# Shift

Shift is a powerful, privacy-focused desktop application designed for seamless local file conversions. Built with performance and security in mind, Shift handles your images, videos, audio, documents, and more without ever uploading a single byte to the cloud.

This is a v1.0.0 Alpha release supporting both Windows and Linux. The application structure is currently in progress and undergoing refactoring.

## Known Issues

### Linux Version
- Interface rendering glitches in specific UI elements.
- Automatic installation fails for two core dependencies.
- General performance and UI lag during interactions.

### Windows Version
- No UI rendering glitches.
- Dependency installation completes successfully.
- Stable performance.

## Features

- **Zero-Cloud Privacy**: All conversions happen 100% locally on your machine.
- **Smart Dependency Management**: Automatically detects, installs, and manages required tools (FFmpeg, ExifTool, Pandoc, LibreOffice).
- **Hardware Acceleration**: Optimized to utilize your specific GPU for faster video processing.
- **Intelligent Queue**: Drag-and-drop multiple files, track conversions, and monitor status.
- **Organized Output**: Automatically sorts converted files into logical folders (Video, Audio, Images, Documents).
- **Archive History**: Keeps a searchable log of all past conversions for easy access.
- **Modern UI**: A sleek, glassmorphic dark-themed interface built for focus and efficiency.

## Tech Stack

- **Runtime**: Tauri 2.x
- **Backend Language**: Rust
- **Frontend Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Animation**: Framer Motion
- **State Management**: Zustand
- **Core Engines**: FFmpeg, ExifTool, Pandoc, LibreOffice, Python (pdf2docx)

## Installation

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/0jazzz/Shift.git
   cd Shift
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Development

To start the development server with hot-reloading:

```bash
npm run tauri dev
```

This compiles the Rust backend, starts the Vite frontend dev server, and launches the Tauri window.

## Building

To create a production-ready installer/executable:

```bash
npm run tauri build
```

The output files will be generated in the `src-tauri/target/release/bundle/` directory.

## License

[GPLv3](LICENSE)
