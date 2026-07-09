# Kimi Code CLI (kimi-code-jnlk)

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Fork](https://img.shields.io/badge/upstream-MoonshotAI%2Fkimi--code-lightgrey)](https://github.com/MoonshotAI/kimi-code) <br>
[Documentation](https://moonshotai.github.io/kimi-code/en/) · [Issues](https://github.com/jnlk-cn/kimi-code-jnlk/issues) · [中文](README.zh-CN.md)

> **Fork notice**
>
> This repository (**kimi-code-jnlk**) is a community fork of [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code), maintained independently under the [MIT License](LICENSE). It is **not** affiliated with, endorsed by, or supported by Moonshot AI.
>
> - **Upstream**: use the official project for the default release channel, docs site, and marketplace plugins.
> - **This fork**: community patches on top of upstream; see [What this fork changes](#what-this-fork-changes) below. Install from this repo only if you intend to use this fork's builds.
> - **Support**: report issues in [jnlk-cn/kimi-code-jnlk](https://github.com/jnlk-cn/kimi-code-jnlk/issues); for upstream behavior, refer to MoonshotAI/kimi-code.
> - **License**: retain the original MIT copyright notice in `LICENSE`; see also [UPSTREAM.md](UPSTREAM.md).

![Demo of using Kimi Code](./docs/media/intro.gif)

## What is Kimi Code CLI

Kimi Code CLI is an AI coding agent that runs in your terminal — it can read and edit code, run shell commands, search files, fetch web pages, and choose the next step based on the feedback it receives. It works out of the box with Moonshot AI’s Kimi models and can also be configured to use other compatible providers.

## What this fork changes

This fork layers community patches on upstream **0.23.2** (current release **0.24.1**). If you use the official [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code), the differences below may not be included yet.

### DeepSeek V4 official API

Upstream support for DeepSeek V4 (`deepseek-v4-pro`, `deepseek-v4-flash`) against the **official API** (`api.deepseek.com`) is still incomplete. This fork focuses on:

- **Wire compatibility**: via the `openai` provider, correctly sends `thinking.type` and `reasoning_effort`, round-trips `reasoning_content` across tool-call turns, and maps the UI `max` effort tier to DeepSeek's wire values.
- **Catalog and config**: parses `reasoning_options` from the model catalog, surfaces `support_efforts` / `default_effort`, and avoids incorrectly clamping Thinking to `off` when tool-bound think history is present.
- **Docs**: the in-repo [provider configuration](docs/en/configuration/providers.md#openai) includes a `config.toml` example for `api.deepseek.com` (the upstream docs site may not be synced yet).

### Windows and macOS development and testing

- Fixes `agent-core` test failures on Windows (path assertions, cross-platform hook blocking, large-image compression timeouts).
- Re-enables the `test-windows` CI job for more reliable Windows development and contributions.
- Adds a `test-macos` CI job and macOS validation in the fork release workflow.

### CLI updates and DeepSeek footer telemetry (0.24.1)

- **One-click updates**: when `[upgrade].auto_install` is off, the install prompt runs the displayed command, verifies the installed version, supports Windows native installs, and shows clearer manual guidance when the install source cannot be detected.
- **Footer telemetry**: when using the official DeepSeek API, the footer shows session token usage, estimated cost (CNY), cache hit rate, and account balance when available.

### Distribution

- Ships through this repo's [GitHub Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases) and one-line install scripts (`install.sh` / `install.ps1`).
- Does **not** use the official `code.kimi.com` CDN or the npm package `@moonshot-ai/kimi-code`.

See [apps/kimi-code/CHANGELOG.md](apps/kimi-code/CHANGELOG.md) (0.24.1 entry) for the full list. If you only need official Kimi models and the upstream release channel, stick with the upstream project.

## Install

This fork is **not** distributed through the official `code.kimi.com` install scripts or the npm package `@moonshot-ai/kimi-code`. Use one of the methods below.

### Install script (recommended)

The script fetches the latest [GitHub Release](https://github.com/jnlk-cn/kimi-code-jnlk/releases/latest), verifies the checksum, and installs `kimi` to `~/.kimi-code/bin` (or `%USERPROFILE%\.kimi-code\bin` on Windows), then updates your `PATH`. **No Node.js required.**

- **macOS / Linux**:

```sh
curl -fsSL https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.sh | bash
```

- **Windows (PowerShell)**:

```powershell
irm https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.ps1 | iex
```

> On Windows, install [Git for Windows](https://gitforwindows.org/) before first launch — Kimi Code CLI uses Git Bash as its shell environment. If Git Bash is in a custom location, set `KIMI_SHELL_PATH` to the absolute path of `bash.exe`.

Pin a specific release (replace the tag with one from [Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases), e.g. `v0.24.1-jnlk`):

```sh
KIMI_VERSION=v0.24.1-jnlk curl -fsSL https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.sh | bash
```

```powershell
$env:KIMI_VERSION = 'v0.24.1-jnlk'
irm https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.ps1 | iex
```

Open a new terminal and verify:

```sh
kimi --version
```

### Manual download

Download the archive for your platform from [GitHub Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases/latest) (`kimi-code-<os>-<arch>.zip`), extract it, and put the `kimi` binary on your `PATH`.

| Platform | Archive name |
|---|---|
| macOS (Apple Silicon) | `kimi-code-darwin-arm64.zip` |
| macOS (Intel) | `kimi-code-darwin-x64.zip` |
| Linux (x64) | `kimi-code-linux-x64.zip` |
| Linux (arm64) | `kimi-code-linux-arm64.zip` |
| Windows (x64) | `kimi-code-win32-x64.zip` |
| Windows (arm64) | `kimi-code-win32-arm64.zip` |

Example on macOS (Apple Silicon):

```sh
VERSION=v0.24.1-jnlk
curl -fsSL -o kimi.zip \
  "https://github.com/jnlk-cn/kimi-code-jnlk/releases/download/${VERSION}/kimi-code-darwin-arm64.zip"
unzip kimi.zip
install -m 755 kimi "$HOME/.local/bin/kimi"   # or another directory on your PATH
kimi --version
```

Pick the archive name from the table above for your OS and CPU.

### Build from source

Requirements: Node.js ≥ 24.15.0, pnpm 10.33.0.

```sh
git clone https://github.com/jnlk-cn/kimi-code-jnlk.git
cd kimi-code-jnlk
pnpm install
pnpm run build
node apps/kimi-code/dist/main.mjs --version
```

To run in dev mode without a full native bundle:

```sh
pnpm dev:cli
```

To expose the built CLI as `kimi` on your PATH (optional):

```sh
pnpm -C apps/kimi-code link --global
kimi --version
```

### Official upstream install

If you want the **official** Moonshot AI release channel (not this fork), use the upstream project instead:

- Install scripts: [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code)
- Docs: [Getting Started](https://moonshotai.github.io/kimi-code/en/guides/getting-started)

## Quick Start

Open a project and start the interactive UI:

```sh
cd your-project
kimi
```

On first launch, run `/login` inside Kimi Code CLI and choose either Kimi Code OAuth or a Moonshot AI Open Platform API key. After login, try your first task:

```
Take a look at this project and explain its main directories.
```

## Key Features

- **Single-binary distribution.** Install with one command: no Node.js setup, PATH gymnastics, or global module conflicts.
- **Blazing-fast startup.** The TUI is ready in milliseconds, so starting a session never feels heavy.
- **Purpose-built TUI.** A carefully tuned interface, optimized end to end for long, focused agent sessions.
- **Video input.** Drop a screen recording or demo clip into the chat and let the agent watch what is hard to describe in words — turn a reference clip into a LUT, a long video into a short, a screen recording into working code, and more.
- **AI-native MCP configuration.** Add, edit, and authenticate Model Context Protocol servers conversationally with `/mcp-config`, without hand-editing JSON.
- **Rich plugin ecosystem.** Install skills, MCP servers, and data sources from the marketplace or any GitHub repo, with each install's trust level surfaced up front.
- **Subagents for focused, parallel work.** Dispatch built-in `coder`, `explore`, and `plan` subagents in isolated contexts while keeping the main conversation clean.
- **Lifecycle hooks.** Run local commands at key points to gate risky tool calls, audit decisions, trigger desktop notifications, or connect to your own automation.
- **Editor & IDE integration (ACP).** Drive a Kimi Code CLI session straight from Zed, JetBrains, or any [Agent Client Protocol](https://agentclientprotocol.com/) client with `kimi acp`.

## Use it in your editor (ACP)

Kimi Code CLI speaks the [Agent Client Protocol](https://agentclientprotocol.com/), so ACP-compatible editors and IDEs (Zed, JetBrains, …) can drive a session over stdio. Log in once, then point your editor at the `kimi acp` subcommand — no extra login needed.

For Zed, add this to `~/.config/zed/settings.json`:

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

Then open a new conversation in Zed's Agent panel. See [Using in IDEs](https://moonshotai.github.io/kimi-code/en/guides/ides) for JetBrains setup and troubleshooting, and the [`kimi acp` reference](https://moonshotai.github.io/kimi-code/en/reference/kimi-acp) for the full capability matrix.

## Docs

- [Getting Started](https://moonshotai.github.io/kimi-code/en/guides/getting-started)
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
pnpm dev:cli    # run the CLI in dev mode
pnpm test       # run tests
pnpm typecheck  # TypeScript check
pnpm lint       # oxlint
pnpm build      # build all packages
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide. Upstream contribution policy lives at [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code/blob/main/CONTRIBUTING.md).

## Community

- [Issues](https://github.com/jnlk-cn/kimi-code-jnlk/issues) (this fork)
- [Upstream issues](https://github.com/MoonshotAI/kimi-code/issues)
- For security vulnerabilities, see [SECURITY.md](SECURITY.md).

## Acknowledgements

Our TUI is built on top of [`pi-tui`](https://github.com/earendil-works/pi-mono/tree/main/packages/tui). We thank the authors of `pi-tui` for their valuable work.

## License

Released under the [MIT License](LICENSE).
