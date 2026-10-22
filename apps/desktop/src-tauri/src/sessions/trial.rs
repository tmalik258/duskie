//! Try mode: the agent works on a throwaway copy (a git worktree next to the
//! project), so the user's code is untouched until they press Keep.

use super::*;

/// A Try session's copy: the repo it came from, the copy's folder and branch.
#[derive(Debug, Clone)]
pub(super) struct Trial {
    repo: PathBuf,
    dir: PathBuf,
    branch: String,
}

pub(super) static TRIALS: Mutex<Option<HashMap<String, Trial>>> = Mutex::new(None);

fn git_ok(dir: &Path, args: &[&str]) -> Result<String, String> {
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

/// A branch name from a task: "try/fix-the-footer-year-wxyz".
pub fn trial_branch(prompt: &str, id: &str) -> String {
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
        "try/{}-{}",
        if slug.is_empty() { "task" } else { &slug },
        tail.to_lowercase()
    )
}

/// Makes the copy, with the user's uncommitted changes carried over so the
/// agent starts from exactly what they see.
pub(super) fn make(path: &Path, prompt: &str, id: &str) -> Result<(PathBuf, String), String> {
    if git_ok(path, &["rev-parse", "--git-dir"]).is_err() {
        return Err("Try needs a git project, so the copy can be thrown away.".into());
    }
    let branch = trial_branch(prompt, id);
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "project".into());
    let parent = path.parent().ok_or("This folder has no parent.")?;
    let dir = parent
        .join(".duskie-try")
        .join(format!("{name}-{}", branch.trim_start_matches("try/")));
    std::fs::create_dir_all(dir.parent().unwrap_or(parent)).map_err(|e| e.to_string())?;
    let d = dir.to_string_lossy().into_owned();
    git_ok(path, &["worktree", "add", "-q", "-b", &branch, &d])?;
    // Carry over uncommitted work: tracked changes as a patch, new files copied.
    if let Ok(diff) = git_ok(path, &["diff", "HEAD", "--binary"])
        && !diff.is_empty()
    {
        {
            let patch = dir.join(".duskie-try.patch");
            let _ = std::fs::write(&patch, format!("{diff}\n"));
            let _ = git_ok(
                &dir,
                &["apply", "--whitespace=nowarn", &patch.to_string_lossy()],
            );
            let _ = std::fs::remove_file(&patch);
        }
    }
    if let Ok(new) = git_ok(path, &["ls-files", "--others", "--exclude-standard"]) {
        for f in new.lines().filter(|l| !l.is_empty()) {
            let to = dir.join(f);
            if let Some(p) = to.parent() {
                let _ = std::fs::create_dir_all(p);
            }
            let _ = std::fs::copy(path.join(f), to);
        }
    }
    // Mark the starting point, so Keep brings over only the agent's work.
    let _ = git_ok(&dir, &["add", "-A"]);
    git_ok(
        &dir,
        &[
            "-c",
            "user.name=Duskie",
            "-c",
            "user.email=try@duskie.local",
            "commit",
            "-q",
            "--allow-empty",
            "--no-verify",
            "-m",
            "Try: starting point",
        ],
    )?;
    with(&TRIALS, |t| {
        t.insert(
            id.into(),
            Trial {
                repo: path.to_owned(),
                dir: dir.clone(),
                branch: branch.clone(),
            },
        )
    });
    Ok((dir, branch))
}

fn take(id: &str) -> Result<Trial, String> {
    with(&TRIALS, |t| t.get(id).cloned())
        .ok_or_else(|| "This session is not trying on a copy.".into())
}

fn remove(t: &Trial) {
    let _ = git_ok(
        &t.repo,
        &["worktree", "remove", "--force", &t.dir.to_string_lossy()],
    );
    let _ = git_ok(&t.repo, &["branch", "-D", &t.branch]);
}

/// Keep: bring the agent's changes into the user's folder as uncommitted
/// edits, then delete the copy.
pub fn keep_trial(id: &str) -> Result<String, String> {
    let t = take(id)?;
    let _ = git_ok(&t.dir, &["add", "-A"]);
    let diff = git_ok(&t.dir, &["diff", "--cached", "--binary", "HEAD"])?;
    if !diff.is_empty() {
        let patch = std::env::temp_dir().join(format!("duskie-try-{id}.patch"));
        std::fs::write(&patch, format!("{diff}\n")).map_err(|e| e.to_string())?;
        let p = patch.to_string_lossy().into_owned();
        // A plain apply first; a three-way merge when the user edited the same lines.
        let applied = git_ok(&t.repo, &["apply", "--whitespace=nowarn", &p])
            .or_else(|_| git_ok(&t.repo, &["apply", "--3way", "--whitespace=nowarn", &p]));
        let _ = std::fs::remove_file(&patch);
        if let Err(e) = applied {
            return Err(format!(
                "Could not bring the changes over ({e}). The copy is kept on {}.",
                t.branch
            ));
        }
    }
    remove(&t);
    with(&TRIALS, |m| m.remove(id));
    Ok("Kept. The changes are in your folder now.".into())
}

/// Throw away: delete the copy and its branch.
pub fn discard_trial(id: &str) -> Result<String, String> {
    let t = take(id)?;
    remove(&t);
    with(&TRIALS, |m| m.remove(id));
    Ok("Thrown away. Your code was never touched.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_trial_branches() {
        assert_eq!(
            trial_branch("Fix the footer year, it says 2024!", "01ABCDWXYZ"),
            "try/fix-the-footer-year-it-wxyz"
        );
        assert_eq!(trial_branch("???", "01AB"), "try/task-01ab");
    }

    fn git(dir: &Path, args: &[&str]) {
        git_ok(dir, args).unwrap();
    }

    #[test]
    fn keep_brings_changes_over_and_throw_away_leaves_code_alone() {
        let root = std::env::temp_dir().join(format!("duskie-try-test-{}", ulid::Ulid::new()));
        let repo = root.join("app");
        std::fs::create_dir_all(&repo).unwrap();
        git(&repo, &["init", "-q"]);
        git(&repo, &["config", "user.email", "t@t"]);
        git(&repo, &["config", "user.name", "t"]);
        std::fs::write(repo.join("a.txt"), "one\n").unwrap();
        git(&repo, &["add", "."]);
        git(&repo, &["commit", "-qm", "init"]);
        // An uncommitted edit of the user's own is carried into the copy.
        std::fs::write(repo.join("a.txt"), "mine\n").unwrap();

        let (dir, _) = make(&repo, "try it", "01TRYA").unwrap();
        assert_eq!(
            std::fs::read_to_string(dir.join("a.txt")).unwrap(),
            "mine\n"
        );
        std::fs::write(dir.join("b.txt"), "agent\n").unwrap();
        discard_trial("01TRYA").unwrap();
        assert!(!dir.exists());
        assert!(!repo.join("b.txt").exists());

        let (dir, _) = make(&repo, "try it", "01TRYB").unwrap();
        std::fs::write(dir.join("b.txt"), "agent\n").unwrap();
        keep_trial("01TRYB").unwrap();
        assert_eq!(
            std::fs::read_to_string(repo.join("b.txt")).unwrap(),
            "agent\n"
        );
        assert_eq!(
            std::fs::read_to_string(repo.join("a.txt")).unwrap(),
            "mine\n"
        );
        assert!(!dir.exists());
        let _ = std::fs::remove_dir_all(&root);
    }
}
