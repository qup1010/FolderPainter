<div align="center">
  <img src="src-tauri/icons/icon.png" alt="FolderPainter Logo" width="128" height="128">

  <h1>FolderPainter</h1>

  <p><strong>AI-Powered Windows Folder Icon Customization Tool</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square&logo=windows" alt="Windows">
    <img src="https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square&logo=tauri" alt="Tauri v2">
    <img src="https://img.shields.io/badge/Rust-1.70+-DEA584?style=flat-square&logo=rust" alt="Rust">
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React">
    <img src="https://img.shields.io/github/license/qup1010/FolderPainter?style=flat-square" alt="License">
  </p>

  <p>
    <a href="#-features">Features</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-usage-guide">Usage Guide</a> •
    <a href="#-configuration">Configuration</a> •
    <a href="#-development">Development</a>
  </p>

  <p>
    <a href="./README.md">简体中文</a> |
    <strong>English</strong>
  </p>
</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🤖 AI-Powered Analysis
- Automatically scan folder content structure
- LLM analysis and icon suggestions
- Natural language conversation interaction

</td>
<td width="50%">

### 🎨 Diverse Styles
- Multiple preset artistic style templates
- Custom style descriptions
- Smart conversation interaction

</td>
</tr>
<tr>
<td>

### 🖼️ Image Processing
- AI image generation
- One-click background removal
- Multi-version preview and comparison

</td>
<td>

### 💾 Template Management
- Create/Edit/Delete custom templates
- Template import/export sharing
- Multi-language support (Chinese/English)

</td>
</tr>
</table>

---

## 📸 Screenshots

| Main Interface | Template Library |
|----------------|------------------|
| ![Main](public/main.png) | ![Templates](public/templates.png) |

| Settings | Preview Panel |
|----------|---------------|
| ![Settings](public/settings.png) | ![Preview](public/preview.png) |

| Generated Results |
|-------------------|
| ![Results](public/result.png) |

---

## 🚀 Quick Start

### Download & Install

Download the latest version from [Releases](https://github.com/qup1010/FolderPainter/releases):

| Version | Description |
|---------|-------------|
| `FolderPainter_x.x.x_x64-setup.exe` | Installer (Recommended) |
| `FolderPainter_x.x.x_x64_en-US.msi` | MSI Package |

### Configure API

First-time setup requires AI model API configuration:

1. Click ⚙️ in the top right to open Settings
2. Configure **Image Generation Model** (Required)
3. Configure **Text Analysis Model** (Optional, enables smart conversation)
4. Click "Test Connection" to verify configuration

#### Supported Image Model Formats

Supports OpenAI-compatible endpoint calls:
`/v1/images/generations`

Also compatible with ModelScope API format.

#### Supported Text Model Formats

Supports OpenAI-compatible endpoint calls:
`/v1/chat/completions`

---

## 📖 Usage Guide

### Basic Workflow

```
Add Folder → AI Analysis → Select/Customize Style → Generate Icon → Preview → Apply
```

### Steps

1. **Add Folders** - Click 📁 at bottom left or drag folders into window
2. **Select Style** - Choose from template library or describe in natural language
3. **Generate Icon** - Click "Generate" or say "generate"
4. **Preview & Adjust** - View multiple versions in the right panel
5. **Apply Icon** - Click "Apply" when satisfied

### Pro Tips

- 💡 **Batch Processing**: Add multiple folders at once for batch generation and application
- 💡 **Background Removal**: Enable cutout feature for transparent background icons
- 💡 **Template Sharing**: Export templates as JSON to share with others
- 💡 **Restore Icons**: One-click restore to system default icons

---

## ⚙️ Configuration

### Data Storage

User data is stored in `%APPDATA%\FolderPainter\`:

```
FolderPainter/
├── config.json    # API configuration
└── history.db     # Templates and history
```

> ⚠️ Updates or reinstalls will not lose user data

### Background Removal Service

Uses free HuggingFace Space services:

- BRIA RMBG 2.0
- BRIA RMBG 1.4
- not-lain/background-removal
- KenjieDec/RemBG

---

## 🛠️ Development

### Requirements

- Node.js 18+
- Rust 1.70+
- Windows 10/11

### Local Development

```bash
# Clone the repository
git clone https://github.com/qup1010/FolderPainter.git
cd FolderPainter

# Install dependencies
npm install

# Start development server
npm run tauri dev
```

### Build for Production

```bash
# Build production version
npm run tauri build
```

Build artifacts are located in `src-tauri/target/release/bundle/`

### Project Structure

```
FolderPainter/
├── src/                    # React Frontend
│   ├── components/         # UI Components
│   ├── hooks/              # React Hooks
│   ├── locales/            # i18n Files
│   └── utils/              # Utility Functions
├── src-tauri/              # Rust Backend
│   └── src/
│       ├── ai_client.rs    # AI API Calls
│       ├── templates/      # Template Management
│       ├── preview.rs      # Preview Session
│       └── ...
└── public/                 # Static Assets
    └── template-covers/    # Preset Template Covers
```

---

## 📝 Notes

- 🔒 **Privacy**: AI only analyzes folder names and directory structure, **does NOT read file contents**
- 🌐 **Network**: Requires internet connection for AI API calls
- 💰 **API Costs**: Image generation consumes API quota; smaller resolutions recommended for icons
- 🖥️ **System**: Windows 10/11 only

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

---

## 📄 License

[MIT License](LICENSE)

---

<div align="center">
  <p>If this project helps you, please give it a ⭐ Star!</p>
</div>
