//! The `run` tool: read-only commands (netstat, ipconfig, ping, Get-*, git
//! status, winget list...) run at once; anything else is offered as a button
//! that shows the exact command, so nothing changes without a tap.

use super::*;

/// First words that only read. `winget` and `git` are checked further below.
const SAFE: &[&str] = &[
    "netstat",
    "ipconfig",
    "ifconfig",
    "ip",
    "ping",
    "nslookup",
    "dig",
    "where",
    "which",
    "whoami",
    "hostname",
    "systeminfo",
    "tasklist",
    "ver",
    "uname",
    "uptime",
    "df",
    "free",
    "node",
    "npm",
    "pnpm",
    "python",
    "python3",
    "py",
    "cargo",
    "rustc",
    "java",
    "go",
    "dotnet",
    "test-connection",
    "test-netconnection",
    "resolve-dnsname",
];

pub fn run_def() -> ToolDef {
    ToolDef {
        name: RUN.into(),
        description: "Run one read-only command on this PC and read its output: netstat, ipconfig, \
            ping, nslookup, tasklist, systeminfo, PowerShell Get-* cmdlets, winget list/show/search, \
            git status/log/diff, tool versions (node -v). Use it to check facts before answering. \
            A command that would change anything is not run; offer it with propose run_command \
            {command} so the user can tap to run it."
            .into(),
        parameters: json!({
            "type": "object",
            "properties": {
                "command": { "type": "string", "description": "One command, no pipes or ;" }
            },
            "required": ["command"]
        }),
    }
}

pub fn run_label(args: &Value) -> String {
    let cmd = args["command"].as_str().unwrap_or_default();
    let short: String = cmd.chars().take(40).collect();
    format!("Running {short}")
}

/// Whether a command only reads: one command from the allowlist, with no
/// chaining, redirection or substitution.
pub fn is_safe(cmd: &str) -> bool {
    let cmd = cmd.trim();
    if cmd.is_empty() || cmd.contains(['|', ';', '&', '>', '<', '`', '\n']) || cmd.contains("$(") {
        return false;
    }
    // Words that change things, whatever the command.
    const CHANGES: &[&str] = &[
        "set",
        "add",
        "del",
        "delete",
        "flush",
        "/flushdns",
        "/release",
        "/renew",
        "/registerdns",
        "kill",
        "stop",
        "remove",
        "install",
        "uninstall",
        "reset",
    ];
    let words: Vec<String> = cmd.split_whitespace().map(str::to_lowercase).collect();
    if words.iter().skip(1).any(|w| CHANGES.contains(&w.as_str())) {
        return false;
    }
    let first = words[0].trim_end_matches(".exe");
    let second = words.get(1).map(String::as_str).unwrap_or_default();
    match first {
        "winget" => {
            matches!(second, "list" | "show" | "search" | "--version" | "-v")
                || (second == "upgrade" && words.len() == 2)
        }
        "git" => {
            matches!(
                second,
                "status" | "log" | "diff" | "branch" | "remote" | "show" | "--version"
            ) && !words
                .iter()
                .any(|w| w == "-d" || w == "-D" || w == "--delete" || w == "add" || w == "remove")
        }
        "docker" => matches!(second, "ps" | "images" | "version" | "info"),
        f if f.starts_with("get-") => true,
        f => SAFE.contains(&f),
    }
}

pub fn run_command(args: &Value) -> String {
    let cmd = args["command"].as_str().unwrap_or_default().trim();
    if !is_safe(cmd) {
        return format!(
            "Not run: this command could change something. Offer it as a button with \
             propose run_command {{\"command\": \"{cmd}\"}} and say in one line what it does."
        );
    }
    duskie_actions::run_shell(cmd).unwrap_or_else(|e| format!("Error: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_reading_commands_run_at_once() {
        for ok in [
            "netstat -ano",
            "ipconfig /all",
            "Get-Process chrome",
            "winget list cursor",
            "winget upgrade",
            "git status",
            "node -v",
            "ping google.com",
            "nslookup github.com",
        ] {
            assert!(is_safe(ok), "{ok}");
        }
        for no in [
            "winget upgrade --id Cursor.Cursor",
            "rm -rf /",
            "Stop-Process -Name chrome",
            "git push",
            "git branch -D old",
            "ipconfig /release",
            "netstat; rm x",
            "ping x | tee y",
            "echo $(whoami)",
            "Remove-Item C:\\x",
            "",
        ] {
            assert!(!is_safe(no), "{no}");
        }
    }

    #[test]
    fn runs_and_refuses() {
        assert!(!run_command(&json!({"command":"uname"})).starts_with("Error"));
        assert!(run_command(&json!({"command":"rm -rf /tmp/x"})).contains("propose run_command"));
    }
}
