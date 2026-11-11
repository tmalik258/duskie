//! What Duskie can see about one app: installed version and where, whether it
//! runs and how heavy it is, a waiting update, recent errors in its own logs,
//! and Windows Event Log errors. Read-only; the facts behind "why is X not
//! working or updating".

use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};

use crate::{ActionError, pc};

/// Installed entry, update, own log errors and Event Log errors, on Windows.
/// The app name arrives in an environment variable, never in the script.
const SCRIPT: &str = r#"$n=$env:DUSKIE_APP
$k='HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
$i=Get-ItemProperty $k -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*$n*" } | Select-Object -First 3
if($i){ foreach($a in $i){ "Installed: $($a.DisplayName) $($a.DisplayVersion) by $($a.Publisher) at $($a.InstallLocation)" } } else { "Installed: not found in the uninstall list" }
if(Get-Command winget -ErrorAction SilentlyContinue){
 $u=winget list --name $n --upgrade-available --accept-source-agreements 2>$null | Select-String -SimpleMatch $n
 if($u){ "Update available: $($u[0].Line.Trim())" } else { "Update available: none found by winget" }
}
$dirs=@("$env:APPDATA\$n\logs","$env:LOCALAPPDATA\$n\logs","$env:LOCALAPPDATA\Programs\$n\logs","$env:LOCALAPPDATA\$n")
$logs=$dirs | Where-Object { Test-Path $_ } | ForEach-Object { Get-ChildItem $_ -Recurse -Filter *.log -ErrorAction SilentlyContinue } | Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-7) } | Sort-Object LastWriteTime -Descending | Select-Object -First 6
if($logs){
 "Own logs: $($logs[0].DirectoryName)"
 $logs | ForEach-Object { Select-String -Path $_.FullName -Pattern 'error|fail|denied|EPERM|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|certificate|proxy|update' -ErrorAction SilentlyContinue } | Select-Object -Last 15 | ForEach-Object { "  log: " + $_.Line.Trim().Substring(0,[Math]::Min(220,$_.Line.Trim().Length)) }
} else { "Own logs: none in the last 7 days" }
$e=Get-WinEvent -FilterHashtable @{LogName='Application';Level=2;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 300 -ErrorAction SilentlyContinue | Where-Object { $_.Message -like "*$n*" } | Select-Object -First 5
if($e){ $e | ForEach-Object { "Event Log: $($_.TimeCreated.ToString('MM-dd HH:mm')) $($_.ProviderName): " + ($_.Message -split "`n")[0] } } else { "Event Log: no errors naming it in 7 days" }
"#;

/// Whether it runs now, with its processes summed. Works everywhere.
pub fn running(name: &str) -> String {
    let q = name.trim().to_lowercase();
    if q.is_empty() {
        return "Running: no app named".into();
    }
    let mut sys = System::new();
    let kind = ProcessRefreshKind::nothing().with_memory();
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, kind);
    let (mut n, mut mem) = (0usize, 0u64);
    for p in sys.processes().values() {
        if p.name().to_string_lossy().to_lowercase().contains(&q) {
            n += 1;
            mem += p.memory();
        }
    }
    if n == 0 {
        "Running: no".into()
    } else {
        format!("Running: yes, {n} processes, {} MB memory", mem / 1_048_576)
    }
}

/// Everything known about `name`, as plain lines for the model.
pub fn app_info(name: &str) -> Result<String, ActionError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(ActionError::Invalid("name the app".into()));
    }
    let mut out = format!("{}\n", running(name));
    if cfg!(windows) {
        out.push_str(&pc::powershell(SCRIPT, &[("DUSKIE_APP", name)])?);
    } else {
        out.push_str("Install, update and log details are read on Windows only.");
    }
    Ok(out.trim().to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn says_whether_an_app_runs() {
        // This test binary itself is running.
        let me = std::env::current_exe().unwrap();
        let stem = me.file_stem().unwrap().to_string_lossy();
        let name: String = stem.chars().take(10).collect();
        assert!(
            running(&name).starts_with("Running: yes"),
            "{}",
            running(&name)
        );
        assert_eq!(running("no-such-app-xyz"), "Running: no");
        assert!(app_info("").is_err());
    }
}
