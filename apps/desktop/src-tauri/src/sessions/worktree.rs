//! A session's own git worktree: its branch name, setup and Finish, which
//! merges it back.

use super::*;

/// A session's own worktree: the repo it came from and its branch.
#[derive(Debug, Clone)]
pub(super) struct Worktree {
    pub(super) repo: PathBuf,
    pub(super) dir: PathBuf,
    pub(super) branch: String,
}

pub(super) static WORKTREES: Mutex<Option<HashMap<String, Worktree>>> = Mutex::new(None);

pub(super) fn git_ok(dir: &Path, args: &[&str]) -> Result<String, String> {
    let mut cmd = std::process::Command::new("git");
    cmd.arg("-C").arg(dir).args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_owned())
    } else {
        Err(String::from_utf8_lossy(&out.stderr)
            .lines()
            .last()
            .unwrap_or("git failed")
            .trim()
            .to_owned())
    }
}

/// A branch name from a task: "wt/fix-the-footer-year".
pub fn worktree_branch(prompt: &str, id: &str) -> String {
    let slug: String = prompt
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|w| !w.is_empty())
        .take(5)
        .collect::<Vec<_>>()
        .join("-");
    let tail = &id[id.len().saturating_sub(4)..];
    format!(
        "wt/{}-{}",
        if slug.is_empty() { "task" } else { &slug },
        tail.to_lowercase()
    )
}

/// A second agent in a repo already in use gets its own worktree next to
/// it, so the two never edit the same files.
pub(super) fn own_worktree(path: &Path, prompt: &str, id: &str) -> Option<Worktree> {
    let busy = with(&SESSIONS, |s| {
        s.values().any(|h| !h.tx.is_closed() && h.path == path)
    });
    if !busy || !path.join(".git").exists() {
        return None;
    }
    let branch = worktree_branch(prompt, id);
    let name = path.file_name()?.to_string_lossy().into_owned();
    let dir = path
        .parent()?
        .join(".sidekick-worktrees")
        .join(format!("{name}-{}", branch.trim_start_matches("wt/")));
    std::fs::create_dir_all(dir.parent()?).ok()?;
    git_ok(
        path,
        &[
            "worktree",
            "add",
            "-q",
            "-b",
            &branch,
            &dir.to_string_lossy(),
        ],
    )
    .ok()?;
    Some(Worktree {
        repo: path.to_owned(),
        dir,
        branch,
    })
}

/// Finish: commit the worktree's changes, merge its branch into the
/// repo's current branch, and remove the worktree.
pub fn finish(id: &str) -> Result<String, String> {
    let wt = with(&WORKTREES, |w| w.get(id).cloned())
        .ok_or("This session has no worktree of its own.")?;
    let dirty = !git_ok(&wt.dir, &["status", "--porcelain"])?.is_empty();
    if dirty {
        git_ok(&wt.dir, &["add", "-A"])?;
        git_ok(
            &wt.dir,
            &[
                "commit",
                "-q",
                "-m",
                &format!("Agent work on {}", wt.branch),
            ],
        )?;
    }
    if let Err(e) = git_ok(&wt.repo, &["merge", "--no-edit", "-q", &wt.branch]) {
        let _ = git_ok(&wt.repo, &["merge", "--abort"]);
        return Err(format!(
            "Could not merge {} by itself ({e}). It is kept, so you can merge it in your editor.",
            wt.branch
        ));
    }
    let _ = git_ok(
        &wt.repo,
        &["worktree", "remove", "--force", &wt.dir.to_string_lossy()],
    );
    let _ = git_ok(&wt.repo, &["branch", "-d", &wt.branch]);
    with(&WORKTREES, |w| w.remove(id));
    Ok(format!("Merged {} back", wt.branch))
}
