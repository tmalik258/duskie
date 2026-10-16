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
