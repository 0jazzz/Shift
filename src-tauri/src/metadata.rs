// METADATA MODULE
//
// This module handles reading and writing metadata (Exif, ID3, document info)
// using ExifTool, FFprobe, or FFmpeg commands.
//
// Rust concepts you will learn here:
// - Struct definition and deserialization with `serde` (Chapter 5 + Serde docs)
// - HashMaps for dynamic key-value storage (Chapter 8)
// - Spawning child processes and capturing JSON stdout (Chapter 12 + std::process)

use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};

/// TODO: Define a struct representing normalized file metadata.
/// In TypeScript, we had fields like title, artist, album, etc.
/// Annotate this with `#[derive(Serialize, Deserialize, Debug, Clone)]`
/// so that Tauri/Serde can serialize it to JSON for the frontend.
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct FileMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<String>,
    pub comment: Option<String>,
    
    // For storing any extra tags that don't fit the standard fields
    pub extra_tags: HashMap<String, String>,
}

/// TODO: Implement helper to detect if a file is a media format (video/audio).
/// This helps decide if we should fallback to ffprobe when exiftool is missing.
/// Tip: Use `path.extension()` to get the file extension and compare it to known values.
pub fn is_likely_media(file_path: &Path) -> bool {
    if let Some(ext) = file_path.extension().and_then(|e| e.to_str()) {
        matches!(
            ext.to_lowercase().as_str(),
            "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" | "mp4" | "mkv" | "avi" | "mov" | "webm"
        )
    } else {
        false
    }
}

pub fn read_with_exiftool(file_path: &Path, exiftool_path: &Path) -> Result<FileMetadata, String> {
    let output = std::process::Command::new(exiftool_path)
        .arg("-json")
        .arg(file_path)
        .output()
        .map_err(|e| format!("Failed to run ExifTool: {}", e))?;

    if !output.status.success() {
        return Err(format!("ExifTool failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    let parsed: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse ExifTool JSON: {}", e))?;

    let raw = if parsed.is_array() {
        parsed.get(0).ok_or("Empty ExifTool array")?
    } else {
        &parsed
    };

    let mut metadata = FileMetadata::default();
    
    if let Some(t) = raw.get("Title").and_then(|v| v.as_str()) { metadata.title = Some(t.to_string()); }
    if let Some(a) = raw.get("Artist").and_then(|v| v.as_str()) { metadata.artist = Some(a.to_string()); }
    if let Some(a) = raw.get("Album").and_then(|v| v.as_str()) { metadata.album = Some(a.to_string()); }
    if let Some(g) = raw.get("Genre").and_then(|v| v.as_str()) { metadata.genre = Some(g.to_string()); }
    if let Some(y) = raw.get("Year").or_else(|| raw.get("CreateDate")).and_then(|v| v.as_str()) {
        metadata.year = Some(y.to_string());
    }
    if let Some(c) = raw.get("Comment").and_then(|v| v.as_str()) { metadata.comment = Some(c.to_string()); }

    Ok(metadata)
}

pub fn read_with_ffprobe(_file_path: &Path, _ffprobe_path: &Path) -> Result<FileMetadata, String> {
    Ok(FileMetadata::default())
}

pub fn write_with_exiftool(file_path: &Path, metadata: &FileMetadata, exiftool_path: &Path) -> Result<(), String> {
    let mut cmd = std::process::Command::new(exiftool_path);
    
    if let Some(ref t) = metadata.title { cmd.arg(format!("-title={}", t)); }
    if let Some(ref a) = metadata.artist { cmd.arg(format!("-artist={}", a)); }
    if let Some(ref alb) = metadata.album { cmd.arg(format!("-album={}", alb)); }
    if let Some(ref g) = metadata.genre { cmd.arg(format!("-genre={}", g)); }
    if let Some(ref y) = metadata.year { cmd.arg(format!("-year={}", y)); }
    if let Some(ref c) = metadata.comment { cmd.arg(format!("-comment={}", c)); }
    
    cmd.arg("-overwrite_original");
    cmd.arg(file_path);

    let status = cmd.status().map_err(|e| format!("Failed to spawn ExifTool: {}", e))?;
    if status.success() {
        Ok(())
    } else {
        Err("ExifTool exited with error".to_string())
    }
}

pub fn write_with_ffmpeg(file_path: &Path, metadata: &FileMetadata, ffmpeg_path: &Path) -> Result<(), String> {
    let temp_file = file_path.with_extension("temp_meta.tmp");
    let mut cmd = std::process::Command::new(ffmpeg_path);
    cmd.arg("-i").arg(file_path);
    
    if let Some(ref t) = metadata.title { cmd.arg("-metadata").arg(format!("title={}", t)); }
    if let Some(ref a) = metadata.artist { cmd.arg("-metadata").arg(format!("artist={}", a)); }
    if let Some(ref alb) = metadata.album { cmd.arg("-metadata").arg(format!("album={}", alb)); }
    if let Some(ref g) = metadata.genre { cmd.arg("-metadata").arg(format!("genre={}", g)); }
    if let Some(ref y) = metadata.year { cmd.arg("-metadata").arg(format!("date={}", y)); }
    if let Some(ref c) = metadata.comment { cmd.arg("-metadata").arg(format!("comment={}", c)); }

    cmd.arg("-codec").arg("copy").arg("-y").arg(&temp_file);

    let status = cmd.status().map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;
    if status.success() {
        std::fs::rename(&temp_file, file_path).map_err(|e| format!("Failed to replace file: {}", e))?;
        Ok(())
    } else {
        let _ = std::fs::remove_file(&temp_file);
        Err("FFmpeg metadata write failed".to_string())
    }
}
