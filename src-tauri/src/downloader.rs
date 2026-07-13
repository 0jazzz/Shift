// DOWNLOADER MODULE
//
// This module will handle downloading and extracting conversion dependencies 
// (like ffmpeg, exiftool, pandoc, etc.) to the local `.bin` folder.
//
// Rust concepts you will learn here:
// - `std::fs` and `std::path` for file and directory manipulation (Chapter 3 + Chapter 12)
// - `std::process::Command` for running system-level commands (e.g., PowerShell extraction)
// - Error handling with `Result` and `Option` (Chapter 9)
// - Third-party HTTP requests (using crates like `reqwest` or running curl/powershell commands)
use std::fs::File;
use std::fs;
use std::path::Path;
use curl::easy::Easy;
use std::io::Write;
use std::process::Command;
/// TODO: Define a struct or constant mapping for dependency configurations.
/// In TypeScript, we had: CONSTANT DOWNLOAD_URLS = Dictionary mapping dependency names to URLs
/// In Rust, you can define a struct:
/// struct DependencyConfig {
///     url: &'static str,
///     extract_type: &'static str, // "zip", "7z", or "pip"
/// }

#[allow(dead_code)]
struct DependencyConfig {
    url: &'static str,
    extract_type: &'static str, 
}

/// TODO: Implement a function to download a file from a URL.
/// Tip: For a beginner-friendly approach, you can spawn a system command (like `curl` or `powershell -Command Invoke-WebRequest`) 
/// using `std::process::Command`. 
/// For a pure-Rust approach later, you can learn about the `reqwest` crate.
///
/// Signature idea:
/// pub fn download_file(url: &str, destination: &Path) -> Result<(), String> {
///     // Your implementation here
/// }
pub fn download_file(url: &str, destination: &Path) -> Result<(), String> {
    // TODO: Write code to download file
    // 1. Log the download start
    println!("Starting download for: {}", url);
    // 2. Spawn curl or powershell to download the file to the destination path
    let mut file = File::create(destination)
        .map_err(|e| format!("Failed to create file at {:?}: {}", destination, e))?;

    // 2. Initialize the curl handle
    let mut handle = Easy::new();
    handle.url(url).map_err(|e| e.to_string())?;

    // Stream data from the URL directly into the file
    handle.write_function(move |data| {
        match file.write_all(data) {
            Ok(_) => Ok(data.len()),
            Err(e) => {
                println!("Failed to write to file: {}", e);
                Err(curl::easy::WriteError::Pause)
            }
        }
    }).map_err(|e| e.to_string())?;

    // Perform the download operation
    handle.perform().map_err(|e| format!("Download failed: {}", e))?;

    println!("Download completed successfully to: {:?}", destination);

    // 3. Return Ok(()) on success, or Err(error_message) on failure
    Ok(())
    
}

/// TODO: Implement a function to extract a ZIP archive.
/// Tip: On Windows, you can spawn PowerShell's `Expand-Archive` command:
/// `powershell -Command Expand-Archive -Path <zip_path> -DestinationPath <dest_dir> -Force`
///
/// Signature idea:
/// pub fn extract_dependency(zip_path: &Path, dest_dir: &Path) -> Result<(), String> {
///     // Your implementation here
/// }
pub fn extract_dependency(zip_path: &Path, dest_dir: &Path) -> Result<(), String> {
    // 1. Create target folder if it doesn't exist
    match fs::create_dir_all(dest_dir) {
        Ok(_) => println!("Directory created successfully."),
        Err(e) => eprintln!("Failed to create directory: {}", e),
    }
    
    // 2. Spawn extraction command depending on target OS
    #[cfg(target_os = "windows")]
    let status = Command::new("powershell")
        .arg("-Command")
        .arg("Expand-Archive")
        .arg("-Path")
        .arg(zip_path)
        .arg("-DestinationPath")
        .arg(dest_dir)
        .arg("-Force")
        .status();

    #[cfg(not(target_os = "windows"))]
    let status = {
        let path_str = zip_path.to_string_lossy();
        if path_str.ends_with(".tar.gz") || path_str.ends_with(".tgz") {
            Command::new("tar")
                .arg("-xzf")
                .arg(zip_path)
                .arg("-C")
                .arg(dest_dir)
                .status()
        } else if path_str.ends_with(".tar.xz") {
            Command::new("tar")
                .arg("-xJf")
                .arg(zip_path)
                .arg("-C")
                .arg(dest_dir)
                .status()
        } else {
            Command::new("unzip")
                .arg("-o")
                .arg(zip_path)
                .arg("-d")
                .arg(dest_dir)
                .status()
        }
    };

    match status {
        Ok(exit_status) => {
            if exit_status.success(){
                println!("Successfully extracted {:?}", zip_path);
                // The starting folder to search is dest_dir, and we want the file to land in dest_dir!
                find_and_move_exe(dest_dir, dest_dir);
                Ok(())
            }
            else {
                let err_msg = format!("Failed to extract {:?}", zip_path);
                eprintln!("{}", err_msg);
                Err(err_msg)
            }
        }
        Err(e) => {
            let err_msg = format!("Failed to launch extraction process: {}", e);
            eprintln!("{}", err_msg);
            Err(err_msg)
        }
    }
}

// 3. Handle moving nested folders if needed (like FFmpeg's top-level archive directory)

fn find_and_move_exe(current_dir: &Path, final_dir: &Path) {
    for entry in fs::read_dir(current_dir).unwrap(){
        let entry = entry.unwrap();
        let path = entry.path();
        
        let is_executable = {
            #[cfg(target_os = "windows")]
            {
                path.extension() == Some(OsStr::new("exe"))
            }
            #[cfg(not(target_os = "windows"))]
            {
                let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
                path.is_file() && (
                    filename == "ffmpeg" ||
                    filename == "exiftool" ||
                    filename == "pandoc" ||
                    filename == "pdftotext" ||
                    filename == "magick" ||
                    filename == "convert"
                )
            }
        };

        if is_executable {
            let new_location = final_dir.join(path.file_name().unwrap());
            let _ = fs::rename(&path, new_location);
        }
        if path.is_dir() {
            find_and_move_exe(&path, final_dir);
        }
    }
}


/// TODO: Implement Python Pip package installer helper.
/// This runs `python -m pip install <package_name>` to install libraries like `pdf2docx`.
pub fn install_pip_package(package_name: &str) -> Result<(), String> {
    // TODO: Write code to spawn a command `python -m pip install <package_name>`
    // Check if python command is available first!

    let status = Command::new("python")
        .arg("-m")
        .arg("pip")
        .arg("install")
        .arg(package_name)
        .status();

    match status {
        Ok(exit_status) => {
            if exit_status.success(){
                println!("Successfully installed {}", package_name);
                Ok(())

            }

            else {
                let err_msg = format!("Python failed to install {}" , package_name);
                eprintln!("{}", err_msg);
                Err(err_msg)
            }
        }

        Err(e) => {
            let err_msg = format!("Failed to launch Python: {}", e);
            eprintln!("{}", err_msg);
            Err(err_msg)
        }
    }
}

pub fn handle_download_dependency(dep_name: String) -> Result<(), String> {
    let name = dep_name.to_lowercase();
    
    // 1. Determine download URL and type depending on `dep_name` and OS
    let (url, _extract_type) = match name.as_str() {
        "ffmpeg" => {
            #[cfg(target_os = "windows")]
            { ("https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip", "zip") }
            #[cfg(not(target_os = "windows"))]
            { ("https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz", "tar.xz") }
        }
        "exiftool" => {
            #[cfg(target_os = "windows")]
            { ("https://sourceforge.net/projects/exiftool/files/exiftool-13.52_64.zip/download", "zip") }
            #[cfg(not(target_os = "windows"))]
            { ("https://exiftool.org/Image-ExifTool-13.52.tar.gz", "tar.gz") }
        }
        "imagemagick" => {
            #[cfg(target_os = "windows")]
            { ("https://imagemagick.org/archive/binaries/ImageMagick-7.1.1-29-portable-Q16-x64.zip", "zip") }
            #[cfg(not(target_os = "windows"))]
            { ("", "") }
        }
        "pandoc" => {
            #[cfg(target_os = "windows")]
            { ("https://github.com/jgm/pandoc/releases/download/3.8.3/pandoc-3.8.3-windows-x86_64.zip", "zip") }
            #[cfg(not(target_os = "windows"))]
            { ("https://github.com/jgm/pandoc/releases/download/3.8.3/pandoc-3.8.3-linux-amd64.tar.gz", "tar.gz") }
        }
        "xpdf" => {
            #[cfg(target_os = "windows")]
            { ("https://dl.xpdfreader.com/xpdf-tools-win-4.06.zip", "zip") }
            #[cfg(not(target_os = "windows"))]
            { ("https://dl.xpdfreader.com/xpdf-tools-linux-4.06.tar.gz", "tar.gz") }
        }
        "pdf2docx" => {
            return install_pip_package("pdf2docx");
        }
        _ => return Err(format!("Unknown dependency: {}", dep_name)),
    };

    if url.is_empty() {
        return Err(format!("No download URL available for {} on this platform", dep_name));
    }

    // 2. Create the target `.bin` directory if it does not exist
    let bin_dir = std::env::current_dir().unwrap_or_default().join(".bin");
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;
    }

    // 3. Download the file to a temporary location
    let file_ext = if url.contains(".tar.xz") {
        "tar.xz"
    } else if url.contains(".tar.gz") || url.contains(".tgz") {
        "tar.gz"
    } else {
        "zip"
    };
    
    let temp_file = bin_dir.join(format!("temp_{}.{}", name, file_ext));
    download_file(url, &temp_file)?;

    // 4. Extract based on type
    let extract_result = extract_dependency(&temp_file, &bin_dir);

    // 5. Clean up the downloaded temporary archive file
    let _ = fs::remove_file(&temp_file);

    // Set execute permissions on Linux/macOS
    #[cfg(not(target_os = "windows"))]
    {
        if name == "exiftool" {
            let exiftool_path = bin_dir.join("exiftool");
            if exiftool_path.exists() {
                let _ = Command::new("chmod").arg("+x").arg(&exiftool_path).status();
            }
        }
        if name == "ffmpeg" {
            let ffmpeg_path = bin_dir.join("ffmpeg");
            if ffmpeg_path.exists() {
                let _ = Command::new("chmod").arg("+x").arg(&ffmpeg_path).status();
            }
        }
        if name == "pandoc" {
            let pandoc_path = bin_dir.join("pandoc");
            if pandoc_path.exists() {
                let _ = Command::new("chmod").arg("+x").arg(&pandoc_path).status();
            }
        }
    }

    extract_result
}
