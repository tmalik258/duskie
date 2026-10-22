//! Files attached to an Ask question: images go to the model as pictures;
//! text files are read into the question.

use std::path::Path;

/// Text read per file, so one big log cannot crowd out the question.
const MAX_TEXT: usize = 20_000;

/// The PNGs to show the model, and the text to add to the question.
pub fn read(files: &[String]) -> (Vec<Vec<u8>>, String) {
    let mut images = Vec::new();
    let mut text = String::new();
    for f in files {
        let path = Path::new(f);
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy())
            .unwrap_or_default();
        if path
            .extension()
            .is_some_and(|e| e.eq_ignore_ascii_case("png"))
        {
            match std::fs::read(path) {
                Ok(png) => images.push(png),
                Err(_) => text.push_str(&format!("\n\n(Attached image {name} could not be read.)")),
            }
            continue;
        }
        match std::fs::read(path)
            .ok()
            .and_then(|b| String::from_utf8(b).ok())
        {
            Some(body) => {
                let cut: String = body.chars().take(MAX_TEXT).collect();
                let more = if cut.len() < body.len() {
                    "\n…(cut)"
                } else {
                    ""
                };
                text.push_str(&format!("\n\nAttached file {name}:\n```\n{cut}{more}\n```"));
            }
            None => text.push_str(&format!("\n\n(Attached: {name} at {f}, not text.)")),
        }
    }
    (images, text)
}

#[cfg(test)]
mod tests {
    #[test]
    fn reads_text_and_picks_the_image() {
        let dir = std::env::temp_dir().join(format!("duskie-askfiles-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let t = dir.join("notes.txt");
        let p = dir.join("shot.png");
        std::fs::write(&t, "hello").unwrap();
        std::fs::write(&p, [137u8, 80, 78, 71]).unwrap();
        let files = [t.display().to_string(), p.display().to_string()];
        let (image, text) = super::read(&files);
        assert_eq!(image, vec![vec![137u8, 80, 78, 71]]);
        assert!(
            text.contains("notes.txt") && text.contains("hello"),
            "{text}"
        );
        std::fs::remove_dir_all(dir).ok();
    }
}
