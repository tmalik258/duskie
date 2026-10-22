//! Images pasted into an agent chat travel as `@path` references. Claude Code
//! and Codex also get them as real pictures, so they see them without a read.

use std::path::PathBuf;

/// PNG uploads referenced in `text` that still exist.
pub(super) fn attached(text: &str) -> Vec<PathBuf> {
    let re = regex::Regex::new(r#"@"([^"]+)"|@(\S+)"#).expect("valid pattern");
    re.captures_iter(text)
        .filter_map(|c| c.get(1).or_else(|| c.get(2)).map(|m| m.as_str().to_owned()))
        .filter(|p| p.contains("duskie-attachments") && p.to_lowercase().ends_with(".png"))
        .map(PathBuf::from)
        .filter(|p| p.is_file())
        .collect()
}

/// Claude Code's stream-json content: the text, then each image inline.
pub(super) fn claude_content(text: &str) -> serde_json::Value {
    use base64::Engine;
    let mut parts = vec![serde_json::json!({ "type": "text", "text": text })];
    for p in attached(text) {
        if let Ok(png) = std::fs::read(&p) {
            let data = base64::engine::general_purpose::STANDARD.encode(png);
            parts.push(serde_json::json!({
                "type": "image",
                "source": { "type": "base64", "media_type": "image/png", "data": data },
            }));
        }
    }
    serde_json::Value::Array(parts)
}

/// Codex's turn input: the text, then each image as a local file.
pub(super) fn codex_input(text: &str) -> serde_json::Value {
    let mut parts = vec![serde_json::json!({ "type": "text", "text": text })];
    for p in attached(text) {
        parts.push(serde_json::json!({ "type": "localImage", "path": p.to_string_lossy() }));
    }
    serde_json::Value::Array(parts)
}

#[cfg(test)]
mod tests {
    #[test]
    fn finds_only_existing_png_uploads() {
        let dir = std::env::temp_dir().join("duskie-attachments");
        std::fs::create_dir_all(&dir).unwrap();
        let png = dir.join(format!("test-{}.png", std::process::id()));
        std::fs::write(&png, [137u8, 80, 78, 71]).unwrap();
        let text = format!(
            "look @{} and @src/a.png and @\"{}/gone.png\"",
            png.display(),
            dir.display()
        );
        assert_eq!(super::attached(&text), vec![png.clone()]);
        assert_eq!(super::codex_input(&text).as_array().unwrap().len(), 2);
        std::fs::remove_file(png).ok();
    }
}
