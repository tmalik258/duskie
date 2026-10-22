//! The text on screen, read with OCR and cached for a short while.

use super::*;

/// The text in a screenshot, read on this PC with Tesseract.
/// Screen text read in the background when Ask opened: (window pid, when,
/// text). Only kept in memory, and only briefly.
pub(super) static SCREEN_CACHE: std::sync::Mutex<
    Option<(Option<u32>, std::time::Instant, String)>,
> = std::sync::Mutex::new(None);
/// Background screen text older than this is read again.
pub(super) const SCREEN_FRESH: std::time::Duration = std::time::Duration::from_secs(90);

pub(super) fn last_pid(app: &AppHandle) -> Option<u32> {
    lock(&app.state::<AppState>().last_window)
        .as_ref()
        .and_then(|w| w["pid"].as_u64())
        .and_then(|p| u32::try_from(p).ok())
}

/// The screen text read when Ask opened, while it is still about the same
/// window.
pub fn cached_screen(app: &AppHandle) -> Option<String> {
    let pid = last_pid(app);
    let cache = SCREEN_CACHE.lock().ok()?;
    let (p, at, text) = cache.as_ref()?;
    (*p == pid && at.elapsed() < SCREEN_FRESH).then(|| text.clone())
}

/// Reads the screen text in the background, so a question about the
/// screen does not wait for the capture and OCR.
pub async fn prefetch_screen(app: &AppHandle) {
    if cached_screen(app).is_some() {
        return;
    }
    let pid = last_pid(app);
    let Ok(png) = crate::ai::screenshot(app).await else {
        return;
    };
    if let Ok(text) = screen_text(app, &png).await
        && let Ok(mut cache) = SCREEN_CACHE.lock()
    {
        *cache = Some((pid, std::time::Instant::now(), text));
    }
}

/// The text of the window the user was in: the background read when it is
/// fresh, else a new capture.
pub async fn screen_now(app: &AppHandle) -> Result<String, String> {
    if let Some(text) = cached_screen(app) {
        return Ok(text);
    }
    let png = crate::ai::screenshot(app)
        .await
        .map_err(|e| format!("could not capture the screen: {e}"))?;
    screen_text(app, &png).await
}

pub async fn screen_text(app: &AppHandle, png: &[u8]) -> Result<String, String> {
    let state = app.state::<AppState>();
    std::fs::create_dir_all(&state.scratch_dir).map_err(|e| e.to_string())?;
    let path = state.scratch_dir.join("screen-ocr.png");
    std::fs::write(&path, png).map_err(|e| e.to_string())?;
    let exec = executor(&state);
    let text = exec.read_text(&path).await.map_err(|e| e.to_string());
    let _ = std::fs::remove_file(&path);
    Ok(clip(&text?, MAX_SCREEN_TEXT))
}
