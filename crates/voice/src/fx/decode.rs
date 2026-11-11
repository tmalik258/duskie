//! Decodes a kit's Ogg Vorbis sprite into mono samples.

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

use crate::{Result, VoiceError};

fn err(e: impl std::fmt::Display) -> VoiceError {
    VoiceError::Audio(format!("sound kit: {e}"))
}

/// Ogg Vorbis bytes to mono samples and their rate.
pub fn decode(bytes: Vec<u8>) -> Result<(Vec<f32>, u32)> {
    let source = MediaSourceStream::new(Box::new(std::io::Cursor::new(bytes)), Default::default());
    let mut hint = Hint::new();
    hint.with_extension("ogg");
    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            source,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(err)?;
    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| err("no audio track"))?;
    let id = track.id;
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(err)?;
    let (mut mono, mut rate) = (Vec::new(), 0);
    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(Error::IoError(_)) => break,
            Err(e) => return Err(err(e)),
        };
        if packet.track_id() != id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(Error::DecodeError(_)) => continue,
            Err(e) => return Err(err(e)),
        };
        let spec = *decoded.spec();
        rate = spec.rate;
        let channels = spec.channels.count().max(1);
        let mut buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        buf.copy_interleaved_ref(decoded);
        mono.extend(
            buf.samples()
                .chunks(channels)
                .map(|f| f.iter().sum::<f32>() / channels as f32),
        );
    }
    if mono.is_empty() {
        return Err(err("no samples"));
    }
    Ok((mono, rate))
}

#[cfg(test)]
mod tests {
    #[test]
    fn decodes_the_bundled_kits() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../apps/desktop/public/sounds");
        let Ok(dirs) = std::fs::read_dir(&root) else {
            return;
        };
        for dir in dirs.flatten() {
            let bytes = std::fs::read(dir.path().join("sprite.ogg")).expect("sprite.ogg");
            let (samples, rate) = super::decode(bytes).expect("decodes");
            assert!(
                rate >= 8000 && samples.len() > rate as usize,
                "{:?}",
                dir.path()
            );
        }
    }
}
