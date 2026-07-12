# Kimi Code CLI（kimi-code-jnlk）

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Fork](https://img.shields.io/badge/upstream-MoonshotAI%2Fkimi--code-lightgrey)](https://github.com/MoonshotAI/kimi-code)

[文档](https://moonshotai.github.io/kimi-code/zh/) · [Issues](https://github.com/jnlk-cn/kimi-code-jnlk/issues) · [English](README.md)

> **Fork 说明**
>
> 本仓库（**kimi-code-jnlk**）是 [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code) 的社区 fork，在 [MIT 许可证](LICENSE) 下独立维护，**与 Moonshot AI 无隶属、背书或官方支持关系**。
>
> - **上游**：官方发行渠道、文档站与插件市场请使用上游仓库。
> - **本 fork**：在 upstream 基础上合入社区补丁；改动说明见下方 [本 fork 的改动](#本-fork-的改动)。仅在你明确要使用本 fork 构建时再从此仓库安装运行。
> - **支持**：问题请提交到 [jnlk-cn/kimi-code-jnlk](https://github.com/jnlk-cn/kimi-code-jnlk/issues)；上游行为请参考 MoonshotAI/kimi-code。
> - **许可证**：保留 `LICENSE` 中的原始 MIT 版权声明；详见 [UPSTREAM.md](UPSTREAM.md)。

![Kimi Code 的使用演示](./docs/media/intro.gif)


## 什么是 Kimi Code CLI

Kimi Code CLI 是一个运行在终端里的 AI 编程 agent，可以帮你读写代码、执行 shell 命令、检索文件、抓取网页，并根据反馈自主决定下一步动作。开箱即用对接 Moonshot AI 的 Kimi 模型，也可指向其他兼容厂商。

## 本 fork 的改动

本 fork 在 upstream **0.23.2** 之上合入社区补丁（当前发行版本 **0.24.1**）。若你使用官方 [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code)，以下差异可能尚未包含。

### DeepSeek V4 官方 API

上游对 DeepSeek V4（`deepseek-v4-pro`、`deepseek-v4-flash`）在 **官方 API**（`api.deepseek.com`）上的支持尚不完整。本 fork 重点修复：

- **Wire 兼容**：通过 `openai` provider 正确发送 `thinking.type`、`reasoning_effort`，并在 tool call 多轮对话中回传 `reasoning_content`；将 UI 中的 `max` 档位映射为 DeepSeek 要求的 wire 值。
- **目录与配置**：解析模型目录中的 `reasoning_options`，暴露 `support_efforts` / `default_effort`；在含 tool-bound think 历史的会话中，避免错误将 Thinking 钳制为 `off`。
- **文档**：仓库内 [供应商配置](docs/zh/configuration/providers.md#openai) 提供 `api.deepseek.com` 的 `config.toml` 示例（上游文档站可能尚未同步）。

### Windows 与 macOS 开发与测试

- 修复 `agent-core` 在 Windows 上的路径断言失败、hook 跨平台阻塞命令、大图压缩测试超时等问题。
- 在 CI 中重新启用 `test-windows` job，便于在 Windows 上开发与贡献。
- 新增 `test-macos` CI job，并在 fork 发布流程中加入 macOS 验证。

### CLI 更新与 DeepSeek footer 遥测（0.24.1）

- **一键更新**：当 `[upgrade].auto_install` 关闭时，安装提示会执行其显示的命令、安装后校验版本、支持 Windows 原生安装，并在无法检测安装来源时给出更清晰的手动指引。
- **Footer 遥测**：使用 DeepSeek 官方 API 时，footer 显示会话 token 用量、预估费用（人民币）、缓存命中率，以及可用时的账户余额。

### Provider 目录（已验证子集）

- `/provider`「Known third-party provider」与 `kimi provider catalog` 默认从本仓库的 [catalog/api.json](https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/catalog/api.json) 拉取——这是本 fork **按官方 API 验证过的白名单**（当前为 DeepSeek V4 / `api.deepseek.com`），不是完整的 [models.dev](https://models.dev/) 目录。
- 白名单源文件：[`apps/kimi-code/scripts/catalog-allowlist.json`](apps/kimi-code/scripts/catalog-allowlist.json)。新增供应商前需完成 wire + TUI 验证。
- 需要完整上游目录：`kimi provider catalog list --url https://models.dev/api.json`。
- 维护者更新镜像（需能访问 models.dev；可用本地代理）：

```sh
export https_proxy=http://127.0.0.1:6789 http_proxy=http://127.0.0.1:6789 all_proxy=socks5://127.0.0.1:6789
pnpm -C apps/kimi-code run catalog:mirror
```

### 发行渠道

- 通过本仓库的 [GitHub Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases) 与一键安装脚本（`install.sh` / `install.ps1`）分发。
- **不**接入官方 `code.kimi.com` CDN 与 npm 包 `@moonshot-ai/kimi-code`。

完整变更列表见 [apps/kimi-code/CHANGELOG.md](apps/kimi-code/CHANGELOG.md)（0.24.1 条目）。若你只需要官方 Kimi 模型与上游发行渠道，请继续使用上游项目。

## 安装

本 fork **不会**通过官方 `code.kimi.com` 安装脚本或 npm 包 `@moonshot-ai/kimi-code` 分发。请使用以下方式之一。

### 安装脚本（推荐）

脚本会自动拉取最新 [GitHub Release](https://github.com/jnlk-cn/kimi-code-jnlk/releases/latest)、校验校验和，并将 `kimi` 安装到 `~/.kimi-code/bin`（Windows 为 `%USERPROFILE%\.kimi-code\bin`），同时尝试更新 PATH。**无需预装 Node.js。**

- **macOS / Linux**：

```sh
curl -fsSL https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.sh | bash
```

- **Windows（PowerShell）**：

```powershell
irm https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.ps1 | iex
```

> Windows 首次启动前请安装 [Git for Windows](https://gitforwindows.org/) — Kimi Code CLI 使用其中的 Git Bash 作为 Shell 环境。若 Git Bash 在非标准路径，请将 `KIMI_SHELL_PATH` 设为 `bash.exe` 的绝对路径。

安装指定版本（将标签替换为 [Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases) 中的实际标签，例如 `v0.24.1-jnlk`）：

```sh
KIMI_VERSION=v0.24.1-jnlk curl -fsSL https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.sh | bash
```

```powershell
$env:KIMI_VERSION = 'v0.24.1-jnlk'
irm https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.ps1 | iex
```

新开一个终端后验证：

```sh
kimi --version
```

### 手动下载预编译包

在 [GitHub Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases/latest) 下载对应平台的 `kimi-code-<系统>-<架构>.zip`，解压后将 `kimi` 可执行文件加入 `PATH`。

| 平台 | 压缩包文件名 |
|---|---|
| macOS（Apple Silicon） | `kimi-code-darwin-arm64.zip` |
| macOS（Intel） | `kimi-code-darwin-x64.zip` |
| Linux（x64） | `kimi-code-linux-x64.zip` |
| Linux（arm64） | `kimi-code-linux-arm64.zip` |
| Windows（x64） | `kimi-code-win32-x64.zip` |
| Windows（arm64） | `kimi-code-win32-arm64.zip` |

macOS（Apple Silicon）示例：

```sh
VERSION=v0.24.1-jnlk
curl -fsSL -o kimi.zip \
  "https://github.com/jnlk-cn/kimi-code-jnlk/releases/download/${VERSION}/kimi-code-darwin-arm64.zip"
unzip kimi.zip
install -m 755 kimi "$HOME/.local/bin/kimi"   # 或 PATH 中的其他目录
kimi --version
```

请根据上表选择与你系统、CPU 匹配的压缩包文件名。

### 从源码构建

环境要求：Node.js ≥ 24.15.0，pnpm 10.33.0。

```sh
git clone https://github.com/jnlk-cn/kimi-code-jnlk.git
cd kimi-code-jnlk
pnpm install
pnpm run build
node apps/kimi-code/dist/main.mjs --version
```

开发模式（无需完整原生单文件包）：

```sh
pnpm dev:cli
```

可选：将构建产物注册为全局 `kimi` 命令：

```sh
pnpm -C apps/kimi-code link --global
kimi --version
```

### 上游官方安装

若你需要 **Moonshot AI 官方**发行渠道（而非本 fork），请使用上游项目：

- 安装脚本：[MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code)
- 文档：[快速上手](https://moonshotai.github.io/kimi-code/zh/guides/getting-started)

## 快速开始

进入项目目录并启动交互界面：

```sh
cd your-project
kimi
```

首次启动时，在 Kimi Code CLI 里输入 `/login`，选择 Kimi Code OAuth 或 Moonshot AI Open Platform API 密钥登录。登录完成后，可以先让它熟悉项目：

```
帮我看一下这个项目的目录结构，简单介绍一下每个目录是做什么的
```

## 核心特性

- **二进制发行，零环境依赖** 一行命令安装，不需要预装 Node.js，不用折腾 PATH，也不会和全局模块冲突。
- **极速启动** TUI 在毫秒级就绪，开一个新会话没有任何心智负担。
- **精致的 TUI 体验** 端到端打磨的交互界面，专为长时间、专注的 Agent 会话优化。
- **视频也能输入** 把屏幕录像、演示视频拖进对话，让 Agent 看那些难以用文字描述的东西——把参考片段做成 LUT、把长视频剪成短视频、把录屏变成代码，等等。
- **AI-native 的 MCP 配置** 通过 `/mcp-config` 对话式添加、编辑、认证 MCP 服务器，无需手写 JSON。
- **丰富的插件生态** 从插件市场或任意 GitHub 仓库安装 skills、MCP 服务器和数据源，每次安装都会标明来源的信任级别。
- **子 Agent 聚焦并行工作** 内置 `coder`、`explore`、`plan` 子 Agent 在隔离上下文中处理子任务，主对话保持清爽。
- **生命周期 hooks** 在关键节点执行本地命令：拦截高风险工具调用、审计决策、发送桌面通知，或对接你自己的自动化脚本。
- **编辑器 / IDE 集成（ACP）** 用 `kimi acp` 让 Zed、JetBrains 等任意 [Agent Client Protocol](https://agentclientprotocol.com/) 客户端直接驱动会话。


## 在编辑器里使用（ACP）

Kimi Code CLI 支持 [Agent Client Protocol](https://agentclientprotocol.com/)，ACP 兼容的编辑器 / IDE（Zed、JetBrains……）可以通过 stdio 直接驱动会话。登录一次后，把编辑器指向 `kimi acp` 子命令即可，无需重复登录。

以 Zed 为例，在 `~/.config/zed/settings.json` 中加入：

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

随后在 Zed 的 Agent 面板新建对话即可。JetBrains 配置与排障见[在 IDE 中使用](https://moonshotai.github.io/kimi-code/zh/guides/ides)，完整能力矩阵见 [`kimi acp` 参考](https://moonshotai.github.io/kimi-code/zh/reference/kimi-acp)。

## 文档

- [快速上手](https://moonshotai.github.io/kimi-code/zh/guides/getting-started)
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
pnpm dev:cli    # 以开发模式运行 CLI
pnpm test       # 运行测试
pnpm typecheck  # TypeScript 检查
pnpm lint       # 运行 oxlint
pnpm build      # 构建所有包
```

完整贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。上游贡献规范见 [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code/blob/main/CONTRIBUTING.md)。

## 社区

- [Issues](https://github.com/jnlk-cn/kimi-code-jnlk/issues)（本 fork）
- [上游 Issues](https://github.com/MoonshotAI/kimi-code/issues)
- 安全漏洞反馈，请见 [SECURITY.md](SECURITY.md)。

## 致谢

我们的 TUI 构建在 [`pi-tui`](https://github.com/earendil-works/pi-mono/tree/main/packages/tui) 之上。我们衷心感谢 `pi-tui` 作者的工作。

## 许可证

基于 [MIT](LICENSE) 协议发布。
