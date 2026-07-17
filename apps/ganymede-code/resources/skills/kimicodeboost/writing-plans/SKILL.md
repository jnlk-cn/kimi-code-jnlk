---
name: writing-plans
description: 当拿到多步骤任务的规格说明或需求、准备动手写代码前，必须使用本技能制定完整实现计划
---

# Writing Plans（编写实现计划）

## Overview（概述）

撰写详尽的实现计划，并假设执行工程师对我们的代码库一无所知，且品味堪忧。需要记录他们所需的一切信息：每个任务要改动哪些文件、代码、测试、需要查阅的文档，以及如何进行测试。把整个计划拆成一口一个的小任务。遵循 DRY、YAGNI、TDD，频繁提交。

假设执行者是一位熟练的开发者，但几乎不了解我们的工具链或问题域，也不太擅长设计良好的测试。

**开始时声明：**"我正在使用 writing-plans 技能来创建实现计划。"

**上下文：** 如果在隔离 worktree 中工作，该 worktree 应在使用时通过 `using-git-worktrees` 技能创建。

**计划保存路径（CLI / 非 Ganymede）：** `docs/kimicodeboost/plans/YYYY-MM-DD-<feature-name>.md`
- （用户对计划位置的偏好会覆盖此默认路径）

## Ganymede Plans panel（伽利略计划面板）

<HARD-GATE>
**Ganymede Code：** 本技能 **仅** 在 **计划（Plan）模式** 下执行。
- 计划 **必须** 写入 agent plan 文件（会话目录下 `agents/main/plans/{id}.md`，由 Plan 模式分配；路径在系统提醒的 `Plan file:` 行）。
- **禁止** 写入 `docs/kimicodeboost/plans/` 或其它工作区路径作为正式审阅计划。
- frontmatter **必须** 包含 `name`、`overview`、`todos[]`（每项 `id` / `content` / `status`）。
- 写完后 **必须** 调用 `ExitPlanMode`，让用户在 Plans 面板审阅并按 Build 批准。
- Build 批准前不得开始实现代码。
</HARD-GATE>

进入 Plan 模式后，将当前会话 TodoList checklist（若有）一次性迁入 plan frontmatter `todos[]`，之后 Composer 待办与 Plans 面板共用该列表。

```markdown
---
name: Feature Name
overview: One-sentence goal for the plan
todos:
  - id: task-1
    content: Short task title
    status: pending
  - id: task-2
    content: Next task title
    status: pending
---

# Feature Name Implementation Plan
...
```

- `todos[].status` 取值：`pending` | `in_progress` | `completed` | `cancelled`
- frontmatter 之后仍使用下方 Plan Document Header 与 Task Structure
- 需要隔离实现时，配合 `GanymedeWorktree` 或 Composer 执行目标「Worktree」

## Scope Check（范围检查）

如果规格说明涉及多个相互独立的子系统，它本应在头脑风暴阶段被拆分为子项目规格。如果尚未拆分，建议将其拆分为独立的计划——每个子系统一份。每份计划都应能独立产出可运行、可测试的软件。

## File Structure（文件结构）

在定义任务之前，先梳理将要创建或修改哪些文件，以及每个文件的职责。这里是分解决策被确定下来的地方。

- 设计边界清晰、接口明确的单元。每个文件应有单一且清晰的职责。
- 你能同时保持在上下文中的代码才最容易推理，文件越聚焦，编辑也越可靠。优先选择小而聚焦的文件，而非承担过多职责的大文件。
- 一起变化的文件应该放在一起。按职责拆分，而不是按技术层级拆分。
- 在已有代码库中，遵循已有模式。如果代码库本身使用大文件，不要单方面重构——但如果你要修改的文件已经臃肿，在计划中加入拆分是合理的。

这一结构会指导任务分解。每个任务都应产出独立自洽、可独立理解的变更。

## Task Right-Sizing（任务大小划分）

任务应是最小可独立测试循环单元，并且值得一次新的评审关口。划分任务边界时：把搭建、配置、脚手架和文档步骤合并到真正需要它们的交付任务中；只在评审者可能拒绝任务 A 同时批准相邻任务 B 的地方进行拆分。每个任务都以一个可独立测试的交付物结束。

## Bite-Sized Task Granularity（一口大小的任务粒度）

**每一步都是单个动作（2-5 分钟）：**
- "Write the failing test" — 一步
- "Run it to make sure it fails" — 一步
- "Implement the minimal code to make the test pass" — 一步
- "Run the tests and make sure they pass" — 一步
- "Commit" — 一步

## Plan Document Header（计划文档头部）

**每份计划必须以该头部开头：**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

## Global Constraints

[The spec's project-wide requirements — version floors, dependency limits,
naming and copy rules, platform requirements — one line each, with exact
values copied verbatim from the spec. Every task's requirements implicitly
include this section.]

---
```

## Task Structure（任务结构）

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Interfaces:**
- Consumes: [what this task uses from earlier tasks — exact signatures]
- Produces: [what later tasks rely on — exact function names, parameter
  and return types. A task's implementer sees only their own task; this
  block is how they learn the names and types neighboring tasks use.]

**Complex-Task Analysis (required for large refactoring / wide bugfix / cross-module changes):**
- 功能收益：[具体模块与收益]
- 问题风险：[潜在回归与兼容性问题]
- 组件配合：[与上下游模块的交互方式]
- 组件耦合：[新增或加重的依赖关系]

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## Complex-Task Analysis（复杂任务的收益与风险分析）

在把任务拆成步骤之前，先判断它是否需要收益/风险/耦合分析。以下类型**必须**进行分析：

- 大型重构
- 大范围 bug 修复
- 跨多个模块的架构调整
- 可能改变公共接口的改动

以下类型**不需要**进行分析：

- 单一文件的小修复
- 纯文档更新
- 配置项更名
- 不影响其他模块的独立新增函数

如果任务属于必须分析的类型，在 Task Structure 的 `Interfaces` 之后、`Steps` 之前追加 **Complex-Task Analysis** 块，并填写以下四个字段：

- **功能收益**：本任务完成后，具体模块获得了什么能力或性能提升。
- **问题风险**：改动可能引入的回归、兼容性破坏、性能下降、测试覆盖缺口。
- **组件配合**：本任务修改的模块如何与上下游组件交互；调用关系、数据流、事件流的变化。
- **组件耦合**：是否引入新的依赖、是否加重循环依赖、是否让原本独立的模块产生隐性耦合。

## No Placeholders（禁止占位符）

每一步都必须包含工程师实际需要的具体内容。以下内容是**计划失败项**——绝对不要写：
- "TBD"、"TODO"、"implement later"、"fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above"（没有给出实际测试代码）
- "Similar to Task N"（重复代码——工程师可能会乱序阅读任务）
- 只描述做什么、不展示怎么做的步骤（代码步骤必须附带代码块）
- 引用任何任务中未定义的类型、函数或方法

## Remember（谨记）
- 始终使用精确文件路径
- 每一步都给出完整代码——如果某一步修改代码，就展示代码
- 精确命令及其预期输出
- DRY、YAGNI、TDD、频繁提交

## Self-Review（自我审阅）

完成整个计划后，用全新的眼光对照规格说明检查计划。这是你自己运行的检查清单——不是派发给子代理的。

**1. Spec coverage（规格覆盖）：** 浏览规格说明的每个章节/需求。你能否指出实现它的任务？列出任何缺口。

**2. Placeholder scan（占位符扫描）：** 在计划中搜索危险信号——即上面"No Placeholders"部分列出的任何模式。修复它们。

**3. Type consistency（类型一致性）：** 你在后续任务中使用的类型、方法签名和属性名是否与前面任务定义的一致？Task 3 中叫 `clearLayers()`，Task 7 中却叫 `clearFullLayers()`，这就是 bug。

如果发现问题，直接就地修复。无需重新审阅——直接修复并继续。如果发现某个规格需求没有对应任务，就补上该任务。

## Execution Handoff（执行交接）

保存计划后，提供执行选项：

**"Plan complete and saved to `docs/kimicodeboost/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use subagent-driven-development
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILL:** Use executing-plans
- Batch execution with checkpoints for review
