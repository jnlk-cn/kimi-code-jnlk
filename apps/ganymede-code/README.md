# 伽利略 Code / Ganymede Code

当前版本：**0.2.0**。完整变更见 [CHANGELOG.md](CHANGELOG.md)。

Ganymede Code（`@jnlk.zone/ganymede-code`）是基于 Electron 与 `@moonshot-ai/kimi-code-sdk` 的本地优先桌面代理工作台。主进程直接托管 SDK 会话，渲染进程通过受限、类型化的 preload API 使用项目、Git、终端、浏览器和自动化能力。运行时数据默认在 `~/.ganymede`（可用 `GANYMEDE_HOME` 覆盖），项目级配置在 `.ganymede/`，与 Kimi CLI 的 `.kimi-code` 分离。

## 功能

- 多项目、多会话、流式工具时间线、审批与结构化追问
- 六种交互模式：助理、工程、计划、排障、集群、问答（权限与模式正交；工程模式内建 KimiCodeBoost 工作流技能）
- Local / 托管 Worktree、Git diff、暂存、提交、推送和 GitHub PR
- 多标签终端、文件浏览/编辑、PDF 与图片预览
- 内置浏览器、页面截图、Chrome bridge 和 macOS Computer Use helper
- 插件、Skills、MCP、Sites、本地 Scheduled/Inbox 与 SQLite FTS Memory
- 深浅主题、快捷键、系统通知、Quick Chat（默认问答模式）和任务摘要

云任务、跨设备同步和公网 Sites 托管有意替换为本地等价能力。Scheduled 任务要求应用保持运行；内部未签名构建不会在锁屏后控制电脑。

## 开发

桌面模式（Electron 窗口）：

```sh
pnpm install
pnpm dev:desktop
```

Web 模式（浏览器热更新，适合在 Cursor 内调试 UI）：

```sh
pnpm install
pnpm dev:web:ganymede
```

启动后在 Cursor 中：`Cmd+Shift+P` → **Simple Browser: Show** → 打开终端打印的 URL（默认 `http://localhost:5173`）。也可运行 VS Code / Cursor 任务 **ganymede-code: dev:web**。

Web 模式限制：

- 内嵌浏览器面板依赖隐藏 Electron 窗口的 `WebContentsView`，浏览器里无法直接嵌入页面；完整浏览器交互请用桌面模式
- 系统文件/目录对话框仍会弹出本机 Electron 对话框（可用），与纯 Web 上传体验不同
- Computer Use / Chrome bridge 行为与桌面一致，但 UI 预览受限
- 窗口拖拽区域（`-webkit-app-region`）在浏览器中无效，不影响功能调试

生产构建与内部安装包：

```sh
pnpm build:ganymede
pnpm package:ganymede
```

Computer Use 需要 macOS 的 Screen Recording 与 Accessibility 权限。Chrome bridge 扩展位于 `resources/chrome-extension`，可通过 Chrome 的“加载已解压的扩展程序”安装。
