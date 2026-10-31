export const FRAGMENT: Readonly<Record<string, string>> = {
  'Usage: /plugins install <local-path-or-zip-url>': '用法：/plugins install <本地路径或 zip 链接>',
  'Install cancelled.': '已取消安装。',
  'Installing plugin from {source}…': '正在从 {source} 安装插件…',
  'Install finished — see details below.': '安装完成 — 详见下方。',
  'Install failed: {error}': '安装失败：{error}',
  'Usage: /plugins mcp enable|disable <id> <server>':
    '用法：/plugins mcp enable|disable <id> <server>',
  'Enabled MCP server {server} for {id}. Run /reload or /new to apply.':
    '已为 {id} 启用 MCP 服务器 {server}。运行 /reload 或 /new 以生效。',
  'Disabled MCP server {server} for {id}. Run /reload or /new to apply.':
    '已为 {id} 禁用 MCP 服务器 {server}。运行 /reload 或 /new 以生效。',
  'Usage: /plugins remove <id>': '用法：/plugins remove <id>',
  'Remove cancelled: {id}.': '已取消移除：{id}。',
  'Unknown /plugins action: {action}. Run /plugins to choose interactively.':
    '未知的 /plugins 操作：{action}。请运行 /plugins 交互选择。',
  '/plugins {action} failed: {error}': '/plugins {action} 执行失败：{error}',
  'Failed to load plugins: {error}': '加载插件失败：{error}',
  '/plugins failed: {error}': '/plugins 执行失败：{error}',
  'Failed to load plugin MCP servers: {error}': '加载插件的 MCP 服务器失败：{error}',
  '/plugins mcp failed: {error}': '/plugins mcp 执行失败：{error}',
  'Failed to install {label}: {error}': '安装 {label} 失败：{error}',
  '{label} installation is still running in the background.': '{label} 仍在后台安装中。',
  '{label} installation failed: {error}': '{label} 安装失败：{error}',
  'Fix the reported error, then install again from /plugins.':
    '请修复上述错误，然后从 /plugins 重新安装。',
  'Grant Accessibility and Screen Recording in System Settings → Privacy & Security.':
    '请在「系统设置 → 隐私与安全性」中授予「辅助功能」与「屏幕录制」权限。',
  '{label} installation did not complete. Check the logs and install again from /plugins.':
    '{label} 安装未完成。请检查日志，然后从 /plugins 重新安装。',
  '{label} is installed.': '{label} 已安装。',
  'Install cancelled: {label}.': '已取消安装：{label}。',
  'Installing or updating {label} from marketplace…': '正在从插件市场安装或更新 {label}…',
  'Some MCP servers are disabled; re-enable with /plugins mcp enable {id} <server>.':
    '部分 MCP 服务器已禁用；可用 /plugins mcp enable {id} <server> 重新启用。',
  'Enabled {id}. Run /reload or /new to apply.': '已启用 {id}。运行 /reload 或 /new 以生效。',
  'Disabled {id}. Run /reload or /new to apply.': '已禁用 {id}。运行 /reload 或 /new 以生效。',
  'MCP servers disabled': 'MCP 服务器已禁用',
  'Opening the {label} page in your browser…': '正在浏览器中打开 {label} 页面…',
  'If it did not open, visit {url}': '若未打开，请访问 {url}',
  'Removed {id}.': '已移除 {id}。',
  'Note: the runtime binaries were left untouched, but GanyCode plugin wiring is disabled for new sessions. Restart GanyCode before reinstalling from the Official tab.':
    '注意：运行时二进制文件未被改动，但新会话已停用该插件的 GanyCode 接线。从 Official 标签页重新安装前请先重启 GanyCode。',
  'Plugins ({count})': '插件（{count}）',
  'Run /new or /reload to apply plugin changes.': '运行 /new 或 /reload 以应用插件变更。',
  '*Two steps left to use Kimi Browser Extension:*': '*还需两步即可使用 Kimi 浏览器扩展：*',
  '1. Install the browser extension': '1. 安装浏览器扩展',
  'Manual installation guide': '手动安装指南',
  '2. Run `/reload` or `/new` to apply it.': '2. 运行 `/reload` 或 `/new` 使其生效。',
  'Note: This plugin consumes your quota.': '注意：该插件会消耗你的额度。',
  'Declares {count} MCP server; enabled by default and configurable from /plugins.':
    '声明 {count} 个 MCP 服务器；默认启用，可在 /plugins 中配置。',
  'Declares {count} MCP servers; enabled by default and configurable from /plugins.':
    '声明 {count} 个 MCP 服务器；默认启用，可在 /plugins 中配置。',
  'Installed {name}{version} {source}': '已安装 {name}{version} {source}',
  'Migrated {name}: {from} → {to}{version}': '已迁移 {name}：{from} → {to}{version}',
  'Updated {name}{version} {source}': '已更新 {name}{version} {source}',
  'from {source}': '来自 {source}',
  'Reload: +{added} -{removed}': '重载：+{added} -{removed}',
  '({count} errors)': '（{count} 个错误）',
  'run /reload or /new to apply': '运行 /reload 或 /new 以生效',
  'Logged in.': '已登录。',
  'Authentication successful, but failed to refresh config: {error}':
    '认证成功，但刷新配置失败：{error}',
  'Already logged in. Model configuration refreshed.': '已处于登录状态。模型配置已刷新。',
  'Login cancelled.': '已取消登录。',
  'Login failed.': '登录失败。',
  'Login cancelled: {error}': '已取消登录：{error}',
  'Login failed: {error}': '登录失败：{error}',
  'Failed to verify API key: {error}': '验证 API 密钥失败：{error}',
  'Hint: If your API key was obtained from Kimi Code, please select "Kimi Code" instead.':
    '提示：如果你的 API 密钥来自 Kimi Code，请改选 “Kimi Code”。',
  'No models available for this platform.': '该平台没有可用模型。',
  'Setup complete: {platform} · {model}': '设置完成：{platform} · {model}',
  'OAuth login': 'OAuth 登录',
  'Nothing to logout.': '当前没有可退出的登录。',
  'Logged out from {label}.': '已退出登录：{label}。',
};
