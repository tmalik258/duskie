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
/// Codex (and others) may report a turn diff before the workspace snapshot settles.
pub(super) static DIFF_HINT: Mutex<Option<HashMap<String, bool>>> = Mutex::new(None);
static DECISION_LOCK: Mutex<()> = Mutex::new(());

pub(super) fn note_diff(id: &str) {
    with(&DIFF_HINT, |h| {
        h.insert(id.into(), true);
    });
}

fn take_diff_hint(id: &str) -> bool {
    with(&DIFF_HINT, |h| h.remove(id).unwrap_or(false))
}

/// Snapshot the workspace for this turn. Empty captures are retried / replaced when
/// live changes (or a Codex turn-diff hint) show the agent did write files.
pub(super) fn capture_turn(id: &str) {
    let Some((before, path, entry, baseline)) = with(&SESSIONS, |s| {
        s.get(id).map(|h| {
            (
                h.checkpoints
                    .last()
                    .cloned()
                    .or_else(|| h.baseline.clone()),
                h.path.clone(),
                h.checkpoints.len().saturating_sub(1),
                h.baseline.clone(),
            )
        })
    }) else {
        return;
    };

    let existing_idx =
        with(&REVIEWS, |r| r.get(id).and_then(|v| v.iter().position(|t| t.entry == entry)));
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
        if files_error.0.is_empty() && files_error.1.is_none() {
            if let Some(live) = baseline.as_ref().and_then(|b| review::changes(b).ok()) {
                if !live.is_empty() {
                    files_error = (live, None);
                }
            }
        }
    }
    let (files, error) = files_error;
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
