import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { GitDiff, GitStatus, ProjectSummary } from '../../shared/contracts';
import {
  ChevronDown,
  FileCode2,
  FileDiff,
  FolderGit2,
  GitBranch,
  GitCommit,
  LoaderCircle,
  RefreshCw,
  X,
} from '../icons';
import { languageFromPath } from '../language-from-path';
import { gitErrorMessage } from '../presentation';
import {
  readProjectUi,
  writeProjectUi,
} from '../workspace-ui-persistence';
import {
  filterFilesByStage,
  gitFileStatusLabel,
  hasStagedChanges,
  isUntrackedFile,
  parseUnifiedDiffLines,
} from '../git-review';
import { GitDiffSurface } from './git-diff-surface';

const api = window.ganymede;

type BusyAction = 'fetch' | 'pull' | 'push' | 'commit' | 'checkout' | 'stage' | undefined;

export function ReviewPanel(props: {
  readonly project?: ProjectSummary;
  readonly onError: (message: string) => void;
  readonly onProjectUpdated: (project: ProjectSummary) => void;
}): ReactNode {
  const reviewSnapshot = props.project === undefined
    ? undefined
    : readProjectUi(props.project.workDir).review;
  const [status, setStatus] = useState<GitStatus>();
  const [diff, setDiff] = useState<GitDiff>();
  const [stagedTab, setStagedTab] = useState(reviewSnapshot?.stagedTab ?? false);
  const [selectedFile, setSelectedFile] = useState<string | undefined>(reviewSnapshot?.selectedFile);
  const [commit, setCommit] = useState(reviewSnapshot?.commitMessage ?? '');
  const [branches, setBranches] = useState<readonly string[]>([]);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [busy, setBusy] = useState<BusyAction>();
  const [discardTarget, setDiscardTarget] = useState<string>();
  const isGitRepository = props.project?.isGitRepository === true;

  const visibleFiles = useMemo(
    () => (status === undefined ? [] : filterFilesByStage(status.files, stagedTab)),
    [status, stagedTab],
  );
  const unstagedCount = useMemo(
    () => (status === undefined ? 0 : filterFilesByStage(status.files, false).length),
    [status],
  );
  const stagedCount = useMemo(
    () => (status === undefined ? 0 : filterFilesByStage(status.files, true).length),
    [status],
  );
  const canCommit = status !== undefined && hasStagedChanges(status.files);
  const diffLines = useMemo(() => parseUnifiedDiffLines(diff?.text ?? ''), [diff?.text]);
  const selectedIsUntracked = useMemo(() => {
    const file = visibleFiles.find((item) => item.path === selectedFile);
    return file !== undefined && isUntrackedFile(file);
  }, [visibleFiles, selectedFile]);

  const syncProject = useCallback(async () => {
    if (props.project === undefined) return;
    try {
      const next = await api.inspectProject(props.project.workDir);
      props.onProjectUpdated(next);
    } catch {
      // Best-effort; status refresh still succeeded.
    }
  }, [props]);

  const refresh = useCallback(
    async (options?: { readonly file?: string; readonly staged?: boolean }) => {
      if (props.project === undefined || !isGitRepository) return;
      const nextStaged = options?.staged ?? stagedTab;
      let nextFile = options?.file ?? selectedFile;
      try {
        const [nextStatus, nextBranches] = await Promise.all([
          api.gitStatus(props.project.workDir),
          api.gitBranches(props.project.workDir).catch(() => [] as string[]),
        ]);
        setStatus(nextStatus);
        setBranches(nextBranches);
        const filtered = filterFilesByStage(nextStatus.files, nextStaged);
        if (nextFile === undefined || !filtered.some((file) => file.path === nextFile)) {
          nextFile = filtered[0]?.path;
        }
        setSelectedFile(nextFile);
        if (nextFile !== undefined) {
          const nextDiff = await api.gitDiff(props.project.workDir, nextStaged, nextFile);
          setDiff(nextDiff);
        } else {
          setDiff(undefined);
        }
      } catch (cause) {
        props.onError(gitErrorMessage(cause));
      }
    },
    [props, isGitRepository, stagedTab, selectedFile],
  );

  useEffect(() => {
    if (props.project === undefined) return;
    const snapshot = readProjectUi(props.project.workDir).review;
    setStagedTab(snapshot.stagedTab);
    setSelectedFile(snapshot.selectedFile);
    setCommit(snapshot.commitMessage);
  }, [props.project?.workDir]);

  useEffect(() => {
    void refresh();
  }, [props.project?.workDir, isGitRepository, stagedTab]);

  useEffect(() => {
    if (props.project === undefined) return;
    writeProjectUi(props.project.workDir, {
      review: {
        stagedTab,
        selectedFile,
        commitMessage: commit,
      },
    });
  }, [props.project?.workDir, stagedTab, selectedFile, commit]);

  const runBusy = useCallback(
    async (action: BusyAction, work: () => Promise<void>) => {
      setBusy(action);
      try {
        await work();
        await refresh();
        await syncProject();
      } catch (cause) {
        props.onError(gitErrorMessage(cause));
      } finally {
        setBusy(undefined);
      }
    },
    [props, refresh, syncProject],
  );

  const selectFile = useCallback(
    (path: string) => {
      setSelectedFile(path);
      if (props.project === undefined) return;
      void api
        .gitDiff(props.project.workDir, stagedTab, path)
        .then(setDiff)
        .catch((cause) => props.onError(gitErrorMessage(cause)));
    },
    [props, stagedTab],
  );

  const switchTab = useCallback((nextStaged: boolean) => {
    setStagedTab(nextStaged);
    setSelectedFile(undefined);
    setDiff(undefined);
  }, []);

  if (props.project === undefined) {
    return (
      <div className="empty-panel">
        <span>
          <FileDiff size={22} />
        </span>
        <p>选择 Git 项目后查看改动</p>
      </div>
    );
  }
  if (!isGitRepository) {
    return (
      <div className="panel-content review-panel">
        <NonGitRepositoryState
          body="初始化 Git 后即可在此查看改动、暂存并提交。"
          workDir={props.project.workDir}
          onError={props.onError}
          onProjectUpdated={props.onProjectUpdated}
        />
      </div>
    );
  }

  const workDir = props.project.workDir;

  return (
    <div className="panel-content review-panel">
      <div className="review-header">
        <div className="review-branch">
          <button
            aria-expanded={branchMenuOpen}
            aria-label="切换分支"
            className="review-branch-button"
            onClick={() => setBranchMenuOpen((open) => !open)}
            title="切换分支"
            type="button"
          >
            <GitBranch size={13} />
            <span>{status?.branch ?? '—'}</span>
            <ChevronDown size={12} />
          </button>
          {branchMenuOpen ? (
            <div className="review-branch-menu">
              <div className="review-branch-list">
                {branches.map((branch) => (
                  <button
                    className={branch === status?.branch ? 'active' : ''}
                    disabled={busy !== undefined || branch === status?.branch}
                    key={branch}
                    onClick={() => {
                      setBranchMenuOpen(false);
                      void runBusy('checkout', async () => {
                        await api.gitCheckout(workDir, branch);
                      });
                    }}
                    type="button"
                  >
                    {branch}
                  </button>
                ))}
              </div>
              <form
                className="review-branch-create"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newBranchName.trim();
                  if (name.length === 0) return;
                  setBranchMenuOpen(false);
                  setNewBranchName('');
                  void runBusy('checkout', async () => {
                    await api.gitCreateBranch(workDir, name);
                  });
                }}
              >
                <input
                  onChange={(event) => setNewBranchName(event.target.value)}
                  placeholder="新建分支…"
                  value={newBranchName}
                />
                <button disabled={newBranchName.trim().length === 0 || busy !== undefined} type="submit">
                  创建
                </button>
              </form>
            </div>
          ) : null}
        </div>
        {status?.upstream !== undefined && (status.ahead > 0 || status.behind > 0) ? (
          <span className="review-sync-badge" title={status.upstream}>
            {status.ahead > 0 ? `↑${String(status.ahead)}` : null}
            {status.ahead > 0 && status.behind > 0 ? ' ' : null}
            {status.behind > 0 ? `↓${String(status.behind)}` : null}
          </span>
        ) : null}
        <div className="review-sync-actions">
          <button
            aria-label="刷新改动"
            disabled={busy !== undefined}
            onClick={() => void refresh()}
            title="刷新改动"
            type="button"
          >
            <RefreshCw size={13} />
          </button>
          <button
            disabled={busy !== undefined}
            onClick={() =>
              void runBusy('fetch', async () => {
                await api.gitFetch(workDir);
              })
            }
            title="Fetch"
            type="button"
          >
            {busy === 'fetch' ? <LoaderCircle className="spin" size={13} /> : null}
            Fetch
          </button>
          <button
            disabled={busy !== undefined}
            onClick={() =>
              void runBusy('pull', async () => {
                await api.gitPull(workDir);
              })
            }
            title="Pull"
            type="button"
          >
            {busy === 'pull' ? <LoaderCircle className="spin" size={13} /> : null}
            Pull
          </button>
          <button
            disabled={busy !== undefined}
            onClick={() =>
              void runBusy('push', async () => {
                await api.gitPush(workDir);
              })
            }
            title="Push"
            type="button"
          >
            {busy === 'push' ? <LoaderCircle className="spin" size={13} /> : null}
            推送
          </button>
        </div>
      </div>

      <div className="segmented">
        <button
          className={!stagedTab ? 'active' : ''}
          onClick={() => switchTab(false)}
          type="button"
        >
          未暂存 ({String(unstagedCount)})
        </button>
        <button
          className={stagedTab ? 'active' : ''}
          onClick={() => switchTab(true)}
          type="button"
        >
          已暂存 ({String(stagedCount)})
        </button>
      </div>

      <div className="review-toolbar">
        {!stagedTab ? (
          <button
            disabled={busy !== undefined || unstagedCount === 0}
            onClick={() =>
              void runBusy('stage', async () => {
                await api.gitStage(workDir, []);
              })
            }
            type="button"
          >
            全部暂存
          </button>
        ) : (
          <button
            disabled={busy !== undefined || stagedCount === 0}
            onClick={() =>
              void runBusy('stage', async () => {
                const paths = filterFilesByStage(status?.files ?? [], true).map((file) => file.path);
                if (paths.length === 0) return;
                await api.gitUnstage(workDir, paths);
              })
            }
            type="button"
          >
            全部取消
          </button>
        )}
        {!stagedTab && selectedFile !== undefined ? (
          <button
            disabled={busy !== undefined || selectedIsUntracked}
            onClick={() => setDiscardTarget(selectedFile)}
            type="button"
          >
            丢弃改动
          </button>
        ) : null}
      </div>

      <div className="changed-files">
        {visibleFiles.map((file) => (
          <div
            className={file.path === selectedFile ? 'selected' : ''}
            key={file.path}
            onClick={() => selectFile(file.path)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectFile(file.path);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <FileCode2 size={13} />
            <span title={file.path}>{file.path}</span>
            <code>{gitFileStatusLabel(file)}</code>
            <button
              onClick={(event) => {
                event.stopPropagation();
                void runBusy('stage', async () => {
                  if (stagedTab) {
                    await api.gitUnstage(workDir, [file.path]);
                  } else {
                    await api.gitStage(workDir, [file.path]);
                  }
                });
              }}
              type="button"
            >
              {stagedTab ? '取消' : '暂存'}
            </button>
          </div>
        ))}
        {visibleFiles.length === 0 ? (
          <div className="changed-files-empty">没有{stagedTab ? '已暂存' : '未暂存'}的改动</div>
        ) : null}
      </div>

      {diff?.truncated === true ? (
        <p className="review-diff-truncated">Diff 过大，已截断显示。</p>
      ) : null}
      {selectedFile !== undefined && diffLines.length > 0 ? (
        <GitDiffSurface language={languageFromPath(selectedFile)} lines={diffLines} />
      ) : (
        <pre className="diff-view">
          {selectedFile === undefined ? '选择文件以查看改动。' : '没有可显示的改动。'}
        </pre>
      )}

      <div className="commit-box">
        <input
          onChange={(event) => setCommit(event.target.value)}
          placeholder="提交说明"
          value={commit}
        />
        <button
          disabled={commit.trim().length === 0 || !canCommit || busy !== undefined}
          onClick={() =>
            void runBusy('commit', async () => {
              await api.gitCommit(workDir, commit);
              setCommit('');
            })
          }
          type="button"
        >
          {busy === 'commit' ? <LoaderCircle className="spin" size={14} /> : <GitCommit size={14} />}
          提交
        </button>
      </div>

      {discardTarget !== undefined ? (
        <div className="modal-backdrop">
          <div className="modal">
            <header>
              <strong>丢弃工作区改动</strong>
              <button
                aria-label="关闭"
                onClick={() => setDiscardTarget(undefined)}
                title="关闭"
                type="button"
              >
                <X size={16} />
              </button>
            </header>
            <div className="modal-body">
              <div className="confirm-sheet">
                <p>确定丢弃「{discardTarget}」的未提交改动吗？此操作不可撤销。</p>
                <div className="modal-actions">
                  <button onClick={() => setDiscardTarget(undefined)} type="button">
                    取消
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => {
                      const path = discardTarget;
                      setDiscardTarget(undefined);
                      void runBusy('stage', async () => {
                        await api.gitRevert(workDir, [path]);
                      });
                    }}
                    type="button"
                  >
                    丢弃改动
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NonGitRepositoryState(props: {
  readonly body: string;
  readonly workDir: string;
  readonly onError: (message: string) => void;
  readonly onProjectUpdated: (project: ProjectSummary) => void;
}): ReactNode {
  const [initializing, setInitializing] = useState(false);
  return (
    <div className="empty-state">
      <span>
        <FolderGit2 size={22} />
      </span>
      <strong>当前目录不是 Git 仓库</strong>
      <p>{props.body}</p>
      <button
        className="primary-button"
        disabled={initializing}
        onClick={() => {
          setInitializing(true);
          void api
            .gitInit(props.workDir)
            .then((project) => props.onProjectUpdated(project))
            .catch((cause) => props.onError(gitErrorMessage(cause)))
            .finally(() => setInitializing(false));
        }}
        type="button"
      >
        {initializing ? '正在初始化…' : '初始化 Git 仓库'}
      </button>
    </div>
  );
}
