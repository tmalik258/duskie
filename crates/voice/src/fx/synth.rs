//! The "Duskie" sound kit, rendered to samples: short, soft tones made on
//! the fly, ported from the island's Web Audio synth so they play from
//! Duskie's own process.

use std::f32::consts::TAU;

/// The rate every sound here is rendered at.
pub const RATE: u32 = 48_000;

#[derive(Clone, Copy)]
pub(super) enum Wave {
    Sine,
    Triangle,
    Saw,
}

enum Op {
    /// From, to (Hz), length, wave, loudness, start (s).
    Tone(f32, f32, f32, Wave, f32, f32),
    /// Length, filter from (Hz), loudness, start, filter to, Q.
    Noise(f32, f32, f32, f32, f32, f32),
}

use Op::{Noise, Tone};
use Wave::{Sine, Triangle};

fn tone(f1: f32, f2: f32, dur: f32, vol: f32, at: f32) -> Op {
    Tone(f1, f2, dur, Sine, vol, at)
}

/// Three notes, one after another.
fn chord(fs: [f32; 3], f: impl Fn(usize, f32) -> Op) -> Vec<Op> {
    fs.iter().enumerate().map(|(i, &x)| f(i, x)).collect()
}

fn ops(name: &str) -> Option<Vec<Op>> {
    Some(match name {
        "chirp" => vec![
            tone(900., 1500., 0.08, 0.14, 0.),
            tone(1300., 1900., 0.07, 0.12, 0.09),
        ],
        "pop" => vec![
            tone(520., 1180., 0.09, 0.26, 0.),
            Noise(0.03, 2600., 0.05, 0., 2600., 1.),
        ],
        "coo" => vec![
            tone(540., 760., 0.16, 0.14, 0.),
            tone(760., 700., 0.18, 0.11, 0.15),
        ],
        "cooSoft" => vec![tone(620., 760., 0.22, 0.1, 0.)],
        "sparkle" => chord([1568., 2093., 2637.], |i, f| {
            tone(f, f * 1.005, 0.14, 0.08, i as f32 * 0.06)
        }),
        "mwah" => vec![
            Noise(0.04, 2400., 0.12, 0., 1800., 2.),
            tone(660., 420., 0.14, 0.12, 0.03),
        ],
        "hello" => vec![
            tone(587., 622., 0.11, 0.14, 0.),
            tone(784., 830., 0.18, 0.14, 0.13),
        ],
        "hmm" => vec![
            tone(240., 252., 0.26, 0.12, 0.),
            tone(252., 226., 0.26, 0.1, 0.26),
        ],
        "hmmUp" => vec![tone(320., 520., 0.26, 0.12, 0.)],
        "gasp" => vec![
            Noise(0.14, 2000., 0.1, 0., 3800., 1.5),
            tone(520., 880., 0.12, 0.1, 0.),
        ],
        "tada" => chord([523., 659., 784.], |i, f| {
            tone(f, f, if i == 2 { 0.38 } else { 0.1 }, 0.12, i as f32 * 0.09)
        }),
        "fanfare" => {
            let mut v = chord([523., 659., 784.], |i, f| {
                Tone(f, f, 0.1, Triangle, 0.09, i as f32 * 0.09)
            });
            v.push(tone(1047., 1047., 0.45, 0.1, 0.27));
            v
        }
        "sad" => vec![
            tone(440., 420., 0.2, 0.1, 0.),
            tone(392., 370., 0.2, 0.1, 0.22),
            tone(330., 300., 0.4, 0.1, 0.44),
        ],
        "uhoh" => vec![
            tone(620., 610., 0.1, 0.12, 0.),
            tone(460., 440., 0.2, 0.12, 0.13),
        ],
        "yawn" => vec![
            tone(300., 520., 0.35, 0.1, 0.),
            tone(520., 240., 0.6, 0.1, 0.33),
        ],
        "snore" => vec![Noise(0.9, 380., 0.08, 0., 240., 3.)],
        "focus" => vec![
            tone(330., 330., 0.5, 0.07, 0.),
            tone(495., 495., 0.5, 0.05, 0.05),
        ],
        "open" => vec![
            tone(520., 880., 0.09, 0.12, 0.),
            tone(880., 1180., 0.09, 0.1, 0.1),
        ],
        "disconnect" => vec![
            tone(740., 494., 0.14, 0.11, 0.),
            tone(494., 330., 0.22, 0.11, 0.15),
        ],
        "reconnect" => vec![
            tone(494., 740., 0.1, 0.11, 0.),
            tone(740., 988., 0.18, 0.11, 0.11),
        ],
        "buzz" => vec![Tone(300., 200., 0.2, Triangle, 0.1, 0.)],
        "click" => vec![
            tone(2200., 1500., 0.05, 0.16, 0.),
            Noise(0.02, 3500., 0.05, 0., 3500., 1.),
        ],
        "tap" => vec![Noise(0.06, 2200., 0.16, 0., 1600., 1.2)],
        "down" => vec![tone(880., 560., 0.08, 0.12, 0.)],
        _ => return None,
    })
}

/// A synthesized sound at `volume`, or None for an unknown name.
pub fn render(name: &str, volume: f32) -> Option<Vec<f32>> {
    let ops = ops(name)?;
    let mut buf = Vec::new();
    for op in ops {
        match op {
            Tone(f1, f2, dur, wave, vol, at) => {
                add_tone(&mut buf, (f1, f2), dur, wave, vol * volume, at)
            }
            Noise(dur, f1, vol, at, f2, q) => {
                add_noise(&mut buf, (f1, f2), dur, vol * volume, at, q)
            }
        }
    }
    Some(buf)
}

/// Web Audio's exponential ramp from `a` to `b`, `x` from 0 to 1.
pub(super) fn expo(a: f32, b: f32, x: f32) -> f32 {
    a * (b / a).powf(x.clamp(0.0, 1.0))
}

/// Rise to `peak` by `rise` seconds, then fall to silence at `end`.
pub(super) fn envelope(t: f32, peak: f32, rise: f32, end: f32) -> f32 {
    let peak = peak.max(0.0002);
    if t < rise {
        expo(0.0001, peak, t / rise)
    } else {
        expo(peak, 0.0001, (t - rise) / (end - rise))
    }
}

pub(super) fn wave(w: Wave, phase: f32) -> f32 {
    match w {
        Wave::Sine => (phase * TAU).sin(),
        Wave::Triangle => 1.0 - 4.0 * (phase - 0.5).abs(),
        Wave::Saw => 2.0 * phase - 1.0,
    }
}

/// Adds `samples` into `buf` starting at `at` seconds.
pub(super) fn mix_at(buf: &mut Vec<f32>, at: f32, samples: impl Iterator<Item = f32>) {
    let start = (at * RATE as f32) as usize;
    for (i, s) in samples.enumerate() {
        if buf.len() <= start + i {
            buf.resize(start + i + 1, 0.0);
        }
        buf[start + i] += s;
    }
}

fn add_tone(buf: &mut Vec<f32>, (f1, f2): (f32, f32), dur: f32, w: Wave, peak: f32, at: f32) {
    let n = ((dur + 0.02) * RATE as f32) as usize;
    let mut phase = 0.0f32;
    let samples = (0..n).map(|i| {
        let t = i as f32 / RATE as f32;
        let f = expo(f1, f2.max(20.0), t / dur);
        phase = (phase + f / RATE as f32).fract();
        wave(w, phase) * envelope(t, peak, 0.02f32.min(dur / 3.0), dur)
    });
    mix_at(buf, at, samples);
}

fn add_noise(buf: &mut Vec<f32>, (f1, f2): (f32, f32), dur: f32, peak: f32, at: f32, q: f32) {
    let n = (dur * RATE as f32) as usize;
    let mut seed = 0x9E37_79B9u32;
    let mut filter = super::Biquad::default();
    let samples = (0..n).map(|i| {
        let t = i as f32 / RATE as f32;
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        let white = seed as f32 / u32::MAX as f32 * 2.0 - 1.0;
        let band = filter.bandpass(white, expo(f1, f2, t / dur), q);
        band * envelope(t, peak, 0.01, dur)
    });
    mix_at(buf, at, samples);
}
