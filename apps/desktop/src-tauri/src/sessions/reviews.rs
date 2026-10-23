use super::*;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewTurn {
    pub id: String,
    pub entry: usize,
    pub files: Vec<review::FileChange>,
    pub decisions: HashMap<String, String>,
    pub error: Option<String>,
    before: Option<Baseline>,
    fingerprints: HashMap<String, Option<u64>>,
}

pub(super) static REVIEWS: Mutex<Option<HashMap<String, Vec<ReviewTurn>>>> = Mutex::new(None);
pub(super) static WRITING: Mutex<Option<HashMap<String, bool>>> = Mutex::new(None);
/// Set when a session stream reports a turn diff before the workspace snapshot settles.
pub(super) static DIFF_HINT: Mutex<Option<HashMap<String, bool>>> = Mutex::new(None);
static DECISION_LOCK: Mutex<()> = Mutex::new(());

/// What the agent itself wrote this turn, from its own tool calls, so review
/// leaves out the user's edits. A shell command can change anything, so after
/// one the whole folder diff is used.
#[derive(Default)]
struct Touched {
    paths: std::collections::HashSet<String>,
    shell: bool,
    /// The agent reported at least one tool call this turn.
    tracked: bool,
}
static TOUCHED: Mutex<Option<HashMap<String, Touched>>> = Mutex::new(None);

/// A new turn starts with nothing touched.
pub(super) fn begin_touch(id: &str) {
    with(&TOUCHED, |t| t.insert(id.into(), Touched::default()));
}

/// Records a `touch` or `shell` event; true when `data` was one.
pub(super) fn note_touch(id: &str, data: &Value) -> bool {
    match data["kind"].as_str() {
        Some("touch") => with(&TOUCHED, |t| {
            let e = t.entry(id.into()).or_default();
            e.tracked = true;
            for p in data["paths"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
            {
                e.paths.insert(norm(p));
            }
            true
        }),
        Some("shell") => with(&TOUCHED, |t| {
            let e = t.entry(id.into()).or_default();
            e.tracked = true;
            e.shell = true;
            true
        }),
        _ => false,
    }
}

fn norm(p: &str) -> String {
    p.replace('\\', "/").trim_start_matches("./").to_lowercase()
}

/// Keeps only files the agent wrote, when its tool calls say so.
fn own_files(id: &str, files: Vec<review::FileChange>) -> Vec<review::FileChange> {
    with(&TOUCHED, |t| match t.get(id) {
        Some(tc) if tc.tracked && !tc.shell => files
            .into_iter()
            .filter(|f| {
                let rel = norm(&f.path);
                tc.paths
                    .iter()
                    .any(|p| *p == rel || p.ends_with(&format!("/{rel}")))
            })
            .collect(),
        _ => files,
    })
}

pub(super) fn note_diff(id: &str) {
    with(&DIFF_HINT, |h| {
        h.insert(id.into(), true);
    });
}

fn take_diff_hint(id: &str) -> bool {
    with(&DIFF_HINT, |h| h.remove(id).unwrap_or(false))
}

/// Snapshot the workspace for this turn. Empty captures retry briefly when a
/// turn-diff hint (or a live non-empty tree) suggests writes have not settled
/// yet - never fill from a live full-tree diff.
pub(super) fn capture_turn(id: &str) {
    let Some((before, path, entry, baseline)) = with(&SESSIONS, |s| {
        s.get(id).map(|h| {
            (
                h.checkpoints.last().cloned().or_else(|| h.baseline.clone()),
                h.path.clone(),
                h.checkpoints.len().saturating_sub(1),
                h.baseline.clone(),
            )
        })
    }) else {
        return;
    };

    let existing_idx = with(&REVIEWS, |r| {
        r.get(id)
            .and_then(|v| v.iter().position(|t| t.entry == entry))
    });
    if let Some(idx) = existing_idx {
        let has_files = with(&REVIEWS, |r| {
            r.get(id)
                .and_then(|v| v.get(idx))
                .is_some_and(|t| !t.files.is_empty() || t.error.is_some())
        });
        let writing = with(&WRITING, |w| w.get(id).copied().unwrap_or(false));
        // Keep a settled non-empty turn; allow replacing an empty one.
        if has_files && !writing {
            with(&WRITING, |w| {
                w.insert(id.into(), false);
            });
            return;
        }
    }

    let hinted = take_diff_hint(id);
    let mut files_error = snapshot_between(&before, &path);
    if files_error.0.is_empty() && files_error.1.is_none() && (hinted || live_nonempty(&baseline)) {
        std::thread::sleep(std::time::Duration::from_millis(200));
        files_error = snapshot_between(&before, &path);
    }
    let (files, error) = files_error;
    let files = own_files(id, files);
    let fingerprints = before
        .as_ref()
        .map(|b| {
            files
                .iter()
                .map(|f| (f.path.clone(), review::fingerprint(&b.root, &f.path)))
                .collect()
        })
        .unwrap_or_default();
    let turn = ReviewTurn {
        id: ulid::Ulid::new().to_string(),
        entry,
        files,
        decisions: HashMap::new(),
        error,
        before,
        fingerprints,
    };
    with(&REVIEWS, |r| {
        let list = r.entry(id.into()).or_default();
        if let Some(idx) = list.iter().position(|t| t.entry == entry) {
            list[idx] = turn;
        } else {
            list.push(turn);
        }
    });
    with(&WRITING, |w| {
        w.insert(id.into(), false);
    });
}

fn live_nonempty(baseline: &Option<Baseline>) -> bool {
    baseline
        .as_ref()
        .and_then(|b| review::changes(b).ok())
        .is_some_and(|c| !c.is_empty())
}

fn snapshot_between(
    before: &Option<Baseline>,
    path: &Path,
) -> (Vec<review::FileChange>, Option<String>) {
    match (|| {
        let b = before.as_ref().ok_or("Workspace snapshot unavailable")?;
        let after = review::capture(path, shadow_root().as_deref())
            .ok_or("Could not capture the completed workspace")?;
        review::between(b, &after)
    })() {
        Ok(f) => (f, None),
        Err(e) => (Vec::new(), Some(e)),
    }
}

pub fn list(id: &str) -> Vec<ReviewTurn> {
    let mut turns = with(&REVIEWS, |r| r.get(id).cloned()).unwrap_or_default();
    for line in turns
        .iter_mut()
        .flat_map(|t| &mut t.files)
        .flat_map(|f| &mut f.hunks)
        .flat_map(|h| &mut h.lines)
    {
        *line = mask(line).into_owned();
    }
    turns
}

/// Latest non-empty turn snapshot files for a session (for fast Review open).
#[cfg(test)]
pub fn latest_files(id: &str) -> Option<Vec<review::FileChange>> {
    with(&REVIEWS, |r| {
        r.get(id).and_then(|turns| {
            turns
                .iter()
                .rev()
                .find(|t| !t.files.is_empty())
                .map(|t| t.files.clone())
        })
    })
}

/// Files from the most recent turn (may be empty) - used after `capture_turn`.
pub(super) fn last_turn_files(id: &str) -> Vec<review::FileChange> {
    with(&REVIEWS, |r| {
        r.get(id)
            .and_then(|turns| turns.last().map(|t| t.files.clone()))
            .unwrap_or_default()
    })
}

/// Merge every turn's files for this session; the latest turn wins per path.
pub fn merged_files(id: &str) -> Vec<review::FileChange> {
    with(&REVIEWS, |r| {
        merge_turn_files(r.get(id).map(|t| t.as_slice()).unwrap_or(&[]))
    })
}

/// Latest-path-wins merge over turn snapshots (pure; used by tests).
pub(super) fn merge_turn_files(turns: &[ReviewTurn]) -> Vec<review::FileChange> {
    let mut map: HashMap<String, review::FileChange> = HashMap::new();
    let mut order: Vec<String> = Vec::new();
    for turn in turns {
        for f in &turn.files {
            if map.insert(f.path.clone(), f.clone()).is_none() {
                order.push(f.path.clone());
            }
        }
    }
    order.into_iter().filter_map(|p| map.remove(&p)).collect()
}

pub fn decide(
    id: &str,
    turn_id: &str,
    path: Option<&str>,
    hunk: Option<usize>,
    accept: bool,
) -> Result<(), String> {
    let _guard = lock(&DECISION_LOCK);
    if !accept && with(&WRITING, |w| w.get(id).copied().unwrap_or(false)) {
        return Err("Wait for the agent to finish writing before rejecting changes.".into());
    }
    let mut turn = with(&REVIEWS, |r| {
        r.get(id)
            .and_then(|v| v.iter().find(|t| t.id == turn_id))
            .cloned()
    })
    .ok_or("Review snapshot unavailable")?;
    let b = turn
        .before
        .as_ref()
        .ok_or("Workspace snapshot unavailable")?;
    let selected: Vec<_> = turn
        .files
        .iter()
        .filter(|f| path.is_none_or(|p| p == f.path))
        .map(|f| {
            let indices: Vec<usize> = (0..f.hunks.len().max(1))
                .filter(|&n| {
                    hunk.is_none_or(|h| h == n)
                        && !turn.decisions.contains_key(&format!("{}:{n}", f.path))
                })
                .collect();
            (f.clone(), indices)
        })
        .filter(|(_, n)| !n.is_empty())
        .collect();
    if !accept {
        for (f, _) in &selected {
            let expected = turn
                .fingerprints
                .get(&f.path)
                .ok_or("Missing file fingerprint")?;
            if &review::fingerprint(&b.root, &f.path) != expected {
                return Err(format!(
                    "{} changed after this review was captured. Rejection would overwrite later edits.",
                    f.path
                ));
            }
        }
        for (f, indices) in &selected {
            review::reverse_selected(b, f, indices)?;
        }
    }
    for (f, indices) in &selected {
        for n in indices {
            turn.decisions.insert(
                format!("{}:{n}", f.path),
                if accept { "accepted" } else { "rejected" }.into(),
            );
        }
        if !accept {
            turn.fingerprints
                .insert(f.path.clone(), review::fingerprint(&b.root, &f.path));
        }
    }
    with(&REVIEWS, |r| {
        if let Some(t) = r
            .get_mut(id)
            .and_then(|v| v.iter_mut().find(|t| t.id == turn_id))
        {
            *t = turn;
        }
    });
    save();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::review::{FileChange, Hunk};

    fn file(path: &str, header: &str) -> FileChange {
        FileChange {
            path: path.into(),
            status: "modified".into(),
            added: 1,
            removed: 0,
            hunks: vec![Hunk {
                header: header.into(),
                lines: vec!["+x".into()],
            }],
        }
    }

    #[test]
    fn review_keeps_only_files_the_agent_wrote() {
        let id = "touch-test";
        begin_touch(id);
        let both = || vec![file("src/a.rs", "@@"), file("notes.md", "@@")];
        assert_eq!(own_files(id, both()).len(), 2, "untracked turns keep all");
        note_touch(id, &json!({"kind":"touch","paths":["C:\\repo\\src\\A.rs"]}));
        let kept = own_files(id, both());
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].path, "src/a.rs");
        note_touch(id, &json!({"kind":"shell"}));
        assert_eq!(own_files(id, both()).len(), 2, "a shell command keeps all");
    }

    fn turn(entry: usize, files: Vec<FileChange>) -> ReviewTurn {
        ReviewTurn {
            id: format!("t{entry}"),
            entry,
            files,
            decisions: HashMap::new(),
            error: None,
            before: None,
            fingerprints: HashMap::new(),
        }
    }

    #[test]
    fn merge_keeps_latest_path_only() {
        let turns = [
            turn(0, vec![file("a.rs", "@@ a0 @@"), file("b.rs", "@@ b0 @@")]),
            turn(1, vec![file("a.rs", "@@ a1 @@")]),
        ];
        let merged = merge_turn_files(&turns);
        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0].path, "a.rs");
        assert_eq!(merged[0].hunks[0].header, "@@ a1 @@");
        assert_eq!(merged[1].path, "b.rs");
        assert_eq!(merged[1].hunks[0].header, "@@ b0 @@");
    }

    #[test]
    fn merge_empty_turns_is_empty() {
        assert!(merge_turn_files(&[]).is_empty());
        assert!(merge_turn_files(&[turn(0, vec![])]).is_empty());
    }

    #[test]
    fn latest_files_none_without_turns() {
        assert!(latest_files("no-such-review-session").is_none());
    }
}
