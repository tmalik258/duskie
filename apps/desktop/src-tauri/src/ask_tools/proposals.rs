//! Actions offered as buttons: proposing, the button text, keeping them
//! across restarts, and running one when the user clicks.

use super::*;

/// Keeps an action as a button under the answer; it runs on a tap.
pub(super) fn propose(app: &AppHandle, chat_id: &str, args: &Value) -> String {
    let action = args["action"].as_str().unwrap_or_default();
    if !ASK_ACTIONS.contains(&action) {
        return format!("Error: {action} is not something you can offer.");
    }
    let mut action_args = args["args"].clone();
    for key in ["path", "to"] {
        if let Some(p) = action_args[key].as_str() {
            action_args[key] = json!(normalize_target(p));
        }
    }
    if let Some(paths) = action_args["paths"].as_array_mut() {
        for p in paths.iter_mut() {
            if let Some(s) = p.as_str() {
                *p = json!(normalize_target(s));
            }
        }
    }
    // Models sometimes pass the action's own name ("close_app") as the text.
    let label: String = args["label"]
        .as_str()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.contains('_'))
        .map_or_else(|| button_text(action, &action_args), str::to_owned)
        .chars()
        .take(60)
        .collect();
    if action == "open_path" && action_args["path"].as_str().is_some_and(runs_code) {
        return "Refused: that file runs a program. Tell the user to open it themselves.".into();
    }
    let mut label = label;
    if action == "uninstall" {
        match uninstall_target(action_args["name"].as_str().unwrap_or_default()) {
            Ok(name) => {
                action_args["name"] = json!(name);
                label = format!("Uninstall {name}");
            }
            Err(e) => return e,
        }
    }
    // Uninstalling is never a step in a plan: it gets its own tap.
    let step = args["step"].as_bool().unwrap_or(false) && action != "uninstall";
    offer_as(app, chat_id, action, action_args, &label, step);
    if step {
        format!(
            "Added to the plan as \"{label}\". Offer the other steps, then say in one sentence what the plan does."
        )
    } else {
        format!(
            "Shown to the user as a button \"{label}\". Say in one short sentence what it will do."
        )
    }
}

/// The exact installed name for `query`, or the names to pick from.
pub(super) fn uninstall_target(query: &str) -> Result<String, String> {
    use duskie_actions::installed;
    let apps = installed::list().map_err(|e| format!("Error: {e}"))?;
    if let Some(a) = apps
        .iter()
        .find(|a| a.name.eq_ignore_ascii_case(query.trim()))
    {
        return Ok(a.name.clone());
    }
    let found = installed::find(&apps, query);
    match found.as_slice() {
        [one] => Ok(one.name.clone()),
        [] => Err(format!("Error: no installed app matches \"{query}\".")),
        many => Err(format!(
            "Error: several apps match. Ask which one, then offer it by its exact name: {}",
            many.iter()
                .take(15)
                .map(|a| a.name.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        )),
    }
}

/// Readable button text for an action offered without one.
pub(super) fn button_text(action: &str, args: &Value) -> String {
    let what = ["name", "path", "url"]
        .iter()
        .find_map(|k| args[k].as_str())
        .map(|v| {
            v.trim_end_matches(['/', '\\'])
                .rsplit(['/', '\\'])
                .next()
                .unwrap_or(v)
                .to_owned()
        })
        .unwrap_or_default();
    let verb = match action {
        "close_app" => "Close",
        "open_path" | "open_url" => "Open",
        "reveal_path" => "Show in folder",
        "move_file" => "Move",
        "zip" => "Zip",
        "convert" => "Convert",
        "extract_archive" | "extract_text" => "Extract",
        "launch_project" => "Open project",
        "git_pull" => "Pull",
        "install_deps" => "Install packages",
        "sleep_pc" => "Put the PC to sleep",
        "empty_recycle_bin" => "Empty the Recycle Bin",
        "trash_download" => "Remove",
        other => return other.replace('_', " "),
    };
    if what.is_empty() {
        verb.to_owned()
    } else {
        format!("{verb} {what}")
    }
}

/// A button under the answer that runs `action` when tapped. Duskie's own
/// code uses this for steps that need the user's yes (send, post, pay).
pub(super) const PROPOSALS_FILE: &str = "ask-buttons.json";
/// Buttons kept for a tap; older ones are let go.
pub(super) const KEEP_PROPOSALS: usize = 60;

/// Buttons still waiting from before a restart, so they keep working.
pub fn load_proposals(dir: &std::path::Path) -> HashMap<String, Proposed> {
    std::fs::read(dir.join(PROPOSALS_FILE))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

pub(super) fn save_proposals(app: &AppHandle, all: &mut HashMap<String, Proposed>) {
    // Ids are ULIDs, so the smallest are the oldest.
    while all.len() > KEEP_PROPOSALS {
        let Some(oldest) = all.keys().min().cloned() else {
            break;
        };
        all.remove(&oldest);
    }
    if let Ok(dir) = app.path().app_data_dir()
        && let Ok(bytes) = serde_json::to_vec(&*all)
    {
        let _ = std::fs::write(dir.join(PROPOSALS_FILE), bytes);
    }
}

pub fn offer(app: &AppHandle, chat_id: &str, action: &str, action_args: Value, label: &str) {
    offer_as(app, chat_id, action, action_args, label, false);
}

/// Like `offer`; a step shows with the other steps as a plan, run in order.
pub(super) fn offer_as(
    app: &AppHandle,
    chat_id: &str,
    action: &str,
    action_args: Value,
    label: &str,
    step: bool,
) {
    let label: String = label.chars().take(60).collect();
    let id = ulid::Ulid::new().to_string();
    {
        let state = app.state::<AppState>();
        let mut all = lock(&state.ask_proposals);
        // Small models sometimes call the same thing twice in one answer.
        let repeat = all
            .values()
            .any(|p| p.chat_id == chat_id && p.action == action && p.args == action_args);
        if repeat {
            return;
        }
        all.insert(
            id.clone(),
            Proposed {
                action: action.into(),
                args: action_args,
                label: label.clone(),
                chat_id: chat_id.to_owned(),
            },
        );
        save_proposals(app, &mut all);
    }
    let _ = app.emit(
        PROPOSAL_EVENT,
        ProposalNote {
            chat_id,
            id: &id,
            label: &label,
            step,
            undoable: crate::undo::undoable(action),
        },
    );
}

/// Runs a proposal the user tapped, logs it, and keeps Undo for files it
/// made or moved.
pub async fn run_proposal(app: &AppHandle, id: &str) -> Result<Ran, String> {
    let proposed = {
        let state = app.state::<AppState>();
        let mut all = lock(&state.ask_proposals);
        let found = all.remove(id);
        save_proposals(app, &mut all);
        found
    }
    .ok_or("That button has expired; ask again")?;
    let mut activity = crate::activity::Guard::start(app, &proposed.label);
    let result = match crate::act::run(app, &proposed.action, &proposed.args).await {
        Some(r) => r,
        None => {
            let exec = executor(&app.state::<AppState>());
            exec.run(&proposed.action, &proposed.args)
                .await
                .map_err(|e| e.to_string())
        }
    };
    let (ok, message, path) = match &result {
        Ok(o) => (true, o.message.clone(), o.path.clone()),
        Err(e) => (false, e.to_string(), None),
    };
    activity.finish(ok, message.clone());
    let undo_path = match (&result, proposed.action.as_str()) {
        (Ok(o), "move_file") => o
            .path
            .as_deref()
            .zip(proposed.args["path"].as_str())
            .map(|(now, from)| crate::undo::move_back(now, from)),
        (Ok(o), action) => crate::undo::undo_path(action, o.path.as_deref()),
        _ => None,
    };
    let record = ActionRecord {
        id: 0,
        ts: chrono::Utc::now().to_rfc3339(),
        skill_id: SKILL_ID.into(),
        action: proposed.action.clone(),
        label: proposed.label.clone(),
        ok,
        message: message.clone(),
        auto: false,
        undo_path: undo_path.clone(),
        undone: false,
    };
    let undo_id = lock(&app.state::<AppState>().storage)
        .log_action(&record)
        .ok()
        .filter(|_| undo_path.is_some());
    Ok(Ran {
        ok,
        message,
        undo_id,
        path,
    })
}
