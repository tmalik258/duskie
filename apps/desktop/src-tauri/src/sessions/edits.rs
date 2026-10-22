//! What a session changed: review, undo, rewind, and the files and slash
//! commands the composer offers.

use super::*;

pub(super) fn baseline(id: &str) -> Result<Baseline, String> {
    with(&SESSIONS, |s| s.get(id).and_then(|h| h.baseline.clone())).ok_or_else(|| {
        "This project was too big to track, so its changes cannot be reviewed here.".to_owned()
    })
}

/// Event name: one masked file while Review opens (`{ session, file }`).
pub const REVIEW_FILE_EVENT: &str = "review://file";
/// Event name: Review file stream finished (`{ session }`).
pub const REVIEW_DONE_EVENT: &str = "review://done";

/// The changes to review from this session's turn snapshots only, with secrets
/// masked. Undo reads the files again, so masking here never changes what gets undone.
#[cfg(test)]
pub fn changes(id: &str) -> Result<Vec<review::FileChange>, String> {
    changes_emitting(id, None)
}

/// Mask secrets in each file's hunk lines; returns paths in emit order.
pub(super) fn mask_review_files(files: &mut [review::FileChange]) -> Vec<String> {
    let mut order = Vec::with_capacity(files.len());
    for file in files.iter_mut() {
        for line in file.hunks.iter_mut().flat_map(|h| h.lines.iter_mut()) {
            if let Cow::Owned(m) = mask(line) {
                *line = m;
            }
        }
        order.push(file.path.clone());
    }
    order
}

/// Like [`changes`], optionally emitting each masked file then a done event.
pub fn changes_emitting(
    id: &str,
    app: Option<&AppHandle>,
) -> Result<Vec<review::FileChange>, String> {
    let _ = baseline(id)?;
    let mut files = reviews::merged_files(id);
    let order = mask_review_files(&mut files);
    if let Some(app) = app {
        for (path, file) in order.iter().zip(files.iter()) {
            debug_assert_eq!(path, &file.path);
            let _ = app.emit(REVIEW_FILE_EVENT, json!({ "session": id, "file": file }));
        }
        let _ = app.emit(REVIEW_DONE_EVENT, json!({ "session": id }));
    }
    Ok(files)
}

pub fn undo(id: &str, path: Option<&str>, hunk: Option<usize>) -> Result<(), String> {
    let b = baseline(id)?;
    let after = with(&SESSIONS, |s| s.get(id).map(|h| h.after.clone())).unwrap_or_default();
    // A file edited after the agent finished: undo would lose those edits.
    let edited_since = |p: &str| {
        after
            .get(p)
            .is_some_and(|h| review::fingerprint(&b.root, p) != Some(*h))
    };
    let refuse = |p: &str| {
        format!(
            "{p} changed after the agent finished. Undoing now would lose those edits, so it was left as it is."
        )
    };
    match (path, hunk) {
        (Some(p), _) if edited_since(p) => return Err(refuse(p)),
        (None, _) => {
            if let Some(p) = after.keys().find(|p| edited_since(p)) {
                return Err(refuse(p));
            }
        }
        _ => {}
    }
    match (path, hunk) {
        (Some(p), Some(h)) => review::undo_hunk(&b, p, h)?,
        (Some(p), None) => review::undo_file(&b, p)?,
        (None, _) => {
            review::undo_all(&b)?;
        }
    }
    // What is on disk now is Duskie's own doing: the new fingerprint.
    with(&SESSIONS, |s| {
        if let Some(h) = s.get_mut(id) {
            let keys: Vec<String> = match path {
                Some(p) => vec![p.to_owned()],
                None => h.after.keys().cloned().collect(),
            };
            for k in keys {
                match review::fingerprint(&b.root, &k) {
                    Some(f) => h.after.insert(k, f),
                    None => h.after.remove(&k),
                };
            }
        }
    });
    save();
    Ok(())
}

/// How many files Rewind to before message `index` would put back.
pub fn rewind_preview(id: &str, index: usize) -> Result<usize, String> {
    let cp = checkpoint(id, index)?;
    Ok(review::changes(&cp)?.len())
}

/// Puts the project back to how it was before the user's message `index`
/// (0 is the first), and forgets the checkpoints after it.
pub fn rewind(id: &str, index: usize) -> Result<usize, String> {
    let cp = checkpoint(id, index)?;
    let n = review::undo_all(&cp)?;
    with(&SESSIONS, |s| {
        if let Some(h) = s.get_mut(id) {
            h.checkpoints.truncate(index + 1);
        }
    });
    turn_ended(id);
    Ok(n)
}

pub(super) fn checkpoint(id: &str, index: usize) -> Result<Baseline, String> {
    with(&SESSIONS, |s| {
        s.get(id).and_then(|h| h.checkpoints.get(index).cloned())
    })
    .ok_or_else(|| "This project was too big to track, so it cannot be rewound.".to_owned())
}

/// Files in the session's project whose path has every word of `query`,
/// shortest paths first, for @ in the composer.
pub fn files(id: &str, query: &str) -> Vec<String> {
    match with(&SESSIONS, |s| s.get(id).map(|h| h.path.clone())) {
        Some(root) => files_in(root, query),
        None => Vec::new(),
    }
}

/// Same as [`files`] for a folder, before any session exists.
pub fn files_in(root: std::path::PathBuf, query: &str) -> Vec<String> {
    let words: Vec<String> = query
        .to_lowercase()
        .split_whitespace()
        .map(str::to_owned)
        .collect();
    let mut cmd = std::process::Command::new("git");
    cmd.args(["ls-files", "--cached", "--others", "--exclude-standard"])
        .current_dir(&root);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let listed = cmd
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned());
    let all: Vec<String> = match listed {
        Some(text) => text.lines().map(str::to_owned).collect(),
        None => crate::find::find(
            std::slice::from_ref(&root),
            query,
            Some(false),
            std::time::Duration::from_millis(300),
        )
        .into_iter()
        .filter_map(|f| {
            f.path
                .strip_prefix(&root)
                .ok()
                .map(|p| p.display().to_string())
        })
        .collect(),
    };
    let mut hits: Vec<String> = all
        .into_iter()
        .filter(|p| {
            let l = p.to_lowercase();
            words.iter().all(|w| l.contains(w.as_str()))
        })
        .collect();
    // A match in the file name beats one in a folder name; then shorter paths.
    let name_hit = |p: &str| {
        let name = p.rsplit('/').next().unwrap_or(p).to_lowercase();
        !words.iter().all(|w| name.contains(w.as_str()))
    };
    hits.sort_by_key(|p| (name_hit(p), p.len()));
    hits.truncate(8);
    hits
}

/// A command for / in the composer.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommand {
    pub name: String,
    pub description: String,
    pub group: String,
    pub execution: String,
}

/// The session's own commands, then the project's from .claude/commands.
pub fn commands(id: &str) -> Vec<SlashCommand> {
    let Some((agent, path)) = with(&SESSIONS, |s| s.get(id).map(|h| (h.agent, h.path.clone())))
    else {
        return Vec::new();
    };
    let cmd = |name: &str, description: &str, group: &str| SlashCommand {
        name: name.into(),
        description: description.into(),
        group: group.into(),
        execution: if group == "Session" {
            "control"
        } else {
            "provider"
        }
        .into(),
    };
    let mut out = Vec::new();
    if agent == Agent::ClaudeCode {
        out.push(cmd(
            "/compact",
            "Summarize the chat to free context",
            "Session",
        ));
    }
    out.push(cmd("/clear", "Start fresh in the same project", "Session"));
    out.push(cmd(
        "/rewind",
        "Go back to an earlier message, code included",
        "Session",
    ));
    if agent == Agent::ClaudeCode {
        out.extend(project_commands(&path.join(".claude").join("commands")));
    }
    out
}

/// Markdown files in a commands folder: the file name is the command, the
/// frontmatter description (or first line) says what it does.
pub fn project_commands(dir: &Path) -> Vec<SlashCommand> {
    let mut out: Vec<SlashCommand> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "md"))
        .filter_map(|e| {
            let name = e.path().file_stem()?.to_string_lossy().into_owned();
            let text = std::fs::read_to_string(e.path()).unwrap_or_default();
            let description = text
                .lines()
                .find_map(|l| {
                    l.strip_prefix("description:")
                        .map(|d| d.trim().trim_matches('"').to_owned())
                })
                .or_else(|| {
                    text.lines()
                        .map(|l| l.trim().trim_start_matches('#').trim())
                        .find(|l| !l.is_empty() && *l != "---")
                        .map(str::to_owned)
                })
                .unwrap_or_default();
            Some(SlashCommand {
                name: format!("/{name}"),
                description: format!("{description} (.claude/commands/{name}.md)")
                    .trim()
                    .to_owned(),
                group: "This project".into(),
                execution: "provider".into(),
            })
        })
        .collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}
