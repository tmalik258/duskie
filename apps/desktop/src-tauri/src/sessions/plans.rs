//! Locate Claude Code plan files written during Plan mode.
//! Defaults live under `~/.claude/plans`; projects may set `plansDirectory`.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde_json::Value;

/// Directories where Claude may have written a plan for this project.
pub fn claude_plans_dirs(project: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(p) = project_plans_dir(project) {
        dirs.push(p);
    }
    let project_default = project.join(".claude").join("plans");
    if !dirs.iter().any(|d| d == &project_default) {
        dirs.push(project_default);
    }
    if let Some(home) = claude_home() {
        let home_plans = home.join("plans");
        if !dirs.iter().any(|d| d == &home_plans) {
            dirs.push(home_plans);
        }
    }
    dirs
}

fn claude_home() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("CLAUDE_CONFIG_DIR") {
        let p = PathBuf::from(dir);
        if !p.as_os_str().is_empty() {
            return Some(p);
        }
    }
    Some(dirs::home_dir()?.join(".claude"))
}

/// `plansDirectory` from project `.claude/settings.json` when it stays under the project.
fn project_plans_dir(project: &Path) -> Option<PathBuf> {
    let settings = project.join(".claude").join("settings.json");
    let text = fs::read_to_string(settings).ok()?;
    let v: Value = serde_json::from_str(&text).ok()?;
    let rel = v.get("plansDirectory")?.as_str()?.trim();
    if rel.is_empty() {
        return None;
    }
    let path = if Path::new(rel).is_absolute() {
        PathBuf::from(rel)
    } else {
        project.join(rel)
    };
    let root = project.canonicalize().ok()?;
    let canon = path.canonicalize().unwrap_or(path.clone());
    if canon.starts_with(&root) {
        Some(path)
    } else {
        None
    }
}

/// Newest `.md` under any of the plan directories (by modified time).
pub fn newest_plan_file(dirs: &[PathBuf]) -> Option<PathBuf> {
    let mut best: Option<(SystemTime, PathBuf)> = None;
    for dir in dirs {
        let Ok(entries) = fs::read_dir(dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("md") {
                continue;
            }
            let modified = entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .unwrap_or(SystemTime::UNIX_EPOCH);
            if best.as_ref().is_none_or(|(t, _)| modified > *t) {
                best = Some((modified, path));
            }
        }
    }
    best.map(|(_, p)| p)
}

/// Full plan text from ExitPlanMode input, or from the newest plan file on disk.
pub fn read_exit_plan(input: &Value, project: Option<&Path>) -> Option<String> {
    if let Some(plan) = input
        .get("plan")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return Some(plan.to_owned());
    }
    for key in ["planFilePath", "plan_file", "file_path", "path"] {
        if let Some(path) = input.get(key).and_then(|v| v.as_str()).map(str::trim) {
            if path.is_empty() {
                continue;
            }
            if let Ok(text) = fs::read_to_string(path) {
                let t = text.trim();
                if !t.is_empty() {
                    return Some(text);
                }
            }
        }
    }
    let project = project?;
    let dirs = claude_plans_dirs(project);
    let (under_project, elsewhere): (Vec<_>, Vec<_>) =
        dirs.into_iter().partition(|d| d.starts_with(project));
    let path = newest_plan_file(&under_project).or_else(|| newest_plan_file(&elsewhere))?;
    let text = fs::read_to_string(path).ok()?;
    let t = text.trim();
    if t.is_empty() { None } else { Some(text) }
}

/// True when a Write/Edit path is clearly a Claude plan file.
pub fn is_plan_file_path(path: &str) -> bool {
    let p = path.replace('\\', "/").to_lowercase();
    p.contains("/plans/") && p.ends_with(".md")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn prefers_inline_plan_over_file() {
        let v = serde_json::json!({ "plan": "# Inline\n1. Do it" });
        assert_eq!(
            read_exit_plan(&v, None).as_deref(),
            Some("# Inline\n1. Do it")
        );
    }

    #[test]
    fn reads_newest_plan_file() {
        let root = std::env::temp_dir().join(format!("duskie-plans-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let plans = root.join(".claude").join("plans");
        fs::create_dir_all(&plans).unwrap();
        let older = plans.join("old.md");
        let newer = plans.join("new.md");
        fs::write(&older, "old plan").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        let mut f = fs::File::create(&newer).unwrap();
        writeln!(f, "new plan body").unwrap();
        let found = newest_plan_file(&[plans.clone()]).unwrap();
        assert_eq!(found, newer);
        let text = read_exit_plan(&serde_json::json!({}), Some(&root)).unwrap();
        assert!(text.contains("new plan body"), "{text}");
        let via_path = read_exit_plan(
            &serde_json::json!({ "file_path": newer.to_string_lossy() }),
            None,
        );
        assert!(via_path.unwrap().contains("new plan body"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn detects_plan_paths() {
        assert!(is_plan_file_path(r"C:\Users\x\.claude\plans\fix.md"));
        assert!(is_plan_file_path("/home/me/.claude/plans/abc.md"));
        assert!(!is_plan_file_path("src/main.rs"));
        assert!(!is_plan_file_path("/plans/readme.txt"));
    }
}
