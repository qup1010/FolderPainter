<div align="center">
  <img src="src-tauri/icons/icon.png" alt="FolderPainter Logo" width="128" height="128">

  <h1>FolderPainter</h1>

  <p>Generate and apply AI-made icons for Windows folders.</p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square&logo=windows" alt="Windows">
    <img src="https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square&logo=tauri" alt="Tauri v2">
    <img src="https://img.shields.io/badge/Rust-1.70+-DEA584?style=flat-square&logo=rust" alt="Rust">
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React">
    <img src="https://img.shields.io/github/license/qup1010/FolderPainter?style=flat-square" alt="License">
  </p>

  <p>
    <a href="#overview">Overview</a> |
    <a href="#features">Features</a> |
    <a href="#screenshots">Screenshots</a> |
    <a href="#quick-start">Quick Start</a> |
    <a href="#workflow">Workflow</a> |
    <a href="#configuration">Configuration</a> |
    <a href="#development">Development</a>
  </p>

  <p>
    <a href="./README.md">简体中文</a> |
    <strong>English</strong>
  </p>
</div>

---

## Overview

FolderPainter is a Windows utility for folder icons. It looks at folder names and directory structure, suggests icon directions, and uses text and image models to generate icons you can apply directly.

It is useful when you want to:

- organize project folders, asset libraries, or collections more clearly
- generate icons in batches instead of finding them one by one
- connect your own model endpoints to a local desktop tool

## Features

- Analyze folder structure and generate icon directions and prompts
- Use preset templates or describe styles in natural language
- Preview, compare, and apply multiple generated versions
- Remove backgrounds for transparent icon output
- Import and export templates
- Restore the default system icon

## Screenshots

| Main Interface | Settings |
| --- | --- |
| ![Main Interface](assets/1da8cd10ea588bcd39e040d3119f0971d06993c0b631fb4e7c475eb1a01f114f.png) | ![Settings](assets/0ba4d2a037738227208d49d7ba488ece778f7b24788c143fb8896c79846a6395.png) |

| Template Library | Folder Analysis |
| --- | --- |
| ![Template Library](assets/c97e8500315043ce653f7c7b347333f844b5f0fe55c2f67ec161ba225caa4980.png) | ![Folder Analysis](assets/5586ce8d487f16defbe10b4af3de32ad7558fde9b09e566f7ba8d2ba98f1134a.png) |

| Preview |
| --- |
| ![Preview](assets/68d54538c2f390e8b42058d464b7e8b4fafaaf9856a5b0a4e9f50a658561b087.png) |

| Generated Result |
| --- |
| ![Generated Result](public/result.png) |

The example above uses `gemini-3-flash` for text analysis and `FLUX-2-KLEIN-4B-FP8` in `ComfyUI` for image generation.

If you want to connect ComfyUI models to this project, see:
[Comfyui2Openai](https://github.com/qup1010/Comfyui2Openai?tab=readme-ov-file)

## Quick Start

Before using the app, prepare two endpoints:

- a text model endpoint for folder analysis and prompt generation
- an image generation endpoint for icon creation

### Download

Download the latest release from [Releases](https://github.com/qup1010/FolderPainter/releases):

| File | Description |
| --- | --- |
| `FolderPainter_x.x.x_x64-setup.exe` | Installer, recommended |
| `FolderPainter_x.x.x_x64_en-US.msi` | MSI package |

### First-time Setup

1. Open Settings from the top right corner.
2. Configure the image generation model endpoint.
3. Configure the text analysis model endpoint.
4. Click "Test Connection" to confirm the setup.

### Supported Endpoint Formats

Image generation supports the OpenAI-compatible format:

`/v1/images/generations`

Text models support the OpenAI-compatible format:

`/v1/chat/completions`

## Workflow

```text
Add folder -> Analyze content -> Select or describe style -> Generate icon -> Preview -> Apply
```

### Basic Steps

1. Add a folder or drag it into the window.
2. Pick a style from the template library, or describe the result you want.
3. Generate icons and review multiple candidates.
4. Apply the version you want to the folder.

### Common Features

- Batch processing for multiple folders
- One-click background removal
- Import and export templates
- Restore the default system icon

## Configuration

### Data Storage

User data is stored in `%APPDATA%\FolderPainter\`:

```text
FolderPainter/
├── config.json    # API settings
└── history.db     # Templates and history
```

### Background Removal Services

The app currently uses free services hosted on HuggingFace Spaces:

- BRIA RMBG 2.0
- BRIA RMBG 1.4
- not-lain/background-removal
- KenjieDec/RemBG

Please follow the availability and usage terms of those services.

## Development

### Requirements

- Node.js 18+
- Rust 1.70+
- Windows 10/11

### Local Run

```bash
git clone https://github.com/qup1010/FolderPainter.git
cd FolderPainter
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

Build artifacts are written to `src-tauri/target/release/bundle/`.

### Project Structure

```text
FolderPainter/
├── src/                     # React frontend
├── src-tauri/              # Rust backend
├── public/                 # Static assets
└── assets/                 # README example images
```

## Notes

- AI only uses folder names and directory structure. It does not read file contents.
- Icon generation and model calls require network access.
- Image generation consumes model quota. High resolution is usually unnecessary for icons.
- Windows 10/11 only.

## Contributing

Issues and pull requests are welcome.

## License

[MIT License](LICENSE)
