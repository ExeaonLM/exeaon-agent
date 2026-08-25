use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const BACKEND_PORT: u16 = 18000;
const BACKEND_HOST: &str = "127.0.0.1";

#[allow(dead_code)]
struct ServerProcess(Arc<Mutex<Option<Child>>>);

/// Check if the backend is already responding on the expected port.
fn is_backend_alive() -> bool {
    std::net::TcpStream::connect_timeout(
        &format!("{BACKEND_HOST}:{BACKEND_PORT}").parse().unwrap(),
        Duration::from_millis(200),
    )
    .is_ok()
}

/// Spawn the Python agent-server as a headless child process.
/// Returns None if the port is already occupied (server already running).
fn start_backend_if_needed() -> Option<Child> {
    if is_backend_alive() {
        return None;
    }

    let mut cmd = Command::new("uvx");
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
    cmd.env("OH_SECRET_KEY", "exeaon-local-secret-key-32byteslong!");
    // Allow Tauri WebView origin through CORS
    cmd.env(
        "OH_ALLOW_CORS_ORIGINS",
        r#"["http://tauri.localhost"]"#,
    );

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

/// Block (with a spinner-friendly sleep) until the backend responds or timeout.
fn wait_for_backend(timeout: Duration) {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if is_backend_alive() {
            return;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 1. Spawn backend sidecar (no-op if already running)
    let child_handle = Arc::new(Mutex::new(start_backend_if_needed()));
    let child_clone = child_handle.clone();

    // 2. Wait up to 30s for the backend to become reachable.
    //    The Tauri window opens instantly; the frontend retries on its own,
    //    but giving the server a head start avoids the initial error flash.
    wait_for_backend(Duration::from_secs(30));

    // 3. Launch the Tauri app
    tauri::Builder::default()
        .manage(ServerProcess(child_handle))
        .setup(|_app| {
            #[cfg(debug_assertions)]
            _app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
            Ok(())
        })
        .on_window_event(move |_window, event| {
            // Kill the sidecar when the window is destroyed
            if let tauri::WindowEvent::Destroyed = event {
                if let Ok(mut lock) = child_clone.lock() {
                    if let Some(mut child) = lock.take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
