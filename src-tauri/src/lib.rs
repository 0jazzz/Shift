use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Emitter;
use tauri::Manager;

// Declare new backend modules containing your learning tasks
pub mod conversion_graph;
pub mod downloader;
pub mod engine;
pub mod metadata;

#[derive(Serialize)]
struct DependencyStatus {
    name: String,
    found: bool,
    version: Option<String>,
}

#[derive(Serialize)]
struct GpuInfo {
    name: String,
    vendor: String,
}

fn candidate_bin_dirs() -> Vec<PathBuf> {
    // We intentionally keep this "walk up" strategy because `cargo run` / `tauri dev`
    // / production bundles can have different working directories.
    vec![
        PathBuf::from(".bin"),
        PathBuf::from("../.bin"),
        PathBuf::from("../../.bin"),
        PathBuf::from("../../../.bin"),
    ]
}

fn find_local_binary(file_names: &[&str]) -> Option<PathBuf> {
    for dir in candidate_bin_dirs() {
        for name in file_names {
            // If you copied the Windows `.bin` folder over to Linux/macOS, it may contain
            // `*.exe` binaries. Those are not natively executable and often trigger “install Wine”
            // suggestions. Ignore them on non-Windows.
            #[cfg(not(target_os = "windows"))]
            {
                if name.to_ascii_lowercase().ends_with(".exe") {
                    continue;
                }
            }

            let p = dir.join(name);
            if p.exists() {
                return Some(p);
            }
        }
    }
    None
}

fn find_in_path(cmd_names: &[&str]) -> Option<PathBuf> {
    for name in cmd_names {
        if let Ok(p) = which::which(name) {
            return Some(p);
        }
    }
    None
}

pub(crate) fn find_binary(file_names: &[&str], cmd_names: &[&str]) -> Option<PathBuf> {
    find_local_binary(file_names).or_else(|| find_in_path(cmd_names))
}

fn get_version_line(bin: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new(bin).args(args).output().ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let text = if stdout.trim().is_empty() {
        stderr
    } else {
        stdout
    };

    text.lines()
        .map(|l| l.trim())
        .find(|l| !l.is_empty())
        .map(|l| l.to_string())
}

#[tauri::command]
fn check_dependencies() -> Vec<DependencyStatus> {
    let mut deps = Vec::new();

    // Prefer local bundled binaries (Windows builds often bundle `.exe` in `.bin/`)
    // but also accept system-installed binaries (Linux users typically install via package manager).
    let ffmpeg = find_binary(&["ffmpeg.exe", "ffmpeg"], &["ffmpeg"]);
    deps.push(DependencyStatus {
        name: "ffmpeg".to_string(),
        found: ffmpeg.is_some(),
        version: ffmpeg
            .as_deref()
            .and_then(|p| get_version_line(p, &["-version"]))
            .or(Some("Installed".to_string()))
            .filter(|_| ffmpeg.is_some()),
    });

    let exiftool = find_binary(
        &["exiftool.exe", "exiftool(-k).exe", "exiftool"],
        &["exiftool"],
    );
    deps.push(DependencyStatus {
        name: "exiftool".to_string(),
        found: exiftool.is_some(),
        version: exiftool
            .as_deref()
            .and_then(|p| get_version_line(p, &["-ver"]))
            .or(Some("Installed".to_string()))
            .filter(|_| exiftool.is_some()),
    });

    // ImageMagick can be `magick` (IM7) or `convert` (IM6)
    let imagemagick = find_binary(
        &["magick.exe", "magick", "convert.exe", "convert"],
        &["magick", "convert"],
    );
    deps.push(DependencyStatus {
        name: "imagemagick".to_string(),
        found: imagemagick.is_some(),
        version: imagemagick
            .as_deref()
            .and_then(|p| get_version_line(p, &["-version"]))
            .or(Some("Installed".to_string()))
            .filter(|_| imagemagick.is_some()),
    });

    let pandoc = find_binary(&["pandoc.exe", "pandoc"], &["pandoc"]);
    deps.push(DependencyStatus {
        name: "pandoc".to_string(),
        found: pandoc.is_some(),
        version: pandoc
            .as_deref()
            .and_then(|p| get_version_line(p, &["--version"]))
            .or(Some("Installed".to_string()))
            .filter(|_| pandoc.is_some()),
    });

    // Windows: `pdftotext.exe` (Xpdf). Linux: typically `pdftotext` (poppler-utils).
    let pdftotext = find_binary(&["pdftotext.exe", "pdftotext"], &["pdftotext"]);
    deps.push(DependencyStatus {
        name: "xpdf".to_string(),
        found: pdftotext.is_some(),
        version: pdftotext
            .as_deref()
            .and_then(|p| get_version_line(p, &["-v"]))
            .or(Some("Installed".to_string()))
            .filter(|_| pdftotext.is_some()),
    });

    // Python/pdf2docx are usually system-level; keep it permissive so the UI isn't blocked.
    deps.push(DependencyStatus {
        name: "python".to_string(),
        found: find_in_path(&["python", "python3", "py"]).is_some(),
        version: Some("Installed".to_string()),
    });
    deps.push(DependencyStatus {
        name: "pdf2docx".to_string(),
        found: true,
        version: Some("Installed".to_string()),
    });

    deps
}

#[tauri::command]
fn get_missing_dependencies() -> Vec<String> {
    let deps = check_dependencies();
    deps.into_iter()
        .filter(|d| !d.found)
        .map(|d| d.name)
        .collect()
}

#[tauri::command]
fn detect_gpus() -> Vec<GpuInfo> {
    let mut gpus = Vec::new();

    // Windows-only native query.
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("wmic")
            .args(&["path", "win32_VideoController", "get", "name"])
            .output()
        {
            if let Ok(text) = String::from_utf8(output.stdout) {
                for line in text.lines().skip(1) {
                    let name = line.trim();
                    if !name.is_empty() {
                        let vendor = if name.to_lowercase().contains("nvidia") {
                            "NVIDIA"
                        } else if name.to_lowercase().contains("amd")
                            || name.to_lowercase().contains("radeon")
                        {
                            "AMD"
                        } else {
                            "Intel"
                        };
                        gpus.push(GpuInfo {
                            name: name.to_string(),
                            vendor: vendor.to_string(),
                        });
                    }
                }
            }
        }
    }

    // Linux-only query using lspci
    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = Command::new("lspci").output() {
            if let Ok(text) = String::from_utf8(output.stdout) {
                for line in text.lines() {
                    if line.contains("VGA compatible controller") || line.contains("3D controller")
                    {
                        if let Some(pos) = line.find("controller:") {
                            let name = line[pos + 11..].trim().to_string();
                            let vendor = if name.to_lowercase().contains("nvidia") {
                                "NVIDIA"
                            } else if name.to_lowercase().contains("amd")
                                || name.to_lowercase().contains("ati")
                                || name.to_lowercase().contains("radeon")
                            {
                                "AMD"
                            } else if name.to_lowercase().contains("intel") {
                                "Intel"
                            } else {
                                "Unknown"
                            };
                            gpus.push(GpuInfo {
                                name,
                                vendor: vendor.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    if gpus.is_empty() {
        gpus.push(GpuInfo {
            name: "Software Rendering / Unknown GPU".to_string(),
            vendor: "Unknown".to_string(),
        });
    }

    gpus
}

#[tauri::command]
fn get_target_formats(_ext: String) -> Vec<String> {
    vec![
        "MP4".to_string(),
        "MKV".to_string(),
        "MP3".to_string(),
        "JPG".to_string(),
        "PNG".to_string(),
        "PDF".to_string(),
    ]
}

#[tauri::command]
fn show_item_in_folder(path: String) {
    let p = Path::new(&path);
    #[cfg(target_os = "windows")]
    {
        if p.exists() {
            let _ = Command::new("explorer")
                .arg(format!("/select,{}", p.display()))
                .spawn();
        } else if let Some(parent) = p.parent() {
            let _ = Command::new("explorer").arg(parent).spawn();
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let parent = if p.is_dir() {
            p
        } else {
            p.parent().unwrap_or(p)
        };
        #[cfg(target_os = "linux")]
        let _ = Command::new("xdg-open").arg(parent).spawn();
        #[cfg(target_os = "macos")]
        let _ = Command::new("open").arg(parent).spawn();
    }
}

#[tauri::command]
fn start_conversion(payload: serde_json::Value, window: tauri::Window) -> serde_json::Value {
    match serde_json::from_value::<crate::engine::ConversionTask>(payload) {
        Ok(task) => {
            let task_id = task.task_id.clone();
            match crate::engine::convert_file(task, window.clone()) {
                Ok(out_path) => {
                    let _ = window.emit(
                        "fromMain",
                        serde_json::json!({
                            "type": "conversionProgress",
                            "taskId": task_id,
                            "percent": 100,
                            "status": "done",
                            "outputPath": out_path.to_string_lossy()
                        }),
                    );
                    let size = std::fs::metadata(&out_path)
                        .map(|m| m.len())
                        .unwrap_or(0);
                    serde_json::json!({
                        "success": true,
                        "outputPath": out_path.to_string_lossy(),
                        "outputSize": size
                    })
                }
                Err(err) => {
                    let _ = window.emit(
                        "fromMain",
                        serde_json::json!({
                            "type": "conversionProgress",
                            "taskId": task_id,
                            "percent": 0,
                            "status": "error",
                            "message": err
                        }),
                    );
                    serde_json::json!({
                        "success": false,
                        "error": err
                    })
                }
            }
        }
        Err(e) => {
            serde_json::json!({ "success": false, "error": e.to_string() })
        }
    }
}

#[tauri::command]
fn download_dependency(dep_name: String) -> serde_json::Value {
    match crate::downloader::handle_download_dependency(dep_name) {
        Ok(_) => serde_json::json!({ "success": true }),
        Err(e) => serde_json::json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
fn delete_all_dependencies() -> serde_json::Value {
    let mut check = false;

    for i in &candidate_bin_dirs() {
        if i.exists() {
            let _ = std::fs::remove_dir_all(i);
            check = true;
            break;
        }
    }

    if check == true {
        println!("Deleting all dependencies");
        serde_json::json!({ "success": true })
    } else {
        println!("Error occured, could not locate bin folder with dependencies, required manual intervension!!!");
        serde_json::json!({ "Failure": true })
    }
}

#[tauri::command]
fn select_folder() -> Option<String> {
    // TODO: Replace with a real folder picker (dialog plugin).
    // For now, return a sane platform-specific default.
    #[cfg(target_os = "windows")]
    {
        return Some("C:\\Converted Files".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        return Some(format!("{}/Converted Files", home));
    }
}

#[tauri::command]
fn save_silent(payload: serde_json::Value) -> serde_json::Value {
    // Real implementation would save to file
    println!("Saving silently: {:?}", payload);
    serde_json::json!({ "success": true })
}

#[tauri::command]
fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn window_maximize(window: tauri::Window) {
    if let Ok(maximized) = window.is_maximized() {
        if maximized {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn window_start_dragging(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[derive(serde::Serialize)]
struct InitStatus {
    first_run: bool,
    recreated: bool,
    paths: Vec<String>,
}

#[tauri::command]
fn initialize_output_directories(app: tauri::AppHandle) -> Result<InitStatus, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|e| format!("Could not resolve user home directory: {}", e))?;
    let home_path = std::path::PathBuf::from(home);
    let converted_files_dir = home_path.join("Converted Files");

    let subdirs = vec!["Videos", "Audio", "Images", "Documents"];

    let app_config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !app_config_dir.exists() {
        std::fs::create_dir_all(&app_config_dir).map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    let flag_file = app_config_dir.join("init_flag.txt");

    let previously_initialized = flag_file.exists();
    let mut missing = false;
    for sub in &subdirs {
        if !converted_files_dir.join(sub).exists() {
            missing = true;
            break;
        }
    }

    let mut first_run = false;
    let mut recreated = false;

    if missing {
        if previously_initialized {
            recreated = true;
        } else {
            first_run = true;
        }

        for sub in &subdirs {
            let path = converted_files_dir.join(sub);
            std::fs::create_dir_all(&path).map_err(|e| format!("Failed to create output subdirectory {}: {}", sub, e))?;
        }

        if !previously_initialized {
            std::fs::write(&flag_file, "initialized").map_err(|e| format!("Failed to write initialization flag: {}", e))?;
        }
    }

    let paths = subdirs.iter()
        .map(|sub| converted_files_dir.join(sub).to_string_lossy().into_owned())
        .collect();

    Ok(InitStatus {
        first_run,
        recreated,
        paths,
    })
}

#[tauri::command]
fn get_file_size(path: String) -> Result<u64, String> {
    std::fs::metadata(&path)
        .map(|m| m.len())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_default_file_manager() -> Result<(), String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|e| format!("Could not resolve user home directory: {}", e))?;
    
    #[cfg(target_os = "linux")]
    let _ = std::process::Command::new("xdg-open").arg(home).spawn();
    
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("explorer").arg(home).spawn();
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_dependencies,
            get_missing_dependencies,
            detect_gpus,
            get_target_formats,
            start_conversion,
            download_dependency,
            delete_all_dependencies,
            select_folder,
            save_silent,
            window_minimize,
            window_maximize,
            window_close,
            window_start_dragging,
            show_item_in_folder,
            initialize_output_directories,
            open_default_file_manager,
            get_file_size
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
