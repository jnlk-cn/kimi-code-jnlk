export const FRAGMENT: Readonly<Record<string, string>> = {
  'Session title: {title}': '会话标题：{title}',
  'Session title: (not set) — id: {id}': '会话标题：（未设置）— id：{id}',
  'Failed to set title: {error}': '设置标题失败：{error}',
  'Session title set to: {title}': '会话标题已设为：{title}',
  'Session forked ({forkId}), but failed to release its environment: {error}':
    '会话已复制（{forkId}），但无法释放其环境：{error}',
  'Command copied to clipboard': '命令已复制到剪贴板',
  'Command copied via terminal escape sequence (unverified)': '命令已通过终端转义序列复制（未验证）',
  'Failed to copy command to clipboard': '复制命令到剪贴板失败',
  'Session forked ({forkId}). Still in the original session; switch to the fork via /sessions.\n  To enter the fork in a new process, run: {command}\n  {note}':
    '会话已复制（{forkId}）。仍停留在原会话；可通过 /sessions 切换到副本。\n  若要在新进程中进入副本，请运行：{command}\n  {note}',
  'Failed to fork session: {error}': '复制会话失败：{error}',
  'Exporting session as Markdown…': '正在将会话导出为 Markdown…',
  'No messages to export.': '没有可导出的消息。',
  'Exported {count} messages': '已导出 {count} 条消息',
  'Failed to export session: {error}': '导出会话失败：{error}',
  'Exporting session…': '正在导出会话…',
  'Export complete': '导出完成',
  'Init failed: {error}': '初始化失败：{error}',

  'Usage: /provider [refresh [providerId]]': '用法：/provider [refresh [providerId]]',
  'Refreshing models for all providers…': '正在刷新所有供应商的模型…',
  'Refreshing models for {provider}…': '正在刷新 {provider} 的模型…',
  'Refresh failed.': '刷新失败。',
  'Failed to refresh models: {error}': '刷新模型失败：{error}',
  'Refresh finished.': '刷新完成。',
  '{provider}: model metadata updated.': '{provider}：模型元数据已更新。',
  '{provider}: {counts} model.': '{provider}：{counts} 个模型。',
  '{provider}: {counts} models.': '{provider}：{counts} 个模型。',
  'Skipped refreshing {provider}: {reason}': '已跳过刷新 {provider}：{reason}',
  'No model changes ({count} provider up to date).': '模型无变化（{count} 个供应商已是最新）。',
  'No model changes ({count} providers up to date).': '模型无变化（{count} 个供应商已是最新）。',
  'Add provider failed: {error}': '新增供应商失败：{error}',
  'Remove provider failed: {error}': '移除供应商失败：{error}',
  'Failed to delete provider {provider}: {error}': '删除供应商 {provider} 失败：{error}',
  'Add provider': '新增供应商',
  'Known third-party provider': '已知第三方供应商',
  'Custom registry (api.json)': '自定义注册表（api.json）',
  'Fetching catalog from {url}': '正在从 {url} 获取目录',
  'Catalog loaded from built-in snapshot (models.dev unreachable).':
    '已从内置快照加载目录（models.dev 无法访问）。',
  'Catalog loaded.': '目录已加载。',
  'Failed to load catalog.': '加载目录失败。',
  'Failed to fetch catalog{hint}: {error}': '获取目录失败{hint}：{error}',
  'Provider "{provider}" has no usable models in this catalog.':
    '供应商“{provider}”在此目录中没有可用模型。',
  'Provider "{provider}" declares protocol "{protocol}" in the catalog, which this client version does not support.':
    '供应商“{provider}”在目录中声明的协议“{protocol}”不受当前客户端版本支持。',
  'Provider "{provider}" uses a proprietary SDK this client cannot speak (e.g. Amazon Bedrock or Cohere); it cannot be imported from the catalog.':
    '供应商“{provider}”使用了本客户端无法对接的专有 SDK（例如 Amazon Bedrock 或 Cohere），无法从目录导入。',
  'Base URL contains an env placeholder or is empty. Enter the resolved URL instead.':
    'Base URL 含有环境变量占位符或为空，请改为输入解析后的 URL。',
  'Provider added: {provider}': '已新增供应商：{provider}',
  'Protocol guessed as "openai" for {provider} — edit "type" in config.toml if requests fail.':
    '已将 {provider} 的协议推断为 "openai"——若请求失败，请在 config.toml 中修改 "type"。',
  'Set default model failed: {error}': '设置默认模型失败：{error}',
  'Default model set to {model} with thinking {effort}.': '默认模型已设为 {model}，思考档位 {effort}。',
  'Registry contained no providers.': '注册表中没有供应商。',
  'Failed to import registry: {error}': '导入注册表失败：{error}',
  'Failed to apply registry: {error}': '应用注册表失败：{error}',
  'This registry requires authentication — paste its Bearer token.':
    '该注册表需要认证——请粘贴其 Bearer token。',
  'Imported 1 provider from registry.': '已从注册表导入 1 个供应商。',
  'Imported {count} providers from registry.': '已从注册表导入 {count} 个供应商。',
  'provider "{provider}" declares credential env var "{env}" — set api_key_env in config.toml to use it':
    '供应商“{provider}”声明了凭据环境变量“{env}”——请在 config.toml 中设置 api_key_env 以启用',

  'Select a provider to log out': '选择要退出登录的供应商',
  'No attachment': '不附带附件',
  'Text feedback only': '仅文字反馈',
  'Logs only': '仅日志',
  'Upload wire events and diagnostic logs from this session': '上传本次会话的 wire 事件与诊断日志',
  'Logs + codebase': '日志 + 代码库',
  'Include your codebase for deeper diagnosis. Sensitive files are automatically excluded — e.g. .env, config files, secret keys. We use attachments only for diagnosis and never share them.':
    '附带你的代码库以便更深入诊断。敏感文件会被自动排除，例如 .env、配置文件、密钥。附件仅用于诊断，我们绝不会分享。',
  'Share diagnostic info to help us investigate?': '愿意分享诊断信息，帮助我们排查吗？',
  'Your key will be saved to ~/.ganycode/config.toml': '你的密钥将保存到 ~/.ganycode/config.toml',
  'The password is used only in this process and is never saved.': '密码仅在本进程中使用，不会被保存。',
  'Enter SSH password for {host}': '输入 {host} 的 SSH 密码',
  'SSH password cannot be empty.': 'SSH 密码不能为空。',
  'The catalog declares no endpoint for this provider — enter its base URL.':
    '目录未为该供应商声明端点——请输入其 Base URL。',
  'Enter base URL for {provider}': '输入 {provider} 的 Base URL',
  'Base URL cannot be empty.': 'Base URL 不能为空。',
  'Catalog has no providers with supported wire types.':
    '目录中没有使用受支持协议类型的供应商。',
  'Select a provider': '选择供应商',
};
