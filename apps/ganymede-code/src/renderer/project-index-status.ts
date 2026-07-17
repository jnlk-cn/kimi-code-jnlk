import { useEffect, useState } from 'react';

import type { IndexStatus } from '../shared/contracts';

export function indexBadgeLabel(status: IndexStatus | undefined): string {
  if (status === undefined) return '索引…';
  if (status.state === 'disabled') return '索引关闭';
  if (status.state === 'idle') return '未索引';
  if (status.state === 'blocked') return '待确认';
  if (status.state === 'indexing') {
    return `索引 ${String(Math.round(status.progress * 100))}%`;
  }
  if (status.state === 'error') return '索引错误';
  if (status.state === 'ready') {
    return status.semanticReady ? '已索引' : '全文索引';
  }
  return '未索引';
}

export function indexStatusTitle(status: IndexStatus | undefined): string | undefined {
  if (status === undefined) return '正在读取索引状态…';
  if (status.state === 'disabled') {
    return '项目索引已在设置中关闭；可在设置中重新启用';
  }
  if (status.state === 'idle') {
    return '项目尚未建立本地索引；点击可查看说明并开始索引';
  }
  if (status.state === 'blocked') {
    return status.error ?? '此目录需确认后才会建立索引';
  }
  if (status.error !== undefined) return status.error;
  const truncated = status.truncated === true ? ' · 已截断' : '';
  return `索引 ${String(status.fileCount)} 个文件 · ${String(status.chunkCount)} 块${truncated}`;
}

export function useProjectIndexStatus(workDir: string | undefined): IndexStatus | undefined {
  const [indexStatus, setIndexStatus] = useState<IndexStatus>();

  useEffect(() => {
    let alive = true;
    setIndexStatus(undefined);
    if (workDir === undefined) {
      return () => {
        alive = false;
      };
    }
    const refresh = (): void => {
      void window.ganymede
        .indexStatus(workDir)
        .then((status) => {
          if (alive) setIndexStatus(status);
        })
        .catch(() => {
          if (alive) setIndexStatus(undefined);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 2_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [workDir]);

  return indexStatus;
}
