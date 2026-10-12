from pathlib import Path
p = Path('apps/desktop/src-tauri/src/sessions.rs')
s = p.read_text(encoding='utf-8')
a = s.index('    let mut next_id = 0u64;', s.index('async fn run_codex('))
b = s.index('    let (sandbox, approval)', a)
s = s[:a] + '    codex_initialize(&mut stdin, &mut lines).await?;\n    let mut next_id = 1u64;\n' + s[b:]
a = s.index('                if v.get("method").is_none() && let Some(rid)')
b = s.index('                // Approval requests:', a)
s = s[:a] + '''                if let Some((method, result)) = rpc_response(&v, &mut pending) {
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
''' + s[b:]
s = s.replace('''                    thread = t;
                    for text''', '''                    thread = t;
                    if thread.is_none() { return Err("Codex returned no thread ID".into()); }
                    for text''')
p.write_text(s, encoding='utf-8')
