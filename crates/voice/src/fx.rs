//! Duskie's sound effects, played from its own process so Windows shows one
//! "Duskie" in the volume mixer and the effects follow the same speaker as
//! the voice. Kits are audio sprites (Ogg Vorbis) sliced per sound; the
//! "Duskie" kit and the start-up sound are synthesized in [`synth`].

mod decode;
mod power;
pub mod synth;

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

use crate::audio::Output;
use crate::{Result, VoiceError};

pub use decode::decode;
pub use synth::RATE;

/// A decoded kit: mono samples and where each named sound sits (seconds).
pub struct Kit {
    pub samples: Vec<f32>,
    pub rate: u32,
    pub map: HashMap<String, (f32, f32)>,
}

impl Kit {
    /// One named sound, cut from the sprite.
    pub fn slice(&self, sound: &str) -> Option<&[f32]> {
        let &(start, end) = self.map.get(sound)?;
        let at = |s: f32| ((s * self.rate as f32) as usize).min(self.samples.len());
        self.samples.get(at(start)..at(end))
    }
}

/// A sound effect to play.
pub enum Effect<'a> {
    /// A synthesized sound by name (chirp, pop, tada...).
    Synth(&'a str),
    /// The machine powering on.
    Settle,
    /// A named sound from a decoded kit.
    Kit(&'a Kit, &'a str),
}

/// Renders an effect at `volume`, falling back to a soft tone so feedback
/// never disappears. Returns the samples and their rate.
pub fn render(effect: Effect, volume: f32) -> (Vec<f32>, u32) {
    let fallback = || (power::fallback(volume), RATE);
    match effect {
        Effect::Synth(name) => synth::render(name, volume).map_or_else(fallback, |s| (s, RATE)),
        Effect::Settle => (power::power_up(volume), RATE),
        Effect::Kit(kit, sound) => match kit.slice(sound) {
            Some(s) => (s.iter().map(|x| x * volume).collect(), kit.rate),
            None => fallback(),
        },
    }
}

/// The speaker the effects play on, opened on first use and kept.
fn output() -> Result<&'static Mutex<Option<Output>>> {
    static OUT: OnceLock<Mutex<Option<Output>>> = OnceLock::new();
    let out = OUT.get_or_init(|| Mutex::new(None));
    let mut guard = out
        .lock()
        .map_err(|_| VoiceError::Audio("speaker lock".into()))?;
    if guard.is_none() {
        *guard = Some(Output::start()?);
    }
    Ok(out)
}

/// Plays an effect, mixed over anything already sounding.
pub fn play(effect: Effect, volume: f32) -> Result<()> {
    if volume <= 0.0 {
        return Ok(());
    }
    let (samples, rate) = render(effect, volume);
    let out = output()?;
    if let Ok(guard) = out.lock()
        && let Some(o) = guard.as_ref()
    {
        o.mix(&samples, rate);
    }
    Ok(())
}

/// Kits decoded so far, by id.
pub fn kits() -> &'static Mutex<HashMap<String, Arc<Kit>>> {
    static KITS: OnceLock<Mutex<HashMap<String, Arc<Kit>>>> = OnceLock::new();
    KITS.get_or_init(Default::default)
}

/// Biquad filter (RBJ cookbook), recomputed per sample for sweeps.
#[derive(Default)]
struct Biquad {
    x: [f32; 2],
    y: [f32; 2],
}

impl Biquad {
    fn run(&mut self, input: f32, b: [f32; 3], a: [f32; 3]) -> f32 {
        let out = (b[0] * input + b[1] * self.x[0] + b[2] * self.x[1]
            - a[1] * self.y[0]
            - a[2] * self.y[1])
            / a[0];
        self.x = [input, self.x[0]];
        self.y = [out, self.y[0]];
        out
    }

    fn parts(freq: f32, q: f32) -> (f32, f32) {
        let w = std::f32::consts::TAU * freq.min(RATE as f32 * 0.45) / RATE as f32;
        (w.cos(), w.sin() / (2.0 * q))
    }

    fn bandpass(&mut self, input: f32, freq: f32, q: f32) -> f32 {
        let (cos, alpha) = Self::parts(freq, q);
        self.run(
            input,
            [alpha, 0.0, -alpha],
            [1.0 + alpha, -2.0 * cos, 1.0 - alpha],
        )
    }

    fn lowpass(&mut self, input: f32, freq: f32, q: f32) -> f32 {
        let (cos, alpha) = Self::parts(freq, q);
        let b = (1.0 - cos) / 2.0;
        self.run(
            input,
            [b, 1.0 - cos, b],
            [1.0 + alpha, -2.0 * cos, 1.0 - alpha],
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_kit_sound_renders_quietly() {
        for name in [
            "chirp",
            "pop",
            "coo",
            "tada",
            "fanfare",
            "snore",
            "tap",
            "click",
            "buzz",
            "sigh",
            "doze",
            "shake",
            "tapeOn",
            "tapeOff",
            "startle",
            "askOpen",
            "askClose",
            "agentsOpen",
            "agentsClose",
            "gitOpen",
            "gitClose",
            "settingsOpen",
            "settingsClose",
        ] {
            let s = synth::render(name, 1.0).expect(name);
            assert!(s.len() > 1000, "{name} too short");
            let peak = s.iter().fold(0.0f32, |m, x| m.max(x.abs()));
            assert!(peak > 0.01 && peak < 1.0, "{name} peak {peak}");
        }
        assert!(synth::render("nope", 1.0).is_none());
    }

    #[test]
    fn settle_and_fallback_render() {
        for (s, _) in [
            render(Effect::Settle, 1.0),
            render(Effect::Synth("nope"), 1.0),
        ] {
            let peak = s.iter().fold(0.0f32, |m, x| m.max(x.abs()));
            assert!(peak > 0.01 && peak < 1.0 && peak.is_finite());
        }
    }

    #[test]
    fn slices_a_kit() {
        let kit = Kit {
            samples: vec![0.5; 1000],
            rate: 1000,
            map: [("a".to_owned(), (0.1, 0.3))].into(),
        };
        assert_eq!(kit.slice("a").map(<[f32]>::len), Some(200));
        assert!(kit.slice("b").is_none());
    }
}
