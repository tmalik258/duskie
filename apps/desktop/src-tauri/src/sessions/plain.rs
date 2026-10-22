//! CLIs run once per message (Copilot, Cursor): their arguments, the run
//! and Cursor's stream-json events.

use super::*;

/// One turn's arguments for a CLI run once per message (Copilot, Cursor).
/// They cannot ask in the island, so the mode decides up front what they
/// may do; review and undo still cover every change.
pub(super) fn plain_args(agent: Agent, mode: Mode, text: &str, again: bool) -> Vec<String> {
    let mut a: Vec<String> = vec!["-p".into(), text.into()];
    match agent {
        Agent::Copilot => {
            if again {
                a.push("--continue".into());
            }
            match mode {
                Mode::Full => a.push("--allow-all-tools".into()),
                Mode::Edit | Mode::Debug | Mode::Ask => {
                    a.extend(["--allow-all-tools", "--deny-tool", "shell"].map(String::from))
                }
                Mode::Plan => a.extend(
                    [
                        "--allow-all-tools",
                        "--deny-tool",
                        "write",
                        "--deny-tool",
                        "shell",
                    ]
                    .map(String::from),
                ),
            }
        }
        _ => {
            // Cursor streams each step as JSON, so its sessions are as live as Codex.
            a.extend(["--output-format", "stream-json"].map(String::from));
            if matches!(mode, Mode::Full | Mode::Edit | Mode::Debug) {
                a.push("--force".into());
            }
        }
    }
    a
}

/// Runs a CLI that takes one prompt per process, streaming what it prints.
/// A message sent mid-turn runs as the next turn.
pub(super) async fn run_plain(
    app: &AppHandle,
    id: &str,
    agent: Agent,
    exe: &Path,
    path: &Path,
    mode: Mode,
    mut rx: mpsc::UnboundedReceiver<Cmd>,
) -> Result<(), String> {
    let mut turns = 0usize;
    // Cursor's own chat id, so later turns carry on the same chat.
    let mut chat: Option<String> = None;
    let mut queued: std::collections::VecDeque<String> = std::collections::VecDeque::new();
    loop {
        let text = match queued.pop_front() {
            Some(t) => t,
            None => match rx.recv().await {
                Some(Cmd::Send(t)) => t,
                Some(Cmd::Control(_)) => continue,
                // Already idle: Esc is a no-op; keep waiting for a message.
                Some(Cmd::Stop) => continue,
                Some(Cmd::Restart) | None => return Ok(()),
            },
        };
        emit(app, id, json!({ "kind": "working", "mode": mode }));
        let mut cmd = tokio::process::Command::new(exe);
        cmd.args(plain_args(agent, selected_mode(id, mode), &text, turns > 0));
        if let Some(c) = chat.as_ref().filter(|_| agent == Agent::Cursor) {
            cmd.args(["--resume", c]);
        }
        cmd.current_dir(path)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        crate::agents::hide_console(&mut cmd);
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("could not start {}: {e}", agent.name()))?;
        turns += 1;
        let stderr = keep_stderr(&mut child);
        if let Some(pid) = child.id() {
            with(&PIDS, |p| p.insert(id.to_owned(), pid));
        }
        let mut lines = BufReader::new(child.stdout.take().ok_or("no stdout")?).lines();
        let mut stopped = false;
        loop {
            tokio::select! {
                line = lines.next_line() => match line {
                    Ok(Some(line)) if agent == Agent::Cursor => {
                        let Ok(v) = serde_json::from_str::<Value>(&line) else { continue };
                        if let Some(c) = v["session_id"].as_str() {
                            chat = Some(c.to_owned());
                        }
                        for e in cursor_events(&v) {
                            emit(app, id, e);
                        }
                    }
                    Ok(Some(line)) => emit(app, id, json!({ "kind": "text", "text": format!("{line}\n") })),
                    _ => break,
                },
                cmd = rx.recv() => match cmd {
                    Some(Cmd::Send(more)) => queued.push_back(more),
                    Some(Cmd::Control(_)) => {},
                    Some(Cmd::Stop) => {
                        let _ = child.kill().await;
                        stopped = true;
                        break;
                    }
                    Some(Cmd::Restart) | None => {
                        let _ = child.kill().await;
                        return Ok(());
                    }
                },
            }
        }
        let ok = !stopped && child.wait().await.is_ok_and(|s| s.success());
        let error = (!stopped && !ok).then(|| why_stopped(agent.name(), &lock(&stderr)));
        if stopped {
            cancel_running_steps(app, id);
        }
        complete_turn(app, id, json!({ "kind": "turn", "error": error })).await;
    }
}

/// What one line of `cursor-agent --output-format stream-json` means for
/// the island.
pub fn cursor_events(v: &Value) -> Vec<Value> {
    match v["type"].as_str() {
        Some("assistant") => v["message"]["content"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|c| c["text"].as_str())
            .map(|t| json!({ "kind": "text", "text": t }))
            .collect(),
        Some("tool_call") => {
            let call = v["tool_call"].as_object();
            let (name, body) = call
                .and_then(|o| o.iter().next())
                .map(|(k, b)| (k.trim_end_matches("ToolCall").to_owned(), b.clone()))
                .unwrap_or_default();
            let args = &body["args"];
            let detail = args["path"]
                .as_str()
                .or_else(|| args["command"].as_str())
                .or_else(|| args["pattern"].as_str())
                .unwrap_or("");
            let label = match name.as_str() {
                "read" => "Read",
                "edit" | "write" => "Edit",
                "shell" => "Run",
                "grep" | "glob" | "ls" => "Search",
                _ => "Step",
            };
            let done = v["subtype"] == "completed";
            let failed = done && body["result"].get("error").is_some();
            vec![json!({
                "kind": "step",
                "id": v["call_id"].as_str().unwrap_or(""),
                "tool": name,
                "label": label,
                "detail": shown_command(detail),
                "state": if failed { "failed" } else if done { "done" } else { "running" },
            })]
        }
        _ => Vec::new(),
    }
}
