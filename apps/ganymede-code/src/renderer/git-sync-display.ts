import type { GitLineStats, GitStatus } from '../shared/contracts';

export function formatLineStats(stats: GitLineStats | undefined): string {
  const additions = stats?.additions ?? 0;
  const deletions = stats?.deletions ?? 0;
  return `+${String(additions)} / −${String(deletions)}`;
}

export function formatSyncState(status: Pick<GitStatus, 'ahead' | 'behind' | 'upstream'>): string {
  if (status.upstream === undefined) return '未设置上游分支';
  if (status.ahead === 0 && status.behind === 0) return '已与远程同步';
  if (status.ahead > 0 && status.behind > 0) {
    return `领先 ${String(status.ahead)} · 落后 ${String(status.behind)}`;
  }
  if (status.ahead > 0) return `领先 ${String(status.ahead)} 个提交`;
  return `落后 ${String(status.behind)} 个提交`;
}
