//! Moves a user's saved data to a new folder when the app's identifier
//! changes. The old folder is copied, never moved or deleted, so a failed or
//! interrupted run loses nothing and can simply run again.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Written first; its presence means a copy started and may be unfinished.
const STARTED: &str = ".migration-started";
/// Written last; its presence means the copy is complete.
const DONE: &str = ".migration-done";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    /// No old folder, so there is nothing to bring over.
    NothingToMigrate,
    /// The new folder already has its own data (a fresh install or an
    /// earlier run of the new app); it was left alone.
    NewHasData,
    /// A previous run finished.
    AlreadyDone,
    /// Copied this many files.
    Copied(usize),
}

/// The old app folder next to `new`: same parent, named `old_id`. None when
/// `new` has no parent.
pub fn legacy_sibling(new: &Path, old_id: &str) -> Option<PathBuf> {
    Some(new.parent()?.join(old_id))
}

/// Copies `old` into `new` unless `new` already holds the user's data.
/// Files already in `new` are kept, so an interrupted run resumes safely.
pub fn migrate_dir(old: &Path, new: &Path) -> io::Result<Outcome> {
    if new.join(DONE).exists() {
        return Ok(Outcome::AlreadyDone);
    }
    if !old.is_dir() {
        return Ok(Outcome::NothingToMigrate);
    }
    let resuming = new.join(STARTED).exists();
    if !resuming && has_entries(new)? {
        return Ok(Outcome::NewHasData);
    }
    fs::create_dir_all(new)?;
    fs::write(new.join(STARTED), b"")?;
    let copied = copy_missing(old, new)?;
    fs::write(new.join(DONE), b"")?;
    Ok(Outcome::Copied(copied))
}

fn has_entries(dir: &Path) -> io::Result<bool> {
    match fs::read_dir(dir) {
        Ok(mut it) => Ok(it.next().is_some()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(e),
    }
}

fn copy_missing(from: &Path, to: &Path) -> io::Result<usize> {
    let mut copied = 0;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        let kind = entry.file_type()?;
        if kind.is_dir() {
            fs::create_dir_all(&target)?;
            copied += copy_missing(&entry.path(), &target)?;
        } else if kind.is_file() && !target.exists() {
            fs::copy(entry.path(), &target)?;
            copied += 1;
        }
    }
    Ok(copied)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("migrate-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    fn seed(old: &Path) {
        fs::create_dir_all(old.join("skills/a")).unwrap();
        fs::write(old.join("settings.json"), "{\"muted\":true}").unwrap();
        fs::write(old.join("sidekick.db"), "db").unwrap();
        fs::write(old.join("skills/a/SKILL.md"), "skill").unwrap();
    }

    #[test]
    fn copies_everything_and_keeps_the_old_folder() {
        let root = tmp("copy");
        let (old, new) = (root.join("old"), root.join("new"));
        seed(&old);
        assert_eq!(migrate_dir(&old, &new).unwrap(), Outcome::Copied(3));
        assert_eq!(
            fs::read_to_string(new.join("settings.json")).unwrap(),
            "{\"muted\":true}"
        );
        assert!(new.join("skills/a/SKILL.md").exists());
        assert!(old.join("settings.json").exists());
        assert_eq!(migrate_dir(&old, &new).unwrap(), Outcome::AlreadyDone);
    }

    #[test]
    fn nothing_to_do_without_an_old_folder() {
        let root = tmp("none");
        assert_eq!(
            migrate_dir(&root.join("old"), &root.join("new")).unwrap(),
            Outcome::NothingToMigrate
        );
    }

    #[test]
    fn never_overwrites_a_new_install() {
        let root = tmp("fresh");
        let (old, new) = (root.join("old"), root.join("new"));
        seed(&old);
        fs::create_dir_all(&new).unwrap();
        fs::write(new.join("settings.json"), "new").unwrap();
        assert_eq!(migrate_dir(&old, &new).unwrap(), Outcome::NewHasData);
        assert_eq!(
            fs::read_to_string(new.join("settings.json")).unwrap(),
            "new"
        );
    }

    #[test]
    fn resumes_after_an_interrupted_copy() {
        let root = tmp("resume");
        let (old, new) = (root.join("old"), root.join("new"));
        seed(&old);
        fs::create_dir_all(&new).unwrap();
        fs::write(new.join(STARTED), b"").unwrap();
        fs::write(new.join("settings.json"), "{\"muted\":true}").unwrap();
        assert_eq!(migrate_dir(&old, &new).unwrap(), Outcome::Copied(2));
        assert!(new.join("sidekick.db").exists());
    }

    #[test]
    fn finds_the_old_folder_next_to_the_new_one() {
        let new = Path::new("/data/app.duskie.desktop");
        assert_eq!(
            legacy_sibling(new, "app.sidekick.desktop"),
            Some(PathBuf::from("/data/app.sidekick.desktop"))
        );
    }
}
