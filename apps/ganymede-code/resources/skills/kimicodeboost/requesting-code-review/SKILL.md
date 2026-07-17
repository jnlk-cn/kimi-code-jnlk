---
name: requesting-code-review
description: 当完成任务、实现主要功能或在合并前需要验证工作是否符合要求时必须使用
---

# 请求代码评审

派发一个代码评审员子代理，在问题扩散前将其捕获。评审员会获得精心构建的评估上下文——绝不提供你的会话历史。这让评审员专注于工作成果，而非你的思考过程，同时也保留你自己的上下文以便继续工作。

**核心原则：** 尽早评审，频繁评审。

## 何时请求评审

**必须：**
- 子代理驱动开发中每个任务完成后
- 完成主要功能后
- 合并到 main 前

**可选但很有价值：**
- 卡住时（获得新视角）
- 重构前（基线检查）
- 修复复杂 bug 后

## 如何请求

**1. 获取 git SHA：**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. 派发代码评审员子代理：**

使用 `Agent` 工具（`subagent_type: "coder"`）派发一个代码评审子代理，填写 [code-reviewer.md](code-reviewer.md) 中的模板

**占位符：**
- `{DESCRIPTION}` - 你构建内容的简要说明
- `{PLAN_OR_REQUIREMENTS}` - 它应该做什么
- `{BASE_SHA}` - 起始提交
- `{HEAD_SHA}` - 结束提交

**3. 处理反馈：**
- 立即修复严重问题
- 在继续前修复重要问题
- 记录次要问题稍后处理
- 如果评审员错了，反驳（并说明理由）

## 示例

```
[刚完成任务 2：添加验证函数]

你：我先请求代码评审再继续。

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[派发代码评审员子代理]
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types
  PLAN_OR_REQUIREMENTS: Task 2 from docs/kimicodeboost/plans/deployment-plan.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[子代理返回]：
  优点：架构清晰，测试真实
  问题：
    重要：缺少进度指示器
    次要：报告间隔使用了魔术数字（100）
  评估：可以继续

你：[修复进度指示器]
[继续任务 3]
```

## 与工作流集成

**子代理驱动开发：**
- 每个任务后都评审
- 在问题复合前捕获
- 在继续下一任务前修复

**执行计划：**
- 每个任务后或在自然检查点评审
- 获取反馈、应用、继续

**临时开发：**
- 合并前评审
- 卡住时评审

## 警示信号

**切勿：**
- 因为"很简单"就跳过评审
- 忽略严重问题
- 带着未修复的重要问题继续
- 对有效的技术反馈争辩

**如果评审员错了：**
- 用技术理由反驳
- 展示能证明其有效的代码/测试
- 请求澄清

查看模板：[code-reviewer.md](code-reviewer.md)
