# FolderPainter 项目指南

## 1. 项目概况
**FolderPainter** 是一个 Windows 桌面应用程序，利用 AI (LLM + 图像生成) 智能分析文件夹内容并定制专属图标。应用采用类似 GPT 的对话式交互界面。

### 技术架构
- **框架**: Tauri v2
- **后端 (Rust)**: 处理系统调用、文件操作、AI 接口请求、SQLite 数据库。
- **前端 (Web)**: React + TypeScript + Vite + Tailwind CSS。
- **核心库**:
  - Rust: `windows` (Win32 API), `rusqlite` (历史记录), `reqwest` (AI), `image/ico` (图片处理)。
  - Frontend: `lucide-react` (UI 图标), `zustand` (状态管理)。

## 2. 开发环境与命令
确保已安装 Node.js 和 Rust 环境。

- **启动开发服务器**:
  ```bash
  npm run tauri dev
  ```
- **构建生产版本**:
  ```bash
  npm run tauri build
  ```
- **仅前端开发**:
  ```bash
  npm run dev
  ```

## 3. 项目结构说明

### Backend (`src-tauri/src/`)
- `lib.rs`: 应用程序入口，注册所有 Tauri 命令。
- `commands.rs`: 暴露给前端的直接命令接口。
- `windows_api.rs` / `desktop_ini.rs`: 封装底层 Windows API 操作 (修改图标、刷新缓存)。
- `ai_client.rs`: 处理与 LLM 和图像生成模型的通信。
- `text_ai.rs`: 负责分析文件夹内的文件结构和内容摘要。
- `icon_gen.rs`: 处理图片下载、缩放及 `.ico` 格式转换。
- `history.rs`: 基于 SQLite 的操作历史记录与"撤销"功能实现。
- `preview.rs`: 管理预览会话状态 (多版本、多文件夹)。
- `templates.rs`: 预设图标模板管理。
- `config.rs`: 用户配置 (API Key 等) 管理。

### Frontend (`src/`)
- `App.tsx`: 主应用入口。
- `AppLayout.tsx`: 主要布局组件（左侧聊天 + 右侧预览面板）。
- `ChatView.tsx`: 聊天视图组件，处理用户交互和 Agent 通信。
- `SettingsPanel.tsx`: 设置面板（API 配置、外观、语言等）。
- `hooks/usePreviewSession.ts`: 核心状态管理 Hook，负责与后端预览命令通信。
- `hooks/useI18n.ts`: 国际化 Hook，支持中英文切换。
- `hooks/useChatAgent.ts`: 聊天 Agent Hook，处理 LLM 工具调用。
- `components/PreviewPanel.tsx`: 预览面板组件。
- `components/TemplatePanel.tsx`: 模板库组件。
- `components/TemplateEditor.tsx`: 模板编辑器组件。
- `locales/zh-CN.json`: 中文翻译文件。
- `locales/en.json`: 英文翻译文件。

## 4. 国际化 (i18n)

### 支持语言
- 🇨🇳 简体中文 (zh-CN) - 默认
- 🇬🇧 English (en)

### 使用方式
在设置界面 **"外观"** 标签页切换语言，设置自动保存到 localStorage。

### 开发规范
- 所有用户可见文本必须使用 `t('key')` 函数获取
- 翻译文件位于 `src/locales/` 目录
- 使用嵌套 JSON 结构组织翻译键值

```tsx
import { useI18n } from './hooks/useI18n';

function MyComponent() {
  const { t } = useI18n();
  return <h1>{t('settings.title')}</h1>;
}
```

### 翻译文件结构
```
├── app           # 应用基础信息
├── chat          # 聊天界面
├── header        # 顶部栏
├── apiWarning    # API 配置提示
├── messages      # 各类消息
├── preview       # 预览面板
├── template      # 模板库
├── templateEditor # 模板编辑器
├── settings      # 设置面板
└── dialog        # 通用对话框
```

## 5. 编码与协作规范 (User Rules)
- **语言**: 必须使用**简体中文**进行回复、注释和文档编写。
- **命名**: 变量/函数保持英文 (snake_case for Rust, camelCase for TS)。
- **错误处理**:
  - Rust 端应详细捕获错误并返回易读的错误信息给前端。
  - 使用 `anyhow` 或自定义 `Result` 类型。
- **UI 设计**:
  - 遵循现代、高颜值的设计原则 (Glassmorphism, Vibrant Colors)。
  - 保持交互的流动性和响应性。
- **国际化**:
  - 新增 UI 文本必须同时更新 `zh-CN.json` 和 `en.json`。
  - 禁止在组件中硬编码用户可见文本。

## 6. 核心功能流 (Workflow)
1. **用户操作**: 拖拽文件夹进入窗口。
2. **分析**: Frontend -> `scan_subfolders` / `analyze_folder_content` -> Rust 分析文件类型/摘要。
3. **生成**: Rust 组装 Prompt -> 调用 LLM 获取建议 -> 调用绘图 AI 生成图片 -> 转为 ICO。
4. **预览**: Frontend 展示生成的图标预览 (Session Version)。
5. **应用**: 用户确认 -> Frontend 调用 `set_folder_icon` -> Rust 修改 `desktop.ini` -> 刷新 Explorer。
6. **回退**: 操作记录入库 -> 可随时调用 `restore_folder_icon` 恢复。

## 7. 当前状态 (截至 2026-01)
- ✅ 后端核心模块（API调用、图像处理、系统修改、数据库）已就绪。
- ✅ 前端已实现完整的预览会话、聊天交互、模板库功能。
- ✅ 国际化支持（中文/英文）已完成。
- ✅ 自定义应用图标已配置。
- 🔄 持续优化：UI 细节、动画交互及用户体验。

