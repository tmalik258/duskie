//! Claude Code: `claude -p` with stream-json in and out, and the permission
//! prompt tool its questions come through.

use super::*;

/// Tools the user allowed for the rest of a Claude Code session, by session.
/// Codex keeps this itself (acceptForSession). Never saved: a restart asks
/// again.
pub(super) static SESSION_ALLOWED: Mutex<
    Option<HashMap<String, std::collections::HashSet<String>>>,
> = Mutex::new(None);

/// What Claude Code's permission prompt tool gets: called by the CLI (not
/// the model) through Duskie's MCP server.
pub async fn claude_permission(app: &AppHandle, args: &Value) -> String {
    let tool = args["tool_name"].as_str().unwrap_or("a tool");
    let input = &args["input"];
    let owner = args["tool_use_id"]
        .as_str()
        .and_then(|t| with(&TOOL_OWNER, |o| o.get(t).cloned()))
        .or_else(|| with(&SESSIONS, |s| s.keys().last().cloned()));
    let Some(session) = owner else {
        return json!({ "behavior": "deny", "message": "No Duskie session is waiting for this." })
            .to_string();
    };
    // Allowed for this session already (Allow this session).
    if with(&SESSION_ALLOWED, |a| {
        a.get(&session).is_some_and(|t| t.contains(tool))
    }) {
        return json!({ "behavior": "allow", "updatedInput": input }).to_string();
    }
    let (label, detail) = describe_tool(tool, input);
    match ask(app, &session, &label, &detail).await {
        Answer::Allow => json!({ "behavior": "allow", "updatedInput": input }).to_string(),
        Answer::Always => {
            with(&SESSION_ALLOWED, |a| {
                a.entry(session.clone())
                    .or_default()
                    .insert(tool.to_owned())
            });
            json!({ "behavior": "allow", "updatedInput": input }).to_string()
        }
        Answer::Deny => {
            json!({ "behavior": "deny", "message": "The user said no. Ask them what to do instead." })
                .to_string()
        }
    }
}

/// A tool call in words: ("Edit src/main.rs", "3 lines").
pub fn describe_tool(tool: &str, input: &Value) -> (String, String) {
    let s = |k: &str| input[k].as_str().unwrap_or_default().to_owned();
    let file = || {
        let p = s("file_path");
        let p = if p.is_empty() { s("path") } else { p };
        p.rsplit(['/', '\\']).next().unwrap_or_default().to_owned()
    };
    match tool {
        "Read" => (format!("Read {}", file()), String::new()),
        "Edit" | "MultiEdit" => (format!("Edit {}", file()), String::new()),
        "Write" => (format!("Write {}", file()), String::new()),
        "Bash" => {
            let cmd = s("command");
            ("Run a command".into(), cmd.chars().take(160).collect())
        }
        "Grep" => (format!("Search for {}", s("pattern")), String::new()),
        "Glob" => (format!("Find files {}", s("pattern")), String::new()),
        "WebFetch" => (format!("Read {}", s("url")), String::new()),
        "WebSearch" => {
            let q = s("query");
            if q.is_empty() {
                ("Search the web".into(), String::new())
            } else {
                (format!("Search the web for {q}"), q)
            }
        }
        "TodoWrite" => ("Update the plan".into(), String::new()),
        other => (
            other
                .trim_start_matches("mcp__")
                .replace("__", " ")
                .replace('_', " "),
            String::new(),
        ),
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn run_claude(
    app: &AppHandle,
    id: &str,
    exe: &Path,
    path: &Path,
    mode: Mode,
    model: Option<String>,
    effort: Option<&str>,
    mcp_config: &Path,
    resume: Option<String>,
    mut rx: mpsc::UnboundedReceiver<Cmd>,
) -> Result<(), String> {
    let mut cmd = tokio::process::Command::new(exe);
    if let Some(t) = effort.and_then(thinking_tokens) {
        cmd.env("MAX_THINKING_TOKENS", t);
    }
    if let Some(r) = &resume {
        cmd.args(["--resume", r]);
    }
    cmd.args([
        "-p",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--permission-mode",
        mode.claude(),
    ]);
    if let Some(m) = model {
        cmd.args(["--model", &m]);
    }
    if mcp_config.is_file() {
        cmd.arg("--mcp-config").arg(mcp_config);
        if mode != Mode::Full {
            cmd.args(["--permission-prompt-tool", "mcp__duskie__duskie_permission"]);
        }
    }
    cmd.current_dir(path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    crate::agents::hide_console(&mut cmd);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("could not start Claude Code: {e}"))?;
    let stderr = keep_stderr(&mut child);
    if let Some(pid) = child.id() {
        with(&PIDS, |p| p.insert(id.to_owned(), pid));
    }
    let mut stdin = child.stdin.take().ok_or("no stdin")?;
    let mut lines = BufReader::new(child.stdout.take().ok_or("no stdout")?).lines();
    loop {
        tokio::select! {
            cmd = rx.recv() => match cmd {
                Some(Cmd::Send(text)) => {
                    let mut line = json!({
                        "type": "user",
                        "message": { "role": "user", "content": super::images::claude_content(&text) },
                    })
                    .to_string();
                    line.push('\n');
                    stdin.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;
                    stdin.flush().await.map_err(|e| e.to_string())?;
                    emit(app, id, json!({ "kind": "working", "mode": mode }));
                }
                Some(Cmd::Control(_)) => {},
                Some(Cmd::Restart) => {
                    let _ = child.kill().await;
                    return Err(RESTARTED.into());
                }
                Some(Cmd::Stop) => {
                    let _ = child.kill().await;
                    return Err(INTERRUPTED.into());
                }
                None => {
                    let _ = child.kill().await;
                    return Ok(());
                }
            },
            line = lines.next_line() => {
                let Ok(Some(line)) = line else {
                    let _ = child.wait().await;
                    return Err(why_stopped("Claude Code", &lock(&stderr)));
                };
                let Ok(v) = serde_json::from_str::<Value>(&line) else { continue };
                for data in claude_events(&v, Some(path)) {
                    if data["kind"] == "session" {
                        let resume = data["resume"].as_str().map(str::to_owned);
                        with(&SESSIONS, |s| if let Some(h) = s.get_mut(id) { h.resume = resume });
                        save();
                        continue;
                    }
                    if data["kind"] == "step" && data["state"] == "running"
                        && let Some(t) = data["id"].as_str()
                    {
                        with(&TOOL_OWNER, |o| o.insert(t.to_owned(), id.to_owned()));
                    }
                    if data["kind"] == "turn" {
                        complete_turn(app, id, data).await;
                    } else { emit(app, id, data); }
                }
            }
        }
    }
}

/// What one stream-json line means for the island.
/// `project` is the session cwd, used to find Claude plan files on disk.
pub fn claude_events(v: &Value, project: Option<&Path>) -> Vec<Value> {
    let mut out = Vec::new();
    match v["type"].as_str() {
        Some("system") if v["subtype"] == "init" => {
            if let Some(s) = v["session_id"].as_str() {
                out.push(json!({ "kind": "session", "resume": s }));
            }
        }
        Some("stream_event") => {
            let e = &v["event"];
            if e["type"] == "content_block_delta" && e["delta"]["type"] == "text_delta" {
                out.push(json!({ "kind": "text", "text": e["delta"]["text"] }));
            }
        }
        Some("assistant") => {
            // What this call read is how full the context is now. The
            // result's usage adds up every call in the turn, so it reads high.
            let u = &v["message"]["usage"];
            let used = [
                "input_tokens",
                "cache_read_input_tokens",
                "cache_creation_input_tokens",
            ]
            .iter()
            .filter_map(|k| u[k].as_u64())
            .sum::<u64>();
            if used > 0 {
                out.push(json!({ "kind": "usage", "used": used, "window": CLAUDE_WINDOW }));
            }
            for b in v["message"]["content"].as_array().into_iter().flatten() {
                if b["type"] != "tool_use" {
                    continue;
                }
                let name = b["name"].as_str().unwrap_or_default();
                if name == "TodoWrite" {
                    let items: Vec<Value> = b["input"]["todos"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .map(|t| json!({ "text": t["content"], "status": t["status"] }))
                        .collect();
                    out.push(json!({ "kind": "plan", "items": items }));
                    continue;
                }
                // Ready for review: prefer inline plan text, else the plan file on disk.
                if name == "ExitPlanMode" {
                    if let Some(plan) = plans::read_exit_plan(&b["input"], project) {
                        out.push(json!({ "kind": "plan_doc", "text": plan }));
                    }
                    continue;
                }
                // The agent's own multiple-choice question, with its options.
                if name == "AskUserQuestion" && b["input"]["questions"].is_array() {
                    out.push(json!({
                        "kind": "choose", "id": b["id"], "questions": b["input"]["questions"],
                    }));
                    continue;
                }
                // Writing the plan file is itself the document when ExitPlanMode has no text.
                if matches!(name, "Write" | "Edit" | "write_file") {
                    let path = b["input"]["file_path"]
                        .as_str()
                        .or_else(|| b["input"]["path"].as_str())
                        .unwrap_or_default();
                    if plans::is_plan_file_path(path) {
                        let from_input = b["input"]["content"]
                            .as_str()
                            .or_else(|| b["input"]["new_string"].as_str())
                            .map(str::trim)
                            .filter(|t| !t.is_empty())
                            .map(str::to_owned);
                        let from_disk = std::fs::read_to_string(path)
                            .ok()
                            .filter(|t| !t.trim().is_empty());
                        if let Some(text) = from_input.or(from_disk) {
                            out.push(json!({ "kind": "plan_doc", "text": text }));
                        }
                    }
                }
                let (label, detail) = describe_tool(name, &b["input"]);
                out.push(json!({
                    "kind": "step", "id": b["id"], "tool": name, "label": label,
                    "detail": detail, "state": "running",
                }));
            }
        }
        Some("user") => {
            for b in v["message"]["content"].as_array().into_iter().flatten() {
                if b["type"] == "tool_result" {
                    let failed = b["is_error"].as_bool().unwrap_or(false);
                    let text = match &b["content"] {
                        Value::String(t) => t.clone(),
                        Value::Array(parts) => parts
                            .iter()
                            .filter_map(|p| p["text"].as_str())
                            .collect::<Vec<_>>()
                            .join("\n"),
                        _ => String::new(),
                    };
                    out.push(json!({
                        "kind": "step", "id": b["tool_use_id"],
                        "state": if failed { "failed" } else { "done" },
                        "output": tail(&text),
                    }));
                }
            }
        }
        // The plan's usage limits: "allowed", "allowed_warning" near the
        // limit, "rejected" at it.
        Some("rate_limit_event") => {
            let r = &v["rate_limit_info"];
            if let Some(status) = r["status"].as_str() {
                out.push(json!({
                    "kind": "limit",
                    "status": status,
                    "window": r["rateLimitType"],
                    "resetsAt": r["resetsAt"],
                    "used": r["utilization"],
                }));
            }
        }
        Some("result") => {
            let failed = v["is_error"].as_bool().unwrap_or(false);
            out.push(json!({
                "kind": "turn",
                "error": if failed { v["result"].clone() } else { Value::Null },
            }));
        }
        _ => {}
    }
    out
}
