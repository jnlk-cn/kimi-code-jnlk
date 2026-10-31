export const FRAGMENT: Readonly<Record<string, string>> = {
  'Approve once': '允许一次',
  'Approve for this session': '本次会话内允许',
  'Approve': '允许',
  'Reject': '拒绝',
  'Reject with feedback': '拒绝并给出反馈',
  'Revise': '要求修改',
  'Start a goal?': '要启动目标吗？',
  'Start goal: {objective}': '启动目标：{objective}',
  'Done when: {criterion}': '完成条件：{criterion}',
  'Stop task {id}: {description}': '停止任务 {id}：{description}',
  'stop task: {target}': '停止任务：{target}',
  'edit {path}': '编辑 {path}',
  'spawn {name}': '启动子代理 {name}',
  'agent': '子代理',
  'invoke skill {name}': '调用技能 {name}',
  'fetch {url}': '抓取 {url}',
  'search: {query}': '搜索：{query}',
  'update todo list ({count} items)': '更新待办列表（{count} 项）',
  '{status} task {id}: {description}': '{status} 任务 {id}：{description}',

  'Switch to Never Ask and start': '切换到「从不询问」并开始',
  'Switch to Ask When Needed and start': '切换到「按需询问」并开始',
  'Keep Ask When Needed and start': '保持「按需询问」并开始',
  'Start in Always Ask': '以「每次询问」模式开始',
  'Do not start': '不启动',
  'Return to the input box with your goal command.': '回到输入框，命令仍然保留。',
  'Best if you want Kimi Code to keep working while you are away. Tools are approved automatically and questions are skipped; only plans in Plan mode wait for your review.':
    '适合你离开时希望 GanyCode 持续工作的场景。工具会自动授权，提问会被跳过；只有计划模式下的方案会等你确认。',
  'Best for swarm tasks. Tools are approved automatically and questions are skipped; only plans in Plan mode wait for your review.':
    '适合集群任务。工具会自动授权，提问会被跳过；只有计划模式下的方案会等你确认。',
  'Tools are approved automatically. Kimi Code may still ask you questions.':
    '工具会自动授权，GanyCode 仍可能向你提问。',
  'Tools stay approved automatically. Kimi Code may still ask you questions.':
    '工具保持自动授权，GanyCode 仍可能向你提问。',
  'Keep approvals on. Kimi Code will ask before risky actions, so the goal may stop and wait for you.':
    '保持审批开启。GanyCode 会在风险操作前询问你，因此目标可能停下来等待你。',
  'Keep approvals on. Kimi Code may stop and wait for you during the swarm task.':
    '保持审批开启。集群任务进行期间，GanyCode 可能停下来等待你。',

  'Start a goal with approvals on?': '在开启审批的情况下启动目标吗？',
  'Start a goal in Ask When Needed mode?': '在「按需询问」模式下启动目标吗？',
  'Start a swarm task with approvals on?': '在开启审批的情况下启动集群任务吗？',
  'Always Ask mode asks you before Kimi Code runs commands, edits files, or takes other risky actions, and is not suitable for unattended goal work.':
    '「每次询问」模式会在 GanyCode 执行命令、编辑文件或进行其他风险操作前询问你，不适合无人值守的目标任务。',
  'You can go back without losing your command.': '你可以返回，命令不会丢失。',
  'Ask When Needed mode approves tools automatically, but can still stop for questions.':
    '「按需询问」模式会自动授权工具，但仍可能停下来向你提问。',
  'Switch to Never Ask if you want questions skipped during goal work.':
    '如果你希望目标执行期间跳过提问，请切换到「从不询问」。',
  'Always Ask mode asks you before Kimi Code runs commands, edits files, or takes other risky actions, and can block swarm work while agents are running.':
    '「每次询问」模式会在 GanyCode 执行命令、编辑文件或进行其他风险操作前询问你，代理运行期间可能阻塞集群任务。',

  '↑↓ navigate · Enter select · Esc cancel': '↑↓ 移动 · Enter 选择 · Esc 取消',
  '↑↓ navigate · Enter select · Esc exit': '↑↓ 移动 · Enter 选择 · Esc 退出',
  'shift+↑/↓ scroll': 'shift+↑/↓ 滚动',

  'Trust this folder?': '要信任这个文件夹吗？',
  'Trust and continue': '信任并继续',
  'Exit': '退出',
  'Trust is remembered for this folder, including future project config changes.':
    '对此文件夹的信任会被记住，包括今后对项目配置的改动。',
  'Tool approvals follow your permission settings.': '工具审批遵循你设置的权限模式。',
  'Enlarge terminal to review sources. Esc exit.': '请调大终端窗口以查看来源。按 Esc 退出。',
  '←→ page · {page} / {total}': '←→ 翻页 · {page} / {total}',
  'Start {count} MCP server automatically': '自动启动 {count} 个 MCP 服务器',
  'Start {count} MCP servers automatically': '自动启动 {count} 个 MCP 服务器',
  'Access {count} folder outside this project': '访问本项目之外的 {count} 个文件夹',
  'Access {count} folders outside this project': '访问本项目之外的 {count} 个文件夹',
  'Config: {paths}': '配置：{paths}',
  'Load project {subject}': '加载项目{subject}',
  'instructions and agent profiles': '指令与代理配置',
  'instructions': '指令',
  'agent profiles': '代理配置',
  'Check: {paths}': '检查：{paths}',
  'No project integrations or instructions to activate.': '没有需要启用的项目集成或指令。',

  'Switch model?': '要切换模型吗？',
  'Switch effort from {from} to {to}?': '要把思考档位从 {from} 切换到 {to} 吗？',
  'Compact and continue': '压缩上下文后继续',
  'Lower cost and better output quality when continuing this session':
    '继续本会话时成本更低、输出质量更好',
  'Continue as-is': '保持原样继续',
  'Output quality may suffer · cache loss may increase token usage':
    '输出质量可能下降 · 缓存失效可能增加 token 消耗',
  'Cancel': '取消',
  'Stay on the current model': '保持当前模型',
  'Stay on the current effort': '保持当前思考档位',
  'Confirm switch': '确认切换',
};
