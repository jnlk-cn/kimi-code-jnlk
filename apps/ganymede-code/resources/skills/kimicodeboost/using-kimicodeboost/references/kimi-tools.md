# Kimi Code 工具映射

技能以动作来表达（例如“派遣子代理”、“创建待办”、“读取文件”）。在 Kimi Code 中，这些动作对应到如下工具。

| 技能请求的动作 | Kimi Code 工具 |
|----------------|----------------|
| 询问用户 / 澄清问题 / 多选选项 | `AskUserQuestion` |
| 任务跟踪（“创建待办”、“标记完成”） | `TodoList` |
| 调用技能 | `Skill` |
| 读取文件 | `Read` |
| 创建新文件 | `Write` |
| 编辑文件 | `Edit` |
| 运行 shell 命令 | `Bash` |
| 搜索文件内容 | `Grep` |
| 按名称 / 模式查找文件 | `Glob` |
| 获取 URL | `FetchURL` |
| 网络搜索 | `WebSearch` |
| MCP 服务器 | MCP tools |
| 派遣实现 / 审阅 / 代码修复子代理 | `Agent`，`subagent_type: "coder"` |
| 派遣只读代码库探索子代理 | `Agent`，`subagent_type: "explore"` |
| 派遣只读规划或架构设计子代理 | `Agent`，`subagent_type: "plan"` |
| 同时派遣多个独立子代理 | 同一回复中多次调用 `Agent`；TUI 会将它们分组显示 |
| 基于模板批量派遣子代理 | `AgentSwarm`；同一回复中只能有这一个工具调用 |
| 控制并发上限 | 设置环境变量 `KIMI_CODE_AGENT_SWARM_MAX_CONCURRENCY=<正整数>` |
| 后台运行子代理并稍后取回结果 | `Agent(..., run_in_background: true)` + `TaskOutput` |
| 查询子代理 / 后台任务状态 | `TaskList` / `TaskOutput` |
| 停止后台子代理任务 | `TaskStop` |
| 运行项目本地预览命令 | `Bash`（如 `npm run dev`、`pnpm dev`、`python -m http.server`） |
| 启动本地 Kimi 图形会话 | `kimi server run --open` 或 `kimi web` |
| 连接并操作浏览器 | 通过 Kimi WebBridge 本地服务 + 浏览器扩展（CDP） |
| 获取公开页面内容 | `FetchURL` |
| 捕获页面截图 / 状态 | Kimi WebBridge 的截图与页面内容读取能力 |
| 查询后台预览任务 | `TaskList` / `TaskOutput` |

## AskUserQuestion 使用指南

当 KimiCodeBoost 技能要求询问用户、提出澄清问题、一次只提一个问题、呈现多选选项、在终端中提问或等待用户选择时，请调用 Kimi Code 的 `AskUserQuestion` 工具。除非 `AskUserQuestion` 不可用或会话处于自动权限模式，否则不要将这些选项渲染为普通助手文本。

使用 `AskUserQuestion` 时，尽量每次提供 1 个问题并给出 2–4 个具体选项。将推荐选项放在首位，并在其标签后加上 `(Recommended)`。支持多选时设置 `multi_select: true`，需要异步等待用户回复时设置 `background: true`。

## 子代理支持

当 KimiCodeBoost 技能要求你派遣实现者 / 审阅者 / 修复者子代理时，请使用 Kimi Code 的 `Agent` 工具并指定 Kimi 子代理类型。不要将 `general-purpose` 作为 `subagent_type` 传入——该取值在 Kimi Code 中不存在。

| 子代理角色 | `subagent_type` | 说明 |
|-----------|-----------------|------|
| 实现任务、代码审阅、规格审阅、质量审阅、已填写的 KimiCodeBoost 子代理提示模板 | `coder` | 默认类型；若省略，Kimi Code 也默认使用 `coder` |
| 需要多次搜索的只读代码库探索 | `explore` | 只读，不修改文件 |
| 只读规划或架构设计 | `plan` | 生成计划 / 架构方案，不修改文件 |

调用 `Agent` 时，将完整填写后的提示文本粘贴到 `prompt` 字段，并提供简短的 `description`。保持相互依赖的子代理步骤按顺序执行；仅在任务相互独立且支持后台代理时，才使用多个 `Agent` 调用或设置 `run_in_background: true`。

## AgentSwarm 使用约束

当 KimiCodeBoost 技能要求基于同一模板向多个输入批量派生子代理时，使用 `AgentSwarm`：

- `prompt_template` 必须包含 `{{item}}` 占位符。
- 一次只能有一个 `AgentSwarm` 调用，且该回复中不能包含其他工具调用。
- 至少需要 2 个 `items`，或通过 `resume_agent_ids` 恢复已有子代理。
- 可用环境变量 `KIMI_CODE_AGENT_SWARM_MAX_CONCURRENCY=<正整数>` 限制并发数。

## 后台任务与任务跟踪

- `Bash` 后台运行时必须提供 `description`。
- `TodoList` 以替换整表的方式更新，每次调用需提供完整列表。
- `TaskOutput` 返回快照；如果输出很大，结果中会提供 `output_path`，应使用 `Read` 读取该路径。

## 指令文件

当技能提到“你的指令文件”时，在 Kimi Code 中指的是项目根目录下的 **`AGENTS.md`**。Kimi Code 还会从工作区目录及其祖先目录分层加载 `AGENTS.md`。

## 个人技能目录

用户级技能位于 **`$KIMI_CODE_HOME/skills/`**（默认 `~/.kimi-code/skills/`）。Kimi Code 还会读取跨运行时的共享路径 **`~/.agents/skills/`**。每个技能是一个子目录，其中包含一个带有 `name` 和 `description` 前置信息的 `SKILL.md`。
