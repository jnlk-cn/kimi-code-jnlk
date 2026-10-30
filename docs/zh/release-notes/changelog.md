---
outline: 2
---

# 变更记录

本页记录 Kimi Code CLI 每个版本的变更内容。

## 2.4.0-jnlk.0 (2026-10-30)

已重新基于上游 `MoonshotAI/kimi-code` 2.4.0。Ganymede Code 不在本分支，仍留在 0.25 的 fork 线上。

### 新功能

- 在 DeepSeek 官方 API 上支持 V4 思考档位：可选 `high` 或 `max`，选 `off` 现在会显式关闭思考，而不是省略该字段。
- `/usage` 中为每个 DeepSeek 模型显示预估人民币费用，按 DeepSeek 官方费率与当前峰谷倍率计算。
- 当前模型走 DeepSeek 官方 API 时，`/usage` 会显示 DeepSeek 账户余额。
- 默认 provider 发现改为本 fork 验证过的目录（`catalog/api.json`），不再是完整的 models.dev 目录。想查看全部 provider，执行 `kimi provider catalog list --url https://models.dev/api.json`。
- 提供 `install.sh` / `install.ps1` 与按 tag 触发的发布流水线，产物发布到本 fork 的 GitHub Releases，包含单文件原生产物。

### 变更

- 遥测默认关闭，需在 `config.toml` 中显式开启。依赖旧默认值的安装如需继续上报，请设置 `telemetry = true`。
- `kimi upgrade` 不再把 fork 的原生构建替换为官方版本；升级请使用 fork 的安装脚本。
