//! Which tools a question gets: what only reads, what is Duskie's own, and
//! the few tools picked by meaning or by words.

use super::*;

pub fn reads_only(name: &str) -> bool {
    matches!(
        name,
        USE_SKILL
            | SEARCH
            | FIND
            | TODAY
            | RECENT
            | SCREEN
            | PC_STATUS
            | STORAGE
            | SYSTEM
            | RUN
            | APP_INFO
            | DIAGNOSE
            | COMPARE
            | HELP
            | DOCTOR
            | GIT
            | GITHUB
            | WEB_SEARCH
            | READ_PAGE
            | NOTIFS
    )
}

/// One of Duskie's own tools (not Composio's).
pub fn is_own(name: &str) -> bool {
    matches!(
        name,
        USE_SKILL
            | SEARCH
            | TODAY
            | RECENT
            | OPEN
            | SCREEN
            | PROPOSE
            | FIND
            | REVEAL
            | PC_STATUS
            | STORAGE
            | SYSTEM
            | RUN
            | APP_INFO
            | DIAGNOSE
            | COMPARE
            | HELP
            | DOCTOR
            | GIT
            | GITHUB
            | PC
            | WINDOWS
            | WEB_SEARCH
            | READ_PAGE
            | NOTIFS
            | BROWSER
            | APP_ACTION
            | DESKTOP
            | APPS
            | OFFICE
            | RECIPES
            | REMEMBER
    )
}

/// Always offered: what nearly every question needs.
/// Greetings and writing help: answered from the words alone, so no tool
/// list for a small model to read first.
pub fn needs_no_tools(question: &str) -> bool {
    let q = question.trim().to_lowercase();
    let first = q.split_whitespace().next().unwrap_or_default();
    let small_talk = q.split_whitespace().count() <= 4
        && [
            "hi", "hello", "hey", "thanks", "thank", "ok", "okay", "yo", "can", "good", "bye",
        ]
        .contains(&first.trim_matches(|c: char| !c.is_alphanumeric()))
        && !q.contains("file")
        && !q.contains("open");
    let writing = [
        "rewrite",
        "rephrase",
        "reword",
        "translate",
        "summarize",
        "proofread",
    ]
    .contains(&first)
        || (first == "write" && !q.contains("file"));
    small_talk || writing
}

pub(super) const CORE: &[&str] = &[SEARCH, FIND, OPEN, PROPOSE];
/// Tools offered beyond the core, picked by meaning.
pub(super) const PICKED: usize = 6;
/// Each tool's name and the embedding of its description.
pub(super) type ToolVectors = Vec<(String, Vec<f32>)>;
/// Tool descriptions embedded once per embedding model.
pub(super) static TOOL_VECTORS: tokio::sync::Mutex<Option<(String, ToolVectors)>> =
    tokio::sync::Mutex::const_new(None);

/// About eight tools instead of twenty: the core ones plus the closest in
/// meaning to the question. Small models pick better from fewer. Without an
/// embedding model every tool is offered.
pub async fn pick(app: &AppHandle, question: &str, defs: Vec<ToolDef>) -> Vec<ToolDef> {
    if needs_no_tools(question) {
        return Vec::new();
    }
    let Some((client, model)) = crate::search::embedder(app) else {
        return by_words(question, defs);
    };
    let embed = async {
        let mut cached = TOOL_VECTORS.lock().await;
        if cached.as_ref().is_none_or(|(m, _)| *m != model) {
            let inputs: Vec<String> = defs
                .iter()
                .map(|d| {
                    crate::search::prefixed(
                        &model,
                        "search_document",
                        &format!("{}: {}", d.name, d.description),
                    )
                })
                .collect();
            let vectors = client.embed(&model, &inputs).await.ok()?;
            *cached = Some((
                model.clone(),
                defs.iter().map(|d| d.name.clone()).zip(vectors).collect(),
            ));
        }
        let q = client
            .embed(
                &model,
                &[crate::search::prefixed(&model, "search_query", question)],
            )
            .await
            .ok()?
            .pop()?;
        Some((q, cached.as_ref()?.1.clone()))
    };
    let Ok(Some((q, tools))) = tokio::time::timeout(PICK_TIMEOUT, embed).await else {
        return by_words(question, defs);
    };
    let names = closest(&q, &tools, PICKED);
    let intent = by_intent(question);
    defs.into_iter()
        .filter(|d| {
            CORE.contains(&d.name.as_str())
                || names.contains(&d.name)
                || intent.contains(&d.name.as_str())
        })
        .collect()
}

/// The status line shown the moment a question is asked, from its intent.
pub fn first_step(question: &str) -> Option<&'static str> {
    let tools = by_intent(question);
    let first = *tools.first()?;
    Some(match first {
        DIAGNOSE => "Looking into it",
        COMPARE => "Comparing them",
        SYSTEM => "Checking this PC",
        HELP => "Checking Duskie's guide",
        _ => "Checking",
    })
}

/// Tools a question's intent always needs, on top of the picked ones, so a
/// "why" question is never left without the tools that can find out why.
pub fn by_intent(question: &str) -> Vec<&'static str> {
    let q = format!(" {} ", question.to_lowercase());
    let has = |words: &[&str]| words.iter().any(|w| q.contains(w));
    let mut out: Vec<&'static str> = Vec::new();
    if has(&[
        "slower than",
        "faster than",
        " vs ",
        "compared to",
        "than chrome",
        "than edge",
    ]) {
        out.push(COMPARE);
    }
    if has(&[
        "why",
        "not working",
        "won't",
        "wont",
        "can't",
        "cannot",
        "stuck",
        "not updating",
        "update",
        "error",
        "crash",
        "broken",
        "freez",
        "not open",
        "not start",
    ]) {
        out.extend([DIAGNOSE, APP_INFO, RUN, SYSTEM, WEB_SEARCH]);
    }
    if has(&[
        "port",
        "localhost",
        "server",
        "wifi",
        "wi-fi",
        "internet",
        "network",
        "ping",
        " ip ",
        "dns",
        "vpn",
        "proxy",
    ]) {
        out.extend([SYSTEM, RUN]);
    }
    if has(&[
        "slow",
        "lag",
        "slower",
        " vs ",
        "compared",
        "memory",
        " ram",
        "cpu",
        "running hot",
        "eating",
    ]) {
        out.extend([SYSTEM, DIAGNOSE, RUN, PC_STATUS]);
    }
    if has(&[
        "duskie",
        " you ",
        "how do you",
        "can you do",
        "what can you",
        "setting",
        "shortcut",
        "wake word",
    ]) {
        out.push(HELP);
    }
    out.dedup();
    out
}

/// Without an embedding model: the tools whose name or description share
/// the most words with the question, plus the core ones. Every tool when
/// nothing matches, so a question is never left without the right one.
pub fn by_words(question: &str, defs: Vec<ToolDef>) -> Vec<ToolDef> {
    let words: Vec<String> = question
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() >= 4)
        .map(str::to_lowercase)
        .collect();
    let mut scored: Vec<(usize, String)> = defs
        .iter()
        .filter(|d| !CORE.contains(&d.name.as_str()))
        .map(|d| {
            let text = format!("{} {}", d.name.replace('_', " "), d.description).to_lowercase();
            (
                words.iter().filter(|w| text.contains(w.as_str())).count(),
                d.name.clone(),
            )
        })
        .filter(|(n, _)| *n > 0)
        .collect();
    // Nothing matches ("hi", "rewrite this"): the core tools only, not all
    // twenty. Every tool is prompt the model must read before its first word.
    let intent = by_intent(question);
    if scored.is_empty() {
        return defs
            .into_iter()
            .filter(|d| CORE.contains(&d.name.as_str()) || intent.contains(&d.name.as_str()))
            .collect();
    }
    scored.sort_by_key(|a| std::cmp::Reverse(a.0));
    let names: Vec<String> = scored.into_iter().take(PICKED).map(|(_, n)| n).collect();
    defs.into_iter()
        .filter(|d| {
            CORE.contains(&d.name.as_str())
                || names.contains(&d.name)
                || intent.contains(&d.name.as_str())
        })
        .collect()
}

/// Embedding the question may take this long before every tool is offered.
pub(super) const PICK_TIMEOUT: std::time::Duration = std::time::Duration::from_millis(600);

/// The `n` tool names closest to `q`, core tools left out.
pub(super) fn closest(q: &[f32], tools: &[(String, Vec<f32>)], n: usize) -> Vec<String> {
    let mut scored: Vec<(f32, &String)> = tools
        .iter()
        .filter(|(name, _)| !CORE.contains(&name.as_str()))
        .map(|(name, v)| (duskie_core::storage::cosine(q, v), name))
        .collect();
    scored.sort_by(|a, b| b.0.total_cmp(&a.0));
    scored.into_iter().take(n).map(|(_, n)| n.clone()).collect()
}

/// Tools that reach the internet or other apps, left out for "This PC only".
pub fn is_web(name: &str) -> bool {
    matches!(
        name,
        WEB_SEARCH | READ_PAGE | BROWSER | APP_ACTION | APPS | GITHUB
    )
}

#[cfg(test)]
mod intent_tests {
    use super::*;

    #[test]
    fn intents_bring_the_tools_that_can_answer() {
        assert!(by_intent("Why is Cursor not updating?").contains(&DIAGNOSE));
        assert!(by_intent("Which port is free?").contains(&SYSTEM));
        assert!(by_intent("Zen loads sites slower than Chrome").contains(&SYSTEM));
        assert!(by_intent("How do you work?").contains(&HELP));
        assert!(by_intent("Rewrite this sentence").is_empty());
        assert_eq!(by_intent("Zen loads sites slower than Chrome")[0], COMPARE);
        assert_eq!(
            first_step("Why is Cursor not updating?"),
            Some("Looking into it")
        );
        assert_eq!(first_step("Which port is free?"), Some("Checking this PC"));
        assert_eq!(first_step("Rewrite this sentence"), None);
        let names: Vec<String> = by_words("Is localhost busy?", defs())
            .into_iter()
            .map(|d| d.name)
            .collect();
        assert!(names.iter().any(|n| n == SYSTEM), "{names:?}");
    }
}
