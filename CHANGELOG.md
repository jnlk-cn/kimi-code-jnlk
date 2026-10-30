# Changelog

User-facing release notes for the **kimi-code-jnlk** fork. Simplified Chinese: [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md). The docs pages `docs/en/release-notes/changelog.md` and `docs/zh/release-notes/changelog.md` are synced from these two files by `node docs/scripts/sync-changelog.mjs`.

When cutting a release or bumping the fork version, update **both** this file and [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md) — keep version blocks, section headings, and entry counts in sync.

> 中文版变更记录见 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)。发版或 bump 版本时，请同步更新英文与本文件。

## 2.4.0-jnlk.0 (2026-10-30)

Re-based onto upstream `MoonshotAI/kimi-code` 2.4.0. Ganymede Code is not part of this branch; it stays on the 0.25 fork line.

### Features

- Add DeepSeek V4 thinking control on the official API: pick `high` or `max`, and `off` now disables thinking explicitly instead of omitting the field.
- Show an estimated CNY cost next to each DeepSeek model in `/usage`, priced with the official DeepSeek rates and the current peak/off-peak multiplier.
- Show the DeepSeek account balance in `/usage` when the active model runs on the official DeepSeek API.
- Default provider discovery to this fork's verified catalog (`catalog/api.json`) instead of the full models.dev catalog. Run `kimi provider catalog list --url https://models.dev/api.json` to see every provider.
- Ship `install.sh` / `install.ps1` and a tag-driven release workflow for this fork's GitHub Releases, including the native single-binary artifacts.

### Changes

- Turn telemetry off unless `config.toml` opts in. Installs that relied on the old default must set `telemetry = true` to keep sending it.
- Stop `kimi upgrade` from replacing a fork native build with an official release; run the fork installer to upgrade instead.
