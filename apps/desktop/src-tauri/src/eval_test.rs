//! 100 real prompts and the tool each should call first (or none), in
//! evals/prompts.json. The file is checked on every test run; the model run
//! is ignored by default and runs before each release against a local
//! Ollama:
//!
//! DUSKIE_EVAL_MODEL=qwen3:4b cargo test -p duskie-desktop eval -- --ignored --nocapture
//!
//! DUSKIE_EVAL_URL changes the server and DUSKIE_EVAL_MIN the pass rate
//! (0.85 by default).

use std::sync::Mutex;

use duskie_ai::{CancellationToken, ChatRequest, Message, OpenAiCompat, Sink, ToolRunner};
use serde::Deserialize;
use serde_json::Value;

const PROMPTS: &str = include_str!("../evals/prompts.json");

#[derive(Deserialize)]
struct Case {
    prompt: String,
    /// One tool name, several that are each fine, or null for no call.
    tool: Value,
    #[serde(default)]
    args: serde_json::Map<String, Value>,
}

fn cases() -> Vec<Case> {
    serde_json::from_str(PROMPTS).expect("evals/prompts.json parses")
}

fn tools_of(case: &Case) -> Vec<&str> {
    match &case.tool {
        Value::String(s) => vec![s.as_str()],
        Value::Array(a) => a.iter().filter_map(Value::as_str).collect(),
        _ => Vec::new(),
    }
}

/// Whether an actual value matches what the case expects: words are
/// contained (any case), lists are "any of", numbers compare as numbers.
fn fits(want: &Value, got: &Value) -> bool {
    match want {
        Value::Array(any) => any.iter().any(|w| fits(w, got)),
        Value::String(w) => got
            .as_str()
            .is_some_and(|g| g.to_lowercase().contains(&w.to_lowercase())),
        Value::Number(n) => {
            let g = got
                .as_f64()
                .or_else(|| got.as_str().and_then(|s| s.trim().parse().ok()));
            g == n.as_f64()
        }
        other => got == other,
    }
}

/// What is wrong with the first call, or None when it is right.
fn judge(case: &Case, first: Option<&(String, Value)>) -> Option<String> {
    let want = tools_of(case);
    match (want.is_empty(), first) {
        (true, None) => None,
        (true, Some((name, _))) => Some(format!("called {name}, wanted no tool")),
        (false, None) => Some(format!("no tool, wanted {}", want.join(" or "))),
        (false, Some((name, args))) => {
            if !want.contains(&name.as_str()) {
                return Some(format!("called {name}, wanted {}", want.join(" or ")));
            }
            // Arguments are only checked when the first choice was the main tool.
            if name != want[0] {
                return None;
            }
            case.args
                .iter()
                .find(|(k, v)| !fits(v, &args[k.as_str()]))
                .map(|(k, v)| format!("{name} {k} = {}, wanted {v}", args[k.as_str()]))
        }
    }
}

#[test]
fn prompt_set_names_real_tools_and_arguments() {
    let defs = crate::ask_tools::defs();
    let cases = cases();
    assert_eq!(cases.len(), 100);
    let mut wrong = Vec::new();
    for c in &cases {
        let tools = tools_of(c);
        for t in &tools {
            if !defs.iter().any(|d| d.name == *t) {
                wrong.push(format!("{}: no tool {t}", c.prompt));
            }
        }
        let Some(def) = tools
            .first()
            .and_then(|t| defs.iter().find(|d| d.name == *t))
        else {
            continue;
        };
        for (k, v) in &c.args {
            let prop = &def.parameters["properties"][k.as_str()];
            if prop.is_null() {
                wrong.push(format!("{}: {} has no {k}", c.prompt, def.name));
            } else if let Some(allowed) = prop["enum"].as_array() {
                let vals = v.as_array().cloned().unwrap_or_else(|| vec![v.clone()]);
                if let Some(bad) = vals.iter().find(|x| !allowed.contains(x)) {
                    wrong.push(format!("{}: {k} {bad} is not allowed", c.prompt));
                }
            }
        }
    }
    assert!(wrong.is_empty(), "{}", wrong.join("\n"));
}

#[test]
fn judging_is_exact_about_tools_and_loose_about_words() {
    let c: Case = serde_json::from_value(serde_json::json!({
        "prompt": "open spotify", "tool": "windows",
        "args": { "action": "launch", "name": "spotify" }
    }))
    .unwrap();
    let call = |n: &str, a: Value| Some((n.to_owned(), a));
    let ok = call(
        "windows",
        serde_json::json!({ "action": "launch", "name": "Spotify app" }),
    );
    assert_eq!(judge(&c, ok.as_ref()), None);
    let wrong = call(
        "windows",
        serde_json::json!({ "action": "focus", "name": "spotify" }),
    );
    assert!(judge(&c, wrong.as_ref()).is_some());
    assert!(judge(&c, call("open", Value::Null).as_ref()).is_some());
    assert!(judge(&c, None).is_some());
    assert!(fits(&serde_json::json!(30), &serde_json::json!("30")));
}

/// Records each call and answers "Done" so the model can finish.
struct Recorder(Mutex<Vec<(String, Value)>>);

#[async_trait::async_trait]
impl ToolRunner for Recorder {
    async fn run(&self, name: &str, arguments: &Value) -> String {
        if let Ok(mut c) = self.0.lock() {
            c.push((name.to_owned(), arguments.clone()));
        }
        "Done.".into()
    }
}

#[tokio::test]
#[ignore = "needs a local model; run before each release"]
async fn local_model_picks_the_right_tools() {
    let model = std::env::var("DUSKIE_EVAL_MODEL").ok();
    let url = std::env::var("DUSKIE_EVAL_URL").ok();
    let min: f64 = std::env::var("DUSKIE_EVAL_MIN")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.85);
    let ai = OpenAiCompat::new(url, model);
    let defs = crate::ask_tools::defs();
    let cases = cases();
    let mut wrong = Vec::new();
    for c in &cases {
        let runner = Recorder(Mutex::new(Vec::new()));
        let (tx, _rx) = tokio::sync::mpsc::unbounded_channel();
        let req = ChatRequest {
            system: crate::ai::SYSTEM.to_owned(),
            messages: vec![Message::user(c.prompt.clone())],
            image: None,
            more_images: Vec::new(),
            think: false,
        };
        let done = ai
            .chat_with_tools(
                &req,
                &defs,
                &runner,
                &Sink::new(tx),
                &CancellationToken::new(),
            )
            .await;
        let calls = runner.0.into_inner().unwrap_or_default();
        let problem = match done {
            Err(e) => Some(format!("error {e}")),
            Ok(_) => judge(c, calls.first()),
        };
        if let Some(p) = problem {
            println!("WRONG  {}  ->  {p}", c.prompt);
            wrong.push(p);
        }
    }
    let rate = 1.0 - wrong.len() as f64 / cases.len() as f64;
    println!(
        "{:.0}% right ({} of {})",
        rate * 100.0,
        cases.len() - wrong.len(),
        cases.len()
    );
    assert!(
        rate >= min,
        "{:.0}% is below {:.0}%",
        rate * 100.0,
        min * 100.0
    );
}

/// One Ask case: the tools the model should reach for, and what its
/// answer should and should not say (the answer scoring runs in the Ask eval).
#[derive(Deserialize)]
struct AskCase {
    group: String,
    q: String,
    tools_must: Vec<String>,
    /// The answer passes when it says any of these (any case).
    #[serde(default)]
    answer_expect: Vec<String>,
    /// The answer fails when it says any of these.
    #[serde(default)]
    answer_forbid: Vec<String>,
}

/// Runs every Ask case through the configured cloud model (Groq, xAI or OpenAI) with the full tool loop and
/// writes evals/report.md. Needs a cloud key; ignored by default.
#[tokio::test]
#[ignore = "needs a cloud key; run: cargo test -p duskie-desktop ask_cases -- --ignored --nocapture"]
async fn ask_cases_with_grok() {
    // The configured cloud key; its prefix says which provider it belongs to.
    let key = ["GROQ_API_KEY", "XAI_API_KEY", "OPENAI_API_KEY"]
        .iter()
        .find_map(|k| std::env::var(k).ok().filter(|v| !v.trim().is_empty()))
        .expect("set a cloud key (GROQ_API_KEY, XAI_API_KEY or OPENAI_API_KEY)");
    let provider = match key.trim() {
        k if k.starts_with("gsk_") => "groq",
        k if k.starts_with("xai-") => "xai",
        _ => "openai",
    };
    let model = std::env::var("DUSKIE_EVAL_MODEL").ok();
    let model_name = format!("{provider} {}", model.as_deref().unwrap_or("default"));
    let ai = OpenAiCompat::cloud(provider, &key, model).expect("a known provider");
    let cases: Vec<AskCase> = serde_json::from_str(include_str!("../evals/ask-cases.json"))
        .expect("evals/ask-cases.json parses");
    // DUSKIE_EVAL_FROM / DUSKIE_EVAL_TO run one slice, so a run fits a time limit.
    let bound = |k: &str, d: usize| {
        std::env::var(k)
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(d)
    };
    let (from, to) = (
        bound("DUSKIE_EVAL_FROM", 0),
        bound("DUSKIE_EVAL_TO", cases.len()).min(cases.len()),
    );
    let ai = std::sync::Arc::new(ai);
    let defs = std::sync::Arc::new(crate::ask_tools::defs());
    // A few at a time, each capped, so one slow answer cannot stall the run.
    let gate = std::sync::Arc::new(tokio::sync::Semaphore::new(1));
    let mut set = tokio::task::JoinSet::new();
    for (i, c) in cases.iter().enumerate().take(to).skip(from) {
        let (ai, defs, gate, q) = (ai.clone(), defs.clone(), gate.clone(), c.q.clone());
        set.spawn(async move {
            let _slot = gate.acquire().await;
            let runner = Recorder(Mutex::new(Vec::new()));
            let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
            let started = std::time::Instant::now();
            // The streamed answer, and when its first word arrived.
            let heard = tokio::spawn(async move {
                let (mut text, mut first) = (String::new(), None);
                while let Some(s) = rx.recv().await {
                    first.get_or_insert(started.elapsed().as_secs_f32());
                    text.push_str(&s);
                }
                (text, first)
            });
            let req = ChatRequest {
                system: crate::ai::SYSTEM.to_owned(),
                messages: vec![Message::user(q)],
                image: None,
                more_images: Vec::new(),
                think: false,
            };
            let (sink, cancel) = (Sink::new(tx), CancellationToken::new());
            // The tools Ask would offer for this question, as in the app.
            let picked = crate::ask_tools::by_words(&req.messages[0].content, (*defs).clone());
            let picked = if crate::ask_tools::needs_no_tools(&req.messages[0].content) {
                Vec::new()
            } else {
                picked
            };
            // Free tiers limit tokens per minute: wait out a limit and try again.
            let mut answer = Err("not run".to_owned());
            for _ in 0..6 {
                runner.0.lock().map(|mut c| c.clear()).ok();
                let call = ai.chat_with_tools(&req, &picked, &runner, &sink, &cancel);
                answer = match tokio::time::timeout(std::time::Duration::from_secs(120), call).await
                {
                    Ok(Ok(_)) => Ok(()),
                    Ok(Err(e)) => Err(e.to_string()),
                    Err(_) => Err("no answer in 120 s".to_owned()),
                };
                match &answer {
                    Err(e) if e.contains("429") || e.contains("paused") => {
                        tokio::time::sleep(std::time::Duration::from_secs(62)).await;
                    }
                    _ => break,
                }
            }
            let calls: Vec<String> = runner
                .0
                .into_inner()
                .unwrap_or_default()
                .into_iter()
                .map(|(n, _)| n)
                .collect();
            let secs = started.elapsed().as_secs_f32();
            drop(sink);
            let (text, first) = heard.await.unwrap_or_default();
            (i, answer, calls, secs, text, first)
        });
    }
    let mut results = Vec::new();
    while let Some(r) = set.join_next().await {
        results.push(r.expect("case task"));
    }
    results.sort_by_key(|r| r.0);
    let mut rows = Vec::new();
    let mut passed = 0;
    let mut failed = 0;
    let run = results.len();
    let (mut firsts, mut totals) = (Vec::new(), Vec::new());
    for (i, answer, calls, secs, text, first) in results {
        let c = &cases[i];
        if let Err(e) = &answer {
            failed += 1;
            println!("ERR {}: {e}", c.q);
        }
        let tools_ok = match &answer {
            Err(_) => false,
            Ok(()) if c.tools_must.is_empty() => calls.is_empty(),
            Ok(()) => calls.first().is_some_and(|n| c.tools_must.contains(n)),
        };
        let said = text.to_lowercase();
        let has = |w: &String| said.contains(&w.to_lowercase());
        let expect_ok = c.answer_expect.is_empty() || c.answer_expect.iter().any(has);
        let forbid = c.answer_forbid.iter().find(|w| has(w));
        let ok = tools_ok && expect_ok && forbid.is_none();
        let why = match (tools_ok, expect_ok, forbid) {
            (true, true, None) => String::new(),
            (false, _, _) => " (tools)".into(),
            (_, false, _) => " (answer)".into(),
            (_, _, Some(w)) => format!(" (said \"{w}\")"),
        };
        if let Some(f) = first {
            firsts.push(f);
        }
        totals.push(secs);
        if ok {
            passed += 1;
        }
        let shown = if calls.is_empty() {
            "none".into()
        } else {
            calls.join(", ")
        };
        rows.push(format!(
            "| {}{why} | {} | {} | {} | {} | {:.1}s |",
            if ok { "pass" } else { "FAIL" },
            c.group,
            c.q,
            shown,
            first.map_or("-".into(), |f| format!("{f:.1}s")),
            secs
        ));
    }
    // Every request refused (a bad key, no network): say so, do not write a 0% report.
    assert!(failed < run, "every request failed; check the cloud key");
    let rate = passed as f64 / run.max(1) as f64 * 100.0;
    let median = |v: &mut Vec<f32>| {
        v.sort_by(f32::total_cmp);
        v.get(v.len() / 2)
            .map_or("-".into(), |m| format!("{m:.1}s"))
    };
    let report = format!(
        "# Ask eval\n\nModel: {}\n\nCases {}-{}: {passed} of {run} pass ({rate:.0}%). Target: 90%.\n\n\
         Median time to first word: {}. Median total: {}.\n\n\
         | Result | Group | Question | Tools called | First word | Time |\n|---|---|---|---|---|---|\n{}\n",
        model_name,
        from + 1,
        to,
        median(&mut firsts),
        median(&mut totals),
        rows.join("\n")
    );
    // A slice writes its own report, so slices can run one after another.
    let name = if from == 0 && to == cases.len() {
        "report.md".to_owned()
    } else {
        format!("report-{}-{to}.md", from + 1)
    };
    let out = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("evals")
        .join(name);
    std::fs::write(&out, report).expect("write report");
    println!("{rate:.0}% tool choice; report at {}", out.display());
}
