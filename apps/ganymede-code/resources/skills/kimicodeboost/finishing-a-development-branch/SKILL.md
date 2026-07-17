---
name: finishing-a-development-branch
description: 当实现完成、所有测试通过且需要决定如何集成工作时必须使用——通过呈现结构化的本地合并、创建 PR 或清理工作树等选项，指导开发工作的收尾
---

# 完成开发分支

## 概述

通过呈现清晰的选项并处理所选工作流，指导开发工作的收尾。

**核心原则：** 验证测试 → 检测环境 → 呈现选项 → 执行选择 → 清理。

**开始时声明：** "我正在使用 finishing-a-development-branch 技能来完成这项工作。"

## 流程

### 步骤 1：验证测试

**在呈现选项之前，先验证测试是否通过：**

```bash
# 运行项目测试套件
npm test / cargo test / pytest / go test ./...
```

**如果测试失败：**
```
测试失败（<N> 处失败）。必须在完成前修复：

[显示失败]

在测试通过前无法继续合并/PR。
```

停止。不要进入步骤 2。

**如果测试通过：** 继续步骤 2。

### 步骤 2：检测环境

**在呈现选项之前，先确定工作区状态：**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

这决定了显示哪个菜单以及清理如何进行：

| 状态 | 菜单 | 清理 |
|------|------|------|
| `GIT_DIR == GIT_COMMON`（普通仓库） | 标准 4 个选项 | 无需清理工作树 |
| `GIT_DIR != GIT_COMMON`，命名分支 | 标准 4 个选项 | 基于来源（见步骤 6） |
| `GIT_DIR != GIT_COMMON`，分离头指针 | 精简 3 个选项（无合并） | 无需清理（外部管理） |

### 步骤 3：确定基础分支

```bash
# 尝试常见的基础分支
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

或询问："该分支从 main 分出——是否正确？"

### 步骤 4：呈现选项

**普通仓库和命名分支工作树——准确呈现以下 4 个选项：**

```
实现已完成。您希望如何操作？

1. 在本地合并回 <base-branch>
2. 推送并创建 Pull Request
3. 保持分支原样（稍后自行处理）
4. 丢弃此工作

选择哪个选项？
```

**分离头指针——准确呈现以下 3 个选项：**

```
实现已完成。您当前处于分离头指针状态（外部管理的工作区）。

1. 推送到新分支并创建 Pull Request
2. 保持原样（稍后自行处理）
3. 丢弃此工作

选择哪个选项？
```

**不要添加解释**——保持选项简洁。

### 步骤 5：执行选择

#### 选项 1：本地合并

```bash
# 获取主仓库根目录以确保当前工作目录安全
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"

# 先合并——在删除任何内容前验证成功
git checkout <base-branch>
git pull
git merge <feature-branch>

# 验证合并结果上的测试
<test command>

# 仅在合并成功后：清理工作树（步骤 6），然后删除分支
```

然后：清理工作树（步骤 6），然后删除分支：

```bash
git branch -d <feature-branch>
```

#### 选项 2：推送并创建 PR

```bash
# 推送分支
git push -u origin <feature-branch>
```

**不要清理工作树**——用户需要保留它来根据 PR 反馈迭代。

#### 选项 3：保持原样

报告："保留分支 <name>。工作树保留在 <path>。"

**不要清理工作树。**

#### 选项 4：丢弃

**首先确认：**
```
这将永久删除：
- 分支 <name>
- 所有提交：<commit-list>
- 位于 <path> 的工作树

输入 'discard' 以确认。
```

等待准确确认。

如果已确认：
```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
```

然后：清理工作树（步骤 6），然后强制删除分支：
```bash
git branch -D <feature-branch>
```

### 步骤 6：清理工作区

**仅在选项 1 和 4 中执行。** 选项 2 和 3 始终保留工作树。

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

**如果 `GIT_DIR == GIT_COMMON`：** 普通仓库，无需清理工作树。完成。

**如果工作树路径位于 `.worktrees/` 或 `worktrees/` 下：** KimiCodeBoost 创建了该工作树——我们负责清理。

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
git worktree remove "$WORKTREE_PATH"
git worktree prune  # 自愈：清理任何过期的注册
```

**否则：** 宿主环境（harness）拥有此工作区。不要删除它。如果您的平台提供了工作区退出工具，请使用它。否则，保持工作区原位。

## 快速参考

| 选项 | 合并 | 推送 | 保留工作树 | 清理分支 |
|------|------|------|------------|----------|
| 1. 本地合并 | 是 | - | - | 是 |
| 2. 创建 PR | - | 是 | 是 | - |
| 3. 保持原样 | - | - | 是 | - |
| 4. 丢弃 | - | - | - | 是（强制） |

## 常见错误

**跳过测试验证**
- **问题：** 合并有问题的代码，创建失败的 PR
- **修复：** 在提供选项前始终验证测试

**开放式问题**
- **问题：** "我接下来该做什么？" 含义模糊
- **修复：** 准确呈现 4 个结构化选项（分离头指针时为 3 个）

**为选项 2 清理工作树**
- **问题：** 删除了用户用于 PR 迭代的工作树
- **修复：** 仅对选项 1 和 4 进行清理

**在移除工作树前删除分支**
- **问题：** `git branch -d` 失败，因为工作树仍引用该分支
- **修复：** 先合并，再移除工作树，然后删除分支

**在工作树内部运行 `git worktree remove`**
- **问题：** 当当前工作目录位于要移除的工作树内时，命令会静默失败
- **修复：** 在 `git worktree remove` 之前始终 `cd` 到主仓库根目录

**清理 harness 拥有的工作树**
- **问题：** 删除 harness 创建的工作树会导致幽灵状态
- **修复：** 仅清理位于 `.worktrees/` 或 `worktrees/` 下的工作树

**丢弃时没有确认**
- **问题：** 意外删除工作
- **修复：** 要求输入 "discard" 确认

## 危险信号

**禁止：**
- 在测试失败时继续
- 未验证合并结果上的测试就合并
- 未经确认删除工作
- 未经明确要求强制推送
- 在确认合并成功前移除工作树
- 清理你未创建的工作树（来源检查）
- 在工作树内部运行 `git worktree remove`

**必须：**
- 在提供选项前验证测试
- 在显示菜单前检测环境
- 准确呈现 4 个选项（分离头指针时为 3 个）
- 为选项 4 获取输入确认
- 仅对选项 1 和 4 清理工作树
- 在移除工作树前 `cd` 到主仓库根目录
- 移除后运行 `git worktree prune`
