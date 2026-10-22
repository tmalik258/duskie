//! The `system` tool: what listens on which port, whether a port is free,
//! and which processes use the CPU and memory. Works on Windows and Linux.

use std::collections::BTreeMap;
use std::net::TcpListener;

use listeners::{Protocol, SocketState};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};

use super::*;

/// Dev ports people ask about, checked when no port is named.
const COMMON: &[u16] = &[3000, 3001, 4200, 5000, 5173, 8000, 8080, 8888];
/// How far past a taken port to look for a free one.
const SEARCH_AHEAD: u16 = 200;
const MAX_ROWS: usize = 40;

pub fn system_def() -> ToolDef {
    ToolDef {
        name: SYSTEM.into(),
        description: "Live facts about this PC's ports and programs. ports lists every \
            listening port with the app that owns it; port_free says whether a port is free \
            (or which common dev ports are free when no port is given) and, when taken, who \
            holds it and the next free one; processes lists what uses the most CPU or memory, \
            optionally only those matching name. To free a port, offer propose kill_port \
            {port}. Use this for any question about ports, localhost, servers, or what is \
            running or slowing the PC."
            .into(),
        parameters: json!({
            "type": "object",
            "properties": {
                "action": { "type": "string", "enum": ["ports", "port_free", "processes"] },
                "port": { "type": "integer", "description": "For port_free" },
                "name": { "type": "string", "description": "Only processes whose name has this" },
                "sort": { "type": "string", "enum": ["cpu", "memory"] }
            },
            "required": ["action"]
        }),
    }
}

pub fn system_label(args: &Value) -> String {
    match args["action"].as_str().unwrap_or_default() {
        "ports" => "Checking which ports are in use".into(),
        "port_free" => match args["port"].as_u64() {
            Some(p) => format!("Checking port {p}"),
            None => "Finding a free port".into(),
        },
        _ => "Checking what is running".into(),
    }
}

pub fn system_tool(args: &Value) -> Result<String, duskie_actions::ActionError> {
    let port = args["port"].as_u64().and_then(|p| u16::try_from(p).ok());
    Ok(match args["action"].as_str().unwrap_or("ports") {
        "port_free" => match port {
            Some(p) => port_report(p),
            None => common_ports(),
        },
        "processes" => processes(
            args["name"].as_str().unwrap_or_default(),
            args["sort"].as_str() == Some("memory"),
        ),
        _ => ports(),
    })
}

/// Listening TCP ports: port to the processes holding it.
fn listening() -> BTreeMap<u16, Vec<String>> {
    let mut out: BTreeMap<u16, Vec<String>> = BTreeMap::new();
    for l in listeners::get_all().unwrap_or_default() {
        if l.protocol != Protocol::TCP || l.state != SocketState::Listen {
            continue;
        }
        let who = format!("{} (pid {})", l.process.name, l.process.pid);
        let entry = out.entry(l.socket.port()).or_default();
        if !entry.contains(&who) {
            entry.push(who);
        }
    }
    out
}

/// Free when nothing listens on it and it can be bound on all addresses.
fn is_free(port: u16, taken: &BTreeMap<u16, Vec<String>>) -> bool {
    !taken.contains_key(&port)
        && TcpListener::bind(("0.0.0.0", port)).is_ok()
        && TcpListener::bind(("127.0.0.1", port)).is_ok()
}

fn next_free(from: u16, taken: &BTreeMap<u16, Vec<String>>) -> Option<u16> {
    (from.saturating_add(1)..=from.saturating_add(SEARCH_AHEAD)).find(|p| is_free(*p, taken))
}

fn port_report(port: u16) -> String {
    let taken = listening();
    if is_free(port, &taken) {
        return format!("Port {port} is free.");
    }
    let who = taken
        .get(&port)
        .map(|w| w.join(", "))
        .unwrap_or_else(|| "a program Duskie cannot see (needs admin)".into());
    match next_free(port, &taken) {
        Some(n) => format!("Port {port} is taken by {who}. The next free port is {n}."),
        None => format!("Port {port} is taken by {who}."),
    }
}

fn common_ports() -> String {
    let taken = listening();
    COMMON
        .iter()
        .map(|p| match taken.get(p) {
            None if is_free(*p, &taken) => format!("{p}: free"),
            None => format!("{p}: taken"),
            Some(who) => format!("{p}: taken by {}", who.join(", ")),
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn ports() -> String {
    let taken = listening();
    if taken.is_empty() {
        return "Nothing is listening on any TCP port.".into();
    }
    let rows: Vec<String> = taken
        .iter()
        .take(MAX_ROWS)
        .map(|(p, who)| format!("{p}: {}", who.join(", ")))
        .collect();
    let more = taken.len().saturating_sub(MAX_ROWS);
    let tail = if more > 0 {
        format!("\n…and {more} more")
    } else {
        String::new()
    };
    format!("Listening ports:\n{}{tail}", rows.join("\n"))
}

/// Processes summed by name, busiest first. CPU needs two samples.
fn processes(filter: &str, by_memory: bool) -> String {
    let mut sys = System::new();
    let kind = ProcessRefreshKind::nothing().with_cpu().with_memory();
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, kind);
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, kind);
    let cores = sys.cpus().len().max(1) as f32;
    let filter = filter.trim().to_lowercase();
    let mut by_name: BTreeMap<String, (f32, u64, usize)> = BTreeMap::new();
    for p in sys.processes().values() {
        let name = p.name().to_string_lossy().to_string();
        if !filter.is_empty() && !name.to_lowercase().contains(&filter) {
            continue;
        }
        let e = by_name.entry(name).or_default();
        e.0 += p.cpu_usage() / cores;
        e.1 += p.memory();
        e.2 += 1;
    }
    if by_name.is_empty() {
        return format!("No running process matches {filter}.");
    }
    let mut rows: Vec<_> = by_name.into_iter().collect();
    if by_memory {
        rows.sort_by_key(|r| std::cmp::Reverse(r.1.1));
    } else {
        rows.sort_by(|a, b| b.1.0.total_cmp(&a.1.0));
    }
    let lines: Vec<String> = rows
        .iter()
        .take(12)
        .map(|(name, (cpu, mem, n))| {
            let count = if *n > 1 {
                format!(" ({n} processes)")
            } else {
                String::new()
            };
            format!(
                "{name}{count}: CPU {cpu:.0}%, memory {} MB",
                mem / 1_048_576
            )
        })
        .collect();
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bound_port_is_taken_and_the_next_one_is_offered() {
        let held = TcpListener::bind("0.0.0.0:0").unwrap();
        let port = held.local_addr().unwrap().port();
        let report = port_report(port);
        assert!(
            report.starts_with(&format!("Port {port} is taken")),
            "{report}"
        );
        assert!(report.contains("next free port"), "{report}");
        drop(held);
    }

    #[test]
    fn processes_lists_this_test() {
        let out = processes("", false);
        assert!(out.contains("CPU"), "{out}");
    }
}
