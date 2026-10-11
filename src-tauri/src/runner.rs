//! Runs door steps and scripts as child processes and streams their output to the UI.
//!
//! Every process is started through the user's login shell (`$SHELL -lc`), so PATH matches a
//! terminal (Homebrew, pnpm, supabase, node from nvm…) even though GUI apps on macOS start with a
//! minimal PATH. Each process gets its own process group so Stop also ends what it spawned
//! (`pnpm dev` → turbo → next…).

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

/// Live processes: process id from the UI → OS pid (also the process group id).
#[derive(Default)]
pub struct Procs(Mutex<HashMap<String, u32>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogEvent {
    proc_id: String,
    stream: &'static str,
    line: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExitEvent {
    proc_id: String,
    code: Option<i32>,
}

fn login_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into())
}

/// `~/x` → `/Users/me/x`; anything else unchanged.
pub fn expand_home(path: &str) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(path)
}

fn pipe<R: Read + Send + 'static>(app: AppHandle, proc_id: String, stream: &'static str, r: R) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let mut reader = BufReader::new(r);
        let mut buf = Vec::new();
        loop {
            buf.clear();
            match reader.read_until(b'\n', &mut buf) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    let line = String::from_utf8_lossy(&buf).trim_end_matches(['\n', '\r']).to_string();
                    let _ = app.emit("door://log", LogEvent { proc_id: proc_id.clone(), stream, line });
                }
            }
        }
    })
}

/// Start `script` in the login shell. Output arrives as `door://log` events and the end as one
/// `door://exit` event, both tagged with `proc_id`. Returns as soon as the process has started.
#[tauri::command]
pub fn run_process(
    app: AppHandle,
    procs: State<'_, Procs>,
    proc_id: String,
    script: String,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
) -> Result<(), String> {
    let mut cmd = Command::new(login_shell());
    cmd.arg("-lc").arg(&script).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(dir) = cwd.filter(|d| !d.trim().is_empty()) {
        let dir = expand_home(&dir);
        if !dir.is_dir() {
            return Err(format!("Folder not found: {}", dir.display()));
        }
        cmd.current_dir(dir);
    }
    if let Some(env) = env {
        cmd.envs(env);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Could not start the process: {e}"))?;
    procs.0.lock().map_err(|e| e.to_string())?.insert(proc_id.clone(), child.id());

    let out = child.stdout.take().map(|o| pipe(app.clone(), proc_id.clone(), "stdout", o));
    let err = child.stderr.take().map(|e| pipe(app.clone(), proc_id.clone(), "stderr", e));

    thread::spawn(move || {
        let status = child.wait();
        for handle in [out, err].into_iter().flatten() {
            let _ = handle.join();
        }
        if let Ok(mut map) = app.state::<Procs>().0.lock() {
            map.remove(&proc_id);
        }
        let code = status.ok().and_then(|s| s.code());
        let _ = app.emit("door://exit", ExitEvent { proc_id, code });
    });
    Ok(())
}

#[cfg(unix)]
fn kill_group(pid: u32) {
    // Negative pid = the whole process group started for this proc.
    let _ = Command::new("kill").arg("-TERM").arg(format!("-{pid}")).status();
}

#[cfg(not(unix))]
fn kill_group(pid: u32) {
    let _ = Command::new("taskkill").args(["/PID", &pid.to_string(), "/T", "/F"]).status();
}

/// Stop a process started with `run_process` (and everything it spawned).
#[tauri::command]
pub fn kill_process(procs: State<'_, Procs>, proc_id: String) -> Result<(), String> {
    let pid = procs.0.lock().map_err(|e| e.to_string())?.get(&proc_id).copied();
    if let Some(pid) = pid {
        kill_group(pid);
    }
    Ok(())
}

/// Called on app exit so dev servers started from doors don't outlive the app.
pub fn kill_all(app: &AppHandle) {
    let pids: Vec<u32> = match app.state::<Procs>().0.lock() {
        Ok(map) => map.values().copied().collect(),
        Err(_) => return,
    };
    for pid in pids {
        kill_group(pid);
    }
}

/// Resolve once something listens on 127.0.0.1:`port`; `false` after `timeout_ms`.
#[tauri::command]
pub async fn wait_for_port(port: u16, timeout_ms: u64) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let deadline = Instant::now() + Duration::from_millis(timeout_ms);
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        while Instant::now() < deadline {
            if TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok() {
                return true;
            }
            thread::sleep(Duration::from_millis(400));
        }
        false
    })
    .await
    .map_err(|e| e.to_string())
}

/// Read a UTF-8 file. `None` when it doesn't exist yet.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<Option<String>, String> {
    let path = expand_home(&path);
    match std::fs::read_to_string(&path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Could not read {}: {e}", path.display())),
    }
}

/// Write a UTF-8 file, creating its folder if needed.
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let path = expand_home(&path);
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    }
    std::fs::write(&path, contents).map_err(|e| format!("Could not write {}: {e}", path.display()))
}

/// Where new door scripts live: `<app data>/scripts/<project id>/`.
#[tauri::command]
pub fn scripts_dir(app: AppHandle, project_id: String) -> Result<String, String> {
    let safe: String = project_id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("scripts").join(safe);
    Ok(dir.to_string_lossy().into_owned())
}
