export const FRAGMENT: Readonly<Record<string, string>> = {
  'Failed to start /btw: {error}': '启动 /btw 失败：{error}',

  'No assistant message to copy.': '没有可复制的助手消息。',
  'Copied to clipboard ({count} characters).': '已复制到剪贴板（{count} 个字符）。',
  'Copied via terminal escape sequence (unverified, {count} characters).':
    '已通过终端转义序列复制（无法验证，{count} 个字符）。',
  'Failed to copy to clipboard: {error}': '复制到剪贴板失败：{error}',

  '{url} — opened in your browser': '{url} — 已在浏览器中打开',

  'TUI config reloaded.': 'TUI 配置已重新加载。',
  'Session reloaded.': '会话已重新加载。',
  'Environment and TUI config reloaded; no active session.': '环境与 TUI 配置已重新加载；当前没有活动会话。',

  'No additional directories configured.': '未配置额外目录。',
  'Additional directories:': '额外目录：',
  'Add directory to workspace: {path}': '将目录添加到工作区：{path}',
  '↑↓ navigate · Enter confirm · Esc cancel': '↑↓ 选择 · Enter 确认 · Esc 取消',
  'Yes, for this session': '是，仅本次会话',
  'Yes, and remember this directory': '是，并记住此目录',
  No: '否',
  'Did not add {path} as a working directory.': '未将 {path} 添加为工作目录。',
  'Added workspace directory:\n  {path}\n  Remembered in the workspace registry':
    '已添加工作区目录：\n  {path}\n  已记录到工作区注册表',
  'Added workspace directory:\n  {path}\n  For this session only':
    '已添加工作区目录：\n  {path}\n  仅本次会话有效',

  'Swarm task not started.': '集群任务未启动。',
  'Swarm mode not enabled.': '集群模式未启用。',
  'Swarm mode is already on.': '集群模式已开启。',
  'Swarm mode is already off.': '集群模式已关闭。',
  'Failed to set permission mode: {error}': '设置权限模式失败：{error}',
  'Permission mode: {mode}': '权限模式：{mode}',
  'Failed to enable swarm mode: {error}': '开启集群模式失败：{error}',
  'Failed to disable swarm mode: {error}': '关闭集群模式失败：{error}',
  "High usage: Swarm is built for large parallel jobs and can use many times the tokens of a normal task. Start small, and run /swarm off when you're done.":
    '高用量提示：集群模式面向大规模并行任务，token 消耗可能是普通任务的数倍。请从小任务开始，完成后运行 /swarm off。',

  'Tower status': 'Tower 状态',
  'Tower base: {base}': 'Tower 基准分支：{base}',
  'Tower mode: ON': 'Tower 模式：开启',
  'Tower mode: OFF': 'Tower 模式：关闭',
  'Tower mode: ON (base: {base})': 'Tower 模式：开启（基准分支：{base}）',
  'Tower mode is already on.': 'Tower 模式已开启。',
  'Tower mode is already off.': 'Tower 模式已关闭。',
  'Tower mode could not be enabled — another session owns this workspace tower, or the experiment is off / was just turned on and needs a restart.':
    '无法开启 Tower 模式 — 另一个会话占用了该工作区的 tower，或实验开关已关闭／刚开启，需要重启。',
  'Tower mode could not be disabled.': '无法关闭 Tower 模式。',
  'Failed to read tower status: {error}': '读取 tower 状态失败：{error}',
  'Failed to enable tower mode: {error}': '开启 tower 模式失败：{error}',
  'Failed to disable tower mode: {error}': '关闭 tower 模式失败：{error}',

  'Session:  ': '会话：  ',
};
