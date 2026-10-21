//! Teaching Duskie your voice: you say its name a few times and read a few
//! short sentences. From those it learns how firmly the wake word model
//! hears your "Duskie", and a voiceprint so only your voice is answered.
//! The takes live in memory only and are dropped once this is done; just
//! the bar and the voiceprint (numbers, not audio) are kept.
//!
//! A voice is judged on the whole question, not on the wake word: a second
//! of audio mostly tells which word was said, while a few seconds tell who
//! said it. For the same reason the print comes from the sentences; the
//! name takes only tune the wake word bar.

use std::path::Path;

use sherpa_onnx::{KeywordSpotter, SpeakerEmbeddingExtractor, SpeakerEmbeddingExtractorConfig};

use crate::listen::{WAKE_THRESHOLD, spotter_config};
use crate::models::{SPEAKER, WAKE};
use crate::{MIC_RATE, Result, VoiceError};

/// Name takes needed, and sentence takes.
pub const NAME_TAKES: usize = 5;
pub const SENTENCE_TAKES: usize = 3;
/// Voiceprints kept. Newer takes push out the oldest, so the print follows
/// how your voice sounds now.
pub const MAX_SAMPLES: usize = 12;
/// Sentences to read, short and with varied sounds.
pub const SENTENCES: [&str; SENTENCE_TAKES] = [
    "What is on my calendar this afternoon?",
    "Remind me to call the bank tomorrow morning.",
    "Turn on night light and play some quiet music.",
];
/// A question at least this alike to the print is yours (cosine of CAM++
/// embeddings). In tests the taught voice's questions scored 0.75 to 0.88
/// and 33 questions in 11 other voices at most 0.63.
pub const SAME_VOICE: f32 = 0.65;
/// Voice needed to judge who spoke before the question ends (16 kHz
/// samples). Less judges poorly; at the end whatever was said is used.
pub const JUDGE_VOICE: usize = MIC_RATE as usize * 2;
/// Keyword bars tried, firmest first. The firmest one that still hears all
/// but one of your takes is kept, so other sounds wake it less.
const BARS: [f32; 6] = [0.3, 0.25, 0.2, 0.15, 0.1, WAKE_THRESHOLD];

/// What was learned. Stored as JSON in the app data folder.
#[derive(Debug, Clone, PartialEq)]
pub struct Profile {
    /// The name it was taught with. A new name needs a new teaching.
    pub name: String,
    /// Keyword bar for the wake word model.
    pub threshold: f32,
    /// The voiceprint: the average of `samples`. Empty when the voice lock
    /// is off.
    pub print: Vec<f32>,
    /// One voiceprint per take, newest last.
    pub samples: Vec<Vec<f32>>,
}

impl Profile {
    pub fn from_samples(name: &str, threshold: f32, samples: Vec<Vec<f32>>) -> Option<Self> {
        let print = average(&samples)?;
        Some(Self {
            name: name.to_owned(),
            threshold,
            print,
            samples,
        })
    }

    pub fn to_json(&self) -> String {
        serde_json::json!({ "name": self.name, "threshold": self.threshold, "samples": self.samples })
            .to_string()
    }

    pub fn from_json(text: &str) -> Option<Self> {
        let v: serde_json::Value = serde_json::from_str(text).ok()?;
        let name = v.get("name")?.as_str()?.to_owned();
        let threshold = v.get("threshold")?.as_f64()? as f32;
        let vector = |x: &serde_json::Value| {
            x.as_array()?
                .iter()
                .map(|f| f.as_f64().map(|f| f as f32))
                .collect::<Option<Vec<f32>>>()
        };
        // Profiles saved before samples were kept hold one print.
        let samples = match v.get("samples") {
            Some(list) => list
                .as_array()?
                .iter()
                .map(vector)
                .collect::<Option<Vec<_>>>()?,
            None => vec![vector(v.get("print")?)?],
        };
        if !(threshold > 0.0 && threshold < 1.0) {
            return None;
        }
        let samples: Vec<Vec<f32>> = samples.into_iter().rev().take(MAX_SAMPLES).rev().collect();
        Self::from_samples(&name, threshold, samples)
    }

    /// Whether `voice` (an embedding from [`embed`]) is yours.
    pub fn matches(&self, voice: &[f32]) -> bool {
        similarity(voice, &self.print) >= SAME_VOICE
    }
}

/// Learns your bar and voiceprint from 16 kHz mono takes.
pub fn learn(
    models: &Path,
    name: &str,
    names: &[Vec<f32>],
    sentences: &[Vec<f32>],
) -> Result<Profile> {
    if names.len() < NAME_TAKES || sentences.len() < SENTENCE_TAKES {
        return Err(VoiceError::Engine("a few takes are missing".into()));
    }
    if !WAKE.installed(models) || !SPEAKER.installed(models) {
        return Err(VoiceError::MissingModels);
    }
    let threshold = calibrate(models, names)?;
    let extractor = extractor(models)?;
    let prints: Vec<Vec<f32>> = sentences
        .iter()
        .filter_map(|clip| embed(&extractor, clip))
        .collect();
    if prints.len() < SENTENCE_TAKES {
        return Err(VoiceError::Engine(
            "could not hear your voice clearly".into(),
        ));
    }
    Profile::from_samples(name, threshold, prints)
        .ok_or_else(|| VoiceError::Engine("could not hear your voice clearly".into()))
}

/// Adds takes to a learned profile: their voiceprints join the kept ones,
/// and the oldest go once there are more than [`MAX_SAMPLES`].
pub fn add_samples(models: &Path, profile: &Profile, sentences: &[Vec<f32>]) -> Result<Profile> {
    if !SPEAKER.installed(models) {
        return Err(VoiceError::MissingModels);
    }
    let extractor = extractor(models)?;
    let mut samples = profile.samples.clone();
    samples.extend(sentences.iter().filter_map(|clip| embed(&extractor, clip)));
    if samples.len() == profile.samples.len() {
        return Err(VoiceError::Engine(
            "could not hear your voice clearly".into(),
        ));
    }
    let samples: Vec<Vec<f32>> = samples.into_iter().rev().take(MAX_SAMPLES).rev().collect();
    Profile::from_samples(&profile.name, profile.threshold, samples)
        .ok_or_else(|| VoiceError::Engine("could not hear your voice clearly".into()))
}

/// The firmest bar at which the wake model still hears all but one take.
fn calibrate(models: &Path, names: &[Vec<f32>]) -> Result<f32> {
    let need = names.len().saturating_sub(1).max(1);
    for bar in BARS {
        let spotter = KeywordSpotter::create(&spotter_config(models, bar))
            .ok_or_else(|| VoiceError::Engine("wake word model did not load".into()))?;
        let heard = names.iter().filter(|clip| spots(&spotter, clip)).count();
        if heard >= need {
            return Ok(bar);
        }
    }
    Ok(WAKE_THRESHOLD)
}

fn spots(spotter: &KeywordSpotter, clip: &[f32]) -> bool {
    let stream = spotter.create_stream();
    stream.accept_waveform(MIC_RATE as i32, clip);
    // Trailing quiet lets the last word finish decoding.
    stream.accept_waveform(MIC_RATE as i32, &vec![0.0; MIC_RATE as usize / 2]);
    stream.input_finished();
    let mut found = false;
    while spotter.is_ready(&stream) {
        spotter.decode(&stream);
        if spotter
            .get_result(&stream)
            .is_some_and(|r| !r.keyword.is_empty())
        {
            spotter.reset(&stream);
            found = true;
        }
    }
    found
}

pub(crate) fn extractor(models: &Path) -> Result<SpeakerEmbeddingExtractor> {
    SpeakerEmbeddingExtractor::create(&SpeakerEmbeddingExtractorConfig {
        model: Some(SPEAKER.file(models, SPEAKER.files[0])),
        num_threads: 1,
        provider: Some("cpu".into()),
        ..Default::default()
    })
    .ok_or_else(|| VoiceError::Engine("voice model did not load".into()))
}

/// Only the voiced parts of `audio`: quiet frames say nothing about who
/// spoke and, around a short wake word, would swamp the voice.
pub(crate) fn voiced(audio: &[f32]) -> Vec<f32> {
    const FRAME: usize = MIC_RATE as usize / 50;
    let level = |f: &[f32]| (f.iter().map(|x| x * x).sum::<f32>() / f.len() as f32).sqrt();
    let peak = audio.chunks(FRAME).map(level).fold(0.0, f32::max);
    let floor = (peak * 0.1).max(0.003);
    audio
        .chunks(FRAME)
        .filter(|f| level(f) >= floor)
        .flatten()
        .copied()
        .collect()
}

/// A unit-length embedding of the voice in `clip`, or None when there is
/// too little of it.
pub(crate) fn embed(extractor: &SpeakerEmbeddingExtractor, clip: &[f32]) -> Option<Vec<f32>> {
    let clip = voiced(clip);
    if clip.len() < MIC_RATE as usize / 8 {
        return None;
    }
    let stream = extractor.create_stream()?;
    stream.accept_waveform(MIC_RATE as i32, &clip);
    stream.input_finished();
    if !extractor.is_ready(&stream) {
        return None;
    }
    extractor.compute(&stream).map(|e| unit(&e))
}

fn unit(v: &[f32]) -> Vec<f32> {
    let n = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if n == 0.0 {
        return v.to_vec();
    }
    v.iter().map(|x| x / n).collect()
}

fn average(prints: &[Vec<f32>]) -> Option<Vec<f32>> {
    let first = prints.first()?;
    let mut sum = vec![0.0; first.len()];
    for p in prints {
        if p.len() != sum.len() {
            return None;
        }
        for (s, x) in sum.iter_mut().zip(p) {
            *s += x;
        }
    }
    Some(unit(&sum))
}

#[doc(hidden)]
pub fn test_extractor(models: &Path) -> SpeakerEmbeddingExtractor {
    extractor(models).expect("voice model loads")
}

#[doc(hidden)]
pub fn test_embed(extractor: &SpeakerEmbeddingExtractor, clip: &[f32]) -> Option<Vec<f32>> {
    embed(extractor, clip)
}

/// Cosine similarity of two embeddings.
pub fn similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let n = |v: &[f32]| v.iter().map(|x| x * x).sum::<f32>().sqrt();
    let d = n(a) * n(b);
    if d == 0.0 { 0.0 } else { dot / d }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_round_trips_and_rejects_nonsense() {
        let p = Profile::from_samples("Duskie", 0.2, vec![vec![0.6, 0.8]]).unwrap();
        assert!(p.matches(&[0.6, 0.8]));
        assert!(!p.matches(&[0.8, -0.6]));
        assert_eq!(Profile::from_json(&p.to_json()), Some(p));
        assert_eq!(Profile::from_json("{\"threshold\":2,\"samples\":[]}"), None);
        assert_eq!(
            Profile::from_json("{\"threshold\":0.2,\"samples\":[]}"),
            None
        );
        assert_eq!(Profile::from_json("not json"), None);
    }

    #[test]
    fn old_profiles_hold_one_print_and_samples_are_capped() {
        let old = Profile::from_json("{\"name\":\"Duskie\",\"threshold\":0.2,\"print\":[0.6,0.8]}")
            .unwrap();
        assert_eq!(old.samples, vec![vec![0.6, 0.8]]);
        let many: Vec<Vec<f32>> = (0..MAX_SAMPLES + 3).map(|i| vec![1.0, i as f32]).collect();
        let p = Profile::from_samples("Duskie", 0.2, many.clone()).unwrap();
        let back = Profile::from_json(&p.to_json()).unwrap();
        assert_eq!(back.samples.len(), MAX_SAMPLES);
        assert_eq!(back.samples.last(), many.last());
    }

    #[test]
    fn voiced_drops_the_quiet() {
        let mut audio = vec![0.0; 1600];
        audio.extend(vec![0.3; 3200]);
        audio.extend(vec![0.001; 1600]);
        assert_eq!(voiced(&audio).len(), 3200);
        assert!(voiced(&[0.0; 1600]).is_empty());
    }

    #[test]
    fn similarity_and_average() {
        assert!((similarity(&[1.0, 0.0], &[2.0, 0.0]) - 1.0).abs() < 1e-6);
        assert!(similarity(&[1.0, 0.0], &[0.0, 1.0]).abs() < 1e-6);
        assert_eq!(similarity(&[1.0], &[1.0, 0.0]), 0.0);
        let avg = average(&[vec![1.0, 0.0], vec![0.0, 1.0]]).unwrap();
        assert!((avg[0] - avg[1]).abs() < 1e-6);
        assert!((similarity(&avg, &avg) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn learning_needs_every_take() {
        let dir = std::env::temp_dir();
        assert!(learn(&dir, "Duskie", &[vec![0.0; 10]], &[]).is_err());
    }
}
