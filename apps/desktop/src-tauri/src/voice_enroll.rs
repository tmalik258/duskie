//! Teach Duskie your voice: records a few short takes from the microphone,
//! learns your wake bar and voiceprint from them, and keeps only that
//! (numbers, never audio). Takes stay in memory and are dropped when done.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use duskie_voice::enroll::{self, NAME_TAKES, SENTENCE_TAKES, SENTENCES};
use duskie_voice::{MIC_RATE, Profile, audio::Mic, models};
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::state::{AppState, lock};

/// Takes recorded so far: the name, then the sentences.
#[derive(Default)]
pub struct Takes {
    names: Vec<Vec<f32>>,
    sentences: Vec<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrollState {
    /// A voice was taught and is in use.
    pub taught: bool,
    /// The name the voice was taught with. Differs from the current name
    /// after a rename, until the new name is taught.
    pub taught_for: Option<String>,
    pub name_takes: usize,
    pub sentence_takes: usize,
    pub names_needed: usize,
    pub sentences: Vec<&'static str>,
}

/// Quieter than this, a take holds no voice.
const VOICE_LEVEL: f32 = 0.01;
/// A take must hold at least this much voice (16 kHz samples).
const MIN_VOICE: usize = MIC_RATE as usize / 4;

fn path(models: &Path) -> PathBuf {
    models.with_file_name("voice-profile.json")
}

/// What was learned, for the assistant called `name`. A renamed assistant
/// has no profile until its new name is taught. `only_me` off keeps the bar
/// but drops the print, so any voice wakes it.
pub fn profile(models: &Path, name: &str, only_me: bool) -> Option<Profile> {
    let mut p = Profile::from_json(&std::fs::read_to_string(path(models)).ok()?)?;
    if !p.name.eq_ignore_ascii_case(name) {
        return None;
    }
    if !only_me || !models::SPEAKER.installed(models) {
        p.print.clear();
    }
    Some(p)
}

fn takes(app: &AppHandle) -> &Mutex<Takes> {
    &app.state::<AppState>().inner().enroll
}

fn models_dir(app: &AppHandle) -> PathBuf {
    app.state::<AppState>().voice.models.clone()
}

pub fn state(app: &AppHandle) -> EnrollState {
    let t = lock(takes(app));
    EnrollState {
        taught: path(&models_dir(app)).exists(),
        taught_for: taught_name(app),
        name_takes: t.names.len(),
        sentence_takes: t.sentences.len(),
        names_needed: NAME_TAKES,
        sentences: SENTENCES.to_vec(),
    }
}

/// Records one take: the name (`sentence` None) or that sentence.
pub fn record(app: &AppHandle, sentence: Option<usize>) -> Result<EnrollState, String> {
    let seconds = if sentence.is_some() { 5.0 } else { 2.5 };
    let clip = capture(Duration::from_secs_f32(seconds))?;
    let clip = trim(&clip).ok_or("Didn't catch that. Try again a little closer to the mic.")?;
    {
        let mut t = lock(takes(app));
        match sentence {
            None if t.names.len() < NAME_TAKES => t.names.push(clip),
            Some(i) if i < SENTENCE_TAKES && t.sentences.len() == i => t.sentences.push(clip),
            _ => {}
        }
    }
    Ok(state(app))
}

fn capture(length: Duration) -> Result<Vec<f32>, String> {
    let (tx, rx) = std::sync::mpsc::sync_channel::<Vec<f32>>(64);
    let mic = Mic::start(tx).map_err(|e| e.to_string())?;
    let started = Instant::now();
    let mut audio = Vec::new();
    while started.elapsed() < length {
        if let Ok(chunk) = rx.recv_timeout(Duration::from_millis(100)) {
            audio.extend(chunk);
        }
    }
    drop(mic);
    Ok(audio)
}

/// Cuts the quiet before and after the voice, keeping a little around it.
/// None when there is too little voice.
fn trim(audio: &[f32]) -> Option<Vec<f32>> {
    const FRAME: usize = MIC_RATE as usize / 50;
    let loud: Vec<bool> = audio
        .chunks(FRAME)
        .map(|f| (f.iter().map(|x| x * x).sum::<f32>() / f.len() as f32).sqrt() >= VOICE_LEVEL)
        .collect();
    let first = loud.iter().position(|&l| l)?;
    let last = loud.iter().rposition(|&l| l)?;
    if loud.iter().filter(|&&l| l).count() * FRAME < MIN_VOICE {
        return None;
    }
    let pad = 10;
    let start = first.saturating_sub(pad) * FRAME;
    let end = ((last + 1 + pad) * FRAME).min(audio.len());
    Some(audio[start..end].to_vec())
}

/// Learns from the takes, saves the result and drops the takes. Fetches
/// the small voice model first if needed.
pub fn finish(app: &AppHandle) -> Result<EnrollState, String> {
    let models = models_dir(app);
    if !models::SPEAKER.installed(&models) {
        let cancel = std::sync::atomic::AtomicBool::new(false);
        models::install(&models::SPEAKER, &models, &cancel, |_, _| {})
            .map_err(|e| e.to_string())?;
    }
    let (names, sentences) = {
        let mut t = lock(takes(app));
        (
            std::mem::take(&mut t.names),
            std::mem::take(&mut t.sentences),
        )
    };
    let name = lock(&app.state::<AppState>().settings)
        .assistant_name
        .clone();
    let learned = enroll::learn(&models, &name, &names, &sentences).map_err(|e| e.to_string())?;
    drop((names, sentences));
    std::fs::write(path(&models), learned.to_json()).map_err(|e| e.to_string())?;
    crate::voice::refresh(app);
    Ok(state(app))
}

/// The name the saved voice was taught with, if any.
pub fn taught_name(app: &AppHandle) -> Option<String> {
    let p = Profile::from_json(&std::fs::read_to_string(path(&models_dir(app))).ok()?)?;
    Some(p.name)
}

/// Drops takes in progress and forgets a taught voice.
pub fn reset(app: &AppHandle) -> EnrollState {
    *lock(takes(app)) = Takes::default();
    let _ = std::fs::remove_file(path(&models_dir(app)));
    crate::voice::refresh(app);
    state(app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trim_keeps_the_voice_and_refuses_silence() {
        let mut audio = vec![0.0; MIC_RATE as usize];
        audio.extend(vec![0.2; MIC_RATE as usize / 2]);
        audio.extend(vec![0.0; MIC_RATE as usize]);
        let t = trim(&audio).unwrap();
        assert!(t.len() < audio.len() && t.len() >= MIC_RATE as usize / 2);
        assert!(trim(&vec![0.001; MIC_RATE as usize]).is_none());
        assert!(trim(&vec![0.2; 100]).is_none());
    }
}
