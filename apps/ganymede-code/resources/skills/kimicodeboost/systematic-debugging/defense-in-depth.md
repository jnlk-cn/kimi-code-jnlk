# Defense-in-Depth Validation

## 概述

当你修复一个由无效数据引起的 bug 时，只在一个地方添加验证似乎就够了。但单一检查可能被不同的代码路径、重构或 mock 绕过。

**核心原则：** 在数据经过的每一层都进行验证。让 bug 在结构上不可能发生。

## 为什么要多层验证

单层验证："我们修复了这个 bug"
多层验证："我们让这个 bug 不可能发生"

不同层捕获不同情况：
- 入口验证捕获大多数 bug
- 业务逻辑捕获边界情况
- 环境防护阻止特定上下文下的危险
- 调试日志在其他层失败时提供帮助

## 四层防御

### 第一层：入口点验证
**目的：** 在 API 边界拒绝明显无效的输入

```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory cannot be empty');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory does not exist: ${workingDirectory}`);
  }
  if (!statSync(workingDirectory).isDirectory()) {
    throw new Error(`workingDirectory is not a directory: ${workingDirectory}`);
  }
  // ... proceed
}
```

### 第二层：业务逻辑验证
**目的：** 确保数据对该操作有意义

```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir required for workspace initialization');
  }
  // ... proceed
}
```

### 第三层：环境防护
**目的：** 在特定上下文中阻止危险操作

```typescript
async function gitInit(directory: string) {
  // In tests, refuse git init outside temp directories
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));

    if (!normalized.startsWith(tmpDir)) {
      throw new Error(
        `Refusing git init outside temp dir during tests: ${directory}`
      );
    }
  }
  // ... proceed
}
```

### 第四层：调试插桩
**目的：** 捕获取证所需的上下文

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  logger.debug('About to git init', {
    directory,
    cwd: process.cwd(),
    stack,
  });
  // ... proceed
}
```

## 应用该模式

当你发现一个 bug 时：

1. **追踪数据流** - 坏值从哪里产生？在哪里使用？
2. **映射所有检查点** - 列出数据经过的每一个点
3. **在每一层添加验证** - 入口、业务、环境、调试
4. **测试每一层** - 尝试绕过第一层，验证第二层能捕获

## 会话中的示例

Bug：空的 `projectDir` 导致在源代码目录中执行 `git init`

**数据流：**
1. 测试设置 → 空字符串
2. `Project.create(name, '')`
3. `WorkspaceManager.createWorkspace('')`
4. `git init` 在 `process.cwd()` 中运行

**添加的四层防御：**
- 第一层：`Project.create()` 验证非空/存在/可写
- 第二层：`WorkspaceManager` 验证 projectDir 非空
- 第三层：`WorktreeManager` 在测试中拒绝 tmpdir 外的 git init
- 第四层：git init 前记录堆栈日志

**结果：** 全部 1847 个测试通过，bug 无法复现

## 关键洞察

四层防御都是必要的。在测试过程中，每一层都捕获了其他层遗漏的 bug：
- 不同代码路径绕过了入口验证
- Mock 绕过了业务逻辑检查
- 不同平台的边界情况需要环境防护
- 调试日志识别出结构性误用

**不要只停在一个验证点。** 在每一层都添加检查。
