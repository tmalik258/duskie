//! Sound effects, played from Duskie's own process (not the WebView) so
//! Windows shows one "Duskie" in the volume mixer and every sound follows
//! the same speaker as the voice.

use std::sync::Arc;

use duskie_voice::fx::{self, Effect, Kit};

use super::CmdResult;

/// Plays a sound: `kind` is "synth" (a Duskie kit sound by name), "settle"
/// (the start-up sound) or "kit" (sound `name` from kit `kit`).
#[tauri::command]
pub async fn play_sfx(
    app: tauri::AppHandle,
    kind: String,
    name: String,
    kit: String,
    volume: f32,
) -> CmdResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        let volume = volume.clamp(0.0, 1.0);
        let played = match kind.as_str() {
            "settle" => fx::play(Effect::Settle, volume),
            "kit" => match load(&app, &kit) {
                Ok(k) => fx::play(Effect::Kit(&k, &name), volume),
                Err(e) => {
                    log::warn!("sound kit {kit}: {e}");
                    fx::play(Effect::Synth(""), volume)
                }
            },
            _ => fx::play(Effect::Synth(&name), volume),
        };
        played.map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Decodes a kit ahead of time; the error, if it cannot load, for Settings.
#[tauri::command]
pub async fn check_kit(app: tauri::AppHandle, kit: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || load(&app, &kit).err())
        .await
        .unwrap_or_else(|e| Some(e.to_string()))
}

/// A kit, decoded once and kept.
fn load(app: &tauri::AppHandle, id: &str) -> Result<Arc<Kit>, String> {
    if let Some(k) = fx::kits().lock().ok().and_then(|m| m.get(id).cloned()) {
        return Ok(k);
    }
    if !id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("bad kit name".into());
    }
    let json: serde_json::Value =
        serde_json::from_slice(&asset(app, &format!("sounds/{id}/sprite.json"))?)
            .map_err(|e| e.to_string())?;
    let map = json["spritemap"]
        .as_object()
        .ok_or("sprite.json has no spritemap")?
        .iter()
        .filter_map(|(k, v)| {
            Some((
                k.clone(),
                (v["start"].as_f64()? as f32, v["end"].as_f64()? as f32),
            ))
        })
        .collect();
    let (samples, rate) =
        fx::decode(asset(app, &format!("sounds/{id}/sprite.ogg"))?).map_err(|e| e.to_string())?;
    let kit = Arc::new(Kit { samples, rate, map });
    if let Ok(mut m) = fx::kits().lock() {
        m.insert(id.to_owned(), kit.clone());
    }
    Ok(kit)
}

/// A file the front end ships in public/: from the bundle, or from the source
/// folder when the dev server serves the front end.
fn asset(app: &tauri::AppHandle, path: &str) -> Result<Vec<u8>, String> {
    if let Some(a) = app.asset_resolver().get(path.to_owned()) {
        return Ok(a.bytes);
    }
    let dev = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../public")
        .join(path);
    std::fs::read(&dev).map_err(|e| format!("{path}: {e}"))
}
