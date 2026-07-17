import type { AuthStatus, PullRequestDetail } from '../shared/contracts';

export function isAuthenticated(status: AuthStatus | undefined): boolean {
  return status?.providers.some((provider) => provider.hasToken) ?? false;
}

export function describeAuthStatus(status: AuthStatus | undefined): string {
  if (status === undefined) return '尚未读取登录状态';
  return isAuthenticated(status) ? '已登录 Kimi 模型账号' : '未登录 Kimi 模型账号';
}

export function pullRequestErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b(?:ENOENT|command not found)\b/i.test(message) && /\bgh\b/i.test(message)) {
    return '未找到 GitHub CLI（gh）。请先安装并登录后重试。';
  }
  if (/\b(?:401|403)\b|auth(?:entication)? failed|not logged in/i.test(message)) {
    return 'GitHub CLI 尚未登录或无权访问该仓库。请运行 gh auth login 后重试。';
  }
  return '无法加载拉取请求。请检查网络连接和 GitHub CLI 登录状态后重试。';
}

/** Build an agent prompt that asks to address PR review feedback. */
export function buildPullRequestFixPrompt(detail: PullRequestDetail): string {
  const reviews = detail.reviews
    .map((review) => `- ${review.author} (${review.state}): ${(review.body ?? '').trim() || '(无正文)'}`)
    .join('\n');
  const comments = detail.comments
    .map((comment) => `- ${comment.author}: ${(comment.body ?? '').trim() || '(无正文)'}`)
    .join('\n');
  const files = detail.files
    .map((file) => `- ${file.path} (+${String(file.additions)}/−${String(file.deletions)})`)
    .join('\n');
  return [
    `请修复拉取请求 #${String(detail.number)}「${detail.title}」上的审查反馈。`,
    '',
    `分支：${detail.headRefName} → ${detail.baseRefName}`,
    `状态：${detail.state}${detail.reviewDecision === undefined ? '' : ` · 审查：${detail.reviewDecision}`}${detail.checks === undefined ? '' : ` · 检查：${detail.checks}`}`,
    '',
    '## PR 说明',
    detail.body.trim().length > 0 ? detail.body.trim() : '(无说明)',
    '',
    '## 审查意见',
    reviews.length > 0 ? reviews : '(无审查意见)',
    '',
    '## 评论',
    comments.length > 0 ? comments : '(无评论)',
    '',
    '## 变更文件',
    files.length > 0 ? files : '(无文件列表)',
    '',
    '请阅读反馈、定位问题、提交必要修复，并保持改动范围聚焦于审查意见。完成后简要说明你做了什么。',
  ].join('\n');
}

export function gitErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/not a git repository/i.test(message)) {
    return '当前目录不是 Git 仓库。';
  }
  if (/\b(?:ENOENT|command not found)\b/i.test(message) && /\bgit\b/i.test(message)) {
    return '未找到 Git。请安装 Git 后重试。';
  }
  return 'Git 操作失败，请稍后重试。';
}
