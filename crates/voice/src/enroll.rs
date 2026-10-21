//! Teaching Duskie your voice: you say its name a few times and read a few
//! short sentences. From those it learns how firmly the wake word model
//! hears your "Duskie", and a voiceprint so only your voice wakes it. The
//! clips live in memory only and are dropped once this is done; just the
//! bar and the voiceprint (numbers, not audio) are kept.

use std::path::Path;

use sherpa_onnx::{KeywordSpotter, SpeakerEmbeddingExtractor, SpeakerEmbeddingExtractorConfig};

use crate::listen::{WAKE_THRESHOLD, spotter_config};
use crate::models::{SPEAKER, WAKE};
use crate::{MIC_RATE, Result, VoiceError};

/// Name clips needed, and sentence clips.
pub const NAME_TAKES: usize = 5;
pub const SENTENCE_TAKES: usize = 3;
/// Sentences to read, short and with varied sounds.
pub const SENTENCES: [&str; SENTENCE_TAKES] = [
    "What is on my calendar this afternoon?",
    "Remind me to call the bank tomorrow morning.",
    "Turn on night light and play some quiet music.",
];
/// Voices at least this alike count as the same person (cosine of two
/// CAM++ embeddings against the averaged print). Kept forgiving: a cold or
/// a different microphone must not lock you out.
pub const SAME_VOICE: f32 = 0.5;
/// Keyword bars tried, firmest first. The firmest one that still hears all
/// but one of your takes is kept, so other sounds wake it less.
const BARS: [f32; 6] = [0.3, 0.25, 0.2, 0.15, 0.1, WAKE_THRESHOLD];

/// What was learned. Stored as JSON in the app data folder.
#[derive(Debug, Clone, PartialEq)]
pub struct Profile {
    pub threshold: f32,
    pub print: Vec<f32>,
}

impl Profile {
    pub fn to_json(&self) -> String {
        serde_json::json!({ "threshold": self.threshold, "print": self.print }).to_string()
    }

    pub fn from_json(text: &str) -> Option<Self> {
        let v: serde_json::Value = serde_json::from_str(text).ok()?;
        let threshold = v.get("threshold")?.as_f64()? as f32;
        let print = v
            .get("print")?
            .as_array()?
            .iter()
            .map(|x| x.as_f64().map(|f| f as f32))
            .collect::<Option<Vec<_>>>()?;
        (threshold > 0.0 && threshold < 1.0).then_some(Self { threshold, print })
    }
}

/// Learns your bar and voiceprint from 16 kHz mono clips.
pub fn learn(models: &Path, names: &[Vec<f32>], sentences: &[Vec<f32>]) -> Result<Profile> {
    if names.len() < NAME_TAKES || sentences.len() < SENTENCE_TAKES {
        return Err(VoiceError::Engine("a few takes are missing".into()));
    }
    if !WAKE.installed(models) || !SPEAKER.installed(models) {
        return Err(VoiceError::MissingModels);
    }
    let threshold = calibrate(models, names)?;
    let extractor = extractor(models)?;
    let prints: Vec<Vec<f32>> = names
        .iter()
        .chain(sentences)
        .filter_map(|clip| embed(&extractor, clip))
        .collect();
    if prints.len() < NAME_TAKES {
        return Err(VoiceError::Engine(
            "could not hear your voice clearly".into(),
        ));
    }
    Ok(Profile {
        threshold,
        print: average(&prints),
    })
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

/// A unit-length embedding of `clip`, or None when it is too short.
pub(crate) fn embed(extractor: &SpeakerEmbeddingExtractor, clip: &[f32]) -> Option<Vec<f32>> {
    let stream = extractor.create_stream()?;
    stream.accept_waveform(MIC_RATE as i32, clip);
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

fn average(prints: &[Vec<f32>]) -> Vec<f32> {
    let mut sum = vec![0.0; prints[0].len()];
    for p in prints {
        for (s, x) in sum.iter_mut().zip(p) {
            *s += x;
        }
    }
    unit(&sum)
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
        let p = Profile {
            threshold: 0.2,
            print: vec![0.6, 0.8],
        };
        assert_eq!(Profile::from_json(&p.to_json()), Some(p));
        assert_eq!(Profile::from_json("{\"threshold\":2,\"print\":[]}"), None);
        assert_eq!(Profile::from_json("not json"), None);
    }

    #[test]
    fn similarity_and_average() {
        assert!((similarity(&[1.0, 0.0], &[2.0, 0.0]) - 1.0).abs() < 1e-6);
        assert!(similarity(&[1.0, 0.0], &[0.0, 1.0]).abs() < 1e-6);
        assert_eq!(similarity(&[1.0], &[1.0, 0.0]), 0.0);
        let avg = average(&[vec![1.0, 0.0], vec![0.0, 1.0]]);
        assert!((avg[0] - avg[1]).abs() < 1e-6);
        assert!((similarity(&avg, &avg) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn learning_needs_every_take() {
        let dir = std::env::temp_dir();
        assert!(learn(&dir, &[vec![0.0; 10]], &[]).is_err());
    }
}
