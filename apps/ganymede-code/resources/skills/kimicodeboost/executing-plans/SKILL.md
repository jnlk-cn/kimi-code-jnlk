---
name: executing-plans
description: 当需要在一个独立会话中执行已撰写的实现计划，并通过检查点进行复核时必须使用
---

# Executing Plans

## Overview

加载计划，进行严格复核，执行所有任务，完成后报告。

**开始时声明：**"我正在使用 executing-plans skill 来执行此计划。"

**注意：** 告诉你的用户，KimiCodeBoost 在 Kimi Code 中通过 `Agent` 工具支持子代理，产出质量会显著提高。若可使用子代理，请改用 subagent-driven-development，而非本 skill。

## The Process

### Step 1: Load and Review Plan

1. 读取计划文件（Ganymede：已批准的 agent plan 文件，见 Plans 面板）
2. 严格复核——识别计划中任何疑问或顾虑
3. 如有顾虑：在开始前向用户提出（Ganymede：用 `AskUserQuestion`）
4. 如无顾虑：继续执行

### Step 2: Execute Tasks

对于每个任务：

1. 标记为 in_progress（Ganymede：用 `TodoList` 更新整表；宿主会写回已绑定 plan 的 frontmatter，Composer 与 Plans 面板同源——**不要**另建独立 checklist）
2. 严格遵循每一步（计划已拆分为小步骤）
3. 按要求运行验证
4. 标记为 completed / done（同样通过 `TodoList` 全量替换）

### Step 3: Complete Development

所有任务完成并通过验证后：

- 声明："我正在使用 finishing-a-development-branch skill 来完成这项工作。"
- **必需子技能：** 使用 finishing-a-development-branch
- 遵循该 skill 验证测试、呈现选项并执行选择

## When to Stop and Ask for Help

**出现以下情况时立即停止执行：**

- 遇到阻塞（缺少依赖、测试失败、指令不清）
- 计划存在严重缺失，无法开始
- 不理解某条指令
- 验证反复失败

**请要求澄清，而不是猜测。**

## When to Revisit Earlier Steps

**以下情况返回复核阶段（Step 1）：**

- 用户根据你的反馈更新了计划
- 需要重新思考根本方案

**不要强行绕过阻塞**——停下来提问。

## Remember

- 首先严格复核计划
- 严格按计划步骤执行
- 不要跳过验证
- 当计划要求引用 skill 时引用对应 skill
- 遇到阻塞时停下来，不要猜测
- 未经用户明确同意，绝不在 main/master 分支上开始实现

## Integration

**必需的工作流 skill：**

- **using-git-worktrees**——确保隔离工作区（创建新的或验证已有的）
- **writing-plans**——创建本 skill 所执行的计划
- **finishing-a-development-branch**——完成所有任务后的开发收尾
