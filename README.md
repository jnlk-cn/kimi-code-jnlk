# Kimi Code CLI (kimi-code-jnlk)

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Fork](https://img.shields.io/badge/upstream-MoonshotAI%2Fkimi--code-lightgrey)](https://github.com/MoonshotAI/kimi-code) <br>
[Documentation](https://moonshotai.github.io/kimi-code/en/) · [Issues](https://github.com/jnlk-cn/kimi-code-jnlk/issues) · [中文](README.zh-CN.md)

> **Fork notice**
>
> This repository (**kimi-code-jnlk**) is a community fork of [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code), maintained independently under the [MIT License](LICENSE). It is **not** affiliated with, endorsed by, or supported by Moonshot AI.
>
> - **Upstream**: official release channel, docs site, and marketplace plugins.
> - **This fork**: community builds with extra provider/CI patches; see [What this fork changes](#what-this-fork-changes). Install from here only if you want those builds.
> - **Support**: [jnlk-cn/kimi-code-jnlk issues](https://github.com/jnlk-cn/kimi-code-jnlk/issues). For upstream behavior, use MoonshotAI/kimi-code.
> - **License**: keep the MIT notice in `LICENSE`; see [UPSTREAM.md](UPSTREAM.md).

![Demo of using Kimi Code](./docs/media/intro.gif)

## What is Kimi Code CLI

Kimi Code CLI is an AI coding agent that runs in your terminal — it can read and edit code, run shell commands, search files, fetch web pages, and choose the next step based on the feedback it receives. It works out of the box with Moonshot AI’s Kimi models and can also be configured to use other compatible providers.

## What this fork changes

Current release: **0.25.0** (`v0.25.0-jnlk`). The fork regularly syncs from upstream and layers community patches on top. Compared with official [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code):

- **Interaction modes**: Agent, Plan, Debug, Multitask, and Ask with mutually exclusive switching (`/mode` or Shift-Tab). See [apps/kimi-code/CHANGELOG.md](apps/kimi-code/CHANGELOG.md).
- **Ganymede Code desktop**: Electron workspace with projects, sessions, terminal, browser, and catalog-backed models (`pnpm dev:desktop`). See [apps/ganymede-code/CHANGELOG.md](apps/ganymede-code/CHANGELOG.md).
- **VS Code / Cursor extension (route B)**: ACP Chat sidebar over `kimi acp` (`pnpm build:vscode`). See [apps/kimi-vscode/CHANGELOG.md](apps/kimi-vscode/CHANGELOG.md).
- **DeepSeek V4 on the official API** (`api.deepseek.com`): thinking toggles, `max` effort, and `reasoning_content` round-trips across tool-call turns work through the `openai` provider. Example `config.toml`: [providers.md](docs/en/configuration/providers.md#openai).
- **Verified provider catalog**: `/provider` and `kimi provider catalog` default to this repo’s [catalog/api.json](https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/catalog/api.json) — an allowlist of providers verified against their official APIs (currently DeepSeek V4), not the full [models.dev](https://models.dev/) catalog. Allowlist: [`catalog-allowlist.json`](apps/kimi-code/scripts/catalog-allowlist.json). Full catalog: `kimi provider catalog list --url https://models.dev/api.json`.
- **DeepSeek footer telemetry**: session token usage, estimated cost (CNY), cache hit rate, and balance when available.
- **Windows / macOS CI**: Windows agent-core test fixes, re-enabled `test-windows`, plus `test-macos` in the fork release workflow.
- **Distribution**: [GitHub Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases) and `install.sh` / `install.ps1` only — not `code.kimi.com` or npm `@moonshot-ai/kimi-code`.

Full CLI notes: [apps/kimi-code/CHANGELOG.md](apps/kimi-code/CHANGELOG.md). If you only need official Kimi models and the upstream channel, use the upstream project.

## Install

This fork is **not** distributed through `code.kimi.com` or `@moonshot-ai/kimi-code`.

### Install script (recommended)

Fetches the latest [GitHub Release](https://github.com/jnlk-cn/kimi-code-jnlk/releases/latest), verifies the checksum, and installs `kimi` to `~/.kimi-code/bin` (or `%USERPROFILE%\.kimi-code\bin` on Windows). **No Node.js required.**

```sh
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.sh | bash
```

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.ps1 | iex
```

> On Windows, install [Git for Windows](https://gitforwindows.org/) first — Kimi Code CLI uses Git Bash as its shell. For a custom Git Bash location, set `KIMI_SHELL_PATH` to the absolute path of `bash.exe`.

Pin a release tag from [Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases):

```sh
KIMI_VERSION=v0.25.0-jnlk curl -fsSL https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.sh | bash
```

```powershell
$env:KIMI_VERSION = 'v0.25.0-jnlk'
irm https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.ps1 | iex
```

Open a new terminal and run `kimi --version`. Later upgrades: `kimi upgrade`.

### Manual download

Download `kimi-code-<os>-<arch>.zip` from [Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases/latest), extract it, and put `kimi` on your `PATH`.

| Platform | Archive |
|---|---|
| macOS (Apple Silicon) | `kimi-code-darwin-arm64.zip` |
| macOS (Intel) | `kimi-code-darwin-x64.zip` |
| Linux (x64) | `kimi-code-linux-x64.zip` |
| Linux (arm64) | `kimi-code-linux-arm64.zip` |
| Windows (x64) | `kimi-code-win32-x64.zip` |
| Windows (arm64) | `kimi-code-win32-arm64.zip` |

```sh
VERSION=v0.25.0-jnlk
curl -fsSL -o kimi.zip \
  "https://github.com/jnlk-cn/kimi-code-jnlk/releases/download/${VERSION}/kimi-code-darwin-arm64.zip"
unzip kimi.zip
install -m 755 kimi "$HOME/.local/bin/kimi"
kimi --version
```

### Build from source

Requires Node.js ≥ 24.15.0 and pnpm 10.33.0.

```sh
git clone https://github.com/jnlk-cn/kimi-code-jnlk.git
cd kimi-code-jnlk
pnpm install
pnpm run build
node apps/kimi-code/dist/main.mjs --version
```

Dev mode without a full native bundle: `pnpm dev:cli`. Optional global link: `pnpm -C apps/kimi-code link --global`.

### Official upstream install

For the **official** Moonshot AI channel (not this fork): [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code) · [Getting Started](https://moonshotai.github.io/kimi-code/en/guides/getting-started).

## Quick Start

```sh
cd your-project
kimi
```

On first launch, pick an API source:

- **Kimi**: run `/login` and choose Kimi Code OAuth or a Kimi Platform API key.
- **DeepSeek V4 (this fork)**: run `/provider`, pick DeepSeek from the verified catalog, enter your official API key, then `/model` to select `deepseek-v4-pro` or `deepseek-v4-flash`. Manual config: [providers.md](docs/en/configuration/providers.md#openai).

Then try:

```
Take a look at this project and explain its main directories.
```

Non-interactive one-shot: `kimi -p "..."`. Resume the last session: `kimi -c`.

## Key Features

- **Single-binary distribution.** One-command install; no Node.js setup or global module conflicts.
- **Blazing-fast startup.** The TUI is ready in milliseconds.
- **Purpose-built TUI.** Tuned for long, focused agent sessions.
- **Video input.** Drop a screen recording or demo clip into the chat and let the agent watch what is hard to describe in words.
- **AI-native MCP configuration.** Add, edit, and authenticate MCP servers with `/mcp-config`.
- **Rich plugin ecosystem.** Skills, MCP servers, and data sources from the marketplace or any GitHub repo.
- **Subagents for focused, parallel work.** Built-in `coder`, `explore`, and `plan` subagents in isolated contexts.
- **Lifecycle hooks.** Gate risky tool calls, audit decisions, or trigger local automation.
- **Editor & IDE integration (ACP).** Drive a session from Zed, JetBrains, or any [Agent Client Protocol](https://agentclientprotocol.com/) client with `kimi acp`.

## Use it in your editor (ACP)

Log in once, then point your editor at `kimi acp`. For Zed, add to `~/.config/zed/settings.json`:

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

See [Using in IDEs](https://moonshotai.github.io/kimi-code/en/guides/ides) and the [`kimi acp` reference](https://moonshotai.github.io/kimi-code/en/reference/kimi-acp).

## Docs

- [Getting Started](https://moonshotai.github.io/kimi-code/en/guides/getting-started)
- [Providers (in-repo, includes DeepSeek)](docs/en/configuration/providers.md)
- [Interaction and approvals](https://moonshotai.github.io/kimi-code/en/guides/interaction)
- [Sessions](https://moonshotai.github.io/kimi-code/en/guides/sessions)
- [Using in IDEs (ACP)](https://moonshotai.github.io/kimi-code/en/guides/ides)
- [Configuration](https://moonshotai.github.io/kimi-code/en/configuration/config-files)
- [Command reference](https://moonshotai.github.io/kimi-code/en/reference/kimi-command)

## Develop

Requirements: Node.js ≥ 24.15.0, pnpm 10.33.0.

```sh
git clone https://github.com/jnlk-cn/kimi-code-jnlk.git
cd kimi-code-jnlk
pnpm install
```

```sh
pnpm dev:cli          # CLI / TUI (apps/kimi-code)
pnpm dev:desktop      # Ganymede Code desktop (SDK in-process, apps/ganymede-code)
pnpm dev:web:ganymede # Ganymede Code web-dev (browser UI + headless Electron; Cursor Simple Browser)
pnpm package:ganymede # Build an internal macOS DMG/ZIP
pnpm build:vscode     # VS Code extension build (ACP / kimi acp, apps/kimi-vscode)
pnpm dev:vscode       # VS Code extension watch build
pnpm vis              # session / replay visual debugger (apps/vis)
pnpm test         # tests
pnpm typecheck    # TypeScript
pnpm lint         # oxlint
pnpm build        # all packages
```

To refresh the curated catalog mirror (maintainers; needs models.dev access):

```sh
pnpm -C apps/kimi-code run catalog:mirror
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Upstream policy: [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code/blob/main/CONTRIBUTING.md).

## Community

- [Issues](https://github.com/jnlk-cn/kimi-code-jnlk/issues) (this fork)
- [Upstream issues](https://github.com/MoonshotAI/kimi-code/issues)
- Security: [SECURITY.md](SECURITY.md)

## Acknowledgements

Our TUI is built on [`pi-tui`](https://github.com/earendil-works/pi-mono/tree/main/packages/tui). Thanks to the authors of `pi-tui`.

## License

Released under the [MIT License](LICENSE).
