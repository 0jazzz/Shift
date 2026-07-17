// CONVERSION ENGINE MODULE
//
// This module handles executing individual conversion steps (e.g. running
// ffmpeg on a file) and chaining multiple steps together using the ConversionGraph
// to execute multi-step conversions (e.g. PDF -> PNG -> JPEG).

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Emitter; // Note: Tauri Emitter is used to emit events back to the frontend

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConversionTask {
    pub task_id: String,
    pub input_path: String,
    pub target_format: String,
    pub output_dir: String,
    pub metadata: Option<crate::metadata::FileMetadata>,
}

pub fn execute_step(
    input_path: &Path,
    output_path: &Path,
    converter: &str,
    metadata: Option<&crate::metadata::FileMetadata>,
    on_progress: impl Fn(f32) + Send + 'static,
) -> Result<(), String> {
    let binary = match converter {
        "ffmpeg" => crate::find_binary(&["ffmpeg.exe", "ffmpeg"], &["ffmpeg"]),
        "imagemagick" => crate::find_binary(
            &["magick.exe", "magick", "convert.exe", "convert"],
            &["magick", "convert"],
        ),
        "pandoc" => crate::find_binary(&["pandoc.exe", "pandoc"], &["pandoc"]),
        "libreoffice" => crate::find_binary(&["soffice.exe", "soffice"], &["soffice"]),
        "xpdf" => crate::find_binary(&["pdftotext.exe", "pdftotext"], &["pdftotext"]),
        "python" => crate::find_binary(
            &["python.exe", "python", "python3.exe", "python3"],
            &["python", "python3", "py"],
        ),
        _ => return Err(format!("Unknown converter: {}", converter)),
    };

    let binary_path =
        binary.ok_or_else(|| format!("Required binary for {} not found", converter))?;

    let mut cmd = Command::new(&binary_path);

    match converter {
        "ffmpeg" => {
            cmd.arg("-i")
                .arg(input_path)
                .arg("-y")
                .arg("-progress")
                .arg("pipe:1");
            if let Some(m) = metadata {
                if let Some(ref t) = m.title {
                    cmd.arg("-metadata").arg(format!("title={}", t));
                }
                if let Some(ref a) = m.artist {
                    cmd.arg("-metadata").arg(format!("artist={}", a));
                }
                if let Some(ref alb) = m.album {
                    cmd.arg("-metadata").arg(format!("album={}", alb));
                }
                if let Some(ref g) = m.genre {
                    cmd.arg("-metadata").arg(format!("genre={}", g));
                }
                if let Some(ref y) = m.year {
                    cmd.arg("-metadata").arg(format!("date={}", y));
                }
                if let Some(ref c) = m.comment {
                    cmd.arg("-metadata").arg(format!("comment={}", c));
                }
            }
            cmd.arg(output_path);
        }
        "imagemagick" => {
            cmd.arg(input_path).arg(output_path);
        }
        "pandoc" => {
            cmd.arg(input_path).arg("-o").arg(output_path);
        }
        "libreoffice" => {
            let out_dir = output_path.parent().unwrap_or_else(|| Path::new("."));
            let out_ext = output_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("pdf");
            cmd.arg("--headless")
                .arg("--convert-to")
                .arg(out_ext)
                .arg("--outdir")
                .arg(out_dir)
                .arg(input_path);
        }
        "xpdf" => {
            cmd.arg("-enc")
                .arg("UTF-8")
                .arg("-layout")
                .arg(input_path)
                .arg(output_path);
        }
        "python" => {
            let py_input = input_path.to_string_lossy().replace('\\', "\\\\");
            let py_output = output_path.to_string_lossy().replace('\\', "\\\\");
            let py_script = format!(
                "from pdf2docx import Converter; cv = Converter('{}'); cv.convert('{}', start=0, end=None); cv.close()",
                py_input, py_output
            );
            cmd.arg("-c").arg(py_script);
        }
        _ => unreachable!(),
    }

    // Spawn process and monitor output
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", converter, e))?;

    // Parse FFmpeg progress
    if converter == "ffmpeg" {
        if let Some(stdout) = child.stdout.take() {
            let on_progress_cap = on_progress;
            std::thread::spawn(move || {
                use std::io::{BufRead, BufReader};
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    if line.starts_with("out_time_ms=") {
                        if let Ok(ms) = line[12..].parse::<i64>() {
                            let percent = ((ms as f32) / 10_000_000.0 * 100.0).min(95.0);
                            on_progress_cap(percent);
                        }
                    }
                }
            });
        }
    }

    let status = child.wait().map_err(|e| format!("Process error: {}", e))?;

    if status.success() {
        if converter == "libreoffice" {
            let out_dir = output_path.parent().unwrap_or_else(|| Path::new("."));
            let input_stem = input_path.file_stem().ok_or("Invalid input file stem")?;
            let lo_default_output = out_dir.join(format!("{}.pdf", input_stem.to_string_lossy()));
            if lo_default_output.exists() && lo_default_output != output_path {
                std::fs::rename(&lo_default_output, output_path)
                    .map_err(|e| format!("Failed to rename LibreOffice output: {}", e))?;
            }
        }
        Ok(())
    } else {
        use std::io::Read;
        let mut err_msg = String::new();
        if let Some(mut stderr) = child.stderr {
            let _ = stderr.read_to_string(&mut err_msg);
        }
        Err(format!("Process exited with failure: {}", err_msg))
    }
}

pub fn convert_file(task: ConversionTask, window: tauri::Window) -> Result<PathBuf, String> {
    use crate::conversion_graph::ConversionGraph;
    use std::sync::{Arc, Mutex};

    let input_path = Path::new(&task.input_path);
    let ext = input_path
        .extension()
        .and_then(|e| e.to_str())
        .ok_or("Input file has no extension")?
        .to_lowercase();

    let base_name = input_path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Input file has no stem")?;

    let graph = ConversionGraph::new();
    let path = graph
        .find_path(&ext, &task.target_format)
        .ok_or_else(|| format!("No conversion path from {} to {}", ext, task.target_format))?;

    if path.is_empty() {
        return Ok(PathBuf::from(task.input_path));
    }

    let output_dir = Path::new(&task.output_dir);
    if !output_dir.exists() {
        std::fs::create_dir_all(output_dir)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let current_path = Arc::new(Mutex::new(PathBuf::from(&task.input_path)));
    let total_steps = path.len();
    let task_id = task.task_id.clone();

    for (i, step) in path.iter().enumerate() {
        let is_last = i == total_steps - 1;
        let step_output_path = if is_last {
            output_dir.join(format!("{}.{}", base_name, step.target))
        } else {
            output_dir.join(format!("{}_temp_{}.{}", base_name, i, step.target))
        };

        let step_progress = (i as f32 / total_steps as f32) * 100.0;

        let _ = window.emit(
            "fromMain",
            serde_json::json!({
                "type": "conversionProgress",
                "taskId": task_id,
                "percent": step_progress.round() as i32,
                "status": "converting"
            }),
        );

        let window_clone = window.clone();
        let task_id_clone = task_id.clone();
        let current_path_val = current_path.lock().unwrap().clone();

        let on_progress = move |percent: f32| {
            let overall = step_progress + (percent / total_steps as f32);
            let _ = window_clone.emit(
                "fromMain",
                serde_json::json!({
                    "type": "conversionProgress",
                    "taskId": task_id_clone,
                    "percent": overall.round() as i32,
                    "status": "converting"
                }),
            );
        };

        execute_step(
            &current_path_val,
            &step_output_path,
            &step.converter,
            if is_last {
                task.metadata.as_ref()
            } else {
                None
            },
            on_progress,
        )?;

        // Clean up intermediate temp files
        if i > 0 {
            let prev_path = current_path.lock().unwrap().clone();
            let _ = std::fs::remove_file(prev_path);
        }

        *current_path.lock().unwrap() = step_output_path;
    }

    if let Some(ref m) = task.metadata {
        let last_step = &path[total_steps - 1];
        if last_step.converter != "ffmpeg" {
            let current_path_val = current_path.lock().unwrap().clone();
            let exiftool = crate::find_binary(&["exiftool.exe", "exiftool"], &["exiftool"]);
            if let Some(exif_path) = exiftool {
                let _ = crate::metadata::write_with_exiftool(&current_path_val, m, &exif_path);
            }
        }
    }

    let final_path = current_path.lock().unwrap().clone();
    Ok(final_path)
}
