export const FRAGMENT: Readonly<Record<string, string>> = {
  'Session in use': '会话正在使用中',
  'Session still in use': '会话仍在使用中',
  'If another GanyCode process is still running, taking over may mix up the history.':
    '如果仍有另一个 GanyCode 进程在运行，接管可能会混淆历史记录。',
  Retry: '重试',
  'send again now': '立即重新发送',
  'get your message back': '取回你的消息',
  'Take over': '接管',
  'send your message anyway': '仍然发送你的消息',
  'Failed to take over the session: {error}': '接管会话失败：{error}',

  'Failed to sync MCP server status: {error}': '同步 MCP 服务器状态失败：{error}',
  'MCP server "{name}" connected · {count} tool ({transport})':
    'MCP 服务器「{name}」已连接 · {count} 个工具（{transport}）',
  'MCP server "{name}" connected · {count} tools ({transport})':
    'MCP 服务器「{name}」已连接 · {count} 个工具（{transport}）',
  'MCP server "{name}" failed': 'MCP 服务器「{name}」连接失败',
  'MCP server "{name}" failed: {error}': 'MCP 服务器「{name}」连接失败：{error}',
  'MCP server "{name}" needs OAuth — run /mcp-config login {name}':
    'MCP 服务器「{name}」需要 OAuth —— 运行 /mcp-config login {name}',
  'MCP server "{name}" disabled': 'MCP 服务器「{name}」已禁用',
  'MCP server "{name}" removed': 'MCP 服务器「{name}」已移除',
  'MCP server "{name}" connecting…': 'MCP 服务器「{name}」正在连接…',

  'Turn stopped: provider safety policy blocked the response.':
    '本轮已停止：供应商安全策略拦截了该响应。',
  'Turn stopped: prompt hook blocked the request.': '本轮已停止：prompt hook 拦截了请求。',
  'Turn blocked by a prompt hook': '本轮被 prompt hook 拦截',
  'Provider safety policy blocked the response.': '供应商安全策略拦截了该响应。',
  'The model output was filtered ({reason}).': '模型输出被过滤（{reason}）。',
  'Model hit max_tokens — tool call was truncated before it could run.':
    '模型触发 max_tokens —— 工具调用被截断，未能执行。',
  'Model hit max_tokens — no tool call was emitted.': '模型触发 max_tokens —— 未发出任何工具调用。',
  'If this limit is wrong for your model, set `max_output_size` on the model alias in your kimi-code config.':
    '如果这个上限不适合你的模型，请在 kimi-code 配置中为对应模型别名设置 `max_output_size`。',
  'Interrupted by user': '已被用户中断',
  'reached per-turn step limit (max_steps)': '已达到单轮步骤上限（max_steps）',
  'step interrupted ({reason})': '步骤被中断（{reason}）',
  'Tower mode ended — a goal was activated': 'tower 模式已结束 —— 目标已被激活',

  'Failed to read upcoming goals: {error}': '读取后续目标失败：{error}',
  'Queued goal started, but could not be removed from the queue: {error}':
    '排队的目标已启动，但无法从队列中移除：{error}',
  'Queued goal could not be restored: {error}': '排队的目标无法恢复：{error}',
  'Queued goal could not be cancelled: {error}': '排队的目标无法取消：{error}',
  'Goal blocked.': '目标已阻塞。',
  'The next queued goal will start only after this goal is complete.':
    '下一个排队的目标将在当前目标完成后启动。',

  'Turn failed': '本轮执行失败',
  'Request failed': '请求失败',
  'Subagent failed': '子代理执行失败',
  'Subagent': '子代理',
  'Background agent was lost': '后台代理已丢失',
  'Approval required': '需要审批',
  'Answer required': '需要回答',
};
