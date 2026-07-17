import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { FolderGit2, RefreshCw } from 'lucide-react';

import type { GitStatus, ProjectSummary } from '../../shared/contracts';
import { EmptyState, PageFrame } from '../page-chrome';
import { formatLineStats, formatSyncState } from '../git-sync-display';
import { gitFileStatusLabel } from '../git-review';
import { gitErrorMessage } from '../presentation';

const api = window.ganymede;

export function GitSyncPage(props: {
  readonly project?: ProjectSummary;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [status, setStatus] = useState<GitStatus>();
  const [loading, setLoading] = useState(false);
  const isGitRepository = props.project?.isGitRepository === true;

  const refresh = useCallback(() => {
    if (props.project === undefined || !isGitRepository) {
      setStatus(undefined);
      return;
    }
    setLoading(true);
    void api
      .gitStatus(props.project.workDir)
      .then(setStatus)
      .catch((cause) => {
        setStatus(undefined);
        props.onError(gitErrorMessage(cause));
      })
      .finally(() => setLoading(false));
  }, [props.project, props.onError, isGitRepository]);

  useEffect(refresh, [refresh, props.project?.updatedAt]);

  if (props.project === undefined) {
    return (
      <PageFrame
        icon={<RefreshCw />}
        title="Git同步"
        subtitle="查看本地与远程同步状态及工作区改动概览（只读）。"
      >
        <EmptyState
          icon={<FolderGit2 size={22} />}
          title="请选择项目"
          body="打开一个本地项目后，即可在此查看分支同步与改动统计。"
        />
      </PageFrame>
    );
  }

  if (!isGitRepository) {
    return (
      <PageFrame
        icon={<RefreshCw />}
        title="Git同步"
        subtitle="查看本地与远程同步状态及工作区改动概览（只读）。"
      >
        <EmptyState
          icon={<FolderGit2 size={22} />}
          title="当前不是 Git 仓库"
          body="此面板仅展示同步状态，不会初始化或管理仓库。可在审查面板中初始化 Git 后再回来查看。"
        />
      </PageFrame>
    );
  }

  const lineStats = status?.lineStats;
  const files = status === undefined ? [] : [...status.files].sort((a, b) => a.path.localeCompare(b.path));

  return (
    <PageFrame
      icon={<RefreshCw />}
      title="Git同步"
      subtitle="查看本地与远程同步状态及工作区改动概览（只读）。"
      action={
        <div className="page-heading-actions">
          <button
            aria-label="刷新同步状态"
            disabled={loading}
            onClick={refresh}
            title="刷新"
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      }
    >
      <div className="git-sync-page">
        <section className="summary-section">
          <h3>分支</h3>
          <p>
            <strong>{status?.branch ?? (loading ? '…' : '—')}</strong>
            {status?.upstream !== undefined ? (
              <span className="git-sync-muted"> → {status.upstream}</span>
            ) : (
              <span className="git-sync-muted"> · 未设置上游分支</span>
            )}
          </p>
          <p className="git-sync-state">
            {status === undefined ? (loading ? '正在读取…' : '—') : formatSyncState(status)}
          </p>
        </section>

        <div className="metric-grid">
          <Metric label="领先" value={status === undefined ? '—' : status.ahead} />
          <Metric label="落后" value={status === undefined ? '—' : status.behind} />
          <Metric label="改动文件" value={status === undefined ? '—' : status.files.length} />
          <Metric
            label="同步状态"
            value={
              status === undefined
                ? '—'
                : status.upstream === undefined
                  ? '无上游'
                  : status.ahead === 0 && status.behind === 0
                    ? '已同步'
                    : '有差异'
            }
          />
        </div>

        <section className="summary-section">
          <h3>行数统计</h3>
          <div className="metric-grid">
            <Metric label="汇总" value={formatLineStats(lineStats?.total)} />
            <Metric label="已暂存" value={formatLineStats(lineStats?.staged)} />
            <Metric label="未暂存" value={formatLineStats(lineStats?.unstaged)} />
          </div>
        </section>

        <section className="summary-section">
          <h3>改动文件</h3>
          {files.length === 0 ? (
            <p className="git-sync-muted">{loading ? '正在读取…' : '工作区干净，没有本地改动。'}</p>
          ) : (
            <div className="git-sync-file-list">
              {files.map((file) => (
                <div className="git-sync-file-row" key={file.path}>
                  <span>{file.path}</span>
                  <code>{gitFileStatusLabel(file)}</code>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="git-sync-hint">
          同步计数基于本地已知的远程跟踪信息；刷新远程状态或执行 fetch / pull / push 请在审查面板操作。
        </p>
      </div>
    </PageFrame>
  );
}

function Metric(props: { readonly label: string; readonly value: ReactNode }): ReactNode {
  return (
    <div className="metric">
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </div>
  );
}
