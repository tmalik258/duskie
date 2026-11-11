//! `app_info` and `diagnose`: the facts about one app, and the likely reasons
//! it is not working or not updating, ranked, so the model can explain the
//! cause in one line and offer fixes as buttons.

use super::*;

pub fn app_info_def() -> ToolDef {
    ToolDef {
        name: APP_INFO.into(),
        description: "Facts about one installed app: version and install folder, whether it is \
            running and its memory, whether winget has an update, recent errors from its own logs \
            and Windows Event Log errors from the last 7 days."
            .into(),
        parameters: json!({
            "type": "object",
            "properties": { "name": { "type": "string", "description": "The app, e.g. Cursor" } },
            "required": ["name"]
        }),
    }
}

pub fn diagnose_def() -> ToolDef {
    ToolDef {
        name: DIAGNOSE.into(),
        description: "One call for \"why is X not working, crashing, slow or not updating\": \
            checks the app (version, running, update, its logs, Event Log, crash records) and \
            returns likely causes, most likely first, with fixes to offer through propose. Use \
            this before guessing or asking the user to look."
            .into(),
        parameters: json!({
            "type": "object",
            "properties": {
                "app": { "type": "string", "description": "The app, e.g. Cursor" },
                "problem": { "type": "string", "description": "What goes wrong, in the user's words" }
            },
            "required": ["app"]
        }),
    }
}

/// Causes the facts point to, most likely first, each with a fix to offer.
pub fn rank(facts: &str, problem: &str) -> Vec<String> {
    let f = facts.to_lowercase();
    let p = problem.to_lowercase();
    let mut out: Vec<(u8, String)> = Vec::new();
    let mut add = |score: u8, s: &str| out.push((score, s.to_owned()));
    if f.contains("update available:") && !f.contains("update available: none") {
        add(
            if p.contains("updat") { 9 } else { 6 },
            "An update is waiting that has not installed. Fix: offer to update it (propose install_app or run winget upgrade as a button), after closing the app.",
        );
    }
    if ["eperm", "denied", "access is denied"]
        .iter()
        .any(|w| f.contains(w))
    {
        add(
            8,
            "Its logs show permission errors, often a folder it cannot write to or an antivirus block. Fix: offer to restart it, or reinstall for the current user.",
        );
    }
    if [
        "enotfound",
        "etimedout",
        "econnrefused",
        "certificate",
        "proxy",
    ]
    .iter()
    .any(|w| f.contains(w))
    {
        add(
            8,
            "Its logs show network errors (DNS, timeout, proxy or certificate). Fix: check the connection with run (ping, nslookup) and any VPN or proxy.",
        );
    }
    if f.contains("crash")
        || f.contains("cause:")
        || f.contains("event log: ") && !f.contains("no errors naming it")
    {
        add(
            7,
            "Windows recorded errors or crashes for it. Fix: the crash causes below; otherwise offer a clean restart or reinstall.",
        );
    }
    if f.contains("running: yes") && p.contains("updat") {
        add(
            5,
            "It is running, and many apps only update after a full restart. Fix: offer to close it fully and open it again.",
        );
    }
    if f.contains("running: no")
        && (p.contains("open") || p.contains("start") || p.contains("working"))
    {
        add(
            5,
            "It is not running now, so it may close right after starting. Fix: offer to start it and check again.",
        );
    }
    if f.contains("not found in the uninstall list") {
        add(
            4,
            "It is not in the installed apps list, so it may be a portable or Store copy. Fix: ask where it came from, or offer install_app.",
        );
    }
    if out.is_empty() {
        out.push((1, "Nothing stands out in its logs or Windows records. Ask what exactly happens, then web_search the exact error.".to_owned()));
    }
    out.sort_by_key(|o| std::cmp::Reverse(o.0));
    out.into_iter().map(|(_, s)| s).collect()
}

pub async fn diagnose(args: &Value) -> String {
    let app = args["app"].as_str().unwrap_or_default().trim().to_owned();
    let problem = args["problem"].as_str().unwrap_or_default().to_owned();
    if app.is_empty() {
        return "Error: name the app to check.".into();
    }
    let name = app.clone();
    let facts = tokio::task::spawn_blocking(move || {
        let info = duskie_actions::app_info::app_info(&name)
            .unwrap_or_else(|e| format!("app_info failed: {e}"));
        let crashes = doctor_report(Some(&name)).unwrap_or_default();
        format!("{info}\nCrash records:\n{crashes}")
    })
    .await
    .unwrap_or_else(|e| format!("Error: {e}"));
    let causes = rank(&facts, &problem);
    let list: Vec<String> = causes
        .iter()
        .enumerate()
        .map(|(i, c)| format!("{}. {c}", i + 1))
        .collect();
    format!(
        "Facts about {app}:\n{facts}\n\nLikely causes, most likely first:\n{}\n\nSay the top cause in one line, then offer the fixes as buttons.",
        list.join("\n")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_waiting_update_comes_first_for_update_problems() {
        let facts =
            "Running: yes, 3 processes\nUpdate available: Cursor 1.2 1.3 winget\nOwn logs: none";
        let r = rank(facts, "not updating");
        assert!(r[0].starts_with("An update is waiting"), "{r:?}");
        assert!(r.iter().any(|c| c.contains("full restart")));
    }

    #[test]
    fn network_errors_in_logs_are_named() {
        let r = rank(
            "Running: no\n  log: getaddrinfo ENOTFOUND update.example.com",
            "won't update",
        );
        assert!(r[0].contains("network errors"), "{r:?}");
    }

    #[test]
    fn nothing_found_says_so() {
        let r = rank(
            "Running: yes\nUpdate available: none found by winget\nEvent Log: no errors naming it in 7 days",
            "slow",
        );
        assert_eq!(r.len(), 1);
        assert!(r[0].starts_with("Nothing stands out"));
    }
}
