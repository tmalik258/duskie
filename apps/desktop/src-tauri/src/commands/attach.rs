//! Files pasted, dropped or picked in a chat box, saved where an agent can
//! read them by path.

use super::CmdResult;

/// Saves `data` as `name` in Duskie's attachment folder and returns its path.
#[tauri::command]
pub async fn save_attachment(name: String, data: Vec<u8>) -> CmdResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = std::env::temp_dir().join("duskie-attachments");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join(format!("{}-{}", ulid::Ulid::new(), clean(&name)));
        std::fs::write(&path, data).map_err(|e| e.to_string())?;
        Ok(path.display().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// A file picker opened from the island is up (`open`) or closed.
#[tauri::command]
pub fn island_dialog(app: tauri::AppHandle, open: bool) {
    crate::island::dialog_open(&app, open);
}

/// A file name without separators or spaces, so `@path` stays one word.
fn clean(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if s.trim_matches('_').is_empty() {
        "file".into()
    } else {
        s
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn names_stay_one_word() {
        assert_eq!(super::clean("my shot (1).png"), "my_shot__1_.png");
        assert_eq!(super::clean("a/b"), "a_b");
        assert_eq!(super::clean("   "), "file");
    }
}
