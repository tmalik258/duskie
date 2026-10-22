//! The start-up sound and the fallback tone, ported from the island's Web
//! Audio versions.

use super::Biquad;
use super::synth::{RATE, Wave, envelope, expo, mix_at, wave};

/// A soft 880 Hz blip, for a sound that could not load.
pub fn fallback(volume: f32) -> Vec<f32> {
    let mut buf = Vec::new();
    let n = (0.2 * RATE as f32) as usize;
    let s = (0..n).map(|i| {
        let t = i as f32 / RATE as f32;
        (t * 880.0 * std::f32::consts::TAU).sin() * envelope(t, 0.15 * volume, 0.005, 0.18)
    });
    mix_at(&mut buf, 0.0, s);
    buf
}

/// A machine powering on: a low hum spins up through an opening filter, a
/// faint FM shimmer climbs over it, and one soft ping lands at the end.
pub fn power_up(volume: f32) -> Vec<f32> {
    let n = (0.4 * RATE as f32) as usize;
    let peak = (0.1 * volume).max(0.0002);
    let mut filter = Biquad::default();
    let mut saws = [0.0f32; 2];
    let (mut carrier, mut modulator, mut ping) = (0.0f32, 0.0f32, 0.0f32);
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let t = i as f32 / RATE as f32;
        let rise = t / 0.24;
        // Hum: two detuned saws sweeping up, the filter opening as they rise.
        let mut hum = 0.0;
        for (k, detune) in [-9.0f32, 9.0].into_iter().enumerate() {
            let f = expo(90.0, 260.0, rise) * 2f32.powf(detune / 1200.0);
            saws[k] = (saws[k] + f / RATE as f32).fract();
            hum += wave(Wave::Saw, saws[k]);
        }
        let hum = filter.lowpass(hum, expo(260.0, 2200.0, rise), 5.0);
        // Shimmer: FM with a fast modulator.
        modulator = (modulator + expo(110.0, 340.0, rise) / RATE as f32).fract();
        let depth = 100.0 + 220.0 * rise.min(1.0);
        let f = expo(520.0, 1320.0, rise) + depth * wave(Wave::Sine, modulator);
        carrier = (carrier + f / RATE as f32).rem_euclid(1.0);
        let shimmer = 0.25 * wave(Wave::Sine, carrier);
        // Ready ping once the machine is up.
        let mut bell = 0.0;
        if (0.2..0.38).contains(&t) {
            ping = (ping + 1760.0 / RATE as f32).fract();
            bell = wave(Wave::Triangle, ping) * envelope(t - 0.2, 0.35, 0.01, 0.14);
        }
        let master = if t < 0.05 {
            expo(0.0001, peak, t / 0.05)
        } else if t < 0.2 {
            peak
        } else {
            expo(peak, 0.0001, (t - 0.2) / 0.18)
        };
        out.push((hum + shimmer + bell) * master);
    }
    out
}
