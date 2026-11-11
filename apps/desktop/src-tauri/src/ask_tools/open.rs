//! Opening and revealing files, folders, apps and links, with paths
//! expanded and anything that runs code refused.

use super::*;

pub(super) async fn reveal(app: &AppHandle, path: &str) -> String {
    let path = normalize_target(path);
    let path = path.as_str();
    if path.is_empty() {
        return "Error: no path.".into();
    }
    if !Path::new(path).exists() {
        return missing(path);
    }
    let exec = executor(&app.state::<AppState>());
    match exec.run("reveal_path", &json!({ "path": path })).await {
        Ok(o) => o.message,
        Err(e) => format!("Error: {e}"),
    }
}

/// A path the model made up or guessed: tell it to look, not the user.
pub(super) fn missing(path: &str) -> String {
    format!(
        "Error: {path} does not exist. Get real paths from find_files (or storage) and try \
         again; do not mention this error to the user."
    )
}

/// Opens a file, folder or link the user clicked in an answer.
pub async fn open_target(app: &AppHandle, target: &str) -> Result<String, String> {
    let out = open(app, target).await;
    if out.starts_with("Error") || out.starts_with("Refused") {
        Err(out)
    } else {
        Ok(out)
    }
}

/// A path as models write it: "file:///C:/x", "/C:/x" or "C:\\x" all mean
/// C:\x.
pub fn normalize_target(target: &str) -> String {
    let t = target.trim().trim_matches(['<', '>', '"', '\'']);
    if t.starts_with("http://") || t.starts_with("https://") {
        return t.to_owned();
    }
    let t = t
        .strip_prefix("file:///")
        .or_else(|| t.strip_prefix("file://"))
        .unwrap_or(t);
    let b = t.as_bytes();
    let t = if b.len() > 2 && b[0] == b'/' && b[1].is_ascii_alphabetic() && b[2] == b':' {
        &t[1..]
    } else {
        t
    };
    expand_home(&expand_vars(&t.replace("%20", " ")))
}

/// What models write for the user's folders, made real: ~, %VAR%, $VAR,
/// $(VAR) and ${VAR} (USERPROFILE, HOME, USERNAME, APPDATA...).
pub fn expand_vars(t: &str) -> String {
    let var = |name: &str| -> Option<String> {
        let n = name.trim();
        std::env::var(n).ok().or_else(|| {
            (n.eq_ignore_ascii_case("home") || n.eq_ignore_ascii_case("userprofile"))
                .then(|| dirs::home_dir().map(|h| h.display().to_string()))
                .flatten()
        })
    };
    let mut out = String::with_capacity(t.len());
    let mut rest = t;
    if let Some(r) = rest.strip_prefix('~')
        && (r.is_empty() || r.starts_with(['/', '\\']))
        && let Some(home) = dirs::home_dir()
    {
        out.push_str(&home.display().to_string());
        rest = r;
    }
    while let Some(i) = rest.find(['%', '$']) {
        out.push_str(&rest[..i]);
        let tail = &rest[i..];
        let (name, used) = if let Some(t) = tail.strip_prefix('%') {
            t.find('%').map_or((None, 1), |j| (Some(&t[..j]), j + 2))
        } else if let Some(t) = tail.strip_prefix("$(").or_else(|| tail.strip_prefix("${")) {
            t.find([')', '}'])
                .map_or((None, 2), |j| (Some(&t[..j]), j + 3))
        } else {
            let t = &tail[1..];
            let j = t
                .find(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))
                .unwrap_or(t.len());
            ((j > 0).then(|| &t[..j]), j + 1)
        };
        match name.and_then(var) {
            Some(v) => out.push_str(&v),
            None => out.push_str(&tail[..used.min(tail.len())]),
        }
        rest = &tail[used.min(tail.len())..];
    }
    out.push_str(rest);
    out
}

/// A made-up user folder (C:\\Users\\John, C:\\Users\\<username>) becomes the
/// real one when the made-up one does not exist.
pub fn expand_home(t: &str) -> String {
    let b = t.as_bytes();
    if b.len() < 10 || !b[0].is_ascii_alphabetic() || b[1] != b':' {
        return t.to_owned();
    }
    let rest = &t[3..];
    let Some(after) = rest
        .strip_prefix("Users")
        .or_else(|| rest.strip_prefix("users"))
    else {
        return t.to_owned();
    };
    let after = after.trim_start_matches(['/', '\\']);
    let (user, tail) = after.split_once(['/', '\\']).unwrap_or((after, ""));
    let Some(home) = dirs::home_dir() else {
        return t.to_owned();
    };
    let shared = ["public", "default", "all users"].contains(&user.to_ascii_lowercase().as_str());
    let users = Path::new(&t[..3]).join("Users");
    if user.is_empty() || shared || !users.is_dir() || users.join(user).exists() {
        return t.to_owned();
    }
    if tail.is_empty() {
        home.display().to_string()
    } else {
        home.join(tail).display().to_string()
    }
}

pub(super) async fn open(app: &AppHandle, target: &str) -> String {
    let target = normalize_target(target);
    let target = target.as_str();
    if target.is_empty() {
        return "Error: nothing to open.".into();
    }
    if runs_code(target) {
        return "Refused: that file runs a program. Tell the user to open it themselves.".into();
    }
    let web = target.starts_with("http://") || target.starts_with("https://");
    if !web && !Path::new(target).exists() {
        return missing(target);
    }
    let (action, args) = if web {
        ("open_url", json!({ "url": target }))
    } else {
        ("open_path", json!({ "path": target }))
    };
    let exec = executor(&app.state::<AppState>());
    match exec.run(action, &args).await {
        Ok(o) => o.message,
        Err(e) => format!("Error: {e}"),
    }
}

/// Files that run something when opened. The model only opens documents,
/// folders and pages; a program starts only when the user starts it.
pub fn runs_code(target: &str) -> bool {
    const RUNS: &[&str] = &[
        "exe", "msi", "bat", "cmd", "com", "ps1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "scr",
        "lnk", "url", "hta", "cpl", "msc", "jar", "reg", "appx", "msix",
    ];
    if target.starts_with("http://") || target.starts_with("https://") {
        return false;
    }
    std::path::Path::new(target)
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| RUNS.contains(&e.to_ascii_lowercase().as_str()))
}

/// Whether Windows (or this OS) has a default app that can open `path`.
/// No extension, or no ProgId / open command → Ask should ask where to open it.
pub fn has_file_association(path: &str) -> bool {
    let p = std::path::Path::new(path);
    if p.is_dir() {
        return true;
    }
    let Some(ext) = p.extension().and_then(|e| e.to_str()) else {
        return false;
    };
    #[cfg(windows)]
    {
        association_prog_id(ext).is_some_and(|id| has_shell_open(&id))
    }
    #[cfg(not(windows))]
    {
        let _ = ext;
        true
    }
}

#[cfg(windows)]
pub(super) fn association_prog_id(ext: &str) -> Option<String> {
    let dot = format!(".{}", ext.to_ascii_lowercase());
    reg_value(
        &format!(
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\{dot}\UserChoice"
        ),
        "ProgId",
    )
    .filter(|id| !id.is_empty())
    .or_else(|| reg_default(&format!(r"HKCR\{dot}")).filter(|id| !id.is_empty()))
}

#[cfg(windows)]
pub(super) fn has_shell_open(prog_id: &str) -> bool {
    reg_default(&format!(r"HKCR\{prog_id}\shell\open\command")).is_some_and(|cmd| !cmd.is_empty())
}

#[cfg(windows)]
pub(super) fn reg_value(key: &str, name: &str) -> Option<String> {
    use std::os::windows::process::CommandExt;
    let out = std::process::Command::new("reg")
        .args(["query", key, "/v", name])
        .creation_flags(0x0800_0000)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let needle = name.to_ascii_lowercase();
    text.lines()
        .find(|l| l.to_ascii_lowercase().contains(&needle))
        .and_then(|l| l.split_whitespace().last())
        .map(str::to_owned)
}

#[cfg(windows)]
pub(super) fn reg_default(key: &str) -> Option<String> {
    use std::os::windows::process::CommandExt;
    let out = std::process::Command::new("reg")
        .args(["query", key, "/ve"])
        .creation_flags(0x0800_0000)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    text.lines().find(|l| l.contains("REG_")).and_then(|l| {
        // "    (Default)    REG_SZ    value", value may be missing.
        let mut parts = l.split_whitespace();
        let _ = parts.next()?; // (Default)
        let _ = parts.next()?; // REG_SZ
        let rest: Vec<_> = parts.collect();
        if rest.is_empty() {
            None
        } else {
            Some(rest.join(" "))
        }
    })
}
