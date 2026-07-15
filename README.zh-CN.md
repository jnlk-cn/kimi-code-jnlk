# Kimi Code CLI（kimi-code-jnlk）

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Fork](https://img.shields.io/badge/upstream-MoonshotAI%2Fkimi--code-lightgrey)](https://github.com/MoonshotAI/kimi-code)

[文档](https://moonshotai.github.io/kimi-code/zh/) · [Issues](https://github.com/jnlk-cn/kimi-code-jnlk/issues) · [English](README.md)

> **Fork 说明**
>
> 本仓库（**kimi-code-jnlk**）是 [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code) 的社区 fork，在 [MIT 许可证](LICENSE) 下独立维护，**与 Moonshot AI 无隶属、背书或官方支持关系**。
>
> - **上游**：官方发行渠道、文档站与插件市场请使用上游仓库。
> - **本 fork**：在定期同步 upstream 的基础上合入社区补丁；改动说明见 [本 fork 的改动](#本-fork-的改动)。仅在你明确要使用本 fork 构建时再从此仓库安装。
> - **支持**：问题请提交到 [jnlk-cn/kimi-code-jnlk](https://github.com/jnlk-cn/kimi-code-jnlk/issues)；上游行为请参考 MoonshotAI/kimi-code。
> - **许可证**：保留 `LICENSE` 中的原始 MIT 版权声明；详见 [UPSTREAM.md](UPSTREAM.md)。

![Kimi Code 的使用演示](./docs/media/intro.gif)

## 什么是 Kimi Code CLI

Kimi Code CLI 是一个运行在终端里的 AI 编程 agent，可以帮你读写代码、执行 shell 命令、检索文件、抓取网页，并根据反馈自主决定下一步动作。开箱即用对接 Moonshot AI 的 Kimi 模型，也可指向其他兼容厂商。

## 本 fork 的改动

当前发行版本：**0.25.0**（`v0.25.0-jnlk`）。本 fork 会定期同步 upstream，并在其上叠加社区补丁。相对官方 [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code)：

- **DeepSeek V4 官方 API**（`api.deepseek.com`）：通过 `openai` provider 支持 Thinking 开关、`max` 档位，以及 tool call 多轮中的 `reasoning_content` 回传。配置示例见 [providers.md](docs/zh/configuration/providers.md#openai)。
- **已验证 Provider 目录**：`/provider` 与 `kimi provider catalog` 默认拉取本仓库的 [catalog/api.json](https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/catalog/api.json)——按官方 API 验证过的白名单（当前为 DeepSeek V4），不是完整的 [models.dev](https://models.dev/) 目录。白名单源文件：[`catalog-allowlist.json`](apps/kimi-code/scripts/catalog-allowlist.json)。完整目录：`kimi provider catalog list --url https://models.dev/api.json`。
- **DeepSeek footer 遥测**：会话 token 用量、预估费用（人民币）、缓存命中率，以及可用时的账户余额。
- **交互模式**：Agent、Plan、Debug、Multitask、Ask——用 `/mode` 或 Shift-Tab 切换。详见 [apps/kimi-code/CHANGELOG.md](apps/kimi-code/CHANGELOG.md)。
- **伽利略 Code 桌面端**（`0.2.0`）：本地优先 Electron 工作台，含原生侧栏、浏览器工具与 Web 调试模式。详见 [apps/ganymede-code/CHANGELOG.md](apps/ganymede-code/CHANGELOG.md)。
- **VS Code / Cursor 扩展**（`0.1.0`）：通过 ACP 连接 `kimi acp`。详见 [apps/kimi-vscode/CHANGELOG.md](apps/kimi-vscode/CHANGELOG.md)。
- **Windows / macOS CI**：修复 Windows 上 `agent-core` 测试问题，重新启用 `test-windows`，并在 fork 发布流程中加入 `test-macos`。
- **发行渠道**：仅通过本仓库 [GitHub Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases) 与 `install.sh` / `install.ps1` 分发——不接入 `code.kimi.com` 或 npm `@moonshot-ai/kimi-code`。

完整发行说明见 [CHANGELOG.md](CHANGELOG.md)（同步至[文档站](docs/zh/release-notes/changelog.md)）。CLI 包级历史见 [apps/kimi-code/CHANGELOG.md](apps/kimi-code/CHANGELOG.md)。若你只需要官方 Kimi 模型与上游发行渠道，请继续使用上游项目。

## 安装

本 fork **不会**通过官方 `code.kimi.com` 安装脚本或 npm 包 `@moonshot-ai/kimi-code` 分发。

### 安装脚本（推荐）

自动拉取最新 [GitHub Release](https://github.com/jnlk-cn/kimi-code-jnlk/releases/latest)、校验校验和，并将 `kimi` 安装到 `~/.kimi-code/bin`（Windows 为 `%USERPROFILE%\.kimi-code\bin`）。**无需预装 Node.js。**

```sh
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.sh | bash
```

```powershell
# Windows（PowerShell）
irm https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.ps1 | iex
```

> Windows 首次启动前请安装 [Git for Windows](https://gitforwindows.org/) — Kimi Code CLI 使用其中的 Git Bash 作为 Shell 环境。若 Git Bash 在非标准路径，请将 `KIMI_SHELL_PATH` 设为 `bash.exe` 的绝对路径。

安装指定版本（标签见 [Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases)）：

```sh
KIMI_VERSION=v0.25.0-jnlk curl -fsSL https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.sh | bash
```

```powershell
$env:KIMI_VERSION = 'v0.25.0-jnlk'
irm https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.ps1 | iex
```

新开终端后运行 `kimi --version`。之后可用 `kimi upgrade` 升级。

### 手动下载预编译包

在 [Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases/latest) 下载对应平台的 `kimi-code-<系统>-<架构>.zip`，解压后将 `kimi` 加入 `PATH`。

| 平台 | 压缩包文件名 |
|---|---|
| macOS（Apple Silicon） | `kimi-code-darwin-arm64.zip` |
| macOS（Intel） | `kimi-code-darwin-x64.zip` |
| Linux（x64） | `kimi-code-linux-x64.zip` |
| Linux（arm64） | `kimi-code-linux-arm64.zip` |
| Windows（x64） | `kimi-code-win32-x64.zip` |
| Windows（arm64） | `kimi-code-win32-arm64.zip` |

```sh
VERSION=v0.25.0-jnlk
curl -fsSL -o kimi.zip \
  "https://github.com/jnlk-cn/kimi-code-jnlk/releases/download/${VERSION}/kimi-code-darwin-arm64.zip"
unzip kimi.zip
install -m 755 kimi "$HOME/.local/bin/kimi"
kimi --version
```

### 从源码构建

环境要求：Node.js ≥ 24.15.0，pnpm 10.33.0。

```sh
git clone https://github.com/jnlk-cn/kimi-code-jnlk.git
cd kimi-code-jnlk
pnpm install
pnpm run build
node apps/kimi-code/dist/main.mjs --version
```

开发模式：`pnpm dev:cli`。可选全局链接：`pnpm -C apps/kimi-code link --global`。

### 上游官方安装

若需要 **Moonshot AI 官方**发行渠道（而非本 fork）：[MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code) · [快速上手](https://moonshotai.github.io/kimi-code/zh/guides/getting-started)。

## 快速开始

```sh
cd your-project
kimi
```

首次启动时配置 API 来源：

- **Kimi**：输入 `/login`，选择 Kimi Code OAuth 或 Kimi Platform API 密钥。
- **DeepSeek V4（本 fork）**：输入 `/provider`，从已验证目录选择 DeepSeek 并填入官方 API 密钥，再用 `/model` 切换到 `deepseek-v4-pro` 或 `deepseek-v4-flash`。手动配置见 [providers.md](docs/zh/configuration/providers.md#openai)。

然后可以先让它熟悉项目：

```
帮我看一下这个项目的目录结构，简单介绍一下每个目录是做什么的
```

非交互一次性任务：`kimi -p "..."`。继续上次会话：`kimi -c`。

## 核心特性

- **二进制发行，零环境依赖** 一行命令安装，不需要预装 Node.js，也不会和全局模块冲突。
- **极速启动** TUI 在毫秒级就绪。
- **精致的 TUI 体验** 专为长时间、专注的 Agent 会话优化。
- **视频也能输入** 把屏幕录像、演示视频拖进对话，让 Agent 看那些难以用文字描述的东西。
- **AI-native 的 MCP 配置** 通过 `/mcp-config` 对话式添加、编辑、认证 MCP 服务器。
- **丰富的插件生态** 从插件市场或任意 GitHub 仓库安装 skills、MCP 服务器和数据源。
- **子 Agent 聚焦并行工作** 内置 `coder`、`explore`、`plan` 子 Agent，在隔离上下文中处理子任务。
- **生命周期 hooks** 拦截高风险工具调用、审计决策，或对接本地自动化。
- **编辑器 / IDE 集成（ACP）** 用 `kimi acp` 让 Zed、JetBrains 等任意 [Agent Client Protocol](https://agentclientprotocol.com/) 客户端直接驱动会话。

## 在编辑器里使用（ACP）

登录一次后，把编辑器指向 `kimi acp` 即可。以 Zed 为例，在 `~/.config/zed/settings.json` 中加入：

```json
{
  "agent_servers": {
    "Kimi Code CLI": {
      "type": "custom",
      "command": "kimi",
      "args": ["acp"],
      "env": {}
    }
  }
}
```

详见[在 IDE 中使用](https://moonshotai.github.io/kimi-code/zh/guides/ides)与 [`kimi acp` 参考](https://moonshotai.github.io/kimi-code/zh/reference/kimi-acp)。

## 文档

- [快速上手](https://moonshotai.github.io/kimi-code/zh/guides/getting-started)
- [供应商配置（仓库内，含 DeepSeek）](docs/zh/configuration/providers.md)
- [交互与审批](https://moonshotai.github.io/kimi-code/zh/guides/interaction)
- [会话](https://moonshotai.github.io/kimi-code/zh/guides/sessions)
- [在 IDE 中使用（ACP）](https://moonshotai.github.io/kimi-code/zh/guides/ides)
- [配置](https://moonshotai.github.io/kimi-code/zh/configuration/config-files)
- [命令参考](https://moonshotai.github.io/kimi-code/zh/reference/kimi-command)

## 本地开发

环境要求：Node.js ≥ 24.15.0，pnpm 10.33.0。

```sh
git clone https://github.com/jnlk-cn/kimi-code-jnlk.git
cd kimi-code-jnlk
pnpm install
```

```sh
pnpm dev:cli          # CLI / TUI（apps/kimi-code）
pnpm dev:desktop      # 伽利略 Code 桌面端（进程内 SDK，apps/ganymede-code）
pnpm dev:web:ganymede # 伽利略 Code Web 调试（浏览器 UI + 无窗口 Electron；可用 Cursor Simple Browser）
pnpm package:ganymede # 构建内部使用的 macOS DMG/ZIP
pnpm build:vscode     # VS Code 扩展构建（ACP / kimi acp，apps/kimi-vscode）
pnpm dev:vscode       # VS Code 扩展 watch 编译
pnpm vis              # 会话 / 回放可视化调试（apps/vis）
pnpm test         # 测试
pnpm typecheck    # TypeScript 检查
pnpm lint         # oxlint
pnpm build        # 构建所有包
```

维护者刷新白名单目录镜像（需能访问 models.dev）：

```sh
pnpm -C apps/kimi-code run catalog:mirror
```

完整贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。上游规范见 [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code/blob/main/CONTRIBUTING.md)。

## 社区

- [Issues](https://github.com/jnlk-cn/kimi-code-jnlk/issues)（本 fork）
- [上游 Issues](https://github.com/MoonshotAI/kimi-code/issues)
- 安全漏洞反馈见 [SECURITY.md](SECURITY.md)

## 致谢

我们的 TUI 构建在 [`pi-tui`](https://github.com/earendil-works/pi-mono/tree/main/packages/tui) 之上。感谢 `pi-tui` 作者的工作。

## 许可证

基于 [MIT](LICENSE) 协议发布。
