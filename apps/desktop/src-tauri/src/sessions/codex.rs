//! Codex: `codex app-server` over JSON-RPC, its approvals and questions,
//! and what its events mean for the island.

use super::*;

pub(super) fn codex_turn_params(
    id: &str,
    thread: &str,
    input: Value,
    path: &Path,
    fallback: Mode,
    default_model: Option<&str>,
) -> Result<Value, String> {
    let mode = selected_mode(id, fallback);
    let tune = tuned(id);
    let model = tune
        .model
        .as_deref()
        .or(default_model)
        .ok_or("Codex collaboration mode requires a configured model")?;
    let effort = tune.effort.as_deref().map(|e| {
        if e == "max" {
            "xhigh"
        } else if e == "off" {
            "none"
        } else {
            e
        }
    });
    let sandbox = match mode {
        Mode::Plan => json!({"type":"readOnly"}),
        Mode::Full => json!({"type":"dangerFullAccess"}),
        _ => {
            json!({"type":"workspaceWrite","writableRoots":[path.to_string_lossy()],"networkAccess":false})
        }
    };
    // Clarifying choices become Duskie's selectable list when written as OPTION lines.
    // Plan mode also needs a structured collaboration plan Duskie can show and edit.
    let instructions = if mode == Mode::Plan {
        "You are in Plan mode (read-only). Produce a plan the user can review before any changes. \
When the user must choose first, ask in one short sentence, then end with up to six lines each starting with OPTION: and a short label in their words. \
When several choices may all apply, use OPTION_MULTI: lines instead (checkboxes + Confirm). \
After they answer (or when no choice is needed), put the plan in the collaboration plan document and say the plan is ready for review. \
Never say the plan is ready without that document. Do not implement or write files in Plan mode."
    } else {
        "When the user must choose before you continue, ask in one short sentence, \
then end with up to six lines each starting with OPTION: and a short label in their words. \
When several choices may all apply, use OPTION_MULTI: lines instead. \
Do not leave the only choices buried in prose."
    };
    Ok(
        json!({"threadId":thread,"input":input,"model":model,"effort":effort,
        "approvalPolicy":mode.codex().1,"sandboxPolicy":sandbox,
        "collaborationMode":{"mode":if mode == Mode::Plan {"plan"} else {"default"},
            "settings":{"model":model,"reasoning_effort":effort,"developer_instructions":instructions}}}),
    )
}

pub(super) fn codex_limits(p: &Value) -> Vec<Value> {
    let mut out = Vec::new();
    let limits: Vec<(&str, &Value)> = match p["rateLimitsByLimitId"].as_object() {
        Some(map) if !map.is_empty() => map.iter().map(|(k, v)| (k.as_str(), v)).collect(),
        _ => vec![("codex", &p["rateLimits"])],
    };
    for (id, limit) in limits {
        for key in ["primary", "secondary"] {
            let w = &limit[key];
            if let Some(used) = w["usedPercent"].as_f64() {
                let mins = w["windowDurationMins"].as_u64();
                let window: String = match mins {
                    Some(300) => "five_hour".into(),
                    Some(10080) => "seven_day".into(),
                    Some(n) => format!("{n} minutes"),
                    None => key.into(),
                };
                let window = if id == "codex" {
                    window
                } else {
                    format!("{id}: {window}")
                };
                out.push(json!({"kind":"limit","status":if used >= 100.0 {"rejected"} else {"allowed"},"window":window,"used":used / 100.0,"resetsAt":w["resetsAt"]}));
            }
        }
    }
    out
}

pub(super) async fn write_line<W: tokio::io::AsyncWrite + Unpin>(
    stdin: &mut W,
    v: Value,
) -> Result<(), String> {
    let mut line = v.to_string();
    line.push('\n');
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())
}

pub(super) async fn codex_initialize<
    W: tokio::io::AsyncWrite + Unpin,
    R: tokio::io::AsyncBufRead + Unpin,
>(
    stdin: &mut W,
    lines: &mut tokio::io::Lines<R>,
) -> Result<(), String> {
    write_line(stdin, json!({"id":1,"method":"initialize","params":{
        "clientInfo":{"name":"duskie","version":env!("CARGO_PKG_VERSION")},"capabilities":{"experimentalApi":true}}})).await?;
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            let line = lines
                .next_line()
                .await
                .map_err(|e| e.to_string())?
                .ok_or("Codex stopped during initialization")?;
            let Ok(v) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            if v["id"] == 1 && v.get("method").is_none() {
                if let Some(e) = v["error"]["message"].as_str() {
                    return Err(format!("Codex initialize: {e}"));
                }
                if v.get("result").is_none() {
                    return Err("Invalid Codex initialization response".into());
                }
                break;
            }
        }
        write_line(stdin, json!({"method":"initialized"})).await
    })
    .await
    .map_err(|_| "Codex initialization timed out".to_owned())?
}

pub(super) fn rpc_response(
    v: &Value,
    pending: &mut HashMap<u64, String>,
) -> Option<(String, Result<Value, String>)> {
    if v.get("method").is_some() {
        return None;
    }
    let method = pending.remove(&v["id"].as_u64()?)?;
    let result = match v.get("error") {
        Some(e) => Err(e["message"]
            .as_str()
            .unwrap_or("Unsupported or rejected Codex request")
            .into()),
        None => v
            .get("result")
            .cloned()
            .ok_or_else(|| "Invalid Codex response: missing result".into()),
    };
    Some((method, result))
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn run_codex(
    app: &AppHandle,
    id: &str,
    exe: &Path,
    path: &Path,
    mode: Mode,
    model: Option<String>,
    resume: Option<String>,
    mut rx: mpsc::UnboundedReceiver<Cmd>,
) -> Result<(), String> {
    let mut cmd = tokio::process::Command::new(exe);
    cmd.arg("app-server")
        .current_dir(path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    crate::agents::hide_console(&mut cmd);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("could not start Codex: {e}"))?;
    let stderr = keep_stderr(&mut child);
    if let Some(pid) = child.id() {
        with(&PIDS, |p| p.insert(id.to_owned(), pid));
    }
    let mut stdin = child.stdin.take().ok_or("no stdin")?;
    let mut lines = BufReader::new(child.stdout.take().ok_or("no stdout")?).lines();
    codex_initialize(&mut stdin, &mut lines).await?;
    let mut next_id = 1u64;
    let (sandbox, approval) = mode.codex();
    let mut params =
        json!({ "cwd": path.to_string_lossy(), "sandbox": sandbox, "approvalPolicy": approval });
    if let Some(m) = &model {
        params["model"] = json!(m);
    }
    next_id += 1;
    let thread_req = next_id;
    // Resume picks up the same thread; otherwise a new one.
    let (method, params) = match &resume {
        Some(t) => ("thread/resume", json!({ "threadId": t })),
        None => ("thread/start", params),
    };
    write_line(
        &mut stdin,
        json!({ "id": thread_req, "method": method, "params": params }),
    )
    .await?;
    let mut thread: Option<String> = None;
    let mut turn: Option<String> = None;
    // A mode chosen during an active Codex turn is deliberately held for the
    // following turn: a steer belongs to the already-running turn.
    let mut active_mode = mode;
    let mut pending: HashMap<u64, String> = HashMap::new();
    next_id += 1;
    pending.insert(next_id, "account/rateLimits/read".into());
    write_line(
        &mut stdin,
        json!({"id":next_id,"method":"account/rateLimits/read"}),
    )
    .await?;
    // Messages typed before the thread opened.
    let mut queued: Vec<String> = Vec::new();
    // Codex's own open question: the next message answers it.
    let mut open_input: Option<(Value, Vec<String>)> = None;
    loop {
        tokio::select! {
            cmd = rx.recv() => match cmd {
                Some(Cmd::Send(text)) => {
                    if let Some((rid, ids)) = open_input.take() {
                        write_line(&mut stdin, json!({ "id": rid, "result": codex_input_answer(&ids, &text) })).await?;
                        emit(app, id, json!({"kind":"working"}));
                        continue;
                    }
                    let Some(t) = thread.clone() else { queued.push(text); continue };
                    if pending.values().any(|m| m == "turn/start") { queued.push(text); continue; }
                    if turn.is_some() && selected_mode(id, mode) != active_mode { queued.push(text); continue; }
                    next_id += 1;
                    let input = json!([{ "type": "text", "text": text }]);
                    let msg = match &turn {
                        Some(active) => json!({ "id": next_id, "method": "turn/steer",
                            "params": { "threadId": t, "expectedTurnId": active, "input": input } }),
                        None => {
                            active_mode = selected_mode(id, mode);
                            let params = codex_turn_params(id, &t, input, path, mode, model.as_deref())?;
                            json!({ "id": next_id, "method": "turn/start", "params": params })
                        }
                    };
                    pending.insert(next_id, msg["method"].as_str().unwrap_or_default().into());
                    write_line(&mut stdin, msg).await?;
                    if turn.is_none() { emit(app, id, json!({ "kind": "working", "mode": selected_mode(id, mode) })); }
                    else { emit(app, id, json!({"kind":"working"})); }
                }
                Some(Cmd::Control(method)) => {
                    if method == "thread/compact/start" && turn.is_some() {
                        emit(app, id, json!({"kind":"control_error","error":"Wait for the turn to finish before compacting."}));
                        continue;
                    }
                    let params = if method == "thread/compact/start" {
                        let Some(t) = &thread else { emit(app,id,json!({"kind":"control_error","error":"Codex is still connecting."})); continue; };
                        json!({"threadId":t})
                    } else { json!({}) };
                    next_id += 1;
                    pending.insert(next_id, method.clone());
                    write_line(&mut stdin, json!({"id":next_id,"method":method,"params":params})).await?;
                    if method == "thread/compact/start" { emit(app,id,json!({"kind":"compaction","state":"running"})); }
                }
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
                    return Err(why_stopped("Codex", &lock(&stderr)));
                };
                let Ok(v) = serde_json::from_str::<Value>(&line) else { continue };
                if v["id"] == thread_req && v.get("method").is_none() {
                    if let Some(err) = v["error"]["message"].as_str() {
                        return Err(why_stopped("Codex", err));
                    }
                    let t = v["result"]["thread"]["id"].as_str().map(str::to_owned);
                    with(&SESSIONS, |s| if let Some(h) = s.get_mut(id) { h.resume = t.clone() });
                    save();
                    thread = t;
                    if thread.is_none() { return Err("Codex returned no thread ID".into()); }
                    for text in std::mem::take(&mut queued) {
                        with(&SESSIONS, |s| { if let Some(h) = s.get(id) { let _ = h.tx.send(Cmd::Send(text)); } });
                    }
                    continue;
                }
                if let Some((method, result)) = rpc_response(&v, &mut pending) {
                    match result {
                        Err(e) => {
                            emit(app, id, json!({"kind":"control_error","error":format!("{method}: {e}")}));
                            if method == "turn/start" { complete_turn(app, id, json!({"kind":"turn","error":e})).await; }
                            if method == "thread/compact/start" { emit(app,id,json!({"kind":"compaction","state":"failed"})); }
                        }
                        Ok(result) if method == "account/rateLimits/read" => {
                            for data in codex_limits(&result) { emit(app, id, data); }
                        }
                        Ok(result) if method == "turn/start" => {
                            turn = result["turn"]["id"].as_str().map(str::to_owned);
                            if turn.is_none() { return Err("Codex turn/start returned no turn ID".into()); }
                            for text in std::mem::take(&mut queued) { with(&SESSIONS, |s| { if let Some(h) = s.get(id) { let _ = h.tx.send(Cmd::Send(text)); } }); }
                        }
                        _ => {}
                    }
                    continue;
                }
                // Approval requests: ask in the island, answer Codex.
                if let (Some(method), Some(rid)) = (v["method"].as_str(), v.get("id"))
                    && method.ends_with("requestApproval")
                {
                    let p = &v["params"];
                    let (label, detail) = if method.contains("commandExecution") {
                        ("Run a command".to_owned(), shown_command(p["command"].as_str().unwrap_or_default()))
                    } else {
                        ("Change files".to_owned(), p["reason"].as_str().unwrap_or_default().to_owned())
                    };
                    let decision = match ask(app, id, &label, &detail).await {
                        Answer::Allow => "accept",
                        Answer::Always => "acceptForSession",
                        Answer::Deny => "decline",
                    };
                    write_line(&mut stdin, json!({ "id": rid, "result": { "decision": decision } })).await?;
                    continue;
                }
                // Codex asks the user a question with options.
                if let (Some("item/tool/requestUserInput"), Some(rid)) = (v["method"].as_str(), v.get("id")) {
                    let (ids, questions) = codex_questions(&v["params"]);
                    open_input = Some((rid.clone(), ids));
                    emit(app, id, json!({ "kind": "choose", "id": rid, "questions": questions }));
                    continue;
                }
                if v["method"] == "turn/started" {
                    turn = v["params"]["turn"]["id"].as_str().map(str::to_owned);
                }
                if v["method"] == "turn/completed" {
                    turn = None;
                    for text in std::mem::take(&mut queued) {
                        with(&SESSIONS, |s| { if let Some(h) = s.get(id) { let _ = h.tx.send(Cmd::Send(text)); } });
                    }
                }
                for data in codex_events(&v) {
                    if data["kind"] == "turn_diff" {
                        let nonempty = data["diff"].as_str().is_some_and(|d| !d.trim().is_empty());
                        if nonempty {
                            reviews::note_diff(id);
                        }
                        emit(app, id, data);
                    } else if data["kind"] == "turn" {
                        complete_turn(app, id, data).await;
                    } else {
                        emit(app, id, data);
                    }
                }
            }
        }
    }
}

/// Codex's question request as the same question shape Claude Code uses,
/// with the ids to answer under.
pub fn codex_questions(p: &Value) -> (Vec<String>, Vec<Value>) {
    let mut ids = Vec::new();
    let mut out = Vec::new();
    for q in p["questions"].as_array().into_iter().flatten() {
        ids.push(q["id"].as_str().unwrap_or_default().to_owned());
        let options: Vec<Value> = q["options"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|o| json!({ "label": o["label"], "description": o["description"] }))
            .collect();
        out.push(json!({
            "question": q["question"],
            "header": q["header"],
            "multiSelect": false,
            "options": options,
        }));
    }
    (ids, out)
}

/// The answer to a Codex question request: the user's reply for each question.
pub fn codex_input_answer(ids: &[String], text: &str) -> Value {
    let answers: serde_json::Map<String, Value> = ids
        .iter()
        .map(|i| (i.clone(), json!({ "answers": [text] })))
        .collect();
    json!({ "answers": answers })
}

/// What one app-server notification means for the island.
pub fn codex_events(v: &Value) -> Vec<Value> {
    let p = &v["params"];
    let item = &p["item"];
    let mut out = Vec::new();
    match v["method"].as_str() {
        Some("item/agentMessage/delta") => out.push(json!({ "kind": "text", "text": p["delta"] })),
        Some(m @ ("item/started" | "item/completed")) => {
            let done = m == "item/completed";
            if item["type"] == "contextCompaction" {
                out.push(json!({"kind":"compaction","state":if done {"done"} else {"running"}}));
                return out;
            }
            let (tool, label, detail) = match item["type"].as_str() {
                Some("commandExecution") => (
                    "Bash",
                    "Run a command".to_owned(),
                    shown_command(item["command"].as_str().unwrap_or_default()),
                ),
                Some("fileChange") => {
                    let files: Vec<String> = item["changes"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .filter_map(|c| c["path"].as_str())
                        .map(|p| p.rsplit(['/', '\\']).next().unwrap_or(p).to_owned())
                        .collect();
                    ("Edit", format!("Edit {}", files.join(", ")), String::new())
                }
                Some("mcpToolCall") => (
                    "Mcp",
                    item["tool"].as_str().unwrap_or("tool").replace('_', " "),
                    String::new(),
                ),
                Some("webSearch") => {
                    let q = web_search_query(item);
                    let label = if q.is_empty() {
                        "Search the web".into()
                    } else {
                        format!("Search the web for {q}")
                    };
                    ("WebSearch", label, q)
                }
                // Plan-mode document from Codex, full markdown, not a tool step.
                Some("plan") => {
                    if done
                        && let Some(text) = item["text"].as_str().filter(|t| !t.trim().is_empty())
                    {
                        out.push(json!({ "kind": "plan_doc", "text": text }));
                    }
                    return out;
                }
                _ => return out,
            };
            let failed = done
                && (item["status"] == "failed"
                    || item["exitCode"].as_i64().is_some_and(|c| c != 0));
            out.push(json!({
                "kind": "step", "id": item["id"], "tool": tool, "label": label, "detail": detail,
                "state": if !done { "running" } else if failed { "failed" } else { "done" },
                "output": tail(item["aggregatedOutput"].as_str().unwrap_or_default()),
            }));
        }
        Some("turn/plan/updated") => {
            let items: Vec<Value> = p["plan"]
                .as_array()
                .into_iter()
                .flatten()
                .map(|s| {
                    let status = match s["status"].as_str() {
                        Some("inProgress") => "in_progress",
                        Some(other) => other,
                        None => "pending",
                    };
                    json!({ "text": s["step"], "status": status })
                })
                .collect();
            out.push(json!({ "kind": "plan", "items": items }));
        }
        Some("thread/tokenUsage/updated") => {
            let u = &p["tokenUsage"];
            let used = u["last"]["totalTokens"]
                .as_u64()
                .or_else(|| u["last"]["inputTokens"].as_u64())
                .unwrap_or(0);
            let window = u["modelContextWindow"].as_u64().unwrap_or(0);
            if window > 0 {
                out.push(json!({ "kind": "usage", "used": used, "window": window, "total":u["total"]["totalTokens"] }));
            }
        }
        Some("account/rateLimits/updated") => out.extend(codex_limits(p)),
        Some("thread/compacted") => out.push(json!({"kind":"compaction","state":"done"})),
        Some("turn/diff/updated") => out.push(json!({"kind":"turn_diff","diff":p["diff"]})),
        Some("turn/completed") => {
            let failed = p["turn"]["status"] == "failed";
            out.push(json!({
                "kind": "turn",
                "error": if failed { p["turn"]["error"]["message"].clone() } else { Value::Null },
            }));
        }
        _ => {}
    }
    out
}

/// Codex often starts a webSearch with an empty `query` and only fills
/// `action.query` / `action.queries` when the item completes.
pub(super) fn web_search_query(item: &Value) -> String {
    let top = item["query"].as_str().unwrap_or("").trim();
    if !top.is_empty() {
        return top.to_owned();
    }
    let action = &item["action"];
    if let Some(q) = action["query"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return q.to_owned();
    }
    if let Some(parts) = action["queries"].as_array() {
        let joined: Vec<&str> = parts
            .iter()
            .filter_map(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .collect();
        if !joined.is_empty() {
            return joined.join(", ");
        }
    }
    action["url"]
        .as_str()
        .or_else(|| action["pattern"].as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("")
        .to_owned()
}

/// The command as the user would type it. Codex wraps each one as
/// `"C:\\...\\pwsh.exe" -Command "..."`; only the inner part matters.
pub(super) fn shown_command(cmd: &str) -> String {
    let cmd = cmd.trim();
    let lower = cmd.to_ascii_lowercase();
    let wrapped = lower.starts_with('"')
        || lower.contains("powershell")
        || lower.contains("pwsh")
        || lower.contains("cmd.exe");
    let inner = ["-command ", "-c ", "/c "]
        .iter()
        .filter(|_| wrapped)
        .find_map(|flag| lower.find(flag).map(|i| &cmd[i + flag.len()..]))
        .unwrap_or(cmd)
        .trim();
    let inner = inner
        .strip_prefix('"')
        .and_then(|s| s.strip_suffix('"'))
        .unwrap_or(inner);
    inner.replace("\\\\", "\\")
}
