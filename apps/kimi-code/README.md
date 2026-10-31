# GanyCode

> The Starting Point for Next-Gen Agents

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Docs](https://img.shields.io/badge/docs-online-blue)](https://moonshotai.github.io/kimi-code/en/)

## What is GanyCode

GanyCode is an AI coding agent that runs in your terminal. It can read and edit code, run shell commands, search files, fetch web pages, and choose the next step based on the feedback it receives. It works out of the box with DeepSeek V4 on the official API and can also be configured to use other compatible providers.

This build is the community fork of Kimi Code CLI. See the repository README for what differs from upstream.

## Install

The recommended install path is the fork installer. It does not require Node.js to be installed first.

- **macOS / Linux**:

```sh
curl -fsSL https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/jnlk/2.4.0/install.sh | bash
```

- **Windows (PowerShell)**:

```powershell
irm https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/jnlk/2.4.0/install.ps1 | iex
```

> On Windows, install [Git for Windows](https://gitforwindows.org/) before first launch because GanyCode uses the bundled Git Bash as its shell environment. If Git Bash is installed in a custom location, set `KIMI_SHELL_PATH` to the absolute path of `bash.exe`.

Then run it with a new Terminal session:

```sh
ganycode --version
```

GanyCode installs as `ganycode` into `~/.ganycode`, so it never replaces an existing Kimi CLI. The npm package `@moonshot-ai/kimi-code` is published by upstream and is not this fork's install path.

## Quick Start

Open a project and start the interactive UI:

```sh
cd your-project
ganycode
```

On first launch, run `/login` inside GanyCode and choose either the managed Kimi Code OAuth flow or a Kimi Platform API key, or use `/provider` to configure any other provider. After login, try a first task:

```
Take a look at this project and explain the main directories.
```

## Key Features

- **Single-binary distribution.** Install with one command — no Node.js setup, no PATH gymnastics, no global module conflicts.
- **Blazing-fast startup.** The TUI is ready in milliseconds, so opening a session never feels heavy.
- **Polished TUI.** A carefully tuned interface designed for long, focused agent sessions.
- **Video input.** Drop a screen recording or demo clip into the chat — let the agent watch instead of typing out what's hard to describe in words.
- **AI-native MCP configuration.** Add, edit, and authenticate Model Context Protocol servers conversationally via `/mcp-config` — no hand-editing JSON.
- **Subagents for focused, parallel work.** Dispatch built-in `coder`, `explore`, and `plan` subagents in isolated context windows; the main conversation stays clean.
- **Lifecycle hooks.** Run local commands at key points — gate risky tool calls, audit decisions, fire desktop notifications, wire into your own automation.

## Documentation

- Full docs: https://moonshotai.github.io/kimi-code/en/
- 中文文档: https://moonshotai.github.io/kimi-code/zh/
- Getting Started: https://moonshotai.github.io/kimi-code/en/guides/getting-started

## Repository & Issues

- Source: https://github.com/jnlk-cn/kimi-code-jnlk
- Issues: https://github.com/jnlk-cn/kimi-code-jnlk/issues
- Security: see SECURITY.md in this repository

## License

MIT
