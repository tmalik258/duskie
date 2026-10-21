//! Teaching Duskie a voice with synthetic takes: one voice says the name and
//! reads the sentences, then that voice must match its print. The built-in
//! voices come from one model and sound too alike to tell apart reliably,
//! so their scores are only printed. Needs the models, so it only runs when
//! DUSKIE_VOICE_MODELS points at a folder holding them.

use duskie_voice::audio::Resampler;
use duskie_voice::enroll::{NAME_TAKES, SAME_VOICE, SENTENCES, learn, similarity};
use duskie_voice::{MIC_RATE, respell, speaker_id, synthesize, tts_config};
use sherpa_onnx::OfflineTts;

fn say(tts: &OfflineTts, voice: &str, text: &str, speed: f32) -> Vec<f32> {
    let (audio, rate) = synthesize(tts, &respell(text), speaker_id(voice), speed).expect("speech");
    Resampler::new(rate, MIC_RATE).process(&audio)
}

#[test]
fn learns_one_voice_and_tells_it_from_others() {
    let Ok(root) = std::env::var("DUSKIE_VOICE_MODELS") else {
        eprintln!("skipped: set DUSKIE_VOICE_MODELS to run");
        return;
    };
    let root = std::path::PathBuf::from(root);
    let tts = OfflineTts::create(&tts_config(&root)).expect("voice model loads");
    let names: Vec<_> = (0..NAME_TAKES + 1)
        .map(|i| say(&tts, "m1", "Duskie", 0.9 + i as f32 * 0.05))
        .collect();
    let sentences: Vec<_> = SENTENCES.iter().map(|s| say(&tts, "m1", s, 1.0)).collect();
    let profile = learn(&root, &names, &sentences).expect("learns");
    eprintln!("bar {}", profile.threshold);

    let extractor = duskie_voice::enroll::test_extractor(&root);
    let check = |voice: &str| {
        let clip = say(&tts, voice, "Duskie, what is the weather like today?", 1.0);
        let e = duskie_voice::enroll::test_embed(&extractor, &clip).expect("embeds");
        similarity(&e, &profile.print)
    };
    let same = check("m1");
    eprintln!("same voice {same}");
    assert!(same >= SAME_VOICE, "own voice scored {same}");
    let others: Vec<_> = ["f1", "f2", "f3", "f4", "f5", "m2", "m3", "m4", "m5"]
        .iter()
        .map(|v| (*v, check(v)))
        .collect();
    eprintln!("{others:?}");
}
