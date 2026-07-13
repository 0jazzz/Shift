# Rust Backend Migration Progress

Follow this ordered checklist to rebuild the Shift backend in Rust. Check off items by changing `[ ]` to `[x]` as you complete them.

## Step 1: Warm Up (Completed)
- [x] **`lib.rs` - Delete Dependencies**
  - Use `std::fs::remove_dir_all` to wipe out the `.bin` folder.
  - Understand borrowing, scope, and loops.

## Step 2: The Downloader
File: `src/downloader.rs`
- [x] **Define `DependencyConfig`**
  - Create a struct or a map containing the URLs and extraction types (zip, 7z) for your dependencies (FFmpeg, ExifTool, etc.).
- [x] **Implement `download_file`**
  - Use `std::process::Command` to spawn `curl` or `powershell` to download a file to the `.bin` directory.
- [x] **Implement `extract_dependency`**
  - Use `std::process::Command` to spawn an extraction command (like PowerShell's `Expand-Archive` or `tar`).
- [ ] **Implement `handle_download_dependency`**
  - Tie the downloader and extractor together so a single function can download and extract a requested dependency.
- [ ] **Wire up to `lib.rs`**
  - Go back to `lib.rs` and update the `download_dependency` command to use your new downloader code.

## Step 3: Metadata
File: `src/metadata.rs`
- [ ] **Define `FileMetadata` Struct**
  - Create the struct representing tags (title, artist, album, etc.) and add `#[derive(Serialize, Deserialize)]` so it can communicate with React.
- [ ] **Implement `read_metadata_exiftool`**
  - Learn how to execute `exiftool` as a child process and capture its standard output (stdout).
  - Use `serde_json` to parse the string output into your `FileMetadata` struct.
- [ ] **Implement `write_with_exiftool`**
  - Spawn `exiftool` again, but this time pass it arguments to write the tags to a file.

## Step 4: The Conversion Graph
File: `src/conversion_graph.rs`
- [ ] **Build the `ConversionGraph` Struct**
  - Set up a `HashMap` mapping source formats to a list of target formats and the tool required (e.g., "mp4" -> ["mp3" via ffmpeg, "gif" via ffmpeg]).
- [ ] **Implement the BFS Algorithm (`find_path`)**
  - Build a Breadth-First Search loop to find the shortest conversion path from the input file to the user's desired output format.

## Step 5: The Boss File (Engine)
File: `src/engine.rs`
- [ ] **Define `ConversionTask` Struct**
  - A struct to hold the user's request (input path, output path, target format).
- [ ] **Implement `convert_file` Orchestration**
  - Combine everything here: ask `conversion_graph` for the path, extract metadata using `metadata.rs`, and execute the `ffmpeg` conversion command.
- [ ] **Background Threads & UI Events**
  - Wrap the execution in `std::thread::spawn` so the UI doesn't freeze.
  - Send progress updates back to the frontend.

## Step 6: Final Wiring
File: `src/lib.rs`
- [ ] **Wire up `start_conversion`**
  - Update the command stub in `lib.rs` to call your new `engine::convert_file` function.
