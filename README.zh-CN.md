# GanyCode（kimi-code-jnlk）

> **Fork 声明**
>
> 本仓库是 [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code) 的社区 fork，当前已重新基于上游 **2.4.0**。与 Moonshot AI 无隶属、背书或支持关系。分发渠道仅为本 fork 的 [GitHub Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases) 与 `install.sh` / `install.ps1`，不走 `code.kimi.com`，也不发布到 npm。

## 本 fork 的改动

相对上游 2.4.0：

- **DeepSeek V4（官方 API `api.deepseek.com`）**：支持 `high` / `max` 思考档位，`off` 会显式关闭思考，工具调用轮次间的推理内容可正常往返（走 `openai` provider）。
- **验证过的内置目录**：provider 发现默认从官方 models.dev 拉取；内置进产物的目录由 [`catalog-allowlist.json`](apps/kimi-code/scripts/catalog-allowlist.json) 过滤，离线时只提供对官方 API 验证过的 provider。
- **以 `ganycode` 安装，不占用 `kimi`**：可执行文件、安装目录（`~/.ganycode`）与数据目录（`~/.ganycode`）都与 Kimi Code 分开，装这个不会覆盖已有的 Kimi CLI。
- **以 `ganycode` 安装，不占用 `kimi`**：可执行文件、安装目录（`~/.ganycode`）与数据目录（`~/.ganycode`）都与 Kimi Code 分开，装这个不会覆盖已有的 Kimi CLI。
- **遥测默认关闭**：需在 `config.toml` 设置 `telemetry = true` 才开启。
- **自托管升级**：`ganycode upgrade` 不会把 fork 的原生构建换成官方版本；升级请用 `install.sh` / `install.ps1`。
- **Ganymede Code 桌面端不在本分支**，仍留在 0.25 的 fork 线上，且无法对着新版 SDK 构建。

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Docs](https://img.shields.io/badge/docs-online-blue)](https://moonshotai.github.io/kimi-code/zh/)

[Documentation](https://moonshotai.github.io/kimi-code/zh/) · [Issues](https://github.com/jnlk-cn/kimi-code-jnlk/issues) · [English](README.md)


![Kimi Code 的使用演示](./docs/media/intro.gif)


## 什么是 Kimi Code CLI

Kimi Code CLI 是一个运行在终端里的 AI 编程 agent，可以帮你读写代码、执行 shell 命令、检索文件、抓取网页，并根据反馈自主决定下一步动作。开箱即用对接 Moonshot AI 的 Kimi 模型，也可指向其他兼容厂商。

## 安装

使用本 fork 的安装脚本，不需要提前安装 Node.js。

- **macOS / Linux**：

```sh
curl -fsSL https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/jnlk/2.4.0/install.sh | bash
```

- **Windows（PowerShell）**：

```powershell
irm https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/jnlk/2.4.0/install.ps1 | iex
```

需要固定版本时：bash 追加 `-s -- --version v2.4.0-jnlk.0`，PowerShell 先设置 `$env:KIMI_VERSION = 'v2.4.0-jnlk.0'`。

> Windows 用户首次启动前还需要安装 [Git for Windows](https://gitforwindows.org/)，Kimi Code CLI 会使用其中的 Git Bash 作为 Shell 环境。如果 Git Bash 安装在非标准路径，请把 `KIMI_SHELL_PATH` 设为 `bash.exe` 的绝对路径。

随后在新的终端会话中运行：

```sh
ganycode --version
```

npm 安装、升级、卸载方式，见[快速上手](https://moonshotai.github.io/kimi-code/zh/guides/getting-started)。

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
git clone https://github.com/MoonshotAI/kimi-code.git
cd kimi-code
pnpm install
```

```sh
pnpm dev:cli    # 以开发模式运行 CLI
pnpm test       # 运行测试
pnpm typecheck  # TypeScript 检查
pnpm lint       # 运行 oxlint
pnpm build      # 构建所有包
```

完整贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 社区

- [Issues](https://github.com/MoonshotAI/kimi-code/issues)
- 安全漏洞反馈，请见 [SECURITY.md](SECURITY.md)。

## 致谢

我们的 TUI 构建在 [`pi-tui`](https://github.com/earendil-works/pi-mono/tree/main/packages/tui) 之上。我们衷心感谢 `pi-tui` 作者的工作。

## 许可证

基于 [MIT](LICENSE) 协议发布。
