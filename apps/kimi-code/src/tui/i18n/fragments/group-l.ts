export const FRAGMENT: Readonly<Record<string, string>> = {
  'Visit the URL below in your browser to authorize:': '在浏览器中打开下面的链接完成授权：',
  'Verification code:  ': '验证码：  ',

  '[goal ': '[目标 ',
  plan: '计划',
  swarm: '集群',
  thinking: '思考',
  'thinking: {effort}': '思考档位：{effort}',
  'context: {percent}% ({used}/{max})': '上下文：{percent}% ({used}/{max})',
  'context: {percent}%': '上下文：{percent}%',
  '[{count} task running]': '[{count} 个任务运行中]',
  '[{count} tasks running]': '[{count} 个任务运行中]',
  '[{count} agent running]': '[{count} 个代理运行中]',
  '[{count} agents running]': '[{count} 个代理运行中]',
  expand: '展开',
  collapse: '收起',

  'ctrl-s to add guidance without waiting for the turn to finish':
    'ctrl-s 追加指令，无需等待本轮结束',
  '/tasks to check progress and status for background tasks': '/tasks 查看后台任务的进度与状态',
  '/init: generate AGENTS.md': '/init：生成 AGENTS.md',
  '/plugins: manage plugins — try the "Kimi Datasource" for reliable financial, economic, and academic data':
    '/plugins：管理插件 —— 试试 "Kimi Datasource"，获取可靠的金融、经济与学术数据',
  'ask Kimi to schedule tasks, e.g. "remind me at 5pm"':
    '让 Kimi 安排定时任务，例如“下午 5 点提醒我”',
  '/sessions to browse and resume earlier sessions': '/sessions 浏览并恢复历史会话',
  '/goal for multi-step work with a clear finish line': '/goal 处理有明确完成标准的多步工作',
  '/goal next to queue follow-up work while the current goal keeps running':
    '/goal next 在当前目标继续运行时排队后续工作',
  '/web: use the Web UI for a better experience': '/web：用 Web 界面获得更好的体验',
  '@: mention files': '@：提及文件',
  '! to run a shell command': '! 执行 Shell 命令',
  'shift+enter: newline': 'shift+enter：换行',
  'ctrl+c: cancel': 'ctrl+c：取消',
  '/theme to switch the terminal UI theme': '/theme 切换终端界面主题',
  '/auto when you want Kimi to handle approvals and keep going; only plans in Plan mode wait for you':
    '/auto 让 Kimi 自行处理审批并持续执行；只有计划模式下的方案会等你确认',
  '/yolo to skip most approvals for trusted batch work, only use it in repos you trust':
    '/yolo 在可信的批量任务中跳过大部分审批，仅在你信任的仓库中使用',
  '/help: show commands': '/help：查看命令',
  '/compact compresses context when it gets long': '/compact 在上下文变长时压缩',
  'ctrl-o to hide or reveal tool output switching between a clean chat view and full execution details':
    'ctrl-o 收起或展开工具输出，在简洁对话视图与完整执行细节之间切换',
  'shift-tab to Plan mode to review the approach before Kimi edits files.':
    'shift-tab 进入计划模式，在 Kimi 改文件前先审视方案。',
  '/model: switch model': '/model：切换模型',
};
