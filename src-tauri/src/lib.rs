use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const BACKEND_PORT: u16 = 18000;
const BACKEND_HOST: &str = "127.0.0.1";

/// Shared secret the local agent-server accepts and the WebView is told to
/// send as `X-Session-API-Key`. Injected into the frontend before first paint
/// so `makeDefaultLocalBackend()` can seed the backend registry — without a
/// key the registry stays empty and the app lands on the "Manage backends"
/// recovery screen ("No extra backends added yet").
const SESSION_API_KEY: &str = "exeaon-local-secret-key-32byteslong!";

/// Entry module of the bundled `openhands-agent-server` runtime.
const AGENT_SERVER_MODULE: &str = "openhands.agent_server.__main__";

/// Automations backend: a separate `openhands-automation` PyPI package served
/// by uvicorn on :18001. It is NOT bundled with the Python runtime, so it is
/// launched via `uvx` (dev/most installs) — the same recipe as
/// `scripts/dev-with-automation.mjs`. Pure-offline installs without uvx will
/// show stale automations; the frontend gates on /api/automation health.
const AUTOMATION_PORT: u16 = 18001;
const AUTOMATION_HOST: &str = "127.0.0.1";
const AUTOMATION_PACKAGE: &str = "openhands-automation";
const AUTOMATION_VERSION: &str = "1.8.0";

/// Port for the local llama.cpp server (offline GGUF models). 18001 is
/// reserved by the automations backend, so llama lives on 18002.
const LLAMA_PORT: u16 = 18002;
const LLAMA_HOST: &str = "127.0.0.1";

#[allow(dead_code)]
struct ServerProcess(Arc<Mutex<Option<Child>>>);

#[allow(dead_code)]
struct AutomationProcess(Arc<Mutex<Option<Child>>>);

#[allow(dead_code)]
struct LlamaProcess(Arc<Mutex<Option<Child>>>);

/// Check if the backend is already responding on the expected port.
fn is_backend_alive() -> bool {
    std::net::TcpStream::connect_timeout(
        &format!("{BACKEND_HOST}:{BACKEND_PORT}").parse().unwrap(),
        Duration::from_millis(200),
    )
    .is_ok()
}

/// Check if the llama.cpp server is already listening.
fn is_llama_alive() -> bool {
    std::net::TcpStream::connect_timeout(
        &format!("{LLAMA_HOST}:{LLAMA_PORT}").parse().unwrap(),
        Duration::from_millis(200),
    )
    .is_ok()
}

/// Resolve the `uvx` executable. The app may launch from Explorer where the
/// user's shell PATH (e.g. `~/.local/bin`) is not inherited, so check known
/// locations directly first. Windows `Path::exists()` does not apply PATHEXT,
/// so probe the `uvx.exe` variant explicitly.
fn resolve_uvx() -> Option<std::path::PathBuf> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();
    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let candidates = [
        format!("{home}\\.local\\bin\\uvx.exe"),
        format!("{home}\\.local\\bin\\uvx"),
        format!("{local}\\uv\\uvx.exe"),
        "uvx".to_string(),
    ];
    for c in candidates {
        if std::path::Path::new(&c).exists() {
            return Some(std::path::PathBuf::from(c));
        }
    }
    // PATH fallback (Windows PATHEXT resolves `uvx` -> `uvx.exe` at spawn).
    if let Ok(p) = std::process::Command::new("where")
        .arg("uvx")
        .output()
        .map(|o| o.status.success())
    {
        if p {
            return Some(std::path::PathBuf::from("uvx"));
        }
    }
    None
}

/// Resolve the bundled Python runtime's interpreter. Tauri's `resource_dir()`
/// points next to the exe on Windows NSIS, but the runtime may land either in
/// `<resource_dir>/python-runtime` (layout used in dev/`tauri build` copy) or
/// inside a `<resource_dir>/resources/python-runtime` subdirectory (how the
/// installer extracts `bundle.resources`). Probe both so the bundled runtime is
/// always used — never the slow `uvx` dev fallback that re-resolves the env on
/// every launch.
fn bundled_python(resource_dir: &Path) -> Option<std::path::PathBuf> {
    let candidates = [
        resource_dir.join("python-runtime").join("python.exe"),
        resource_dir
            .join("resources")
            .join("python-runtime")
            .join("python.exe"),
    ];
    for c in candidates {
        if c.exists() {
            return Some(c);
        }
    }
    None
}

/// Spawn the bundled agent-server runtime (a full, self-contained Python
/// install shipped inside the installer's resources). Returns None when the
/// runtime is not present (e.g. `tauri dev`).
fn spawn_bundled_runtime(resource_dir: &Path) -> Option<Child> {
    let python = bundled_python(resource_dir)?;
    let mut cmd = Command::new(python);
    cmd.args([
        "-m",
        AGENT_SERVER_MODULE,
        "--port",
        &BACKEND_PORT.to_string(),
        "--host",
        BACKEND_HOST,
    ]);

    // Core secrets
    cmd.env("OH_SECRET_KEY", SESSION_API_KEY);
    // Force UTF-8 I/O. Without this the agent-server runs under Windows' default
    // cp1252 'charmap' codec and 500s when a model response contains non-ASCII
    // characters (e.g. the "→" arrow: "can't encode character '→'").
    cmd.env("PYTHONUTF8", "1");
    cmd.env("PYTHONIOENCODING", "utf-8");
    // Allow Tauri WebView origin through CORS
    cmd.env("OH_ALLOW_CORS_ORIGINS", r#"["http://tauri.localhost"]"#);

    // Suppress stdout/stderr windows and console popups
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    match cmd.spawn() {
        Ok(child) => Some(child),
        Err(_) => None,
    }
}

/// Spawn the Python agent-server as a headless child process.
/// Returns None if the port is already occupied (server already running).
fn start_backend_if_needed(resource_dir: &Path) -> Option<Child> {
    if is_backend_alive() {
        return None;
    }

    // Bundled runtime first — the installer ships everything, so a fresh
    // install needs no uvx, no network, no first-run download.
    if let Some(child) = spawn_bundled_runtime(resource_dir) {
        return Some(child);
    }

    // Dev fallback: uvx fetches/launches the same runtime from the uv cache.
    let uvx = resolve_uvx()?;
    let mut cmd = Command::new(uvx);
    cmd.args([
        "--from",
        "openhands-agent-server==1.42.1",
        "--with",
        "openhands-sdk==1.42.1",
        "--with",
        "openhands-tools==1.42.1",
        "--with",
        "openhands-workspace==1.42.1",
        "--with",
        "libtmux",
        "agent-server",
        "--port",
        &BACKEND_PORT.to_string(),
        "--host",
        BACKEND_HOST,
    ]);

    // Core secrets
    cmd.env("OH_SECRET_KEY", SESSION_API_KEY);
    // Force UTF-8 I/O. Without this the agent-server runs under Windows' default
    // cp1252 'charmap' codec and 500s when a model response contains non-ASCII
    // characters (e.g. the "→" arrow: "can't encode character '→'").
    cmd.env("PYTHONUTF8", "1");
    cmd.env("PYTHONIOENCODING", "utf-8");
    // Allow Tauri WebView origin through CORS
    cmd.env("OH_ALLOW_CORS_ORIGINS", r#"["http://tauri.localhost"]"#);

    // Suppress stdout/stderr windows and console popups
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    match cmd.spawn() {
        Ok(child) => Some(child),
        Err(_) => None,
    }
}

/// Return the automation backend run command, mirroring
/// `scripts/dev-with-automation.mjs`. `openhands-automation` is bundled inside
/// the Python runtime (installed at build time), so we launch `uvicorn` from
/// the bundled `python.exe` — fully offline. If a build ever omits the package,
/// we fall back to `uvx` (dev), which may require network on first run.
fn automation_backend_command(resource_dir: &Path) -> Option<(std::path::PathBuf, Vec<String>)> {
    // Bundled runtime first — the installer ships everything, no network.
    if let Some(python) = bundled_python(resource_dir) {
        if python
            .parent()
            .and_then(|p| p.parent())
            .map(|sp| {
                sp.join("Lib")
                    .join("site-packages")
                    .join("openhands_automation")
            })
            .map(|p| p.exists())
            .unwrap_or(false)
        {
            return Some((
                python,
                vec![
                    "-m".to_string(),
                    "uvicorn".to_string(),
                    "openhands.automation.app:app".to_string(),
                    "--host".to_string(),
                    AUTOMATION_HOST.to_string(),
                    "--port".to_string(),
                    AUTOMATION_PORT.to_string(),
                ],
            ));
        }
    }
    // Dev fallback: uvx fetches the package (cached after first run).
    let uvx = resolve_uvx()?;
    let args = vec![
        "--with".to_string(),
        format!("{AUTOMATION_PACKAGE}=={AUTOMATION_VERSION}"),
        "uvicorn".to_string(),
        "openhands.automation.app:app".to_string(),
        "--host".to_string(),
        AUTOMATION_HOST.to_string(),
        "--port".to_string(),
        AUTOMATION_PORT.to_string(),
    ];
    Some((uvx, args))
}

/// Real automation data directory. SQLAlchemy/sqlite never expand `~`, so the
/// earlier literal `~/.openhands/...` URL made startup fail ("unable to open
/// database file" -> the automation server exited). Expand to the user's home
/// and create the tree up front.
fn automation_data_dir() -> std::path::PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir().join("exeaon-claw"));
    home.join(".openhands").join("automation")
}

/// Spawn the automations backend (openhands-automation) as a headless child.
/// Returns None if the port is already occupied or no runtime is available.
fn start_automation_if_needed(resource_dir: &Path) -> Option<Child> {
    if is_automation_alive() {
        return None;
    }
    let (exe, args) = automation_backend_command(resource_dir)?;
    let mut cmd = Command::new(exe);
    cmd.args(args);

    // Shared secrets + config, mirroring spawnService("automation", ...).
    cmd.env("OH_SECRET_KEY", SESSION_API_KEY);
    cmd.env("PYTHONUTF8", "1");
    cmd.env("OPENHANDS_REMOTE_WS_READY_REQUIRED", "false");
    cmd.env(
        "AUTOMATION_AGENT_SERVER_URL",
        format!("http://{BACKEND_HOST}:{BACKEND_PORT}"),
    );
    cmd.env("AUTOMATION_AGENT_SERVER_API_KEY", SESSION_API_KEY);
    cmd.env("AUTOMATION_LOCAL_API_KEY", SESSION_API_KEY);
    cmd.env("AUTOMATION_KV_SECRET", SESSION_API_KEY);
    // SQLAlchemy does not expand `~`; use the real home dir (created first)
    // so the sqlite migration can open the database.
    let data_dir = automation_data_dir();
    let storage_dir = data_dir.join("storage");
    if let Err(e) = std::fs::create_dir_all(&storage_dir) {
        eprintln!("exeaon-claw: failed to create automation data dir: {e}");
    }
    let db_path = data_dir.join("automations.db");
    cmd.env(
        "AUTOMATION_DB_URL",
        format!(
            "sqlite+aiosqlite:///{}",
            db_path.to_string_lossy().replace('\\', "/")
        ),
    );
    cmd.env(
        "AUTOMATION_BASE_URL",
        format!("http://localhost:{AUTOMATION_PORT}"),
    );
    cmd.env("AUTOMATION_CORS_ORIGINS", format!("http://tauri.localhost,http://localhost:{AUTOMATION_PORT},http://127.0.0.1:{AUTOMATION_PORT}"));
    cmd.env("FILE_STORE", "local");
    cmd.env("LOCAL_STORAGE_PATH", &storage_dir);
    cmd.env("OPENHANDS_SUPPRESS_BANNER", "1");

    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    match cmd.spawn() {
        Ok(child) => Some(child),
        Err(_) => None,
    }
}

/// Check if the automations backend is already listening on :18001.
fn is_automation_alive() -> bool {
    std::net::TcpStream::connect_timeout(
        &format!("{AUTOMATION_HOST}:{AUTOMATION_PORT}")
            .parse()
            .unwrap(),
        Duration::from_millis(200),
    )
    .is_ok()
}

/// Locate the bundled `llama-server.exe` (Vulkan build). Probes the two layouts
/// the installer can produce (`<resource_dir>/llama` and
/// `<resource_dir>/resources/llama`, mirroring `bundled_python`), plus — in a
/// debug build — the source `src-tauri/resources/llama` so `tauri dev` (where
/// bundle resources aren't copied next to the exe) can still start a model.
fn llama_server_exe(resource_dir: &Path) -> Option<std::path::PathBuf> {
    let mut candidates = vec![
        resource_dir.join("llama").join("llama-server.exe"),
        resource_dir
            .join("resources")
            .join("llama")
            .join("llama-server.exe"),
    ];
    #[cfg(debug_assertions)]
    candidates.push(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("llama")
            .join("llama-server.exe"),
    );
    candidates.into_iter().find(|c| c.exists())
}

/// Spawn the local llama.cpp server for a GGUF model.
///
/// `gpu_layers` is llama.cpp's `-ngl` (number of transformer layers offloaded to
/// the GPU): 0 = pure CPU, a large value = offload everything the VRAM fits. The
/// UI maps its device picker (CPU / GPU) onto this from the detected hardware.
fn start_llama_server_impl(
    resource_dir: &Path,
    model_path: &str,
    gpu_layers: u32,
) -> Result<Child, String> {
    if is_llama_alive() {
        return Err("A local model server is already running".to_string());
    }
    let exe = llama_server_exe(resource_dir)
        .ok_or_else(|| "llama-server not bundled with this build".to_string())?;
    if !Path::new(model_path).exists() {
        return Err(format!("Model file not found: {model_path}"));
    }

    let mut cmd = Command::new(&exe);
    // Working dir = the exe dir so the side-by-side DLLs resolve.
    if let Some(parent) = exe.parent() {
        cmd.current_dir(parent);
    }
    cmd.args([
        "-m",
        model_path,
        "--port",
        &LLAMA_PORT.to_string(),
        "--host",
        LLAMA_HOST,
        "-ngl",
        &gpu_layers.to_string(),
    ]);
    // Offline-only: never phone home; cap the context to fit typical RAM.
    cmd.args(["--no-webui", "-c", "4096"]);

    // Suppress stdout/stderr windows and console popups
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd.spawn()
        .map_err(|e| format!("failed to start llama-server: {e}"))
}

// ---------------------------------------------------------------------------
// Tauri commands — local models + hardware detection
// ---------------------------------------------------------------------------

/// Start the local llama.cpp server on a GGUF model.
///
/// `device` is the UI's device choice: "gpu" offloads all layers (`-ngl 999`),
/// anything else ("cpu") runs on CPU (`-ngl 0`). The UI only offers "gpu" when a
/// GPU was actually detected.
#[tauri::command]
fn start_local_model(
    app: tauri::AppHandle,
    state: tauri::State<LlamaProcess>,
    model_path: String,
    device: Option<String>,
) -> Result<(), String> {
    // Kill any existing server first.
    if let Ok(mut lock) = state.0.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
        }
    }
    let gpu_layers = match device.as_deref() {
        Some("gpu") => 999,
        _ => 0,
    };
    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let child = start_llama_server_impl(&resource_dir, &model_path, gpu_layers)?;
    if let Ok(mut lock) = state.0.lock() {
        *lock = Some(child);
    }
    Ok(())
}

/// List the GGUF model files present in the app's models directory. This is the
/// enumeration the frontend needs to actually start a model — without it the
/// Models page has nothing to run.
#[tauri::command]
fn list_local_models(app: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("exeaon-claw"))
        .join("models");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        let is_gguf = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("gguf"))
            .unwrap_or(false);
        if !is_gguf {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("model")
            .to_string();
        let size_gb = entry
            .metadata()
            .map(|m| (m.len() as f64 / 1_073_741_824.0 * 100.0).round() / 100.0)
            .unwrap_or(0.0);
        out.push(serde_json::json!({
            "name": name,
            "path": path.to_string_lossy(),
            "sizeGb": size_gb,
        }));
    }
    Ok(out)
}

/// Open the models directory in the OS file manager so the user can drop a GGUF
/// file in without hunting for the path.
#[tauri::command]
fn open_models_dir(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("exeaon-claw"))
        .join("models");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer").arg(&dir).spawn().ok();
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(&dir).spawn().ok();
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        Command::new("xdg-open").arg(&dir).spawn().ok();
    }
    Ok(())
}

/// Stop the local llama.cpp server.
#[tauri::command]
fn stop_local_model(state: tauri::State<LlamaProcess>) -> Result<(), String> {
    if let Ok(mut lock) = state.0.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
        }
    }
    Ok(())
}

/// Whether the local llama.cpp server is currently up.
#[tauri::command]
fn local_model_status(state: tauri::State<LlamaProcess>) -> Result<bool, String> {
    if is_llama_alive() {
        return Ok(true);
    }
    // If the process died (crash), drop the stale handle.
    if let Ok(mut lock) = state.0.lock() {
        if let Some(child) = lock.as_mut() {
            if let Ok(Some(_status)) = child.try_wait() {
                *lock = None;
            }
        }
    }
    Ok(is_llama_alive())
}

/// Detect the user's machine (RAM / CPU cores / GPU) so the UI can recommend
/// a model tier. GPU info is best-effort: NVIDIA reports VRAM via nvidia-smi
/// when present; otherwise we fall back to total system RAM + core count.
#[tauri::command]
fn get_hardware_specs() -> Result<serde_json::Value, String> {
    let mut result = serde_json::Map::new();

    // RAM (bytes -> GB)
    let total_ram = total_ram_bytes();
    result.insert(
        "ramGb".into(),
        serde_json::Value::from((total_ram as f64 / 1_073_741_824.0 * 10.0).round() / 10.0),
    );

    // CPU cores
    let cores = available_parallelism();
    result.insert("cores".into(), serde_json::Value::from(cores));

    // GPU — best effort
    let (gpu_name, vram_mb) = detect_gpu();
    result.insert("gpuName".into(), serde_json::Value::from(gpu_name));
    result.insert("vramMb".into(), serde_json::Value::from(vram_mb));

    Ok(serde_json::Value::Object(result))
}

/// Directory where the app stores downloaded GGUF models.
#[tauri::command]
fn models_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("exeaon-claw"))
        .join("models");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

// --- hardware helpers (Windows-first, portable fallbacks) ---

#[cfg(target_os = "windows")]
fn total_ram_bytes() -> u64 {
    // WMI via PowerShell — no extra crates, works on every Windows box.
    if let Ok(out) = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
        ])
        .output()
    {
        if out.status.success() {
            if let Ok(v) = String::from_utf8_lossy(&out.stdout).trim().parse::<u64>() {
                return v;
            }
        }
    }
    0
}

#[cfg(not(target_os = "windows"))]
fn total_ram_bytes() -> u64 {
    // Portable fallback: read /proc/meminfo on Linux, sysctl on macOS.
    if let Ok(s) = std::fs::read_to_string("/proc/meminfo") {
        for line in s.lines() {
            if let Some(rest) = line.strip_prefix("MemTotal:") {
                if let Ok(kb) = rest.trim().trim_end_matches("kB").trim().parse::<u64>() {
                    return kb * 1024;
                }
            }
        }
    }
    0
}

#[cfg(target_os = "windows")]
fn available_parallelism() -> u32 {
    std::thread::available_parallelism()
        .map(|n| n.get() as u32)
        .unwrap_or(4)
}

#[cfg(not(target_os = "windows"))]
fn available_parallelism() -> u32 {
    std::thread::available_parallelism()
        .map(|n| n.get() as u32)
        .unwrap_or(4)
}

#[cfg(target_os = "windows")]
fn detect_gpu() -> (String, u64) {
    // nvidia-smi gives real VRAM for NVIDIA GPUs (fast, exact when present).
    if let Ok(out) = Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,memory.total",
            "--format=csv,noheader,nounits",
        ])
        .output()
    {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout);
            if let Some(line) = s.lines().next() {
                let parts: Vec<&str> = line.split(',').map(|p| p.trim()).collect();
                if parts.len() >= 2 {
                    let name = parts[0].to_string();
                    let vram = parts[1].parse::<u64>().unwrap_or(0);
                    if !name.is_empty() {
                        return (name, vram);
                    }
                }
            }
        }
    }
    // Cross-vendor fallback (AMD / Intel / any Vulkan GPU): the driver publishes
    // true VRAM in the registry as `HardwareInformation.qwMemorySize` — unlike
    // WMI's AdapterRAM, which is a 32-bit field capped at ~4 GB. Pick the adapter
    // with the most VRAM (the discrete GPU on hybrid laptops) and pair it with
    // the matching Win32_VideoController name. Emits "name|vramMB".
    let ps = r#"
$mem = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\*' -ErrorAction SilentlyContinue |
  Where-Object { $_.'HardwareInformation.qwMemorySize' } |
  Sort-Object { [uint64]$_.'HardwareInformation.qwMemorySize' } -Descending |
  Select-Object -First 1
$gpu = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue |
  Sort-Object AdapterRAM -Descending | Select-Object -First 1
$name = if ($mem.'HardwareInformation.AdapterString') { $mem.'HardwareInformation.AdapterString' } elseif ($gpu) { $gpu.Name } else { '' }
$vram = if ($mem) { [math]::Round([uint64]$mem.'HardwareInformation.qwMemorySize' / 1MB) } elseif ($gpu -and $gpu.AdapterRAM -gt 0) { [math]::Round($gpu.AdapterRAM / 1MB) } else { 0 }
"$name|$vram"
"#;
    if let Ok(out) = Command::new("powershell")
        .args(["-NoProfile", "-Command", ps])
        .output()
    {
        let s = String::from_utf8_lossy(&out.stdout);
        if let Some(line) = s.lines().find(|l| l.contains('|')) {
            let mut parts = line.trim().splitn(2, '|');
            let name = parts.next().unwrap_or("").trim().to_string();
            let vram = parts.next().unwrap_or("0").trim().parse::<u64>().unwrap_or(0);
            if !name.is_empty() {
                return (name, vram);
            }
        }
    }
    ("Unknown".to_string(), 0)
}

#[cfg(not(target_os = "windows"))]
fn detect_gpu() -> (String, u64) {
    ("Unknown".to_string(), 0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let child_handle: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let child_clone = child_handle.clone();
    let automation_handle: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let automation_clone = automation_handle.clone();
    let llama_handle: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let llama_clone = llama_handle.clone();

    // 1. Launch the Tauri app immediately. The frontend owns backend discovery:
    //    it shows the splash while /server_info is pending and a recovery
    //    screen when the backend is unreachable. Blocking here would keep the
    //    window from opening at all. The backend sidecar is spawned inside
    //    setup (below) so it gets a head start before the window loads.
    tauri::Builder::default()
        .manage(ServerProcess(child_handle.clone()))
        .manage(AutomationProcess(automation_handle.clone()))
        .manage(LlamaProcess(llama_handle.clone()))
        .invoke_handler(tauri::generate_handler![
            start_local_model,
            stop_local_model,
            local_model_status,
            get_hardware_specs,
            models_dir,
            list_local_models,
            open_models_dir,
        ])
        .setup(move |app| {
            // 2. Spawn the bundled agent-server (or dev uvx fallback) so the
            //    frontend's /server_info probe finds it when the window loads.
            let child = start_backend_if_needed(&app.path().resource_dir().unwrap_or_default());
            if let Ok(mut lock) = child_handle.lock() {
                *lock = child;
            }

            // 2b. Spawn the automations backend (openhands-automation) so the
            //     Flows feature's /api/automation/* responds instead of 404ing.
            //     The package is bundled in the Python runtime, so this launches
            //     fully offline. If it's not present (e.g. a dev uvx build),
            //     the spawn returns None and Flows gates on health.
            let automation =
                start_automation_if_needed(&app.path().resource_dir().unwrap_or_default());
            if let Ok(mut lock) = automation_handle.lock() {
                *lock = automation;
            }

            // 3. Inject the session API key before the frontend bundle runs.
            //    The window is built here (not from tauri.conf.json) so the
            //    initialization script executes before the app's first module
            //    evaluation, which is when the backend registry is seeded.
            let init_script = format!(
                "window.__AGENT_CANVAS_SESSION_API_KEY__ = '{}';",
                SESSION_API_KEY
            );
            tauri::webview::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Exeaon Claw")
            .inner_size(1380.0, 880.0)
            .min_inner_size(960.0, 640.0)
            .resizable(true)
            .theme(Some(tauri::Theme::Dark))
            .initialization_script(&init_script)
            .build()?;
            #[cfg(debug_assertions)]
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            // In-app updates (desktop only). The updater checks GitHub Releases,
            // verifies the signature, and downloads+installs; the process plugin
            // handles the relaunch after install. No-op in `tauri dev` (there is
            // no installed bundle to replace).
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            Ok(())
        })
        .on_window_event(move |_window, event| {
            // Kill the sidecars when the window is destroyed
            if let tauri::WindowEvent::Destroyed = event {
                if let Ok(mut lock) = child_clone.lock() {
                    if let Some(mut child) = lock.take() {
                        let _ = child.kill();
                    }
                }
                if let Ok(mut lock) = automation_clone.lock() {
                    if let Some(mut child) = lock.take() {
                        let _ = child.kill();
                    }
                }
                if let Ok(mut lock) = llama_clone.lock() {
                    if let Some(mut child) = lock.take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
