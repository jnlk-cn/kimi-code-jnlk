export const FRAGMENT: Readonly<Record<string, string>> = {
  // question-dialog
  ' question': ' 问题',
  '   Type your answer, then press Enter to save.': '   输入你的回答，按 Enter 保存。',
  '   … {count} more lines': '   … 还有 {count} 行',
  '   showing {start}-{end} of {total}': '   显示第 {start}-{end} 项，共 {total} 项',
  '  esc back to question': '  esc 返回问题',
  // Deliberately overrides the shared `Submit` entry (help panel reads "发送") so
  // the question form's submit tab and action agree with its 提交 copy.
  Submit: '提交',
  Other: '其他',
  'type answer': '输入回答',
  '↵ save': '↵ 保存',
  'tab switch': 'tab 切换',
  'esc cancel': 'esc 取消',
  '↑↓ select': '↑↓ 选择',
  '{keys} / ↵ toggle': '{keys} / ↵ 切换',
  '{keys} / ↵ choose': '{keys} / ↵ 选择',
  '←/→/tab switch': '←/→/tab 切换',
  '1/2 choose': '1/2 选择',
  '↵ confirm': '↵ 确认',

  // feedback-input-dialog
  'Send feedback to Kimi Code': '向 Kimi Code 发送反馈',
  "Tell us what's working or what's not.": '告诉我们哪里好用、哪里不好用。',
  'Feedback cannot be empty.': '反馈内容不能为空。',

  // api-key-input-dialog
  'Enter API key for {platform}': '输入 {platform} 的 API 密钥',
  'API key cannot be empty.': 'API 密钥不能为空。',

  'Enter to submit  ·  Esc to cancel': 'Enter 提交  ·  Esc 取消',
};
