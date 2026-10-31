export const FRAGMENT: Readonly<Record<string, string>> = {
  // plugins-selector
  ' Plugins': ' 插件',
  'Installed': '已安装',
  Official: '官方',
  Curated: '精选',
  Custom: '自定义',
  Actions: '操作',
  ' Tab switch · Enter install · Esc cancel': ' Tab 切换 · Enter 安装 · Esc 取消',
  ' Tab switch · ↑↓ navigate · Enter open/install · Esc cancel':
    ' Tab 切换 · ↑↓ 导航 · Enter 打开/安装 · Esc 取消',
  ' Tab switch · Space toggle · D remove · M MCP · {enter} · I details · R reload · Esc cancel':
    ' Tab 切换 · 空格 启用/停用 · D 移除 · M MCP · {enter} · I 详情 · R 重新加载 · Esc 取消',
  'Enter update': 'Enter 更新',
  'Enter details': 'Enter 详情',
  '  No plugins installed.': '  还没有安装插件。',
  ' {count} installed': ' 已安装 {count} 个',
  '  Loading marketplace…': '  正在加载插件市场…',
  '  Marketplace unavailable: {message}': '  插件市场不可用：{message}',
  '  Use the Custom tab to install from a URL.': '  可以在「自定义」标签页用链接安装。',
  '  No plugins found.': '  没有找到插件。',
  ' {installed} installed · {available} available': ' 已安装 {installed} 个 · 可安装 {available} 个',
  ' Source: {source}': ' 来源：{source}',
  ' Third-party plugins from our partners.': ' 来自合作方的第三方插件。',
  ' Install from a GitHub URL (or zip URL / local path):':
    ' 从 GitHub 链接安装（也支持 zip 链接 / 本地路径）：',
  '  Installing {name}…': '  正在安装 {name}…',
  'id {id}': 'id {id}',
  ' · state {state}': ' · 状态 {state}',
  ' · MCP {enabled}/{total}': ' · MCP {enabled}/{total}',
  ' · diagnostics available': ' · 有诊断信息',
  '{count} skill': '{count} 个技能',
  '{count} skills': '{count} 个技能',
  'update {local} → {latest}': '更新 {local} → {latest}',
  'installed · v{version}': '已安装 · v{version}',
  'install v{version}': '安装 v{version}',
  installed: '已安装',
  install: '安装',
  'installing…': '正在安装…',
  'open in browser': '在浏览器中打开',
  enabled: '已启用',
  disabled: '已停用',
  'Official plugin': '官方插件',
  'Curated plugin': '精选插件',
  Plugin: '插件',
  'Control your real browser from Kimi Code — navigate, click, type, and screenshot':
    '用 Kimi Code 控制你真实的浏览器——导航、点击、输入与截图',

  // plugins-selector · MCP servers
  ' MCP servers · {name}': ' MCP 服务器 · {name}',
  ' ↑↓ navigate · Enter/Space enable/disable · Esc cancel':
    ' ↑↓ 导航 · Enter/空格 启用/停用 · Esc 取消',
  'MCP servers ({enabled}/{total} enabled)': 'MCP 服务器（{enabled}/{total} 已启用）',
  '  No MCP servers declared.': '  未声明任何 MCP 服务器。',
  'Back to installed plugins': '返回已安装插件',
  'Return to the local plugin manager.': '回到本地插件管理器。',
  'Enter/Space disable': 'Enter/空格 停用',
  'Enter/Space enable': 'Enter/空格 启用',

  // plugins-selector · confirmations
  'Remove {name} ({id})?': '移除 {name}（{id}）？',
  '↑↓ navigate · Enter/Space select · ←/Esc cancel': '↑↓ 导航 · Enter/空格 选择 · ←/Esc 取消',
  Cancel: '取消',
  'Keep this plugin installed.': '保留这个插件。',
  'Remove plugin': '移除插件',
  'Remove only the install record; plugin files are left in place.':
    '仅移除安装记录；插件文件仍保留在原位。',
  'Install third-party plugin {label}?': '安装第三方插件 {label}？',
  '⚠️ This is a third-party plugin that Kimi has not reviewed. It can bundle MCP servers, skills, or files that run code and access your workspace. Install it only if you trust the source.':
    '⚠️ 这是 Kimi 未审核过的第三方插件。它可能附带会运行代码、访问你工作区的 MCP 服务器、技能或文件。请仅在信任来源时安装。',
  Exit: '退出',
  'Cancel the installation.': '取消安装。',
  'Trust and install': '信任并安装',
  'Install this third-party plugin anyway.': '仍然安装这个第三方插件。',

  // provider-manager
  '[ Add New Platform ]': '[ 新增平台 ]',
  '↑↓ navigate · D delete · Esc cancel': '↑↓ 导航 · D 删除 · Esc 取消',
  ' Providers': ' 供应商',
  '  No providers configured.': '  还没有配置供应商。',
  ' Page {page}/{total}': ' 第 {page}/{total} 页',
  'Delete platform "{name}"?': '删除平台「{name}」？',
  'Delete platform "{name}" and all {count} providers?':
    '删除平台「{name}」及其全部 {count} 个供应商？',

  // custom-registry-import
  'Import custom provider registry': '导入自定义供应商注册表',
  'Paste an api.json URL; the Bearer token is optional.': '粘贴 api.json 链接；Bearer token 可选。',
  'Registry URL cannot be empty.': '注册表链接不能为空。',
  'Tab / ↑↓ to switch  ·  Enter for next field  ·  Esc to cancel':
    'Tab / ↑↓ 切换  ·  Enter 下一个字段  ·  Esc 取消',
  'Tab / ↑↓ to switch  ·  Enter to submit  ·  Esc to cancel':
    'Tab / ↑↓ 切换  ·  Enter 提交  ·  Esc 取消',
  'Registry URL': '注册表链接',
  'Bearer token (optional)': 'Bearer token（可选）',
};
