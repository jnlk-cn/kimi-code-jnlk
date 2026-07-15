# Upstream attribution

This project is a fork of [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code).

## License

The fork is distributed under the same [MIT License](LICENSE) as upstream. The copyright notice in `LICENSE` must be preserved in all copies and substantial portions of the software.

## Relationship to upstream

- **Upstream repository**: https://github.com/MoonshotAI/kimi-code
- **This fork**: https://github.com/jnlk-cn/kimi-code-jnlk
- **Maintainer**: community fork (`jnlk-cn`), not Moonshot AI

User-facing fork release notes live in [CHANGELOG.md](CHANGELOG.md) at the repository root (synced to `docs/en/release-notes/changelog.md`). Package-level changesets history is in [apps/kimi-code/CHANGELOG.md](apps/kimi-code/CHANGELOG.md).

## Installing from this fork

**Recommended:** use the one-line install script (no Node.js required):

```sh
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.sh | bash
```

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/jnlk-cn/kimi-code-jnlk/main/install.ps1 | iex
```

The script downloads the latest GitHub Release, verifies checksums, and installs to `~/.kimi-code/bin`. You can also build from source in this repository, or download release assets manually from the [Releases](https://github.com/jnlk-cn/kimi-code-jnlk/releases) page.

The official `kimi` install scripts at `code.kimi.com` and the npm package `@moonshot-ai/kimi-code` point at upstream unless you configure otherwise.
