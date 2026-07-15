# Kimi VS Code（路线 B）

当前版本：**0.1.0**。完整变更见 [CHANGELOG.md](CHANGELOG.md)。

VS Code / Cursor 扩展骨架：作为 ACP Client，spawn `kimi acp` 子进程，侧边栏 Webview Chat 最小可用。

## 边界

- 允许：`@agentclientprotocol/sdk` + 子进程 `kimi acp`
- 禁止：直接依赖 `@moonshot-ai/agent-core` 或进程内嵌 SDK

## 前置条件

1. 本机能运行 `kimi` CLI（`pnpm -C apps/kimi-code` 构建后，或全局安装）
2. 已登录：`kimi` / `/login`（ACP 会走同一套凭据）
3. Node.js ≥ 24.15.0，pnpm 10.33.0

可配置：

- `kimi.cliPath`：CLI 路径，默认 `kimi`
- `kimi.workDir`：会话 cwd；空则用当前工作区根目录

## 本地调试（F5）

在**仓库根**打开 Cursor / VS Code：

```sh
pnpm install
pnpm run build:vscode
# 开发时可持续编译：
pnpm run dev:vscode
```

然后用扩展开发主机启动（任选其一）：

1. **命令面板**：`Debug: Start Debugging`，若已把根 `.vscode` 配好；或
2. **手动**：

```sh
# 用 code/cursor CLI 打开 Extension Development Host
code --extensionDevelopmentPath="$(pwd)/apps/kimi-vscode"
# 或
cursor --extensionDevelopmentPath="$(pwd)/apps/kimi-vscode"
```

本目录下的 `.vscode/launch.json` 也可在「以 `apps/kimi-vscode` 为根打开」时直接 F5。

打开侧边栏 **Kimi → Chat**，发一条消息；回复通过 ACP `session/update` 流式显示。

## Reverse-RPC（MVP stub）

| 方法 | 行为 |
| --- | --- |
| `fs/read_text_file` | 读工作区文件 |
| `fs/write_text_file` | 写工作区文件 |
| `session/request_permission` | 自动选 `allow_once`（并 `showInformationMessage`） |

## 打包（可选）

```sh
pnpm run build:vscode
# npx @vscode/vsce package --no-dependencies
```

## 后续阶段（未做）

- 真正的审批 UI / 多选项
- Diff 预览、会话列表、续聊
- Marketplace 发布与签名
