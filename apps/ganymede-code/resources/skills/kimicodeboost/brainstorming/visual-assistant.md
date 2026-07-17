# 视觉助手指南

基于浏览器的可视化头脑风暴助手，用于展示原型、图表和选项。

## 何时使用

按问题判断，而不是按会话判断。判断标准：**用户通过“看到”是否比“读到”更容易理解？**

**当内容本身是视觉化时，请使用浏览器：**

- **UI 原型** — 线框图、布局、导航结构、组件设计
- **架构图** — 系统组件、数据流、关系图
- **并排视觉对比** — 比较两种布局、两种配色、两种设计方向
- **设计打磨** — 当问题涉及外观、间距、视觉层级时
- **空间关系** — 状态机、流程图、实体关系图等以图表形式呈现

**当内容是文本或表格时，请使用终端：**

- **需求与范围问题** — “X 是什么意思？”、“哪些功能在范围内？”
- **概念性的 A/B/C 选择** — 用文字描述的方案之间做选择
- **权衡清单** — 优缺点、对比表
- **技术决策** — API 设计、数据建模、架构方案选择
- **澄清性问题** — 任何答案是文字、而非视觉偏好的问题

关于 UI 的问题并不自动等于视觉问题。“你想要哪种向导？”是概念性的——使用终端。“这些向导布局哪个感觉对？”是视觉性的——使用浏览器。

## 工作原理

服务器监听一个目录中的 HTML 文件，并将最新的文件提供给浏览器。你将 HTML 内容写入 `screen_dir`，用户在其浏览器中查看并可以点击选择选项。选择结果会记录到 `state_dir/events`，你在下一轮读取。

**内容片段与完整文档：** 如果你的 HTML 文件以 `<!DOCTYPE` 或 `<html` 开头，服务器会按原样提供（仅注入辅助脚本）。否则，服务器会自动将你的内容包装到框架模板中——添加标题栏、CSS 主题、连接状态以及所有交互基础设施。**默认情况下请编写内容片段。** 只有在你需要完全控制页面时，才编写完整文档。

## 启动会话

```bash
# Start AFTER the user approves the assistant. --open auto-opens their browser on
# the first screen; --project-dir persists mockups and enables same-port restart.
scripts/start-server.sh --project-dir /path/to/project --open

# Returns: {"type":"server-started","port":52341,
#           "url":"http://localhost:52341/?key=ab12…",
#           "screen_dir":"/path/to/project/.kimicodeboost/brainstorm/12345-1706000000/content",
#           "state_dir":"/path/to/project/.kimicodeboost/brainstorm/12345-1706000000/state"}
```

从响应中保存 `screen_dir` 和 `state_dir`。使用 `--open` 时，浏览器会在你推送第一个屏幕时自动打开——无需让用户手动打开，但仍应分享 URL 作为备用（无头/远程环境不会自动打开）。

**URL 包含会话密钥（`?key=…`）。** 服务器会拒绝任何不带密钥的请求，因此始终向用户提供 `url` 字段中的**完整** URL——不要剥离查询字符串，也不要只给裸的 `http://host:port`。该密钥控制 HTTP 和 WebSocket 访问，防止随意的浏览器标签页或网络中的其他机器读取屏幕内容或注入事件。首次加载后，浏览器会通过 Cookie 记住密钥，因此刷新页面和访问 `/files/*` 资源时无需重复携带。

**查找连接信息：** 服务器将启动 JSON 写入 `$STATE_DIR/server-info`。如果你在后台启动了服务器且没有捕获标准输出，请读取该文件以获取 URL 和端口。使用 `--project-dir` 时，请在 `<project>/.kimicodeboost/brainstorm/` 中查看会话目录。

**注意：** 将项目根目录作为 `--project-dir` 传入，这样原型文件会持久保存在 `.kimicodeboost/brainstorm/` 中，并在服务器重启后保留。如果不传，文件会放到 `/tmp` 并被清理。提醒用户将 `.kimicodeboost/` 添加到 `.gitignore`（如果尚未添加）。

**在 Kimi Code 中启动服务器：**

```bash
scripts/start-server.sh --project-dir /path/to/project --open
```

默认模式下脚本会自行后台化服务器。在 Windows 上，脚本会自动检测并切换到前台模式（这会阻塞工具调用）。请在 `Bash` 工具调用上设置 `run_in_background: true`，使服务器在会话轮次之间保持运行，然后在下一轮读取 `$STATE_DIR/server-info` 获取 URL 和端口。

如果当前环境会回收脱离的进程，也可显式使用 `--foreground` 并通过 `run_in_background: true` 启动。

如果你的浏览器无法访问该 URL（常见于远程/容器化环境），请绑定非回环主机：

```bash
scripts/start-server.sh \
  --project-dir /path/to/project \
  --host 0.0.0.0 \
  --url-host localhost
```

使用 `--url-host` 控制返回的 URL JSON 中打印的主机名。

## 工作流程循环

1. **确认服务器存活**，然后向 `screen_dir` 写入新的 HTML 文件：
   - **必须：在引用 URL 或推送屏幕之前，确认服务器处于存活状态。** 检查 `$STATE_DIR/server-info` 是否存在且 `$STATE_DIR/server-stopped` 不存在。如果服务器已关闭，请使用 **相同的 `--project-dir`** 重新启动 `start-server.sh`——它会复用相同的端口，因此用户已打开的标签页会自动重连（服务器关闭期间会显示“暂停”覆盖层），你无需发送新 URL。服务器在闲置 4 小时后自动退出（可通过 `--idle-timeout-minutes` 配置）。
   - 使用语义化文件名：`platform.html`、`visual-style.html`、`layout.html`
   - **永远不要复用文件名**——每个屏幕都应是一个新文件
   - 使用你的文件创建工具——**不要使用 cat/heredoc**（会在终端中产生噪音）
   - 服务器会自动提供最新的文件

2. **告诉用户接下来会发生什么，然后结束本轮：**
   - 每一步都提醒 URL（不只是第一步）
   - 简要文字总结屏幕内容（例如：“展示首页的 3 种布局选项”）
   - 让用户在终端回复：“看一下，告诉我你的想法。如果愿意，可以点击选择一个选项。”

3. **下一轮**——用户在终端回复后：
   - 如果存在，读取 `$STATE_DIR/events`——其中包含用户浏览器交互（点击、选择）的 JSON Lines
   - 将其与用户的终端文字合并，以获得完整反馈
   - 终端消息是主要反馈；`state_dir/events` 提供结构化交互数据

4. **迭代或推进**——如果反馈改变了当前屏幕，请写入新文件（例如 `layout-v2.html`）。只有当当前步骤得到确认后，才进入下一个问题。

5. **返回终端时清空屏幕**——当下一步不需要浏览器时（例如澄清问题、权衡讨论），推送一个等待屏幕以清除过时的内容：

   ```html
   <!-- filename: waiting.html (or waiting-2.html, etc.) -->
   <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
     <p class="subtitle">Continuing in terminal...</p>
   </div>
   ```

   这样可以防止用户在对话已经推进后仍然盯着一个已解决的选项。当下一个视觉问题出现时，像往常一样推送新的内容文件。

6. 重复，直到完成。

## 编写内容片段

只编写放入页面内部的内容。服务器会自动将其包装到框架模板中（标题栏、主题 CSS、连接状态以及所有交互基础设施）。

**最小示例：**

```html
<h2>Which layout works better?</h2>
<p class="subtitle">Consider readability and visual hierarchy</p>

<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Single Column</h3>
      <p>Clean, focused reading experience</p>
    </div>
  </div>
  <div class="option" data-choice="b" onclick="toggleSelect(this)">
    <div class="letter">B</div>
    <div class="content">
      <h3>Two Column</h3>
      <p>Sidebar navigation with main content</p>
    </div>
  </div>
</div>
```

就是这样。不需要 `<html>`、CSS 或 `<script>` 标签。服务器会提供所有这些。

## 可用的 CSS 类

框架模板为你的内容提供以下 CSS 类：

### 选项（A/B/C 选择）

```html
<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Title</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

**多选：** 在容器上添加 `data-multiselect`，让用户可以选择多个选项。每次点击都会切换该选项的选中样式。

```html
<div class="options" data-multiselect>
  <!-- same option markup — users can select/deselect multiple -->
</div>
```

### 卡片（视觉设计）

```html
<div class="cards">
  <div class="card" data-choice="design1" onclick="toggleSelect(this)">
    <div class="card-image"><!-- mockup content --></div>
    <div class="card-body">
      <h3>Name</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

### 原型容器

```html
<div class="mockup">
  <div class="mockup-header">Preview: Dashboard Layout</div>
  <div class="mockup-body"><!-- your mockup HTML --></div>
</div>
```

### 分栏视图（并排）

```html
<div class="split">
  <div class="mockup"><!-- left --></div>
  <div class="mockup"><!-- right --></div>
</div>
```

### 优缺点

```html
<div class="pros-cons">
  <div class="pros"><h4>Pros</h4><ul><li>Benefit</li></ul></div>
  <div class="cons"><h4>Cons</h4><ul><li>Drawback</li></ul></div>
</div>
```

### 模拟元素（线框构建块）

```html
<div class="mock-nav">Logo | Home | About | Contact</div>
<div style="display: flex;">
  <div class="mock-sidebar">Navigation</div>
  <div class="mock-content">Main content area</div>
</div>
<button class="mock-button">Action Button</button>
<input class="mock-input" placeholder="Input field">
<div class="placeholder">Placeholder area</div>
```

### 排版与分区

- `h2` — 页面标题
- `h3` — 小节标题
- `.subtitle` — 标题下方的辅助文字
- `.section` — 底部带间距的内容块
- `.label` — 小型大写标签文字

## 浏览器事件格式

当用户在浏览器中点击选项时，其交互会记录到 `$STATE_DIR/events`（每行一个 JSON 对象）。推送新屏幕时，该文件会自动清空。

```jsonl
{"type":"click","choice":"a","text":"Option A - Simple Layout","timestamp":1706000101}
{"type":"click","choice":"c","text":"Option C - Complex Grid","timestamp":1706000108}
{"type":"click","choice":"b","text":"Option B - Hybrid","timestamp":1706000115}
```

完整的事件流展示了用户的探索路径——他们可能会多次点击不同选项才最终确定。最后一条 `choice` 事件通常是最终选择，但点击模式也能揭示犹豫或值得进一步询问的偏好。

如果 `$STATE_DIR/events` 不存在，说明用户没有与浏览器交互——仅使用他们的终端文字。

## 设计技巧

- **根据问题调整保真度**——布局用线框图，打磨问题用高保真
- **在每一页说明问题**——写“哪种布局看起来更专业？”而不是简单的“选一个”
- **在推进前先迭代**——如果反馈改变了当前屏幕，就写一个新版本
- 每个屏幕最多 **2-4 个选项**
- **在关键处使用真实内容**——对于摄影作品集，使用真实图片（Unsplash）。占位内容会掩盖设计问题。
- **保持原型简洁**——聚焦布局和结构，而非像素级完美设计

## 文件命名

- 使用语义化名称：`platform.html`、`visual-style.html`、`layout.html`
- 永远不要复用文件名——每个屏幕必须是一个新文件
- 迭代时追加版本后缀，如 `layout-v2.html`、`layout-v3.html`
- 服务器按修改时间提供最新文件

## 清理

```bash
scripts/stop-server.sh $SESSION_DIR
```

如果会话使用了 `--project-dir`，原型文件会保留在 `.kimicodeboost/brainstorm/` 中以便后续参考。只有 `/tmp` 会话在停止时会被删除。

## 参考

- 框架模板（CSS 参考）：`scripts/frame-template.html`
- 辅助脚本（客户端）：`scripts/helper.js`
