export const FRAGMENT: Readonly<Record<string, string>> = {
  'A /compact is already queued.': '/compact 已在队列中。',
  'Invalid slash command: /{command}': '无效的斜杠命令：/{command}',
  'Unknown slash command: /{command}': '未知的斜杠命令：/{command}',
  'Provide a goal objective, e.g. `/goal Ship feature X`.': '请提供目标内容，例如 `/goal 上线功能 X`。',
  'Goal objective is too long (max {max} characters). Put long content in a file and reference the file path.':
    '目标内容过长（最多 {max} 个字符）。请把长内容写入文件并引用文件路径。',
  'Provide an upcoming goal objective, e.g. `/goal next Ship feature X`, or use `/goal next manage`.':
    '请提供后续目标内容，例如 `/goal next 上线功能 X`，或使用 `/goal next manage`。',
  'Goal objective is too long ({length}/{max} characters); put long content in a file and reference the file path.':
    '目标内容过长（{length}/{max} 个字符）；请把长内容写入文件并引用文件路径。',
  'Failed to inspect current goal: {error}': '读取当前目标失败：{error}',
  'No active goal. Starting this goal now.': '当前没有进行中的目标，现在开始这个目标。',
  'Failed to load upcoming goals: {error}': '加载后续目标失败：{error}',
  'Failed to update upcoming goals: {error}': '更新后续目标失败：{error}',
  'Failed to update upcoming goal: {error}': '更新后续目标失败：{error}',
  'Queued goal no longer exists.': '排队的目标已不存在。',
  'Goal not started.': '目标未开始。',
  'Permission mode: {mode}': '权限模式：{mode}',
  'Failed to set permission mode: {error}': '设置权限模式失败：{error}',
  'A goal is already active. Use `/goal replace <objective>` to replace it, or `/goal status` to inspect it.':
    '已有进行中的目标。用 `/goal replace <objective>` 替换它，或用 `/goal status` 查看。',
  'No goal to pause.': '没有可暂停的目标。',
  'Goal paused. Use `/goal resume` to continue.': '目标已暂停。用 `/goal resume` 继续。',
  'No goal to resume.': '没有可继续的目标。',
  'No goal to cancel.': '没有可取消的目标。',
  'Goal cancelled.': '目标已取消。',
  'No goal set. Start one with `/goal <objective>`.': '尚未设置目标。用 `/goal <objective>` 开始一个目标。',
};
