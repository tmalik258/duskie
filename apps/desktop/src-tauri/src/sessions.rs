//! Agent sessions in the island: Claude Code and Codex working in a
//! project, streamed step by step, with permission questions answered in
//! the island and every change reviewable afterwards (see `review`).
//!
//! Claude Code runs as `claude -p` with stream-json in and out; its
//! permission questions come through Duskie's MCP server
//! (`--permission-prompt-tool`). Codex runs as `codex app-server` and asks
//! for approvals as JSON-RPC requests.

mod claude;
mod codex;
mod edits;
mod images;
mod local;
mod local_calls;
mod plain;
mod plans;
pub mod reviews;
mod trial;

pub use claude::*;
pub use codex::*;
pub use edits::*;
pub use plain::*;
pub use trial::{discard_trial, keep_trial};

use duskie_sensors::classify::mask;
use std::borrow::Cow;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, oneshot};

use crate::agents::Agent;
use crate::review::{self, Baseline};
use crate::state::{AppState, lock};

pub const EVENT: &str = "agent://event";
/// An unanswered permission question is declined after this long.
const ASK_TIMEOUT: Duration = Duration::from_secs(10 * 60);
/// Claude's context window, for the context ring.
const CLAUDE_WINDOW: u64 = 200_000;

/// How much the agent may do without asking.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    /// Reads and plans; changes nothing.
    Plan,
    /// Asks before every change and command.
    Ask,
    /// Edits files on its own; asks before commands.
    Edit,
    /// Like Edit, plus temporary debug logs that are removed when done.
    Debug,
    /// Does everything without asking.
    Full,
    /// Like Edit, on a throwaway copy; Keep brings the changes over.
    Try,
}

/// What Debug mode asks of the agent before the user's own words.
const DEBUG_BRIEF: &str = "Debug mode. Find the cause before changing behavior: \
1. Add temporary debug logs, each printing a line that starts with [dbg file:line], where the state goes wrong. \
For each one, write a line in your reply: PROBE file:line - what it logs. \
2. Reproduce the bug and read the logs. 3. When you know it, write a line: CAUSE: one sentence. Fix the cause, not the symptom. \
4. Remove every [dbg] log you added, then write a line: PROBES REMOVED. Never leave debug logs behind.\n\n";

impl Mode {
    fn claude(self) -> &'static str {
        match self {
            Mode::Plan => "plan",
            Mode::Ask => "default",
            Mode::Edit | Mode::Debug | Mode::Try => "acceptEdits",
            Mode::Full => "bypassPermissions",
        }
    }

    /// Codex sandbox and approval policy.
    fn codex(self) -> (&'static str, &'static str) {
        match self {
            Mode::Plan => ("read-only", "never"),
            Mode::Ask => ("workspace-write", "untrusted"),
            Mode::Edit | Mode::Debug | Mode::Try => ("workspace-write", "on-request"),
            Mode::Full => ("danger-full-access", "never"),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub session: String,
    #[serde(flatten)]
    pub data: Value,
}

fn emit(app: &AppHandle, session: &str, data: Value) {
    if reviews::note_touch(session, &data) {
        return;
    }
    crate::activity::agent_event(app, session, &data);
    let _ = app.emit(
        EVENT,
        Event {
            session: session.to_owned(),
            data,
        },
    );
}

/// Marks every in-flight tool step cancelled (Esc / Stop mid-command).
pub(super) fn cancel_running_steps(app: &AppHandle, id: &str) {
    emit(app, id, json!({ "kind": "cancel_steps" }));
}

enum Cmd {
    Send(String),
    Control(String),
    Stop,
    /// Stop quietly: a new process carries on the same session.
    Restart,
}

pub fn control(id: &str, method: &str) -> Result<(), String> {
    if !matches!(method, "thread/compact/start" | "account/rateLimits/read") {
        return Err("Unsupported control".into());
    }
    with(&SESSIONS, |s| {
        let h = s.get(id).ok_or("That session is gone.")?;
        if h.agent != Agent::Codex {
            return Err("This control requires Codex.".into());
        }
        h.tx.send(Cmd::Control(method.into()))
            .map_err(|_| "Resume this session first.".into())
    })
}

/// What a quiet restart returns, so it is not reported as the end.
const RESTARTED: &str = "restarted";
/// Esc / Stop: the turn was cut off; the session stays open for the next send.
const INTERRUPTED: &str = "interrupted";

/// The model and thinking picked for one session in its chat box.
#[derive(Debug, Clone, Default)]
struct Tune {
    model: Option<String>,
    effort: Option<String>,
    /// Claude Code takes them only at start: restart on the next message.
    restart: bool,
}

static TUNES: Mutex<Option<HashMap<String, Tune>>> = Mutex::new(None);
static DEFERRED: Mutex<Option<HashMap<String, Vec<String>>>> = Mutex::new(None);

/// Thinking budget for Claude Code by level.
fn thinking_tokens(effort: &str) -> Option<&'static str> {
    match effort {
        "off" => Some("0"),
        "low" => Some("4000"),
        "medium" => Some("10000"),
        "high" => Some("31999"),
        "max" => Some("63999"),
        _ => None,
    }
}

/// Sets the model and thinking for a session from its chat box. Codex
/// takes them with the next turn; Claude Code restarts in its own session
/// before the next message; Local switches model on the next turn.
pub fn tune(id: &str, model: Option<String>, effort: Option<String>) {
    let claude = with(&SESSIONS, |s| {
        s.get(id).map(|h| h.agent == Agent::ClaudeCode)
    })
    .unwrap_or(false);
    with(&TUNES, |t| {
        let e = t.entry(id.to_owned()).or_default();
        e.model = model.filter(|m| !m.trim().is_empty());
        e.effort = effort.filter(|m| !m.trim().is_empty());
        e.restart = claude;
    });
    save();
}

fn tuned(id: &str) -> Tune {
    with(&TUNES, |t| t.get(id).cloned()).unwrap_or_default()
}

pub fn set_mode(id: &str, mode: Mode) -> Result<(), String> {
    let trying = with(&trial::TRIALS, |t| t.contains_key(id));
    if (mode == Mode::Try) != trying {
        return Err(if trying {
            "This session works on a copy. Keep or throw it away first.".into()
        } else {
            "Try starts with a new session, so it can work on a copy.".into()
        });
    }
    let claude = with(&SESSIONS, |s| {
        let h = s.get_mut(id).ok_or("That session is gone.")?;
        h.mode = mode;
        Ok::<_, String>(h.agent == Agent::ClaudeCode)
    })?;
    if claude {
        with(&TUNES, |t| {
            t.entry(id.to_owned()).or_default().restart = true
        });
    }
    save();
    Ok(())
}

fn selected_mode(id: &str, fallback: Mode) -> Mode {
    with(&SESSIONS, |s| s.get(id).map(|h| h.mode)).unwrap_or(fallback)
}

async fn complete_turn(app: &AppHandle, id: &str, mut data: Value) {
    let sid = id.to_owned();
    match tokio::task::spawn_blocking(move || {
        turn_ended(&sid);
        review_count(&sid)
    })
    .await
    {
        Ok(n) => data["changes"] = json!(n),
        Err(e) => data["reviewError"] = json!(e.to_string()),
    }
    if let Some(t) = reviews::list(id).last() {
        // Only expose a review affordance when there are real diffs (or a capture error).
        if !t.files.is_empty() || t.error.is_some() {
            data["review"] = json!({"id":t.id,"files":t.files.len(),"error":t.error});
        }
    }
    emit(app, id, data);
    if let Some(messages) = with(&DEFERRED, |q| q.remove(id)) {
        for text in messages {
            if let Err(error) = send(app, id, &text) {
                emit(app, id, json!({"kind":"control_error","error":error}));
            }
        }
    }
}

struct Handle {
    tx: mpsc::UnboundedSender<Cmd>,
    baseline: Option<Baseline>,
    agent: Agent,
    path: PathBuf,
    mode: Mode,
    /// The agent's own session or thread id, for Open in terminal and Resume.
    resume: Option<String>,
    /// The project before each of the user's messages, for Rewind.
    checkpoints: Vec<Baseline>,
    /// Each changed file's fingerprint when the agent last finished, so an
    /// undo never overwrites edits made after that.
    after: HashMap<String, u64>,
}

/// What is kept on disk for each session, so Review, Undo and Resume work
/// after Duskie restarts.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Saved {
    id: String,
    agent: String,
    path: PathBuf,
    mode: Mode,
    resume: Option<String>,
    baseline: Option<Baseline>,
    #[serde(default)]
    checkpoints: Vec<Baseline>,
    #[serde(default)]
    after: HashMap<String, u64>,
    #[serde(default)]
    reviews: Vec<reviews::ReviewTurn>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    effort: Option<String>,
}

const SAVED_FILE: &str = "agent-sessions.json";
static SAVE_DIR: Mutex<Option<PathBuf>> = Mutex::new(None);

/// Where projects without git get their private snapshot repositories.
fn shadow_root() -> Option<PathBuf> {
    SAVE_DIR
        .lock()
        .ok()
        .and_then(|d| d.clone())
        .map(|d| d.join("snapshots"))
}

/// Writes every session to disk (called after anything that matters changes).
fn save() {
    let Some(dir) = SAVE_DIR.lock().ok().and_then(|d| d.clone()) else {
        return;
    };
    let saved: Vec<Saved> = with(&SESSIONS, |s| {
        s.iter()
            .map(|(id, h)| Saved {
                id: id.clone(),
                agent: h.agent.id().into(),
                path: h.path.clone(),
                mode: h.mode,
                resume: h.resume.clone(),
                baseline: h.baseline.clone(),
                checkpoints: h.checkpoints.clone(),
                after: h.after.clone(),
                reviews: with(&reviews::REVIEWS, |r| r.get(id).cloned()).unwrap_or_default(),
                model: tuned(id).model,
                effort: tuned(id).effort,
            })
            .collect()
    });
    if let Ok(bytes) = serde_json::to_vec(&saved) {
        let _ = std::fs::write(dir.join(SAVED_FILE), bytes);
    }
}

/// Loads the sessions from before a restart; they can be reviewed, undone and
/// resumed, but nothing runs until the user resumes one.
pub fn restore(dir: &Path) {
    if let Ok(mut d) = SAVE_DIR.lock() {
        *d = Some(dir.to_owned());
    }
    let Ok(bytes) = std::fs::read(dir.join(SAVED_FILE)) else {
        return;
    };
    let saved: Vec<Saved> = serde_json::from_slice(&bytes).unwrap_or_default();
    with(&SESSIONS, |s| {
        for v in saved {
            with(&reviews::REVIEWS, |r| r.insert(v.id.clone(), v.reviews));
            with(&TUNES, |t| {
                t.insert(
                    v.id.clone(),
                    Tune {
                        model: v.model,
                        effort: v.effort,
                        restart: false,
                    },
                )
            });
            let agent = Agent::from_id(&v.agent).unwrap_or(Agent::ClaudeCode);
            // Nothing is running: sends fail with "That session has ended".
            let (tx, _) = mpsc::unbounded_channel();
            s.entry(v.id).or_insert(Handle {
                tx,
                baseline: v.baseline,
                agent,
                path: v.path,
                mode: v.mode,
                resume: v.resume,
                checkpoints: v.checkpoints,
                after: v.after,
            });
        }
    });
}

static SESSIONS: Mutex<Option<HashMap<String, Handle>>> = Mutex::new(None);
/// Permission questions waiting for the user: (session, question id).
type Pending = HashMap<String, (String, oneshot::Sender<Answer>)>;
static PENDING: Mutex<Option<Pending>> = Mutex::new(None);
/// Claude tool_use ids seen per session, to know whose question it is.
static TOOL_OWNER: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

fn with<T, R>(m: &Mutex<Option<T>>, f: impl FnOnce(&mut T) -> R) -> R
where
    T: Default,
{
    let mut g = m.lock().unwrap_or_else(|e| e.into_inner());
    f(g.get_or_insert_with(T::default))
}

/// The user's answer to a permission question.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Answer {
    Allow,
    /// Allow this and the same kind of thing for the rest of the session.
    Always,
    Deny,
}

/// What `agent_start` returns.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Started {
    pub id: String,
    pub agent: &'static str,
    pub project: String,
    pub branch: Option<String>,
    /// Changes can be reviewed and undone (the project uses git).
    pub reviewable: bool,
    /// Try mode: the copy's branch. The user's folder is untouched.
    pub trial: Option<String>,
}

/// Starts an agent in `path` with `prompt`.
pub async fn start(
    app: &AppHandle,
    agent: Agent,
    path: &Path,
    prompt: &str,
    mode: Mode,
) -> Result<Started, String> {
    start_tuned(app, agent, path, prompt, mode, None, None).await
}

/// Starts an agent with the model and thinking picked in New's chat box.
pub async fn start_tuned(
    app: &AppHandle,
    agent: Agent,
    path: &Path,
    prompt: &str,
    mode: Mode,
    model: Option<String>,
    effort: Option<String>,
) -> Result<Started, String> {
    if !path.is_dir() {
        return Err(format!("{} is not a folder", path.display()));
    }
    let settings = lock(&app.state::<AppState>().settings).clone();
    let exe = agent
        .resolve(&settings)
        .ok_or_else(|| format!("{} is not installed", agent.name()))?;
    let id = ulid::Ulid::new().to_string();
    if model.is_some() || effort.is_some() {
        with(&TUNES, |t| {
            t.insert(
                id.clone(),
                Tune {
                    model: model.filter(|m| !m.trim().is_empty()),
                    effort: effort.filter(|e| !e.trim().is_empty()),
                    restart: false,
                },
            )
        });
    }
    let copy = if mode == Mode::Try {
        let (path, prompt, id) = (path.to_owned(), prompt.to_owned(), id.clone());
        Some(
            tokio::task::spawn_blocking(move || trial::make(&path, &prompt, &id))
                .await
                .map_err(|e| e.to_string())??,
        )
    } else {
        None
    };
    let project = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let (copy_dir, trial) = copy.unzip();
    let path: &Path = copy_dir.as_deref().unwrap_or(path);
    let baseline = {
        let path = path.to_owned();
        tokio::task::spawn_blocking(move || review::capture(&path, shadow_root().as_deref()))
            .await
            .ok()
            .flatten()
    };
    let branch = branch(path);
    let (tx, rx) = mpsc::unbounded_channel();
    let started = Started {
        id: id.clone(),
        agent: agent.name(),
        project,
        branch,
        reviewable: baseline.is_some(),
        trial,
    };
    with(&SESSIONS, |s| {
        s.insert(
            id.clone(),
            Handle {
                tx: tx.clone(),
                checkpoints: baseline.iter().cloned().collect(),
                baseline,
                agent,
                path: path.to_owned(),
                mode,
                resume: None,
                after: HashMap::new(),
            },
        )
    });
    save();
    with(&reviews::WRITING, |w| w.insert(id.clone(), true));
    let first = if mode == Mode::Debug {
        format!("{DEBUG_BRIEF}{prompt}")
    } else {
        prompt.to_owned()
    };
    let _ = tx.send(Cmd::Send(first));
    crate::activity::report(
        app,
        &format!("agent:{id}"),
        "agent",
        &format!(
            "{} · {}",
            agent.name(),
            path.file_name().unwrap_or_default().to_string_lossy()
        ),
        crate::activity::Phase::Running,
        None,
        None,
        None,
    );
    spawn_run(app, &id, agent, exe, path, mode, None, rx);
    Ok(started)
}

/// Runs the agent's process for session `id` until it ends; `resume` carries
/// on the agent's own earlier session.
#[allow(clippy::too_many_arguments)]
fn spawn_run(
    app: &AppHandle,
    id: &str,
    agent: Agent,
    exe: PathBuf,
    path: &Path,
    mode: Mode,
    resume: Option<String>,
    rx: mpsc::UnboundedReceiver<Cmd>,
) {
    let settings = lock(&app.state::<AppState>().settings).clone();
    let (app2, id2, path2) = (app.clone(), id.to_owned(), path.to_owned());
    let tune = tuned(id);
    let model = match agent {
        _ if tune.model.is_some() => tune.model.clone(),
        Agent::Codex => Some(settings.ai.codex.model.clone()),
        Agent::ClaudeCode => Some(settings.ai.claude_code.model.clone()),
        Agent::Copilot | Agent::Cursor => None,
        Agent::Local => Some(settings.ai.local.model.clone()),
    }
    .filter(|m| !m.trim().is_empty());
    let mcp_config = app
        .state::<AppState>()
        .ai_workdir
        .join(crate::mcp::CONFIG_FILE);
    tauri::async_runtime::spawn(async move {
        let result = match agent {
            Agent::ClaudeCode => {
                run_claude(
                    &app2,
                    &id2,
                    &exe,
                    &path2,
                    mode,
                    model,
                    tune.effort.as_deref(),
                    &mcp_config,
                    resume,
                    rx,
                )
                .await
            }
            Agent::Codex => run_codex(&app2, &id2, &exe, &path2, mode, model, resume, rx).await,
            Agent::Copilot | Agent::Cursor => {
                run_plain(&app2, &id2, agent, &exe, &path2, mode, rx).await
            }
            Agent::Local => {
                local::run(
                    &app2,
                    &id2,
                    &path2,
                    mode,
                    model,
                    &settings.ai.local.base_url,
                    rx,
                )
                .await
            }
        };
        if result.as_ref().err().map(String::as_str) == Some(RESTARTED) {
            return;
        }
        // Esc interrupt: leave the session idle; the next send auto-resumes.
        if result.as_ref().err().map(String::as_str) == Some(INTERRUPTED) {
            cancel_running_steps(&app2, &id2);
            complete_turn(&app2, &id2, json!({ "kind": "turn" })).await;
            return;
        }
        let sid = id2.clone();
        let _ = tokio::task::spawn_blocking(move || turn_ended(&sid)).await;
        let changes = review_count(&id2);
        let review = reviews::list(&id2)
            .last()
            .map(|t| json!({"id":t.id,"files":t.files.len(),"error":t.error}));
        emit(
            &app2,
            &id2,
            json!({ "kind": "ended", "error": result.err(), "changes": changes, "review":review }),
        );
    });
}

/// Carries on a session that ended or was cut off by a restart, in the
/// agent's own session, with the same review baseline.
pub fn resume(app: &AppHandle, id: &str) -> Result<(), String> {
    let (agent, path, mode, resume, running) = with(&SESSIONS, |s| {
        s.get(id).map(|h| {
            (
                h.agent,
                h.path.clone(),
                h.mode,
                h.resume.clone(),
                !h.tx.is_closed(),
            )
        })
    })
    .ok_or("That session is gone.")?;
    if running {
        return Ok(());
    }
    let resume = resume.ok_or("This session ended before it started, so it cannot be resumed.")?;
    let settings = lock(&app.state::<AppState>().settings).clone();
    let exe = agent
        .resolve(&settings)
        .ok_or_else(|| format!("{} is not installed", agent.name()))?;
    let (tx, rx) = mpsc::unbounded_channel();
    with(&SESSIONS, |s| {
        if let Some(h) = s.get_mut(id) {
            h.tx = tx;
        }
    });
    spawn_run(app, id, agent, exe, &path, mode, Some(resume), rx);
    Ok(())
}

/// Claude Code with a new model or thinking: stop the process quietly and
/// carry on the same session with the new settings.
fn restart(app: &AppHandle, id: &str) -> Result<(), String> {
    with(&TUNES, |t| {
        if let Some(e) = t.get_mut(id) {
            e.restart = false;
        }
    });
    let (agent, path, mode, resume) = with(&SESSIONS, |s| {
        s.get(id)
            .map(|h| (h.agent, h.path.clone(), h.mode, h.resume.clone()))
    })
    .ok_or("That session is gone.")?;
    // Not started yet: the first process already has what it needs.
    let Some(resume) = resume else { return Ok(()) };
    let settings = lock(&app.state::<AppState>().settings).clone();
    let exe = agent
        .resolve(&settings)
        .ok_or_else(|| format!("{} is not installed", agent.name()))?;
    let (tx, rx) = mpsc::unbounded_channel();
    with(&SESSIONS, |s| {
        if let Some(h) = s.get_mut(id) {
            let _ = h.tx.send(Cmd::Restart);
            h.tx = tx;
        }
    });
    spawn_run(app, id, agent, exe, &path, mode, Some(resume), rx);
    Ok(())
}

/// When the agent finishes a turn: fingerprint only paths captured on that turn, so an undo later can tell the user's own edits apart.
fn turn_ended(id: &str) {
    reviews::capture_turn(id);
    let Some(b) = with(&SESSIONS, |s| s.get(id).and_then(|h| h.baseline.clone())) else {
        save();
        return;
    };
    let files = reviews::last_turn_files(id);
    with(&SESSIONS, |s| {
        if let Some(h) = s.get_mut(id) {
            for f in &files {
                match review::fingerprint(&b.root, &f.path) {
                    Some(fp) => {
                        h.after.insert(f.path.clone(), fp);
                    }
                    None => {
                        h.after.remove(&f.path);
                    }
                }
            }
        }
    });
    save();
}

fn branch(path: &Path) -> Option<String> {
    let mut cmd = std::process::Command::new("git");
    cmd.args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let out = cmd.output().ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).trim().to_owned())
        .filter(|b| !b.is_empty())
}

fn review_count(id: &str) -> usize {
    reviews::merged_files(id).len()
}

/// Sends a follow-up or a steer to a running session, after a checkpoint
/// of the project so Rewind can come back to this point.
pub fn send(app: &AppHandle, id: &str, text: &str) -> Result<(), String> {
    if tuned(id).restart && with(&reviews::WRITING, |w| w.get(id).copied().unwrap_or(false)) {
        with(&DEFERRED, |q| {
            q.entry(id.into()).or_default().push(text.into())
        });
        return Ok(());
    }
    if tuned(id).restart {
        restart(app, id)?;
    }
    // After Esc interrupt the CLI is gone; bring it back without a Resume click.
    let running = with(&SESSIONS, |s| s.get(id).is_some_and(|h| !h.tx.is_closed()));
    if !running {
        resume(app, id)?;
    }
    send_text(id, text)
}

fn send_text(id: &str, text: &str) -> Result<(), String> {
    let writing = with(&reviews::WRITING, |w| w.insert(id.into(), true)).unwrap_or(false);
    if !writing {
        reviews::begin_touch(id);
    }
    let path = with(&SESSIONS, |s| s.get(id).map(|h| h.path.clone()));
    if !writing
        && let Some(snap) = path
            .as_deref()
            .and_then(|p| review::capture(p, shadow_root().as_deref()))
    {
        with(&SESSIONS, |s| {
            if let Some(h) = s.get_mut(id) {
                h.checkpoints.push(snap);
            }
        });
        save();
    }
    with(&SESSIONS, |s| {
        s.get(id)
            .ok_or_else(|| "That session has ended.".to_owned())
            .and_then(|h| {
                h.tx.send(Cmd::Send(text.to_owned()))
                    .map_err(|_| "That session has ended.".to_owned())
            })
    })
}

pub fn stop(id: &str) {
    with(&SESSIONS, |s| {
        if let Some(h) = s.get(id) {
            let _ = h.tx.send(Cmd::Stop);
        }
    });
}

/// Answers a permission question.
pub fn answer(question: &str, answer: Answer) -> Result<(), String> {
    let tx = with(&PENDING, |p| p.remove(question))
        .ok_or("That question was already answered.")?
        .1;
    tx.send(answer)
        .map_err(|_| "The agent stopped waiting.".into())
}

/// Closes a session: stops the agent and forgets its review.
pub fn close(id: &str) {
    stop(id);
    with(&SESSIONS, |s| s.remove(id));
    with(&reviews::REVIEWS, |r| r.remove(id));
    with(&reviews::WRITING, |w| w.remove(id));
    with(&reviews::DIFF_HINT, |h| {
        h.remove(id);
    });
    with(&DEFERRED, |q| q.remove(id));
    save();
}

/// The session's project folder, to open in the user's editor.
pub fn project(id: &str) -> Option<PathBuf> {
    with(&SESSIONS, |s| s.get(id).map(|h| h.path.clone()))
}

/// Opens the session in a terminal, to carry on in the CLI itself.
pub fn open_terminal(app: &AppHandle, id: &str) -> Result<(), String> {
    let (agent, path, resume) = with(&SESSIONS, |s| {
        s.get(id)
            .map(|h| (h.agent, h.path.clone(), h.resume.clone()))
    })
    .ok_or("That session has ended.")?;
    if agent == Agent::Local {
        return Err("The local agent runs inside Duskie, not in a terminal.".into());
    }
    let settings = lock(&app.state::<AppState>().settings).clone();
    let exe = agent
        .resolve(&settings)
        .ok_or_else(|| format!("{} is not installed", agent.name()))?;
    let args: Vec<String> = match (agent, resume) {
        (Agent::ClaudeCode, Some(r)) => vec!["--resume".into(), r],
        (Agent::Codex, Some(r)) => vec!["resume".into(), r],
        _ => Vec::new(),
    };
    crate::agents::open_terminal(&path, &exe, &args)
}

/// Asks the user and waits for the answer (Deny after a while).
async fn ask(app: &AppHandle, session: &str, label: &str, detail: &str) -> Answer {
    let question = ulid::Ulid::new().to_string();
    let (tx, rx) = oneshot::channel();
    with(&PENDING, |p| {
        p.insert(question.clone(), (session.to_owned(), tx))
    });
    emit(
        app,
        session,
        json!({ "kind": "ask", "question": question, "label": label, "detail": mask(detail) }),
    );
    let answer = tokio::time::timeout(ASK_TIMEOUT, rx)
        .await
        .ok()
        .and_then(Result::ok)
        .unwrap_or(Answer::Deny);
    with(&PENDING, |p| p.remove(&question));
    emit(
        app,
        session,
        json!({ "kind": "answered", "question": question }),
    );
    answer
}

// ---------- CLI processes ----------

/// Each running session's CLI process, for its memory use.
static PIDS: Mutex<Option<HashMap<String, u32>>> = Mutex::new(None);

/// Memory the session's CLI uses, with the processes it started, in bytes.
pub fn memory(id: &str) -> Option<u64> {
    let root = with(&PIDS, |p| p.get(id).copied())?;
    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    let procs = sys.processes();
    procs.get(&sysinfo::Pid::from_u32(root))?;
    // The CLI and everything under it (node, shells, test runners).
    let under = |mut pid: sysinfo::Pid| {
        for _ in 0..16 {
            if pid.as_u32() == root {
                return true;
            }
            match procs.get(&pid).and_then(|p| p.parent()) {
                Some(parent) => pid = parent,
                None => return false,
            }
        }
        false
    };
    Some(
        procs
            .iter()
            .filter(|(pid, _)| under(**pid))
            .map(|(_, p)| p.memory())
            .sum(),
    )
}

/// The end of a CLI's error output, read as it comes so a full pipe never
/// blocks it.
fn keep_stderr(child: &mut tokio::process::Child) -> std::sync::Arc<Mutex<String>> {
    let kept = std::sync::Arc::new(Mutex::new(String::new()));
    if let Some(err) = child.stderr.take() {
        let kept = kept.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(err).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let mut k = lock(&kept);
                k.push_str(&line);
                k.push('\n');
                if k.len() > 4000 {
                    let cut = k.len() - 2000;
                    let cut = (cut..k.len()).find(|i| k.is_char_boundary(*i)).unwrap_or(0);
                    k.drain(..cut);
                }
            }
        });
    }
    kept
}

/// Why an agent stopped, in words: a CLI too old for a flag or method
/// Duskie uses says how to update it.
pub fn why_stopped(agent: &str, stderr: &str) -> String {
    let e = stderr.to_lowercase();
    let old = [
        "unknown option",
        "unexpected argument",
        "unrecognized option",
        "unrecognized argument",
        "unrecognized subcommand",
        "unknown command",
        "unknown subcommand",
        "method not found",
        "unknown variant",
    ];
    if old.iter().any(|o| e.contains(o)) {
        let update = if agent == "Codex" {
            "npm install -g @openai/codex@latest"
        } else {
            "claude update"
        };
        return format!(
            "{agent} is too old for this. Update it (run {update} in a terminal), then try again."
        );
    }
    match stderr.lines().rev().find(|l| !l.trim().is_empty()) {
        Some(last) => format!("{agent} stopped: {}", mask(last.trim())),
        None => format!("{agent} stopped."),
    }
}

/// The end of a command's output, for the folded block under a step.
pub fn tail(text: &str) -> String {
    const LINES: usize = 12;
    const MAX: usize = 1_500;
    let text = mask(text);
    let lines: Vec<&str> = text.trim_end().lines().collect();
    let kept = lines[lines.len().saturating_sub(LINES)..].join("\n");
    let start = kept.len().saturating_sub(MAX);
    let start = (start..=kept.len())
        .find(|i| kept.is_char_boundary(*i))
        .unwrap_or(0);
    kept[start..].to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::review::{FileChange, Hunk};

    #[test]
    fn mask_review_files_keeps_merge_order() {
        let mut files = vec![
            FileChange {
                path: "a.rs".into(),
                status: "modified".into(),
                added: 1,
                removed: 0,
                hunks: vec![Hunk {
                    header: "@@ a @@".into(),
                    lines: vec!["+plain".into()],
                }],
            },
            FileChange {
                path: "b.rs".into(),
                status: "modified".into(),
                added: 1,
                removed: 0,
                hunks: vec![Hunk {
                    header: "@@ b @@".into(),
                    lines: vec!["+plain".into()],
                }],
            },
        ];
        assert_eq!(mask_review_files(&mut files), ["a.rs", "b.rs"]);
    }

    #[test]
    fn changes_without_session_errors() {
        assert!(changes("missing-session-for-review").is_err());
    }

    #[tokio::test]
    async fn mocked_app_server_initializes_before_dependent_requests() {
        let (client, server) = tokio::io::duplex(4096);
        let (reader, mut writer) = tokio::io::split(client);
        let mut lines = BufReader::new(reader).lines();
        let server = tokio::spawn(async move {
            let (reader, mut writer) = tokio::io::split(server);
            let mut lines = BufReader::new(reader).lines();
            let request: Value =
                serde_json::from_str(&lines.next_line().await.unwrap().unwrap()).unwrap();
            assert_eq!(request["method"], "initialize");
            assert_eq!(request["params"]["capabilities"]["experimentalApi"], true);
            assert!(
                tokio::time::timeout(Duration::from_millis(20), lines.next_line())
                    .await
                    .is_err()
            );
            write_line(&mut writer, json!({"method":"notice","params":{}}))
                .await
                .unwrap();
            write_line(&mut writer, json!({"id":99,"result":{}}))
                .await
                .unwrap();
            write_line(&mut writer, json!({"id":1,"result":{"userAgent":"mock"}}))
                .await
                .unwrap();
            let initialized: Value =
                serde_json::from_str(&lines.next_line().await.unwrap().unwrap()).unwrap();
            assert_eq!(initialized["method"], "initialized");
        });
        codex_initialize(&mut writer, &mut lines).await.unwrap();
        server.await.unwrap();
    }

    #[tokio::test]
    async fn mocked_app_server_rejected_initialization_is_visible() {
        let (client, mut server) = tokio::io::duplex(4096);
        let (reader, mut writer) = tokio::io::split(client);
        write_line(
            &mut server,
            json!({"id":1,"error":{"code":-32601,"message":"Unsupported initialize"}}),
        )
        .await
        .unwrap();
        let error = codex_initialize(&mut writer, &mut BufReader::new(reader).lines())
            .await
            .unwrap_err();
        assert!(error.contains("Unsupported initialize"));
    }

    #[test]
    fn rpc_responses_match_ids_and_surface_errors() {
        let mut pending = HashMap::from([
            (2, "turn/start".into()),
            (3, "account/rateLimits/read".into()),
        ]);
        assert!(rpc_response(&json!({"id":2,"method":"requestApproval"}), &mut pending).is_none());
        assert!(rpc_response(&json!({"id":99,"result":{}}), &mut pending).is_none());
        assert_eq!(
            rpc_response(&json!({"id":3,"result":{"rateLimits":{}}}), &mut pending)
                .unwrap()
                .0,
            "account/rateLimits/read"
        );
        let response = rpc_response(
            &json!({"id":2,"error":{"message":"Sandbox rejected"}}),
            &mut pending,
        )
        .unwrap();
        assert_eq!(response.1.unwrap_err(), "Sandbox rejected");
        assert!(pending.is_empty());
    }

    #[test]
    fn codex_turn_settings_include_real_plan_and_restore_default() {
        let path = Path::new("C:/project");
        for mode in [
            Mode::Plan,
            Mode::Ask,
            Mode::Edit,
            Mode::Debug,
            Mode::Full,
            Mode::Try,
        ] {
            let params = codex_turn_params(
                "protocol-test",
                "t",
                json!([]),
                path,
                mode,
                Some("test-model"),
            )
            .unwrap();
            assert_eq!(params["approvalPolicy"], mode.codex().1);
            assert_eq!(
                params["collaborationMode"]["mode"],
                if mode == Mode::Plan {
                    "plan"
                } else {
                    "default"
                }
            );
            assert_eq!(
                params["collaborationMode"]["settings"]["model"],
                "test-model"
            );
            let instructions = params["collaborationMode"]["settings"]["developer_instructions"]
                .as_str()
                .unwrap_or("");
            assert!(instructions.contains("OPTION:"));
            assert!(instructions.contains("OPTION_MULTI:"));
            if mode == Mode::Plan {
                assert!(instructions.contains("collaboration plan"));
            }
        }
    }

    #[test]
    fn mode_changes_wait_for_a_fresh_codex_turn() {
        let before = Mode::Edit;
        let after = Mode::Plan;
        assert_ne!(before, after);
        assert_eq!(after.codex(), ("read-only", "never"));
        // `run_codex` compares the selected mode to this active-turn value;
        // a mismatch queues a message rather than sending turn/steer.
    }

    #[test]
    fn codex_reports_context_separately_from_session_total_and_all_windows() {
        let events = codex_events(
            &json!({"method":"thread/tokenUsage/updated","params":{"tokenUsage":{"last":{"totalTokens":500},"total":{"totalTokens":9000},"modelContextWindow":1000}}}),
        );
        assert_eq!(events[0]["used"], 500);
        assert_eq!(events[0]["total"], 9000);
        let limits = codex_limits(
            &json!({"rateLimits":{"primary":{"usedPercent":0.5,"windowDurationMins":300,"resetsAt":123},"secondary":{"usedPercent":90,"windowDurationMins":10080}}}),
        );
        assert_eq!(limits.len(), 2);
        assert_eq!(limits[0]["used"], 0.005);
        assert_eq!(limits[1]["window"], "seven_day");
        assert!(codex_limits(&json!({"rateLimits":null})).is_empty());
    }

    #[test]
    fn shown_command_unwraps_the_shell() {
        let raw = r#""C:\\Program Files\\WindowsApps\\PowerShell\\pwsh.exe" -Command "git status --short""#;
        assert_eq!(shown_command(raw), "git status --short");
        assert_eq!(shown_command("pnpm test"), "pnpm test");
    }

    #[test]
    fn plain_agents_get_what_the_mode_allows() {
        let a = plain_args(Agent::Copilot, Mode::Plan, "fix it", false);
        assert_eq!(a[..2], ["-p", "fix it"]);
        assert!(a.windows(2).any(|w| w == ["--deny-tool", "write"]));
        assert!(
            plain_args(Agent::Copilot, Mode::Full, "x", true).contains(&"--continue".to_owned())
        );
        assert!(plain_args(Agent::Cursor, Mode::Edit, "x", false).contains(&"--force".to_owned()));
        assert!(!plain_args(Agent::Cursor, Mode::Plan, "x", false).contains(&"--force".to_owned()));
    }

    #[test]
    fn reads_cursor_stream() {
        let text =
            json!({"type":"assistant","message":{"content":[{"type":"text","text":"On it"}]}});
        assert_eq!(cursor_events(&text)[0]["text"], "On it");
        let started = json!({"type":"tool_call","subtype":"started","call_id":"c1",
            "tool_call":{"readToolCall":{"args":{"path":"src/a.ts"}}}});
        let e = &cursor_events(&started)[0];
        assert_eq!(
            (e["label"].as_str(), e["state"].as_str()),
            (Some("Read"), Some("running"))
        );
        let done = json!({"type":"tool_call","subtype":"completed","call_id":"c1",
            "tool_call":{"readToolCall":{"args":{"path":"src/a.ts"},"result":{"success":{}}}}});
        assert_eq!(cursor_events(&done)[0]["state"], "done");
        assert!(cursor_events(&json!({"type":"result"})).is_empty());
    }

    fn git(dir: &Path, args: &[&str]) -> bool {
        std::process::Command::new("git")
            .args(args)
            .current_dir(dir)
            .output()
            .is_ok_and(|o| o.status.success())
    }

    /// A session in a throwaway repo, as if started, without an agent.
    fn session(name: &str) -> Option<(String, PathBuf)> {
        let dir = std::env::temp_dir().join(format!("sidekick-sess-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).ok()?;
        for args in [
            &["init", "-q"][..],
            &["config", "user.email", "t@example.com"],
            &["config", "user.name", "t"],
        ] {
            git(&dir, args).then_some(())?;
        }
        std::fs::write(dir.join("a.txt"), "one\n").ok()?;
        (git(&dir, &["add", "."]) && git(&dir, &["commit", "-q", "-m", "start"])).then_some(())?;
        let b = review::snapshot(&dir, None)?;
        let id = format!("test-{name}");
        let (tx, _rx) = mpsc::unbounded_channel();
        with(&SESSIONS, |s| {
            s.insert(
                id.clone(),
                Handle {
                    tx,
                    checkpoints: vec![b.clone()],
                    baseline: Some(b),
                    agent: Agent::ClaudeCode,
                    path: dir.clone(),
                    mode: Mode::Edit,
                    resume: None,
                    after: HashMap::new(),
                },
            )
        });
        Some((id, dir))
    }

    #[test]
    fn rewinds_to_before_a_message() {
        let Some((id, dir)) = session("rewind") else {
            return; // no git here
        };
        std::fs::write(dir.join("a.txt"), "two\n").unwrap();
        // The second message: a checkpoint, then the agent's next edit.
        let _ = send_text(&id, "also log it");
        std::fs::write(dir.join("a.txt"), "three\n").unwrap();
        std::fs::write(dir.join("new.txt"), "x").unwrap();
        assert_eq!(rewind_preview(&id, 1).unwrap(), 2);
        rewind(&id, 1).unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("a.txt")).unwrap(), "two\n");
        assert!(!dir.join("new.txt").exists());
        close(&id);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn immutable_reviews_preserve_acceptance_and_refuse_later_edits() {
        let (id, dir) = session("immutable-review").expect("git must be available");
        let original: String = (0..20).map(|n| format!("line {n}\n")).collect();
        std::fs::write(dir.join("a.txt"), &original).unwrap();
        std::fs::write(dir.join("existing.txt"), "untracked before\n").unwrap();
        let before = review::capture(&dir, None).unwrap();
        with(&SESSIONS, |s| {
            let h = s.get_mut(&id).unwrap();
            h.baseline = Some(before.clone());
            h.checkpoints = vec![before];
        });
        let changed = original
            .replace("line 1\n", "accepted\n")
            .replace("line 17\n", "pending\n");
        std::fs::write(dir.join("a.txt"), changed).unwrap();
        std::fs::write(
            dir.join("existing.txt"),
            "agent changed existing untracked\n",
        )
        .unwrap();
        turn_ended(&id);
        let first = reviews::list(&id).pop().unwrap();
        assert_eq!(first.files.len(), 2);
        assert_eq!(
            first
                .files
                .iter()
                .find(|f| f.path == "a.txt")
                .unwrap()
                .hunks
                .len(),
            2
        );
        reviews::decide(&id, &first.id, Some("a.txt"), Some(0), true).unwrap();
        reviews::decide(&id, &first.id, Some("a.txt"), None, false).unwrap();
        let now = std::fs::read_to_string(dir.join("a.txt")).unwrap();
        assert!(now.contains("accepted\n"));
        assert!(now.contains("line 17\n"));
        let decisions = reviews::list(&id).pop().unwrap().decisions;
        assert_eq!(decisions["a.txt:0"], "accepted");
        assert_eq!(decisions["a.txt:1"], "rejected");
        std::fs::write(dir.join("existing.txt"), "later external edit\n").unwrap();
        assert!(
            reviews::decide(&id, &first.id, Some("existing.txt"), None, false)
                .unwrap_err()
                .contains("later edits")
        );
        assert_eq!(reviews::list(&id)[0].files, first.files);
        let saved: Vec<reviews::ReviewTurn> =
            serde_json::from_str(&serde_json::to_string(&reviews::list(&id)).unwrap()).unwrap();
        assert_eq!(saved[0].decisions["a.txt:0"], "accepted");
        close(&id);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn reviews_track_deleted_added_binary_files_and_new_turns() {
        let (id, dir) = session("review-multiple").expect("git must be available");
        let before = review::capture(&dir, None).unwrap();
        with(&SESSIONS, |s| {
            let h = s.get_mut(&id).unwrap();
            h.baseline = Some(before.clone());
            h.checkpoints = vec![before];
        });
        std::fs::remove_file(dir.join("a.txt")).unwrap();
        std::fs::write(dir.join("binary.bin"), [0, 1, 2]).unwrap();
        turn_ended(&id);
        let first = reviews::list(&id).pop().unwrap();
        assert_eq!(first.files.len(), 2);
        assert!(
            first.files.iter().any(|f| f.hunks.is_empty()),
            "binary files have no text hunks"
        );
        with(&reviews::WRITING, |w| w.insert(id.clone(), true));
        assert!(
            reviews::decide(&id, &first.id, None, None, false)
                .unwrap_err()
                .contains("writing")
        );
        with(&reviews::WRITING, |w| w.insert(id.clone(), false));
        reviews::decide(&id, &first.id, Some("a.txt"), None, false).unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("a.txt")).unwrap(), "one\n");
        assert!(dir.join("binary.bin").exists());
        close(&id);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn reviews_remain_distinct_for_multiple_turns() {
        let (id, dir) = session("review-turns").expect("git must be available");
        let before = review::capture(&dir, None).unwrap();
        with(&SESSIONS, |s| {
            let h = s.get_mut(&id).unwrap();
            h.baseline = Some(before.clone());
            h.checkpoints = vec![before];
        });
        std::fs::write(dir.join("a.txt"), "first turn\n").unwrap();
        turn_ended(&id);
        let second_before = review::capture(&dir, None).unwrap();
        with(&SESSIONS, |s| {
            s.get_mut(&id).unwrap().checkpoints.push(second_before)
        });
        std::fs::write(dir.join("a.txt"), "second turn\n").unwrap();
        turn_ended(&id);
        let turns = reviews::list(&id);
        assert_eq!(turns.len(), 2);
        assert_eq!(turns[1].files.len(), 1);
        assert_ne!(turns[0].id, turns[1].id);
        reviews::decide(&id, &turns[1].id, None, None, true).unwrap();
        close(&id);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn undo_leaves_files_edited_after_the_agent_finished() {
        let Some((id, dir)) = session("edited") else {
            return;
        };
        std::fs::write(dir.join("a.txt"), "agent\n").unwrap();
        turn_ended(&id);
        std::fs::write(dir.join("a.txt"), "agent\nmine\n").unwrap();
        let err = undo(&id, Some("a.txt"), None).unwrap_err();
        assert!(err.contains("changed after the agent finished"), "{err}");
        assert_eq!(
            std::fs::read_to_string(dir.join("a.txt")).unwrap(),
            "agent\nmine\n"
        );
        close(&id);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn finds_project_commands() {
        let dir = std::env::temp_dir().join(format!("sidekick-cmds-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("release.md"),
            "---\ndescription: Cut a release\n---\nSteps",
        )
        .unwrap();
        std::fs::write(dir.join("notes.txt"), "not a command").unwrap();
        let cmds = project_commands(&dir);
        assert_eq!(cmds.len(), 1);
        assert_eq!(cmds[0].name, "/release");
        assert!(cmds[0].description.starts_with("Cut a release"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn says_when_a_cli_is_too_old() {
        let m = why_stopped(
            "Claude Code",
            "error: unknown option '--include-partial-messages'\n",
        );
        assert!(m.contains("too old") && m.contains("claude update"), "{m}");
        let m = why_stopped("Codex", "error: unrecognized subcommand 'app-server'");
        assert!(m.contains("@openai/codex@latest"), "{m}");
        assert!(why_stopped("Codex", "Method not found: thread/resume").contains("too old"));
        assert_eq!(
            why_stopped("Codex", "\nnot logged in\n\n"),
            "Codex stopped: not logged in"
        );
        assert_eq!(why_stopped("Codex", ""), "Codex stopped.");
    }

    #[test]
    fn keeps_the_end_of_long_output() {
        let text: String = (1..=40).map(|n| format!("line {n}\n")).collect();
        let t = tail(&text);
        assert!(t.starts_with("line 29") && t.ends_with("line 40"), "{t}");
        assert_eq!(tail(""), "");
        assert_eq!(
            tail("export TOKEN ghp_abcdefghijklmnopqrstuvwxyz0123456789AB"),
            "export TOKEN \u{2022}\u{2022}\u{2022}\u{2022}"
        );
    }

    /// Events without the review's touch and shell markers.
    fn no_touch(ev: Vec<Value>) -> Vec<Value> {
        ev.into_iter()
            .filter(|e| !matches!(e["kind"].as_str(), Some("touch" | "shell")))
            .collect()
    }

    #[test]
    fn reads_claude_steps_plans_and_turns() {
        let tool: Value = serde_json::from_str(
            r#"{"type":"assistant","message":{"content":[{"type":"text","text":"ok"},{"type":"tool_use","id":"t1","name":"Edit","input":{"file_path":"C:\\code\\app\\src\\main.rs"}}]}}"#,
        )
        .unwrap();
        let all = claude_events(&tool, None);
        assert!(
            all.iter().any(|e| e["kind"] == "touch"),
            "edits are tracked for review"
        );
        let ev = no_touch(all);
        assert_eq!(ev[0]["label"], "Edit main.rs");
        assert_eq!(ev[0]["state"], "running");

        let todo: Value = serde_json::from_str(
            r#"{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t2","name":"TodoWrite","input":{"todos":[{"content":"Add retries","status":"in_progress"}]}}]}}"#,
        )
        .unwrap();
        assert_eq!(
            claude_events(&todo, None)[0]["items"][0]["text"],
            "Add retries"
        );

        let plan: Value = serde_json::from_str(
            r##"{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t3","name":"ExitPlanMode","input":{"plan":"# Plan\n1. Add retries"}}]}}"##,
        )
        .unwrap();
        let ev = claude_events(&plan, None);
        assert_eq!(ev.len(), 1, "the plan is not also a step");
        assert_eq!(ev[0]["kind"], "plan_doc");
        assert!(ev[0]["text"].as_str().unwrap().contains("Add retries"));

        let ask: Value = serde_json::from_str(
            r#"{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t4","name":"AskUserQuestion","input":{"questions":[{"question":"Which database?","header":"DB","multiSelect":false,"options":[{"label":"SQLite","description":"local"},{"label":"Postgres","description":"server"}]}]}}]}}"#,
        )
        .unwrap();
        let ev = claude_events(&ask, None);
        assert_eq!(ev.len(), 1);
        assert_eq!(ev[0]["kind"], "choose");
        assert_eq!(ev[0]["questions"][0]["options"][1]["label"], "Postgres");

        let result: Value = serde_json::from_str(
            r#"{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","is_error":true}]}}"#,
        )
        .unwrap();
        assert_eq!(claude_events(&result, None)[0]["state"], "failed");

        let said: Value = serde_json::from_str(
            r#"{"type":"assistant","message":{"content":[],"usage":{"input_tokens":10,"cache_read_input_tokens":90}}}"#,
        )
        .unwrap();
        assert_eq!(claude_events(&said, None)[0]["used"], 100);

        let done: Value = serde_json::from_str(
            r#"{"type":"result","is_error":false,"result":"x","usage":{"input_tokens":10,"cache_read_input_tokens":90}}"#,
        )
        .unwrap();
        let ev = claude_events(&done, None);
        assert_eq!(ev[0]["kind"], "turn");
        assert!(ev[0]["error"].is_null());

        let limit: Value = serde_json::from_str(
            r#"{"type":"rate_limit_event","rate_limit_info":{"status":"allowed_warning","rateLimitType":"five_hour","resetsAt":1760000000,"utilization":0.8}}"#,
        )
        .unwrap();
        let ev = claude_events(&limit, None);
        assert_eq!(ev[0]["kind"], "limit");
        assert_eq!(ev[0]["status"], "allowed_warning");
        assert_eq!(ev[0]["window"], "five_hour");
    }

    #[test]
    fn reads_codex_items_and_plans() {
        let cmd: Value = serde_json::from_str(
            r#"{"method":"item/completed","params":{"item":{"type":"commandExecution","id":"i1","command":"cargo test","exitCode":1,"status":"completed"}}}"#,
        )
        .unwrap();
        let ev = no_touch(codex_events(&cmd));
        assert_eq!(ev[0]["detail"], "cargo test");
        assert_eq!(ev[0]["state"], "failed");

        let plan: Value = serde_json::from_str(
            r#"{"method":"turn/plan/updated","params":{"plan":[{"step":"Read","status":"completed"},{"step":"Fix","status":"inProgress"}]}}"#,
        )
        .unwrap();
        let ev = codex_events(&plan);
        assert_eq!(ev[0]["items"][1]["status"], "in_progress");

        let search_start: Value = serde_json::from_str(
            r#"{"method":"item/started","params":{"item":{"type":"webSearch","id":"s1","query":""}}}"#,
        )
        .unwrap();
        let ev = codex_events(&search_start);
        assert_eq!(ev[0]["label"], "Search the web");
        assert_eq!(ev[0]["detail"], "");

        let search_done: Value = serde_json::from_str(
            r#"{"method":"item/completed","params":{"item":{"type":"webSearch","id":"s1","query":"","action":{"type":"search","query":"google drive reclaim storage"}}}}"#,
        )
        .unwrap();
        let ev = codex_events(&search_done);
        assert_eq!(
            ev[0]["label"],
            "Search the web for google drive reclaim storage"
        );
        assert_eq!(ev[0]["detail"], "google drive reclaim storage");
    }

    #[test]
    fn describes_tools_in_words() {
        assert_eq!(
            describe_tool("Bash", &json!({ "command": "npm test" })),
            ("Run a command".into(), "npm test".into())
        );
        assert_eq!(
            describe_tool("mcp__duskie__duskie_search", &json!({})).0,
            "duskie duskie search"
        );
    }

    #[test]
    fn modes_map_to_each_cli() {
        assert_eq!(Mode::Edit.claude(), "acceptEdits");
        assert_eq!(Mode::Plan.codex(), ("read-only", "never"));
        assert_eq!(Mode::Ask.codex().1, "untrusted");
    }
    #[test]
    fn codex_questions_read_like_claude_questions_and_answer_by_id() {
        let p = json!({ "threadId": "t", "turnId": "u", "itemId": "i", "questions": [{
            "id": "db", "header": "DB", "question": "Which database?",
            "options": [{ "label": "SQLite", "description": "local" }, { "label": "Postgres", "description": "server" }],
        }]});
        let (ids, qs) = codex_questions(&p);
        assert_eq!(ids, vec!["db".to_owned()]);
        assert_eq!(qs[0]["question"], "Which database?");
        assert_eq!(qs[0]["options"][1]["label"], "Postgres");
        assert_eq!(
            codex_input_answer(&ids, "SQLite"),
            json!({ "answers": { "db": { "answers": ["SQLite"] } } })
        );
        // No options is a free-text question.
        let (_, qs) = codex_questions(
            &json!({ "questions": [{ "id": "n", "question": "Name?", "options": null }] }),
        );
        assert_eq!(qs[0]["options"], json!([]));
    }
}
