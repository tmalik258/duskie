//! The listener: a small keyword model waits for "Duskie"; then a
//! streaming recognizer transcribes until you stop talking. Partial text
//! arrives as you speak, so the island can show it live.

use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::thread::JoinHandle;
use std::time::Duration;

use sherpa_onnx::{
    KeywordSpotter, KeywordSpotterConfig, OfflineModelConfig, OfflineRecognizer,
    OfflineRecognizerConfig, OfflineTransducerModelConfig, OnlineModelConfig, OnlineRecognizer,
    OnlineRecognizerConfig, OnlineStream, OnlineTransducerModelConfig, SpeakerEmbeddingExtractor,
};

use crate::audio::Mic;
use crate::enroll::Profile;
use crate::models::{FINAL, SPEAKER, SPEECH, WAKE};
use crate::{MIC_RATE, Result, VoiceError};

#[derive(Debug, Clone, PartialEq)]
pub enum Heard {
    /// The wake phrase, or a push to talk: listening starts.
    Wake,
    /// Text so far, wake phrase included.
    Partial(String),
    /// The words have not changed for a moment: the question may be done.
    /// An answer can start now and be dropped if more words come.
    Pause(String),
    /// The utterance ended. Empty when nothing was said.
    Final(String),
    /// The microphone or engine failed; the listener has stopped.
    Error(String),
}

#[derive(Debug, Clone, Copy)]
pub enum Control {
    /// Start listening without the wake phrase.
    ListenNow,
    /// Stop listening and go back to waiting for the wake phrase.
    Cancel,
    /// Duskie is speaking (true) or quiet again (false). While muted the
    /// microphone hears the speakers, so nothing it hears counts.
    Mute(bool),
}

#[derive(Debug, Clone)]
pub struct ListenerConfig {
    pub models: PathBuf,
    /// Listen for "Duskie". Off means push to talk only.
    pub wake_word: bool,
    /// Talking over Duskie's voice stops it and starts listening.
    pub interrupt: bool,
    /// What you taught Duskie about your voice, if you did.
    pub profile: Option<Profile>,
}

/// Audio kept from before the wake phrase was recognised, so the first
/// words after it are not lost.
const PRIME: usize = MIC_RATE as usize * 3 / 2;
/// After the wake phrase people pause before the question. Until this much
/// audio has passed, an utterance that is only the wake phrase does not end
/// listening; it waits for the question instead.
const QUESTION_GRACE: usize = MIC_RATE as usize * 8;
/// Longest a question may run: past this, what was heard is taken as said,
/// so steady background noise can never keep it listening.
const MAX_LISTEN: usize = MIC_RATE as usize * 20;
/// Words unchanged this long count as a pause (16 kHz samples).
const PAUSE: usize = MIC_RATE as usize * 35 / 100;
/// A voice must stay this much louder than the speakers' echo for this
/// long to count as talking over Duskie.
const BARGE_RATIO: f32 = 3.0;
const BARGE_MIN_LEVEL: f32 = 0.02;
const BARGE_LENGTH: usize = MIC_RATE as usize / 5;
/// How long the speakers' echo is only listened to before a voice can
/// barge in (16 kHz samples).
const ECHO_LEARN: usize = MIC_RATE as usize / 2;
/// How fast the remembered echo level falls back (per chunk).
const ECHO_DECAY: f32 = 0.97;
/// No audio this long while listening: the microphone stalled; finish.
const STALL: Duration = Duration::from_secs(3);
/// No audio this long at all: the microphone is gone; report it so the app
/// starts it again.
const DEAD: Duration = Duration::from_secs(10);

/// Hears a voice over Duskie's own speech: clearly louder than the
/// loudest recent echo, for long enough to be a voice and not a click. Its
/// echo of the speakers is learned as they play, so a headset barges in
/// easily and loud laptop speakers rarely do.
#[derive(Debug, Default)]
struct Barge {
    echo: f32,
    /// Audio heard since the speakers started; the first moment only
    /// learns how loud their echo is.
    heard: usize,
    /// Audio of the louder voice, while it lasts.
    voice: Vec<f32>,
}

impl Barge {
    fn push(&mut self, chunk: &[f32]) -> bool {
        if chunk.is_empty() {
            return false;
        }
        let level = (chunk.iter().map(|x| x * x).sum::<f32>() / chunk.len() as f32).sqrt();
        if self.heard < ECHO_LEARN {
            self.heard += chunk.len();
            self.echo = self.echo.max(level);
            return false;
        }
        if level > (self.echo * BARGE_RATIO).max(BARGE_MIN_LEVEL) {
            self.voice.extend_from_slice(chunk);
            if self.voice.len() >= BARGE_LENGTH {
                return true;
            }
        } else {
            self.voice.clear();
            self.echo = self.echo.max(level);
        }
        self.echo *= ECHO_DECAY;
        false
    }
}

/// Owns the keyword spotter, the live recognizer, and the final one that
/// confirms each wake and writes the text of each question.
pub struct Engine {
    spotter: Option<(KeywordSpotter, OnlineStream)>,
    recognizer: OnlineRecognizer,
    stream: OnlineStream,
    final_asr: OfflineRecognizer,
    /// Audio of the question so far, for the final recognizer.
    question: Vec<f32>,
    listening: bool,
    recent: VecDeque<f32>,
    last: String,
    /// Audio fed since listening started.
    heard: usize,
    /// While waiting, the speech model transcribes and wakes on the phrase.
    transcript_wake: bool,
    /// Duskie's own voice is playing: audio is dropped, not heard.
    muted: bool,
    /// Samples since the words last changed, and whether that pause was
    /// already reported.
    still: usize,
    paused: bool,
    /// Talking over the speakers wakes it (see [`BARGE_RATIO`]).
    interrupt: bool,
    barge: Barge,
    /// Listening started by talking over the speakers: audio is heard even
    /// though the speakers were playing a moment ago.
    barged: bool,
    /// Your voiceprint: a question in another voice comes out empty.
    you: Option<(SpeakerEmbeddingExtractor, Profile)>,
    /// Audio of the question so far, kept only to judge whose voice it is.
    said: Vec<f32>,
    /// Whose voice the question is, once judged: yours (true) or not.
    judged: Option<bool>,
}

/// The keyword bar, tuned with the wake bench (10 voices, two speeds, 100
/// everyday sentences): with the boost below it caught 92% alone and 92%
/// with the transcript, with no false wakes. Lower gained nothing more.
/// Teaching Duskie your voice sets your own.
pub const WAKE_THRESHOLD: f32 = 0.05;

/// Transcribes a whole clip at once with the final recognizer.
fn offline_text(asr: &OfflineRecognizer, audio: &[f32]) -> String {
    if audio.is_empty() {
        return String::new();
    }
    let stream = asr.create_stream();
    stream.accept_waveform(MIC_RATE as i32, audio);
    asr.decode(&stream);
    stream
        .get_result()
        .map(|r| r.text.trim().to_owned())
        .unwrap_or_default()
}

pub(crate) fn spotter_config(models: &Path, threshold: f32) -> KeywordSpotterConfig {
    KeywordSpotterConfig {
        model_config: model(
            models,
            &WAKE,
            WAKE.files[0],
            WAKE.files[1],
            WAKE.files[2],
            1,
        ),
        max_active_paths: 4,
        keywords_score: 2.5,
        keywords_threshold: threshold,
        num_trailing_blanks: 1,
        keywords_buf: Some(crate::text::wake_keywords(
            std::fs::read(WAKE.path(models).join("bpe.model"))
                .ok()
                .map(|b| crate::text::read_vocab(&b))
                .as_ref(),
        )),
        ..Default::default()
    }
}

fn model(
    dir: &Path,
    model: &crate::models::Model,
    enc: &str,
    dec: &str,
    joi: &str,
    threads: i32,
) -> OnlineModelConfig {
    OnlineModelConfig {
        transducer: OnlineTransducerModelConfig {
            encoder: Some(model.file(dir, enc)),
            decoder: Some(model.file(dir, dec)),
            joiner: Some(model.file(dir, joi)),
        },
        tokens: Some(model.file(dir, "tokens.txt")),
        num_threads: threads,
        provider: Some("cpu".into()),
        ..Default::default()
    }
}

// The engine's default features (16 kHz, 80 bins) are what the models and
// the microphone resampler use, so feat_config is left at its default.
const _: () = assert!(MIC_RATE == 16_000);

impl Engine {
    /// With the wake word on, both the keyword model and the transcript
    /// listen for it: either one wakes Duskie.
    pub fn new(models: &Path, wake_word: bool) -> Result<Self> {
        Self::with_wake(models, wake_word, wake_word)
    }

    /// Uses what was learned when you taught Duskie your voice: your own
    /// wake bar, and with a print only your questions come through.
    pub fn with_profile(models: &Path, wake_word: bool, profile: Option<&Profile>) -> Result<Self> {
        let threshold = profile.map_or(WAKE_THRESHOLD, |p| p.threshold);
        let mut engine = Self::tuned(models, wake_word, wake_word, threshold)?;
        if let Some(p) = profile.filter(|p| !p.print.is_empty())
            && SPEAKER.installed(models)
        {
            engine.you = Some((crate::enroll::extractor(models)?, p.clone()));
        }
        Ok(engine)
    }

    /// `keyword`: the small keyword model. `transcript`: the speech model
    /// runs all the time and wakes on "hey Duskie" in what it hears.
    pub fn with_wake(models: &Path, keyword: bool, transcript: bool) -> Result<Self> {
        Self::tuned(models, keyword, transcript, WAKE_THRESHOLD)
    }

    fn tuned(models: &Path, keyword: bool, transcript: bool, threshold: f32) -> Result<Self> {
        let wake_word = keyword;
        if !SPEECH.installed(models)
            || !FINAL.installed(models)
            || (wake_word && !WAKE.installed(models))
        {
            return Err(VoiceError::MissingModels);
        }
        let spotter = if wake_word {
            let config = spotter_config(models, threshold);
            let spotter = KeywordSpotter::create(&config)
                .ok_or_else(|| VoiceError::Engine("wake word model did not load".into()))?;
            let stream = spotter.create_stream();
            Some((spotter, stream))
        } else {
            None
        };
        let config = OnlineRecognizerConfig {
            model_config: model(
                models,
                &SPEECH,
                "encoder.onnx",
                "decoder.onnx",
                "joiner.onnx",
                2,
            ),
            decoding_method: Some("greedy_search".into()),
            enable_endpoint: true,
            // Give up after 2 s of silence, end 1 s after speech, cap at 30 s.
            // An answer may already start at the pause before that (Heard::Pause).
            rule1_min_trailing_silence: 2.0,
            rule2_min_trailing_silence: 1.0,
            rule3_min_utterance_length: 30.0,
            ..Default::default()
        };
        let recognizer = OnlineRecognizer::create(&config)
            .ok_or_else(|| VoiceError::Engine("speech model did not load".into()))?;
        let stream = recognizer.create_stream();
        let final_asr = OfflineRecognizer::create(&OfflineRecognizerConfig {
            model_config: OfflineModelConfig {
                transducer: OfflineTransducerModelConfig {
                    encoder: Some(FINAL.file(models, "encoder.int8.onnx")),
                    decoder: Some(FINAL.file(models, "decoder.int8.onnx")),
                    joiner: Some(FINAL.file(models, "joiner.int8.onnx")),
                },
                tokens: Some(FINAL.file(models, "tokens.txt")),
                model_type: Some("nemo_transducer".into()),
                num_threads: 2,
                ..Default::default()
            },
            ..Default::default()
        })
        .ok_or_else(|| VoiceError::Engine("final transcript model did not load".into()))?;
        Ok(Self {
            spotter,
            recognizer,
            stream,
            final_asr,
            question: Vec::new(),
            listening: false,
            recent: VecDeque::with_capacity(PRIME + 4096),
            last: String::new(),
            heard: 0,
            transcript_wake: transcript,
            muted: false,
            still: 0,
            paused: false,
            interrupt: false,
            barge: Barge::default(),
            barged: false,
            you: None,
            said: Vec::new(),
            judged: None,
        })
    }

    /// While muted, audio is dropped: the speakers' sound must not wake
    /// Duskie, nor be primed into the next question. Muting also ends
    /// waiting on anything half heard. A push to talk unmutes.
    pub fn set_muted(&mut self, muted: bool) {
        if muted && !self.muted {
            self.reset();
        }
        self.muted = muted;
        self.barged = false;
        self.barge = Barge::default();
    }

    pub fn set_interrupt(&mut self, on: bool) {
        self.interrupt = on;
    }

    fn talks_over(&mut self, chunk: &[f32]) -> bool {
        self.interrupt && self.barge.push(chunk)
    }

    /// Back to waiting, as if just started: nothing heard, nothing pending.
    pub fn reset(&mut self) {
        self.recognizer.reset(&self.stream);
        self.fresh_spotter();
        self.listening = false;
        self.recent.clear();
        self.question.clear();
        self.last.clear();
        self.heard = 0;
    }

    pub fn listening(&self) -> bool {
        self.listening
    }

    /// Starts transcribing now, with the last moment of audio included.
    pub fn listen_now(&mut self) {
        self.muted = false;
        self.start_listening();
        // A press of the mic button is you, whoever is talking.
        self.judged = Some(true);
    }

    pub fn cancel(&mut self) {
        if self.listening {
            self.recognizer.reset(&self.stream);
        }
        self.listening = false;
        self.last.clear();
        self.question.clear();
    }

    /// Ends listening now with what was heard so far (maybe nothing).
    pub fn finish(&mut self) -> Option<Heard> {
        if !self.listening {
            return None;
        }
        let text = self.current_text();
        self.recognizer.reset(&self.stream);
        self.fresh_spotter();
        self.listening = false;
        self.last.clear();
        self.recent.clear();
        self.heard = 0;
        Some(self.end(text))
    }

    fn start_listening(&mut self) {
        self.fresh_spotter();
        self.listening = true;
        self.heard = 0;
        self.still = 0;
        self.paused = false;
        self.last.clear();
        let prime: Vec<f32> = self.recent.iter().copied().collect();
        self.begin_judging(&prime);
        self.recognizer.reset(&self.stream);
        self.stream.accept_waveform(MIC_RATE as i32, &prime);
    }

    /// Feeds 16 kHz mono audio and returns what was heard.
    pub fn feed(&mut self, chunk: &[f32]) -> Vec<Heard> {
        if self.muted && !self.barged {
            if !self.talks_over(chunk) {
                return Vec::new();
            }
            // Only the voice that talked over is primed, not the echo.
            self.recent = std::mem::take(&mut self.barge.voice).into();
            self.barged = true;
            self.start_listening();
            return vec![Heard::Wake];
        }
        let mut out = Vec::new();
        self.recent.extend(chunk.iter().copied());
        while self.recent.len() > PRIME {
            self.recent.pop_front();
        }
        if !self.listening {
            let spotted = self.spot(chunk);
            // The live recognizer hears the wake phrase too, when it is on.
            let heard = self
                .transcript_wake
                .then(|| self.decode(chunk))
                .is_some_and(|text| crate::text::find_wake(&text).is_some());
            if !(spotted || heard) {
                if self.transcript_wake && self.recognizer.is_endpoint(&self.stream) {
                    self.recognizer.reset(&self.stream);
                }
                return out;
            }
            // Only the final recognizer may wake Duskie: a sound that only
            // looks like the phrase is dropped, and what it heard forgotten
            // so it cannot fire again.
            if !self.confirm_wake() {
                self.recognizer.reset(&self.stream);
                self.fresh_spotter();
                return out;
            }
            out.push(Heard::Wake);
            if self.transcript_wake {
                // The transcript already holds the wake audio, so listening
                // just carries on from here.
                let prime: Vec<f32> = self.recent.iter().copied().collect();
                self.begin_judging(&prime);
                // The keyword model may still hold the phrase; it must not
                // fire on it later.
                self.fresh_spotter();
                self.listening = true;
                self.heard = 0;
                self.last.clear();
            } else {
                self.start_listening();
            }
        } else {
            self.decode(chunk);
            self.question.extend_from_slice(chunk);
            if self.you.is_some() && self.judged.is_none() {
                self.said.extend_from_slice(chunk);
            }
            self.heard += chunk.len();
            if self.heard > MAX_LISTEN {
                out.extend(self.finish());
                return out;
            }
        }
        let text = self.current_text();
        if text != self.last {
            self.last = text.clone();
            self.still = 0;
            self.paused = false;
            out.push(Heard::Partial(text.clone()));
        } else if self.listening {
            self.still += chunk.len();
            if !self.paused && self.still >= PAUSE && !crate::text::strip_wake(&text).is_empty() {
                // An answer may start here, so only for your voice; not
                // enough voice yet to tell waits for the end.
                match self.judge(false) {
                    Some(true) => {
                        self.paused = true;
                        out.push(Heard::Pause(text.clone()));
                    }
                    Some(false) => {
                        out.extend(self.finish());
                        return out;
                    }
                    None => {}
                }
            }
        }
        if self.recognizer.is_endpoint(&self.stream) {
            self.recognizer.reset(&self.stream);
            // Only the wake phrase so far: keep listening for the question.
            if crate::text::strip_wake(&text).is_empty() && self.heard < QUESTION_GRACE {
                if !self.last.is_empty() {
                    self.last.clear();
                    out.push(Heard::Partial(String::new()));
                }
                return out;
            }
            self.fresh_spotter();
            self.listening = false;
            self.last.clear();
            // The words just heard must not wake it again.
            self.recent.clear();
            out.push(self.end(text));
        }
        out
    }

    fn begin_judging(&mut self, prime: &[f32]) {
        self.judged = None;
        self.said.clear();
        self.question = prime.to_vec();
        if self.you.is_some() {
            self.said.extend_from_slice(prime);
        }
    }

    /// Whether the question is in your voice. Without a voiceprint every
    /// voice is. None while there is too little voice to tell, unless
    /// `last`: then too little voice counts as not yours.
    fn judge(&mut self, last: bool) -> Option<bool> {
        let Some((extractor, you)) = &self.you else {
            return Some(true);
        };
        if self.judged.is_none() {
            let voice = crate::enroll::voiced(&self.said);
            if voice.len() >= crate::enroll::JUDGE_VOICE || last {
                let score = crate::enroll::embed(extractor, &self.said)
                    .map(|e| (crate::enroll::similarity(&e, &you.print), you.matches(&e)));
                // Shown in the log so a miss is visible: same voice is 0.65 and up.
                log::info!("voice match: {score:?} for {:?}", self.said.len());
                let yours = score.is_some_and(|(_, m)| m);
                self.judged = Some(yours);
                self.said = Vec::new();
            }
        }
        self.judged
    }

    /// The end of a question: someone else's question comes out empty, as
    /// if nothing was said, so it is never answered.
    fn end(&mut self, streamed: String) -> Heard {
        let text = self.final_text(streamed);
        let yours = text.is_empty() || self.judge(true) == Some(true);
        self.judged = None;
        self.said = Vec::new();
        Heard::Final(if yours { text } else { String::new() })
    }

    /// Whether the last moment of audio holds the wake phrase, by the final
    /// recognizer.
    fn confirm_wake(&self) -> bool {
        let audio: Vec<f32> = self.recent.iter().copied().collect();
        crate::text::find_wake(&offline_text(&self.final_asr, &audio)).is_some()
    }

    /// The question as the final recognizer heard it, from the wake phrase
    /// on. The live text stands in if it heard nothing.
    fn final_text(&mut self, streamed: String) -> String {
        let audio = std::mem::take(&mut self.question);
        let text = offline_text(&self.final_asr, &audio);
        let text = match crate::text::find_wake(&text) {
            Some(at) => text[at..].to_owned(),
            None => text,
        };
        if text.is_empty() { streamed } else { text }
    }

    /// A new keyword stream: a reset keeps audio it has buffered, which
    /// could fire the wake word again a moment later.
    fn fresh_spotter(&mut self) {
        if let Some((spotter, kws)) = &mut self.spotter {
            *kws = spotter.create_stream();
        }
    }

    fn decode(&self, chunk: &[f32]) -> String {
        self.stream.accept_waveform(MIC_RATE as i32, chunk);
        while self.recognizer.is_ready(&self.stream) {
            self.recognizer.decode(&self.stream);
        }
        self.raw_text()
    }

    fn raw_text(&self) -> String {
        self.recognizer
            .get_result(&self.stream)
            .map(|r| r.text.trim().to_owned())
            .unwrap_or_default()
    }

    /// What was said from the wake phrase on (words before it are chatter).
    fn current_text(&self) -> String {
        let text = self.raw_text();
        match crate::text::find_wake(&text) {
            Some(at) => text[at..].to_owned(),
            None => text,
        }
    }

    fn spot(&self, chunk: &[f32]) -> bool {
        let Some((spotter, kws)) = &self.spotter else {
            return false;
        };
        kws.accept_waveform(MIC_RATE as i32, chunk);
        let mut found = false;
        while spotter.is_ready(kws) {
            spotter.decode(kws);
            if spotter
                .get_result(kws)
                .is_some_and(|r| !r.keyword.is_empty())
            {
                spotter.reset(kws);
                found = true;
            }
        }
        found
    }
}

/// Runs the microphone and engine on a background thread.
pub struct Listener {
    control: Sender<Control>,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl Listener {
    pub fn start(
        config: ListenerConfig,
        mut on: impl FnMut(Heard) + Send + 'static,
    ) -> Result<Self> {
        let (control, control_rx) = mpsc::channel::<Control>();
        let stop = Arc::new(AtomicBool::new(false));
        let (ready_tx, ready_rx) = mpsc::channel::<Result<()>>();
        let stopped = stop.clone();
        let thread = std::thread::Builder::new()
            .name("sidekick-listener".into())
            .spawn(move || {
                let mut engine = match Engine::with_profile(
                    &config.models,
                    config.wake_word,
                    config.profile.as_ref(),
                ) {
                    Ok(mut e) => {
                        e.set_interrupt(config.interrupt);
                        e
                    }
                    Err(e) => {
                        let _ = ready_tx.send(Err(e));
                        return;
                    }
                };
                let (tx, chunks) = mpsc::sync_channel::<Vec<f32>>(64);
                let mic = match Mic::start(tx) {
                    Ok(m) => m,
                    Err(e) => {
                        let _ = ready_tx.send(Err(e));
                        return;
                    }
                };
                let _ = ready_tx.send(Ok(()));
                let mut last_chunk = std::time::Instant::now();
                while !stopped.load(Ordering::Relaxed) {
                    while let Ok(c) = control_rx.try_recv() {
                        match c {
                            Control::ListenNow => {
                                engine.listen_now();
                                on(Heard::Wake);
                            }
                            Control::Cancel => engine.cancel(),
                            Control::Mute(muted) => engine.set_muted(muted),
                        }
                    }
                    match chunks.recv_timeout(Duration::from_millis(100)) {
                        Ok(chunk) => {
                            last_chunk = std::time::Instant::now();
                            for heard in engine.feed(&chunk) {
                                on(heard);
                            }
                        }
                        Err(RecvTimeoutError::Timeout) => {
                            let quiet = last_chunk.elapsed();
                            if quiet > STALL
                                && let Some(heard) = engine.finish()
                            {
                                on(heard);
                            }
                            if quiet > DEAD {
                                on(Heard::Error("the microphone stopped responding".into()));
                                break;
                            }
                        }
                        Err(RecvTimeoutError::Disconnected) => {
                            on(Heard::Error("the microphone stopped".into()));
                            break;
                        }
                    }
                }
                drop(mic);
            })?;
        ready_rx
            .recv()
            .map_err(|_| VoiceError::Engine("listener thread ended".into()))??;
        Ok(Self {
            control,
            stop,
            thread: Some(thread),
        })
    }

    pub fn send(&self, c: Control) {
        let _ = self.control.send(c);
    }
}

impl Drop for Listener {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone(level: f32, ms: usize) -> Vec<f32> {
        let n = MIC_RATE as usize * ms / 1000;
        (0..n)
            .map(|i| if i % 2 == 0 { level } else { -level })
            .collect()
    }

    fn talks(b: &mut Barge, level: f32, ms: usize) -> bool {
        tone(level, ms).chunks(1600).any(|c| b.push(c))
    }

    #[test]
    fn a_voice_well_over_the_echo_barges_in() {
        let mut b = Barge::default();
        assert!(!talks(&mut b, 0.05, 500), "the echo alone never barges");
        assert!(!talks(&mut b, 0.05, 500));
        assert!(!talks(&mut b, 0.1, 500), "twice the echo is not enough");
        assert!(talks(&mut b, 0.4, 300));
        assert!(b.voice.len() >= BARGE_LENGTH);
    }

    #[test]
    fn a_short_click_does_not_barge() {
        let mut b = Barge::default();
        assert!(!talks(&mut b, 0.05, 500));
        assert!(!talks(&mut b, 0.9, 100));
        assert!(!talks(&mut b, 0.05, 100), "the click ended");
        assert!(b.voice.is_empty());
    }

    #[test]
    fn silence_alone_needs_a_real_voice() {
        let mut b = Barge::default();
        assert!(!talks(&mut b, 0.01, 600), "below the floor");
        assert!(talks(&mut b, 0.1, 300), "a headset voice over quiet");
    }
}
