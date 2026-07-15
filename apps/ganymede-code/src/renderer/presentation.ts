import type { AuthStatus } from '../shared/contracts';

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
