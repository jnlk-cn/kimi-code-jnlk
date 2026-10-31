export const ZH_CN_DICTIONARY: Readonly<Record<string, string>> = {
  // Slash commands
  'Set the terminal UI theme': '设置终端界面主题',
  'Set the reply language (auto | zh-CN | en)': '设置回复语言（auto | zh-CN | en）',
  'Set the preferred shell for the agent (a hint, not enforced)':
    '设置 Agent 偏好的 Shell（仅为建议，不强制）',

  // Language dialog
  'Reply language': '回复语言',
  Auto: '自动',
  'Reply in whatever language you write in.': '用你正在使用的语言回复。',
  'Reply in Simplified Chinese; code, commands, and paths stay as written.':
    '用简体中文回复；代码、命令与路径保持原样。',
  'Reply in English.': '用英文回复。',

  // Terminal dialog
  'Preferred shell (a hint for the agent, not enforced)': '偏好的 Shell（给 Agent 的建议，不强制）',
  Default: '默认',
  'Let the agent pick the shell it works with best.': '由 Agent 自行选择最合适的 Shell。',
  'Prefer bash (Git Bash on Windows) for shell commands.': '优先使用 bash（Windows 上为 Git Bash）。',
  'Prefer the built-in powershell.exe for shell commands.': '优先使用系统自带的 powershell.exe。',
  'Prefer pwsh for shell commands.': '优先使用 PowerShell 7（pwsh）。',

  // Status messages
  'TUI config reloaded.': '界面配置已重新加载。',
  'Shell preference cleared; the agent picks the shell itself.':
    '已清除 Shell 偏好，由 Agent 自行选择。',

  // Usage panel
  'Session usage': '本次会话用量',
  'Context window': '上下文窗口',
  'DeepSeek balance': 'DeepSeek 余额',
  Total: '合计',
  Granted: '赠送',
  'Topped up': '充值',

  // Command descriptions (must cover every entry in the command registry)
  'Ask When Needed mode: routine edits and commands run automatically; risky actions, questions, and plans still ask.':
    '按需确认模式：常规编辑与命令自动执行；风险操作、提问与计划仍会询问。',
  'Never Ask mode: everything runs and is decided automatically; only plans in Plan mode wait for your review.':
    '从不询问模式：全部自动执行与决策；只有计划模式下的方案会等你确认。',
  'Select permission mode': '选择权限模式',
  'Open TUI settings': '打开界面设置',
  'Toggle plan mode': '切换计划模式',
  'Toggle swarm mode or run one task in swarm mode': '切换集群模式，或在集群模式下执行一个任务',
  'Report tower status, toggle tower mode, or turn it on with a base branch': '查看 tower 状态、切换 tower 模式，或指定基线分支开启',
  'Switch LLM model': '切换模型',
  'Configure the secondary model for subagents': '配置子代理使用的次要模型',
  'Switch thinking effort': '切换思考档位',
  'Manage AI providers (add / delete / refresh)': '管理 AI 供应商（新增 / 删除 / 刷新）',
  'Ask a forked side agent a question': '向旁支代理提一个问题',
  'Show available commands and shortcuts': '查看可用命令与快捷键',
  'Start a fresh session in the current environment': '在当前环境开启新会话',
  'Browse and resume sessions': '浏览并恢复会话',
  'Browse background tasks': '浏览后台任务',
  'Show MCP server status': '查看 MCP 服务器状态',
  'Manage plugins': '管理插件',
  'Add or list an additional workspace directory': '添加或列出额外的工作区目录',
  'Manage experimental features': '管理实验性功能',
  'Reload session and apply config.toml settings plus tui.toml UI preferences':
    '重新加载会话，并应用 config.toml 与 tui.toml 的设置',
  'Reload only tui.toml UI preferences': '只重新加载 tui.toml 界面偏好',
  'Compact the conversation context': '压缩对话上下文',
  'Start or manage an autonomous goal': '开始或管理自主目标',
  'Analyze the codebase and generate AGENTS.md': '分析代码库并生成 AGENTS.md',
  'Fork the current session into a copy without switching to it': '把当前会话复制一份，但不切换过去',
  'Set or show session title': '设置或查看会话标题',
  'Show session tokens + context window + plan quotas': '查看会话 token、上下文窗口与套餐额度',
  'Show current session and runtime status': '查看当前会话与运行状态',
  'Send feedback to make Kimi Code better': '发送反馈帮助改进 Kimi Code',
  'Withdraw the last prompt from the transcript': '撤回上一条提问',
  'Set the external editor for Ctrl-G': '设置 Ctrl-G 使用的外部编辑器',
  'Log out of a configured provider': '退出已配置的供应商登录',
  'Select a platform and authenticate': '选择平台并完成认证',
  'Export current session as a Markdown file': '把当前会话导出为 Markdown 文件',
  'Export current session as a debug ZIP archive': '把当前会话导出为调试 ZIP 包',
  'Import recent Claude Code and Codex sessions': '导入最近的 Claude Code 与 Codex 会话',
  'Copy the last assistant message to the clipboard': '复制最后一条助手回复',
  'Open the current session in the Web UI by starting a new server': '启动服务并在 Web 界面打开当前会话',
  'Open the Kimi Code desktop app page in your browser': '在浏览器中打开 Kimi Code 桌面端页面',
  'Open the current session through Kimi Remote Control': '通过 Kimi Remote Control 打开当前会话',
  'Exit the application': '退出应用',
  'Show version information': '查看版本信息',

  // Help panel
  'Keyboard shortcuts': '键盘快捷键',
  'Slash commands': '斜杠命令',
  'Sure, Kimi is ready to help! Just send a message to get started.':
    '好的，随时可以开始——直接发消息即可。',
  'Edit in external editor ($VISUAL / $EDITOR)': '用外部编辑器打开（$VISUAL / $EDITOR）',
  'Toggle tool output / compaction summary expansion': '展开或收起工具输出 / 压缩摘要',
  'Steer — inject a follow-up during streaming': '插话——在流式输出中追加指令',
  'Insert newline': '插入换行',
  'Interrupt stream / clear input': '中断输出 / 清空输入',
  'Exit (on empty input)': '退出（输入为空时）',
  'Close dialogs / interrupt streaming': '关闭对话框 / 中断输出',
  'Browse input history': '浏览输入历史',
  Submit: '发送',

  'Show the current goal': '查看当前目标',
  'Pause the active goal': '暂停当前目标',
  'Resume a paused goal': '继续已暂停的目标',
  'Cancel and remove the current goal': '取消并移除当前目标',
  'Replace the current goal with a new objective': '用新目标替换当前目标',
  'Queue an upcoming goal': '排队一个后续目标',
  'Manage upcoming goals': '管理排队的后续目标',
  'Turn swarm mode on': '开启集群模式',
  'Turn swarm mode off': '关闭集群模式',
  'Tear down the tower': '拆除 tower',
  'Turn tower mode on': '开启 tower 模式',
  'Turn tower mode off': '关闭 tower 模式',
  'Show configured additional workspace directories': '查看已配置的额外工作区目录',
};
