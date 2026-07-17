# Shift

Shift is a powerful, privacy-focused desktop application designed for seamless local file conversions. Built with performance and security in mind, Shift handles your images, videos, audio, documents, and more without ever uploading a single byte to the cloud.

This is a v1.0.0 Alpha release supporting both Windows and Linux. The application structure is currently in progress and undergoing refactoring.

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

To start the development server:

```bash
npm run tauri dev
```

## Building

To create a installer/executable:

```bash
npm run tauri build
```

The output files will be generated in the `src-tauri/target/release/bundle/` directory.

## License

[GPLv3](LICENSE)
