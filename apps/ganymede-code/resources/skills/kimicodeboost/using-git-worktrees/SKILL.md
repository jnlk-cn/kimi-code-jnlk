---
name: using-git-worktrees
description: 当开始需要与当前工作区隔离的功能开发，或执行实现方案之前，必须使用本 skill；通过原生工具或 git worktree 回退机制确保独立工作空间已存在
---

# 使用 Git Worktrees

## 概述

确保工作在独立工作空间中进行。优先使用平台原生的 worktree 工具。仅当没有原生工具可用时，才回退到手动 git worktree。

**核心原则：** 先检测现有隔离。再使用原生工具。最后回退到 git。切勿与 harness 对抗。

**开始时声明：** "我正在使用 using-git-worktrees skill 来设置独立工作空间。"

## 第 0 步：检测现有隔离

**在创建任何内容之前，先检查你是否已经处于独立工作空间中。**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

**子模块防护：** 在 git 子模块内部，`GIT_DIR != GIT_COMMON` 同样成立。在得出"已经在 worktree 中"的结论前，先确认自己不在子模块里：

```bash
# 如果返回路径，说明你在子模块中，而不是 worktree 中——按普通仓库处理
git rev-parse --show-superproject-working-tree 2>/dev/null
```

**如果 `GIT_DIR != GIT_COMMON`（且不是子模块）：** 你已经位于一个 linked worktree 中。直接跳到第 2 步（项目设置）。不要创建另一个 worktree。

按分支状态报告：
- 在分支上："已在 `<path>` 的独立工作空间中，位于分支 `<name>`。"
- 分离 HEAD："已在 `<path>` 的独立工作空间中（分离 HEAD，由外部管理）。需要在收尾时创建分支。"

**如果 `GIT_DIR == GIT_COMMON`（或在子模块中）：** 你处于普通的仓库检出状态。

用户是否已经在你的指令中表明了 worktree 偏好？如果没有，在创建 worktree 前先征求同意：

> "是否要我设置一个独立的 worktree？这样可以保护当前分支不被修改。"

如果已有明确偏好，直接按偏好执行，无需再问。如果用户拒绝同意，就在原地工作并跳到第 2 步。

## 第 1 步：创建独立工作空间

**你有两种机制，按以下顺序尝试。**

### 1a. 原生 Worktree 工具（优先）

用户已经同意创建独立工作空间（第 0 步）。Kimi Code CLI 当前没有提供原生 worktree 创建工具（如 `EnterWorktree`、`WorktreeCreate` 或 `/worktree` 命令），因此直接跳到第 1b 步使用 `git worktree` 回退方案。

如果未来 Kimi Code CLI 增加了原生 worktree 工具，应优先使用它并跳到第 2 步。在没有原生工具时使用 `git worktree add`，会生成 harness 无法看见或管理的幽灵状态。

### 1b. Git Worktree 回退

**仅在第 1a 步不适用时使用**——即你没有原生 worktree 工具可用。使用 git 手动创建 worktree。

#### 目录选择

遵循以下优先级顺序。用户明确指定的目录始终优先于文件系统当前状态。

1. **检查指令中是否声明了 worktree 目录偏好。** 如果用户已指定，直接使用，无需询问。

2. **检查是否已存在项目本地 worktree 目录：**
   ```bash
   ls -d .worktrees 2>/dev/null     # 优先（隐藏目录）
   ls -d worktrees 2>/dev/null      # 备选
   ```
   如果存在，则使用。如果两者都存在，`.worktrees` 优先。

3. **如果没有其他可用指引**，默认使用项目根目录下的 `.worktrees/`。

#### 安全校验（仅项目本地目录）

**必须确认目录已被忽略，然后才能创建 worktree：**

```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**如果未被忽略：** 先添加到 `.gitignore`，提交更改，然后再继续。

**重要性：** 防止意外将 worktree 内容提交到仓库。

#### 创建 Worktree

```bash
# 根据选定的位置确定路径
path="$LOCATION/$BRANCH_NAME"

git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

**Sandbox 回退：** 如果 `git worktree add` 因权限错误失败（sandbox 拒绝），告知用户 sandbox 阻止了 worktree 创建，你将在当前目录中工作。然后在原地运行设置和基线测试。

## 第 2 步：项目设置

自动检测并运行相应的设置：

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

## 第 3 步：验证干净基线

运行测试，确保工作空间以干净状态开始：

```bash
# 使用适合项目的命令
npm test / cargo test / pytest / go test ./...
```

**如果测试失败：** 报告失败，并询问是继续还是排查。

**如果测试通过：** 报告准备就绪。

### 报告

```
Worktree 已就绪：<full-path>
测试通过（<N> 个测试，0 个失败）
准备实现：<feature-name>
```

## 快速参考

| 情况 | 操作 |
|-----------|--------|
| 已在 linked worktree 中 | 跳过创建（第 0 步） |
| 在子模块中 | 按普通仓库处理（第 0 步防护） |
| 有原生 worktree 工具可用 | 使用它（第 1a 步） |
| 无原生工具 | Git worktree 回退（第 1b 步） |
| `.worktrees/` 已存在 | 使用它（确认已忽略） |
| `worktrees/` 已存在 | 使用它（确认已忽略） |
| 两者都存在 | 使用 `.worktrees/` |
| 两者都不存在 | 先检查指令文件，再默认使用 `.worktrees/` |
| 目录未被忽略 | 添加到 `.gitignore` 并提交 |
| 创建时权限错误 | Sandbox 回退，原地工作 |
| 基线测试失败 | 报告失败并询问 |
| 无 package.json/Cargo.toml 等 | 跳过依赖安装 |

## 常见错误

### 与 harness 对抗

- **问题：** 在平台已提供隔离的情况下仍使用 `git worktree add`
- **修复：** 第 0 步检测现有隔离。第 1a 步优先使用原生工具。

### 跳过检测

- **问题：** 在现有 worktree 内部创建嵌套 worktree
- **修复：** 创建任何东西前都要先执行第 0 步

### 跳过忽略校验

- **问题：** worktree 内容被跟踪，污染 git 状态
- **修复：** 创建项目本地 worktree 前始终使用 `git check-ignore`

### 假定目录位置

- **问题：** 造成不一致，违反项目约定
- **修复：** 遵循优先级：明确指令 > 现有项目本地目录 > 默认值

### 在测试失败时继续

- **问题：** 无法区分新 bug 与既有问题
- **修复：** 报告失败，获得明确同意后再继续

## 红线

**绝不能：**
- 第 0 步已检测到现有隔离时仍创建 worktree
- 有原生 worktree 工具（例如 `EnterWorktree`）时使用 `git worktree add`。这是头号错误——如果有，就用它。
- 跳过第 1a 步直接执行第 1b 步的 git 命令
- 未确认已忽略就创建项目本地 worktree
- 跳过基线测试验证
- 未询问就在测试失败时继续

**必须始终：**
- 先执行第 0 步检测
- 优先使用原生工具而非 git 回退
- 遵循目录优先级：明确指令 > 现有项目本地目录 > 默认值
- 对项目本地目录确认已被忽略
- 自动检测并运行项目设置
- 验证干净测试基线
