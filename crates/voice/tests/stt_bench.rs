//! Compares speech models on the same spoken questions: word error rate
//! and time per clip. Needs the models, so it only runs when
//! DUSKIE_VOICE_MODELS points at a folder holding them, and with --ignored.

use std::path::Path;
use std::time::Instant;

use duskie_voice::audio::Resampler;
use duskie_voice::{MIC_RATE, VOICES, respell, synthesize, tts_config};
use sherpa_onnx::{
    OfflineModelConfig, OfflineMoonshineModelConfig, OfflineRecognizer, OfflineRecognizerConfig,
    OfflineTransducerModelConfig, OfflineTts, OnlineModelConfig, OnlineRecognizer,
    OnlineRecognizerConfig, OnlineTransducerModelConfig,
};

const QUESTIONS: &[&str] = &[
    "What time is it in London right now?",
    "Open my last email from Sarah.",
    "How long until my next meeting?",
    "Remind me to call the bank tomorrow at nine.",
    "Summarize the pull request on the backend repo.",
    "Turn on night light and lower the volume.",
    "What is the weather like in Lahore this weekend?",
    "Move my four o'clock meeting to Thursday afternoon.",
    "Read me the first three unread messages.",
    "Start a focus session for forty five minutes.",
    "Which branches have new commits upstream?",
    "Translate thank you very much into Spanish.",
];

fn words(s: &str) -> Vec<String> {
    s.to_lowercase()
        .replace("o'clock", "oclock")
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(str::to_owned)
        .collect()
}

/// Word edit distance between `want` and `got`.
fn errors(want: &str, got: &str) -> (usize, usize) {
    let (a, b) = (words(want), words(got));
    let mut row: Vec<usize> = (0..=b.len()).collect();
    for (i, x) in a.iter().enumerate() {
        let mut prev = row[0];
        row[0] = i + 1;
        for (j, y) in b.iter().enumerate() {
            let cur = row[j + 1];
            row[j + 1] = (prev + usize::from(x != y)).min(row[j] + 1).min(cur + 1);
            prev = cur;
        }
    }
    (row[b.len()], a.len())
}

fn file(root: &Path, dir: &str, name: &str) -> Option<String> {
    Some(root.join(dir).join(name).to_string_lossy().into_owned())
}

fn moonshine(root: &Path) -> OfflineRecognizer {
    let dir = "sherpa-onnx-moonshine-base-en-quantized-2026-02-27";
    OfflineRecognizer::create(&OfflineRecognizerConfig {
        model_config: OfflineModelConfig {
            moonshine: OfflineMoonshineModelConfig {
                encoder: file(root, dir, "encoder_model.ort"),
                merged_decoder: file(root, dir, "decoder_model_merged.ort"),
                ..Default::default()
            },
            tokens: file(root, dir, "tokens.txt"),
            num_threads: 2,
            ..Default::default()
        },
        ..Default::default()
    })
    .expect("moonshine loads")
}

fn parakeet(root: &Path) -> OfflineRecognizer {
    let dir = "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8";
    OfflineRecognizer::create(&OfflineRecognizerConfig {
        model_config: OfflineModelConfig {
            transducer: OfflineTransducerModelConfig {
                encoder: file(root, dir, "encoder.int8.onnx"),
                decoder: file(root, dir, "decoder.int8.onnx"),
                joiner: file(root, dir, "joiner.int8.onnx"),
            },
            tokens: file(root, dir, "tokens.txt"),
            model_type: Some("nemo_transducer".into()),
            num_threads: 2,
            ..Default::default()
        },
        ..Default::default()
    })
    .expect("parakeet loads")
}

fn offline(r: &OfflineRecognizer, audio: &[f32]) -> String {
    let s = r.create_stream();
    s.accept_waveform(MIC_RATE as i32, audio);
    r.decode(&s);
    s.get_result().map(|r| r.text).unwrap_or_default()
}

fn kroko(root: &Path) -> OnlineRecognizer {
    let dir = "sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06";
    OnlineRecognizer::create(&OnlineRecognizerConfig {
        model_config: OnlineModelConfig {
            transducer: OnlineTransducerModelConfig {
                encoder: file(root, dir, "encoder.onnx"),
                decoder: file(root, dir, "decoder.onnx"),
                joiner: file(root, dir, "joiner.onnx"),
            },
            tokens: file(root, dir, "tokens.txt"),
            num_threads: 2,
            ..Default::default()
        },
        decoding_method: Some("greedy_search".into()),
        ..Default::default()
    })
    .expect("kroko loads")
}

fn online(r: &OnlineRecognizer, audio: &[f32]) -> String {
    let s = r.create_stream();
    s.accept_waveform(MIC_RATE as i32, audio);
    s.input_finished();
    while r.is_ready(&s) {
        r.decode(&s);
    }
    r.get_result(&s).map(|r| r.text).unwrap_or_default()
}

#[test]
#[ignore = "slow: compares speech models"]
fn compare_speech_models() {
    let Ok(root) = std::env::var("DUSKIE_VOICE_MODELS") else {
        eprintln!("skipped: set DUSKIE_VOICE_MODELS to run");
        return;
    };
    let root = std::path::PathBuf::from(root);
    let tts = OfflineTts::create(&tts_config(&root)).expect("voice model loads");
    let (old, moon, para) = (kroko(&root), moonshine(&root), parakeet(&root));
    let mut totals = [(0usize, 0usize, 0f32); 3];
    let mut seconds = 0.0;
    for (i, q) in QUESTIONS.iter().enumerate() {
        let sid = VOICES[i % VOICES.len()].2;
        let Some((said, rate)) = synthesize(&tts, &respell(q), sid, 1.0) else {
            continue;
        };
        let mut audio = vec![0.0; MIC_RATE as usize / 4];
        audio.extend(Resampler::new(rate, MIC_RATE).process(&said));
        audio.extend(vec![0.0; MIC_RATE as usize / 2]);
        // Room noise, like a fan or a cafe: DUSKIE_BENCH_NOISE is its level.
        let noise: f32 = std::env::var("DUSKIE_BENCH_NOISE")
            .ok()
            .and_then(|n| n.parse().ok())
            .unwrap_or(0.0);
        let mut seed = 0x2545_f491_u32 ^ i as u32;
        for x in &mut audio {
            seed ^= seed << 13;
            seed ^= seed >> 17;
            seed ^= seed << 5;
            *x += noise * (seed as f32 / u32::MAX as f32 * 2.0 - 1.0);
        }
        seconds += audio.len() as f32 / MIC_RATE as f32;
        let runs: [(&str, &dyn Fn() -> String); 3] = [
            ("kroko", &|| online(&old, &audio)),
            ("moonshine", &|| offline(&moon, &audio)),
            ("parakeet", &|| offline(&para, &audio)),
        ];
        for (n, (name, run)) in runs.iter().enumerate() {
            let started = Instant::now();
            let got = run();
            let took = started.elapsed().as_secs_f32();
            let (e, w) = errors(q, &got);
            totals[n].0 += e;
            totals[n].1 += w;
            totals[n].2 += took;
            eprintln!("{name:>10} {took:.2}s {e}/{w}: {}", got.trim());
        }
    }
    for (name, (e, w, t)) in ["kroko", "moonshine", "parakeet"].iter().zip(totals) {
        eprintln!(
            "{name:>10}: WER {:.1}%, real-time factor {:.3}",
            100.0 * e as f32 / w as f32,
            t / seconds
        );
    }
}
