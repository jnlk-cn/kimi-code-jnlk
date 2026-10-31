export const FRAGMENT: Readonly<Record<string, string>> = {
  'Cannot undo while streaming — press Esc or Ctrl-C first.':
    '流式输出中无法撤销——请先按 Esc 或 Ctrl-C。',
  'Usage: /undo [count], where count is a positive integer.':
    '用法：/undo [count]，其中 count 为正整数。',
  'Nothing to undo.': '没有可撤销的内容。',
  'Nothing to undo after the last compaction.': '上次压缩之后没有可撤销的内容。',
  'Loaded updates from another client. Review and run /undo again.':
    '已从另一个客户端载入更新，请确认后再次运行 /undo。',
  'Failed to undo: {error}': '撤销失败：{error}',
  'Cannot undo {requested}; only {max} can be undone in the active context.':
    '无法撤销 {requested}；当前上下文中只能撤销 {max}。',
  'Cannot undo {requested}; only {max} can be undone in the active context after the last compaction.':
    '无法撤销 {requested}；上次压缩之后，当前上下文中只能撤销 {max}。',
  '{count} prompt': '{count} 条提问',
  '{count} prompts': '{count} 条提问',
  'User message': '用户消息',
  'User message ({count} image)': '用户消息（{count} 张图片）',
  'User message ({count} images)': '用户消息（{count} 张图片）',
  'Skill: unknown': '技能：未知',

  'Everything runs and is decided automatically; only plans in Plan mode wait for your review.':
    '全部自动执行与决策；只有计划模式下的方案会等你确认。',
};
