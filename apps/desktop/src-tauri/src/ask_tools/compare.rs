//! `compare`: two apps side by side (CPU, memory, processes) and, for
//! browsers, what their profiles say on disk (hardware acceleration,
//! extensions, cache size, proxy), plus a network probe, so "Zen is slower
//! than Chrome" can be told apart from "your network is slow". Needs no
//! browser extension.

use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use super::*;

/// Sites timed by the network probe.
const PROBE: &[&str] = &["google.com", "cloudflare.com", "github.com"];
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);

pub fn compare_def() -> ToolDef {
    ToolDef {
        name: COMPARE.into(),
        description: "Compare two apps side by side: CPU, memory and process count now, and for \
            browsers (Chrome, Edge, Brave, Firefox, Zen and others) what their profile on disk \
            says: hardware acceleration, extension count, cache size and proxy. Also times DNS \
            and connections to a few sites, to tell a slow network from a slow app. Use for \
            \"X is slower than Y\" and \"why is this browser slow\". Needs no extension."
            .into(),
        parameters: json!({
            "type": "object",
            "properties": {
                "apps": { "type": "array", "items": { "type": "string" }, "description": "One or two apps, e.g. [\"Zen\", \"Chrome\"]" }
            },
            "required": ["apps"]
        }),
    }
}

pub fn compare_label(args: &Value) -> String {
    let apps: Vec<&str> = args["apps"]
        .as_array()
        .map(|a| a.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default();
    match apps.as_slice() {
        [a, b, ..] => format!("Comparing {a} and {b}"),
        [a] => format!("Checking {a}"),
        _ => "Comparing apps".into(),
    }
}

pub fn compare_tool(args: &Value) -> String {
    let apps: Vec<String> = args["apps"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default();
    let mut out = Vec::new();
    for app in apps.iter().take(2) {
        out.push(format!("## {app}"));
        out.push(super::system::processes_of(app));
        if let Some(profile) = browser_profile(app) {
            out.push(profile);
        }
    }
    out.push(format!("## Network\n{}", probe()));
    out.join("\n")
}

/// Chromium keeps settings as JSON; Gecko browsers (Firefox, Zen) in prefs.js.
enum Kind {
    Chromium(PathBuf),
    Gecko(PathBuf),
}

fn kind(app: &str) -> Option<Kind> {
    let a = app.to_lowercase();
    let local = dirs::data_local_dir()?;
    let roaming = dirs::config_dir()?;
    let home = dirs::home_dir()?;
    let chromium = |win: &str, unix: &str| {
        Kind::Chromium(if cfg!(windows) {
            local.join(win).join("User Data")
        } else {
            roaming.join(unix)
        })
    };
    let gecko = |win: &str, unix: &str| {
        Kind::Gecko(if cfg!(windows) {
            roaming.join(win)
        } else {
            home.join(unix)
        })
    };
    Some(match () {
        _ if a.contains("chrome") => chromium("Google/Chrome", "google-chrome"),
        _ if a.contains("edge") => chromium("Microsoft/Edge", "microsoft-edge"),
        _ if a.contains("brave") => {
            chromium("BraveSoftware/Brave-Browser", "BraveSoftware/Brave-Browser")
        }
        _ if a.contains("vivaldi") => chromium("Vivaldi", "vivaldi"),
        _ if a.contains("zen") => gecko("zen", ".zen"),
        _ if a.contains("firefox") => gecko("Mozilla/Firefox", ".mozilla/firefox"),
        _ if a.contains("librewolf") => gecko("librewolf", ".librewolf"),
        _ if a.contains("floorp") => gecko("Floorp", ".floorp"),
        _ => return None,
    })
}

fn browser_profile(app: &str) -> Option<String> {
    match kind(app)? {
        Kind::Chromium(root) => Some(chromium(&root)),
        Kind::Gecko(root) => Some(gecko(&root)),
    }
}

fn chromium(root: &Path) -> String {
    if !root.exists() {
        return "Profile: not found on this PC".into();
    }
    let read = |p: PathBuf| {
        std::fs::read_to_string(p)
            .ok()
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
    };
    let state = read(root.join("Local State")).unwrap_or_default();
    let prefs = read(root.join("Default").join("Preferences")).unwrap_or_default();
    let hw = state["hardware_acceleration_mode"]["enabled"]
        .as_bool()
        .unwrap_or(true);
    let extensions = prefs["extensions"]["settings"].as_object().map_or(0, |m| {
        m.values()
            .filter(|e| e["location"].as_i64() == Some(1))
            .count()
    });
    let proxy = prefs["proxy"]["mode"].as_str().unwrap_or("system");
    let cache = size_mb(&root.join("Default").join("Cache"));
    format!(
        "Hardware acceleration: {}\nExtensions installed: {extensions}\nProxy: {proxy}\nCache: {cache} MB",
        if hw { "on" } else { "off" }
    )
}

fn gecko(root: &Path) -> String {
    let Some(dir) = gecko_profile(root) else {
        return "Profile: not found on this PC".into();
    };
    let prefs = std::fs::read_to_string(dir.join("prefs.js")).unwrap_or_default();
    let pref = |key: &str| {
        prefs
            .lines()
            .find(|l| l.contains(&format!("\"{key}\"")))
            .and_then(|l| l.rsplit(',').next())
            .map(|v| v.trim().trim_end_matches(");").trim().to_owned())
    };
    let hw_off = pref("layers.acceleration.disabled").as_deref() == Some("true")
        || pref("gfx.webrender.software").as_deref() == Some("true");
    let proxy = match pref("network.proxy.type").as_deref() {
        Some("1") => "manual",
        Some("2") => "auto config",
        Some("4") => "auto detect",
        Some("0") => "none",
        _ => "system",
    };
    let extensions = std::fs::read_to_string(dir.join("extensions.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| {
            v["addons"].as_array().map(|a| {
                a.iter()
                    .filter(|x| {
                        x["active"].as_bool() == Some(true) && x["location"] == "app-profile"
                    })
                    .count()
            })
        })
        .unwrap_or(0);
    let cache = size_mb(&dir.join("cache2"));
    format!(
        "Hardware acceleration: {}\nExtensions active: {extensions}\nProxy: {proxy}\nCache: {cache} MB",
        if hw_off { "off" } else { "on" }
    )
}

/// The profile marked default in profiles.ini, else the first one.
fn gecko_profile(root: &Path) -> Option<PathBuf> {
    let ini = std::fs::read_to_string(root.join("profiles.ini")).ok()?;
    let mut paths = Vec::new();
    for line in ini.lines() {
        if let Some(p) = line.strip_prefix("Path=") {
            paths.push(p.trim().to_owned());
        } else if line.trim() == "Default=1"
            && let Some(p) = paths.last()
        {
            return Some(root.join(p));
        }
    }
    paths.first().map(|p| root.join(p))
}

fn size_mb(dir: &Path) -> u64 {
    fn walk(d: &Path, depth: u8) -> u64 {
        let Ok(entries) = std::fs::read_dir(d) else {
            return 0;
        };
        entries
            .flatten()
            .map(|e| match e.metadata() {
                Ok(m) if m.is_dir() && depth < 4 => walk(&e.path(), depth + 1),
                Ok(m) => m.len(),
                Err(_) => 0,
            })
            .sum()
    }
    walk(dir, 0) / 1_048_576
}

/// DNS and connect time per site, so a slow network shows up as such.
fn probe() -> String {
    PROBE
        .iter()
        .map(|host| {
            let t = Instant::now();
            let Some(addr) = (*host, 443)
                .to_socket_addrs()
                .ok()
                .and_then(|mut a| a.next())
            else {
                return format!("{host}: DNS failed");
            };
            let dns = t.elapsed().as_millis();
            let t = Instant::now();
            match TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT) {
                Ok(_) => format!(
                    "{host}: DNS {dns} ms, connect {} ms",
                    t.elapsed().as_millis()
                ),
                Err(_) => format!("{host}: DNS {dns} ms, could not connect"),
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_gecko_profile_from_disk() {
        let root = std::env::temp_dir().join(format!("duskie-zen-{}", std::process::id()));
        let dir = root.join("abc.default");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            root.join("profiles.ini"),
            "[Profile0]\nPath=abc.default\nDefault=1\n",
        )
        .unwrap();
        std::fs::write(
            dir.join("prefs.js"),
            "user_pref(\"layers.acceleration.disabled\", true);\nuser_pref(\"network.proxy.type\", 1);\n",
        )
        .unwrap();
        let out = gecko(&root);
        assert!(out.contains("Hardware acceleration: off"), "{out}");
        assert!(out.contains("Proxy: manual"), "{out}");
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn labels_name_both_apps() {
        assert_eq!(
            compare_label(&json!({ "apps": ["Zen", "Chrome"] })),
            "Comparing Zen and Chrome"
        );
    }
}
