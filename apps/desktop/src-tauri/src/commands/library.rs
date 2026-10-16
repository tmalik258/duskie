//! The skills library: skills found in Claude Code and Codex folders, copied
//! into one place, then written back to each tool the user switched on.
//! Nothing in a skill runs here; files are only copied and hashed.

use std::path::PathBuf;

use duskie_skills::library::{self, Entry, Found, Library, Origin, SyncReport, Target};

use super::*;

fn home() -> PathBuf {
    dirs::home_dir().unwrap_or_default()
}

fn target_dir(t: Target) -> Option<PathBuf> {
    match t {
        Target::Claude => Some(home().join(".claude").join("skills")),
        Target::Codex => Some(home().join(".codex").join("skills")),
        // The library itself is what the local model reads.
        Target::Local => None,
    }
}

pub(crate) fn library_of(app: &AppHandle) -> CmdResult<Library> {
    app.path()
        .app_data_dir()
        .map(|d| Library::new(d.join("skills-library")))
        .map_err(|e| e.to_string())
}

fn entries(lib: &Library) -> Vec<Entry> {
    lib.load().skills.into_values().collect()
}

/// Everything on this PC that is not in the library yet, or differs from it.
fn review_now(lib: &Library) -> Vec<Found> {
    let h = home();
    let all = library::dedupe(
        [
            library::scan(&h.join(".claude").join("skills"), Origin::Claude),
            library::scan_plugins(&h.join(".claude").join("plugins")),
            library::scan(&h.join(".codex").join("skills"), Origin::Codex),
        ]
        .concat(),
    );
    let have = lib.load().skills;
    all.into_iter()
        .filter(|f| {
            have.get(&f.name)
                .is_none_or(|e| e.hash != f.hash && !e.synced.values().any(|h| *h == f.hash))
        })
        .collect()
}

#[tauri::command]
pub async fn library_review(app: AppHandle) -> CmdResult<Vec<Found>> {
    let lib = library_of(&app)?;
    off_ui(move || review_now(&lib)).await
}

#[tauri::command]
pub async fn library_list(app: AppHandle) -> CmdResult<Vec<Entry>> {
    let lib = library_of(&app)?;
    off_ui(move || entries(&lib)).await
}

#[tauri::command]
pub async fn library_import(app: AppHandle, names: Vec<String>) -> CmdResult<Vec<Entry>> {
    let lib = library_of(&app)?;
    off_ui(move || {
        for f in review_now(&lib).iter().filter(|f| names.contains(&f.name)) {
            lib.import(f).map_err(|e| e.to_string())?;
        }
        Ok(entries(&lib))
    })
    .await?
}

#[tauri::command]
pub fn library_set_target(
    app: AppHandle,
    name: String,
    target: Target,
    on: bool,
) -> CmdResult<Vec<Entry>> {
    let lib = library_of(&app)?;
    lib.set_target(&name, target, on)
        .map_err(|e| e.to_string())?;
    Ok(entries(&lib))
}

#[tauri::command]
pub fn library_remove(app: AppHandle, name: String) -> CmdResult<Vec<Entry>> {
    let lib = library_of(&app)?;
    lib.remove(&name).map_err(|e| e.to_string())?;
    Ok(entries(&lib))
}

/// Writes the library to every tool. Copies the user changed by hand are
/// reported as conflicts and left alone; anything replaced is backed up.
#[tauri::command]
pub async fn library_sync(app: AppHandle) -> CmdResult<SyncReport> {
    let lib = library_of(&app)?;
    off_ui(move || {
        let mut all = SyncReport::default();
        for t in library::TARGETS {
            let Some(dir) = target_dir(t) else { continue };
            let r = lib.sync(t, &dir).map_err(|e| e.to_string())?;
            all.written.extend(r.written);
            all.conflicts.extend(r.conflicts);
            all.backups.extend(r.backups);
        }
        Ok(all)
    })
    .await?
}

pub const FOUND_EVENT: &str = "library://found";
/// How often the skill folders are looked at again.
const WATCH_EVERY: std::time::Duration = std::time::Duration::from_secs(600);

/// Names in `found` not told before; adds them to `told`.
pub fn fresh(found: &[Found], told: &mut std::collections::BTreeSet<String>) -> Vec<String> {
    found
        .iter()
        .filter(|f| told.insert(format!("{}:{}", f.name, f.hash)))
        .map(|f| f.name.clone())
        .collect()
}

/// Looks at the skill folders now and then and says once per new skill
/// that it can be added. Nothing is imported without a tap.
pub fn library_watch(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let a = app.clone();
            let _ = off_ui(move || {
                let Ok(lib) = library_of(&a) else { return };
                let path = lib.root.join("told.json");
                let mut told: std::collections::BTreeSet<String> = std::fs::read(&path)
                    .ok()
                    .and_then(|b| serde_json::from_slice(&b).ok())
                    .unwrap_or_default();
                let names = fresh(&review_now(&lib), &mut told);
                if names.is_empty() {
                    return;
                }
                let _ = std::fs::create_dir_all(&lib.root);
                if let Ok(b) = serde_json::to_vec(&told) {
                    let _ = std::fs::write(&path, b);
                }
                let _ = a.emit(FOUND_EVENT, serde_json::json!({ "names": names }));
            })
            .await;
            tokio::time::sleep(WATCH_EVERY).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn found(name: &str, hash: &str) -> Found {
        Found {
            name: name.into(),
            description: String::new(),
            origin: Origin::Claude,
            dir: PathBuf::new(),
            hash: hash.into(),
            files: Vec::new(),
            has_scripts: false,
        }
    }

    #[test]
    fn tells_once_per_skill_version() {
        let mut told = Default::default();
        assert_eq!(fresh(&[found("pdf", "a")], &mut told), ["pdf"]);
        assert!(fresh(&[found("pdf", "a")], &mut told).is_empty());
        assert_eq!(fresh(&[found("pdf", "b")], &mut told), ["pdf"]);
    }
}

/// Adds a skill from a GitHub folder link, pinned to the commit the link
/// points at now. Files are only downloaded; nothing in them runs.
#[tauri::command]
pub async fn library_install_url(app: AppHandle, url: String) -> CmdResult<Vec<Entry>> {
    let g = library::parse_github(&url).ok_or("Paste a GitHub link to a skill folder.")?;
    let lib = library_of(&app)?;
    let client = reqwest::Client::builder()
        .user_agent("duskie")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let api = format!("https://api.github.com/repos/{}/{}", g.owner, g.repo);
    let get = |u: String| {
        let client = client.clone();
        async move {
            let r = client.get(&u).send().await.map_err(|e| e.to_string())?;
            if !r.status().is_success() {
                return Err(format!("GitHub answered {}.", r.status()));
            }
            r.bytes().await.map_err(|e| e.to_string())
        }
    };
    let commit: serde_json::Value =
        serde_json::from_slice(&get(format!("{api}/commits/{}", g.reference)).await?)
            .map_err(|e| e.to_string())?;
    let sha = commit["sha"]
        .as_str()
        .ok_or("No such branch or commit.")?
        .to_owned();
    let tree: serde_json::Value =
        serde_json::from_slice(&get(format!("{api}/git/trees/{sha}?recursive=1")).await?)
            .map_err(|e| e.to_string())?;
    let prefix = if g.path.is_empty() {
        String::new()
    } else {
        format!("{}/", g.path)
    };
    let files: Vec<String> = tree["tree"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|t| t["type"] == "blob")
        .filter_map(|t| t["path"].as_str())
        .filter(|p| p.starts_with(&prefix) && !p[prefix.len()..].split('/').any(|s| s == ".."))
        .map(str::to_owned)
        .collect();
    if files.len() > library::MAX_FILES {
        return Err("That folder has too many files for a skill.".into());
    }
    if !files.iter().any(|f| f[prefix.len()..] == *"SKILL.md") {
        return Err("No SKILL.md in that folder.".into());
    }
    let tmp = std::env::temp_dir().join(format!("duskie-skill-{sha}"));
    let _ = std::fs::remove_dir_all(&tmp);
    let mut total = 0u64;
    for f in &files {
        let body = get(format!(
            "https://raw.githubusercontent.com/{}/{}/{sha}/{f}",
            g.owner, g.repo
        ))
        .await?;
        total += body.len() as u64;
        if total > library::MAX_BYTES {
            let _ = std::fs::remove_dir_all(&tmp);
            return Err("That skill is too large.".into());
        }
        let dest = tmp.join(&f[prefix.len()..]);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(&dest, &body).map_err(|e| e.to_string())?;
    }
    off_ui(move || {
        let found = library::read_skill(&tmp, Origin::Url);
        let out = match found {
            Some(f) => lib
                .import(&f)
                .and_then(|_| lib.set_source(&f.name, &url, &sha))
                .map(|_| entries(&lib))
                .map_err(|e| e.to_string()),
            None => Err("That SKILL.md has no valid name.".into()),
        };
        let _ = std::fs::remove_dir_all(&tmp);
        out
    })
    .await?
}
