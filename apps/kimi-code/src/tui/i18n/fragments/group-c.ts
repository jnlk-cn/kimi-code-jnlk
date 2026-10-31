export const FRAGMENT: Readonly<Record<string, string>> = {
  'No active session. Send a message to start one.': '当前没有活动会话。发送一条消息即可开始。',

  'Plan cleared': '计划已清除',
  'Unknown plan subcommand: {subcommand}': '未知的计划子命令：{subcommand}',
  'Plan mode is already on': '计划模式已处于开启状态',
  'Plan mode is already off': '计划模式已处于关闭状态',
  'Plan mode: ON': '计划模式：开启',
  'Plan mode: OFF': '计划模式：关闭',
  'Plan will be created here: {path}': '计划将创建在此路径：{path}',
  'Failed to set plan mode: {error}': '设置计划模式失败：{error}',

  'Unknown theme: {theme}': '未知主题：{theme}',
  'Unknown model alias: {alias}': '未知的模型别名：{alias}',
  '"{choice}" is reserved by the subagent model pool — rename the [models] alias to use it here.':
    '"{choice}" 已被子代理模型池占用——如需在此使用，请重命名 [models] 中的别名。',
  'No models configured': '尚未配置模型',
  'Run /login to sign in to Kimi, or /provider to add another provider from a model catalog.':
    '运行 /login 登录 Kimi，或运行 /provider 从模型目录添加其他供应商。',
  'No model selected. Run /model to select one first.': '尚未选择模型。请先运行 /model 选择一个。',
  'Unsupported thinking effort "{effort}" for {model}. Available: {options}':
    '模型 {model} 不支持思考档位 "{effort}"。可选：{options}',
  'none declared': '未声明',
  'Thinking effort "{effort}" is not listed for {model} (known: {known}). Sending "{effort}" unchanged; the configured provider will validate it.':
    '模型 {model} 未列出思考档位 "{effort}"（已知：{known}）。将原样发送 "{effort}"，由所配置的供应商校验。',
  'Note: Switching models invalidates the existing prompt cache. Use /new to avoid extra token costs.':
    '注意：切换模型会使现有提示缓存失效，用 /new 可避免额外的 token 消耗。',
  'Note: Switching effort invalidates the existing prompt cache. Use /new to avoid extra token costs.':
    '注意：切换思考档位会使现有提示缓存失效，用 /new 可避免额外的 token 消耗。',
  'Skipped refreshing {provider}: {reason}': '已跳过刷新 {provider}：{reason}',
  'Skipped refreshing models: {error}': '已跳过刷新模型：{error}',

  'Editor unchanged: {editor}': '编辑器未变：{editor}',
  'Failed to save editor: {error}': '保存编辑器失败：{error}',
  'Editor set to "{editor}".': '编辑器已设为 "{editor}"。',
  'Editor set to auto-detect ($VISUAL / $EDITOR).': '编辑器已设为自动检测（$VISUAL / $EDITOR）。',

  'Model switch aborted — session changed.': '模型切换已中止——会话已变更。',
  'Model switch aborted — model unchanged.': '模型切换已中止——模型未变更。',
  'Timed out waiting for compaction — model unchanged.': '等待压缩超时——模型未变更。',
  'Compaction cancelled — model unchanged.': '压缩已取消——模型未变更。',
  'Failed to compact: {error}. Model unchanged.': '压缩失败：{error}。模型未变更。',
  ' Select a secondary model (subagents)': ' 选择次要模型（子代理）',
  'Failed to save secondary model: {error}': '保存次要模型失败：{error}',
  'Secondary model set to {model}. Newly spawned subagents will use it by default.':
    '次要模型已设为 {model}。新启动的子代理将默认使用它。',

  'Theme unchanged: "{theme}".': '主题未变更："{theme}"。',
  'Theme "{theme}" could not be loaded.': '无法加载主题 "{theme}"。',
  'Failed to save theme: {error}': '保存主题失败：{error}',
  'Theme set to "{theme}".': '主题已设为 "{theme}"。',
  'Theme set to "{theme}" (tracking terminal; current: {mode}).':
    '主题已设为 "{theme}"（跟随终端；当前：{mode}）。',

  'Failed to load experimental features: {error}': '加载实验性功能失败：{error}',
  'Failed to update experimental features: {error}': '更新实验性功能失败：{error}',
  'No experimental feature changes to apply.': '没有需要应用的实验性功能变更。',
  'Experimental features updated.': '实验性功能已更新。',
  'Experimental features updated. Session reloaded.': '实验性功能已更新，会话已重新加载。',
  'Start a new session to use Updates if this session was created with the feature disabled.':
    '如果本会话创建时该功能处于关闭状态，请新建会话后再使用 Updates。',
  'Tower mode takes effect after restarting Kimi Code.': '重启 GanyCode 后 tower 模式才会生效。',
  'TUI mode takes effect after restarting Kimi Code.': '重启 GanyCode 后界面模式才会生效。',

  'Automatic updates already enabled.': '自动更新已开启。',
  'Automatic updates already disabled.': '自动更新已关闭。',
  'Automatic updates enabled.': '自动更新已开启。',
  'Automatic updates disabled.': '自动更新已关闭。',
  'Failed to save automatic update setting: {error}': '保存自动更新设置失败：{error}',

  'Permission mode unchanged: {mode}.': '权限模式未变更：{mode}。',
  'Permission mode: {mode}': '权限模式：{mode}',
  'Failed to set permission mode: {error}': '设置权限模式失败：{error}',

  'Feedback survey already enabled.': '反馈调研已开启。',
  'Feedback survey already disabled.': '反馈调研已关闭。',
  'Feedback survey enabled.': '反馈调研已开启。',
  'Feedback survey disabled.': '反馈调研已关闭。',
  'Failed to save session rating setting: {error}': '保存会话评分设置失败：{error}',

  'Reply language already {language}.': '回复语言已经是 {language}。',
  'Reply language set to {language}.': '回复语言已设为 {language}。',
  'Shell preference already {preference}.': 'Shell 偏好已经是 {preference}。',
  'Shell preference set to {preference} (a hint for the agent, not enforced).':
    'Shell 偏好已设为 {preference}（仅为给 Agent 的建议，不强制）。',

  'Mermaid diagrams already enabled.': 'Mermaid 图表已开启。',
  'Mermaid diagrams already disabled.': 'Mermaid 图表已关闭。',
  'Mermaid diagrams enabled.': 'Mermaid 图表已开启。',
  'Mermaid diagrams disabled.': 'Mermaid 图表已关闭。',
  'Failed to save mermaid diagram setting: {error}': '保存 Mermaid 图表设置失败：{error}',

  'TUI mode already {mode}.': '界面模式已经是 {mode}。',
  'TUI mode set to {mode}.': '界面模式已设为 {mode}。',
  'Failed to save TUI mode: {error}': '保存界面模式失败：{error}',

  Status: '状态',

  'Submitting feedback…': '正在提交反馈…',
  'Feedback submitted, thank you!': '反馈已提交，感谢你！',
  'Feedback cancelled.': '反馈已取消。',
  'Network error, failed to submit feedback.': '网络错误，提交反馈失败。',
  'Opening GitHub Issues as fallback…': '正在打开 GitHub Issues 作为备用渠道…',
  "You're not signed in. Sign up or leave feedback on GitHub:":
    '你尚未登录。请先注册，或在 GitHub 上提交反馈：',
  'Feedback sent; attachment upload failed — see feedback-upload.log.':
    '反馈已发送；附件上传失败——请查看 feedback-upload.log。',
  'Codebase attachment is not supported for remote sessions — the scanner only reads the local filesystem.':
    '远程会话不支持附加代码库——扫描器只读取本地文件系统。',
  'Failed to load MCP servers: {error}': '加载 MCP 服务器失败：{error}',
};
