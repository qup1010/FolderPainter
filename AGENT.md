# FolderPainter Agent Guide

## 目标

本文件面向在本仓库内工作的 AI coding agent。目标是让代理在尽量少猜测的前提下，按当前项目真实结构完成修改、验证和说明。

## 语言与输出

- 除非用户明确要求英文，否则所有说明、总结、注释、文档均使用简体中文。
- 代码标识符、命令、日志、报错、第三方接口字段保持原始语言。
- 新增或修改的文本文件统一使用 UTF-8 编码，无 BOM。

## 项目概况

FolderPainter 是一个仅面向 Windows 的 Tauri 桌面应用，用 AI 分析文件夹名称与目录结构，生成并应用文件夹图标。

技术栈以当前仓库为准：

- 前端：React 19 + TypeScript + Vite
- 状态管理：Zustand
- 桌面壳：Tauri v2
- 后端：Rust
- 关键 Rust 依赖：`reqwest`、`rusqlite`、`windows`、`image`、`keyring`

不要假设项目使用 Tailwind、Next.js、Electron 或其他未在仓库中出现的框架。

## 目录职责

### 前端

- `src/App.tsx`：应用入口
- `src/AppLayout.tsx`：整体布局
- `src/ChatView.tsx`：聊天视图
- `src/SettingsPanel.tsx`：设置面板
- `src/components/`：通用 UI 组件
- `src/components/tools/`：工具结果与生成流程相关组件
- `src/hooks/`：前端业务 Hook
- `src/stores/appStore.ts`：全局状态
- `src/locales/zh-CN.json`、`src/locales/en.json`：国际化文案

### 后端

- `src-tauri/src/lib.rs`：Tauri 注册入口
- `src-tauri/src/main.rs`：桌面程序入口
- `src-tauri/src/commands.rs`：前端调用的命令接口
- `src-tauri/src/ai_client.rs`：模型接口访问
- `src-tauri/src/chat_agent.rs`：聊天代理相关逻辑
- `src-tauri/src/text_ai.rs`：文件夹结构分析
- `src-tauri/src/icon_gen.rs`：图标生成与转换
- `src-tauri/src/desktop_ini.rs`、`src-tauri/src/windows_api.rs`：Windows 文件夹图标应用
- `src-tauri/src/config.rs`：配置管理
- `src-tauri/src/history.rs`：历史记录
- `src-tauri/src/preview/`：预览会话
- `src-tauri/src/templates/`：模板库

## 常用命令

在仓库根目录执行：

```bash
npm install
npm run dev
npm run build
npm run tauri dev
npm run tauri build
```

在 `src-tauri` 目录可执行：

```bash
cargo check
cargo test
```

修改 Rust 代码后，优先运行 `cargo check`。
修改前端代码后，优先运行 `npm run build`。
如果改动跨前后端，至少做一次前端构建和一次 Rust 检查。

## 开发约束

### 1. 保持现有架构

- 前端保持函数组件 + Hook 模式。
- 不要无理由引入新的状态管理、UI 框架或大型依赖。
- 小型样式修改优先复用现有 CSS 文件，不要擅自重构整套视觉系统。

### 2. 国际化

- 所有用户可见文本必须走 i18n。
- 新增文案时同时更新：
  - `src/locales/zh-CN.json`
  - `src/locales/en.json`
- 不要在组件中硬编码中文或英文界面文本，调试日志除外。

### 3. Windows / Tauri 特性

- 本项目明确只支持 Windows 10/11，涉及文件夹图标、`desktop.ini`、Explorer 刷新时不要为了“跨平台”改坏现有实现。
- 修改 `windows_api.rs`、`desktop_ini.rs`、`commands.rs` 时，注意前端调用链是否同步变化。
- 涉及系统副作用的逻辑，应优先保证可回退、可报错、可提示。

### 4. API 与配置

- 模型接口采用 OpenAI 兼容格式，相关改动需兼顾文本模型与图片模型调用链。
- 敏感信息优先使用现有配置/密钥存储机制，不要把密钥写入源码或示例配置。

### 5. 样式与交互

- 保持当前产品风格和信息密度，不要把成熟界面改成演示页式布局。
- 新增样式优先沿用已有类名组织方式：组件与样式文件一一对应。
- 动效应克制，避免影响列表、预览、对话等核心操作效率。

## 改动前后的检查清单

开始改动前：

- 先确认修改发生在前端、后端还是两侧联动。
- 先读相关文件，不要按名称猜实现。
- 如果发现仓库现状与文档不一致，以代码为准。

完成改动后：

- 检查是否引入了未国际化文案。
- 检查 TypeScript 类型或 Rust 编译错误。
- 检查命令参数、返回结构、字段名是否与调用方一致。
- 如果改动影响用户流程，说明验证方式或未验证项。

## 建议工作流

1. 先用 `rg` 查相关实现和调用点。
2. 优先做最小闭环修改，不做顺手大重构。
3. 修改后运行最贴近改动范围的验证命令。
4. 向用户汇报时，先说结果，再说验证，再说剩余风险。

## 禁止事项

- 不要假设不存在的依赖、脚本或目录。
- 不要把 README 用语直接当成运行时事实，必须以代码验证。
- 不要随意改动生成产物、图标资源或发布文件名，除非任务明确要求。
- 不要为了“统一风格”批量重命名已稳定的前后端接口。

## 补充说明

- 仓库中已有 `CLAUDE.md`，可作为历史参考，但如果它与当前代码冲突，以当前代码和本文件为准。
- 如果后续新增脚本、测试命令或目录职责变化，应同步更新本文件。
