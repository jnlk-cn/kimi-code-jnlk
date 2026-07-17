import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, FolderGit2, GitPullRequest, Plus, RefreshCw, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type {
  ProjectSummary,
  PullRequestDetail,
  PullRequestSummary,
} from '../../shared/contracts';
import { EmptyState, Modal, PageFrame, messageOf } from '../page-chrome';
import { buildPullRequestFixPrompt, gitErrorMessage, pullRequestErrorMessage } from '../presentation';

const api = window.ganymede;

type PrStateFilter = 'open' | 'merged' | 'closed' | 'all';

export function PullsPage(props: {
  readonly project?: ProjectSummary;
  readonly onError: (message: string) => void;
  readonly onProjectUpdated: (project: ProjectSummary) => void;
  readonly onOpenTask: (sessionId: string) => void;
}): ReactNode {
  const [pulls, setPulls] = useState<readonly PullRequestSummary[]>([]);
  const [selected, setSelected] = useState<PullRequestDetail>();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [state, setState] = useState<PrStateFilter>('open');
  const [fixing, setFixing] = useState(false);
  const isGitRepository = props.project?.isGitRepository === true;

  const refresh = useCallback(() => {
    if (props.project === undefined || !isGitRepository) return;
    void api
      .pullRequests(props.project.workDir, state)
      .then(setPulls)
      .catch((cause) => props.onError(pullRequestErrorMessage(cause)));
  }, [props.project, props.onError, isGitRepository, state]);

  useEffect(refresh, [refresh]);

  if (props.project !== undefined && !isGitRepository) {
    return (
      <PageFrame icon={<GitPullRequest />} title="拉取请求" subtitle="查看检查、审查意见并让代理修复反馈。">
        <NonGitRepositoryState
          body="初始化 Git 后即可查看并创建拉取请求。"
          workDir={props.project.workDir}
          onError={props.onError}
          onProjectUpdated={props.onProjectUpdated}
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame
      icon={<GitPullRequest />}
      title="拉取请求"
      subtitle="查看检查、审查意见并让代理修复反馈。"
      action={
        props.project === undefined ? undefined : (
          <div className="page-heading-actions">
            <button aria-label="刷新拉取请求" onClick={refresh} title="刷新" type="button">
              <RefreshCw size={14} />
            </button>
            <button className="primary-button" onClick={() => setCreating((value) => !value)} type="button">
              <Plus size={14} /> 创建 PR
            </button>
          </div>
        )
      }
    >
      <div className="page-toolbar">
        <div className="segmented-control" role="tablist" aria-label="PR 状态">
          {(
            [
              ['open', '打开'],
              ['merged', '已合并'],
              ['closed', '已关闭'],
              ['all', '全部'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-selected={state === value}
              className={state === value ? 'selected' : undefined}
              onClick={() => setState(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {creating && props.project !== undefined ? (
        <div className="pr-create">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="PR 标题" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="说明改动、验证与风险" />
          <button
            className="primary-button"
            disabled={!title.trim()}
            onClick={() =>
              void api
                .createPullRequest(props.project!.workDir, title, body)
                .then((url) => {
                  setCreating(false);
                  setTitle('');
                  setBody('');
                  void api.openExternal(url);
                  refresh();
                })
                .catch((cause) => props.onError(pullRequestErrorMessage(cause)))
            }
            type="button"
          >
            创建并打开
          </button>
        </div>
      ) : null}
      <div className="card-list">
        {pulls.map((pull) => (
          <button
            className="pr-card"
            key={pull.number}
            onClick={() =>
              props.project &&
              void api
                .pullRequestDetail(props.project.workDir, pull.number)
                .then(setSelected)
                .catch((cause) => props.onError(pullRequestErrorMessage(cause)))
            }
            type="button"
          >
            <GitPullRequest size={17} />
            <div>
              <strong>
                #{pull.number} {pull.title}
              </strong>
              <span>
                {pull.headRefName} → {pull.baseRefName}
              </span>
              <small>
                {pull.author} · {pull.checks ?? pull.reviewDecision ?? pull.state}
              </small>
              {pull.checks === undefined ? null : (
                <span className={`pr-check-pill ${checkTone(pull.checks)}`}>{pull.checks}</span>
              )}
            </div>
            <ChevronRight size={16} />
          </button>
        ))}
        {props.project !== undefined && pulls.length === 0 ? (
          <EmptyState
            icon={<GitPullRequest />}
            title="没有匹配的 PR"
            body="需要已安装并登录的 GitHub CLI。可切换状态筛选或创建新的拉取请求。"
          />
        ) : null}
      </div>
      {selected === undefined ? null : (
        <Modal title={`#${String(selected.number)} ${selected.title}`} onClose={() => setSelected(undefined)}>
          <div className="pr-detail">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.body}</ReactMarkdown>
            <h3>审查</h3>
            {selected.reviews.map((review, index) => (
              <div key={`${review.author}:${String(index)}`}>
                <strong>
                  {review.author} · {review.state}
                </strong>
                <p>{review.body}</p>
              </div>
            ))}
            {selected.comments.map((comment, index) => (
              <div key={`${comment.author}:${String(index)}`}>
                <strong>{comment.author}</strong>
                <p>{comment.body}</p>
              </div>
            ))}
            <h3>文件</h3>
            {selected.files.map((file) => (
              <div className="pr-file" key={file.path}>
                <span>{file.path}</span>
                <code>
                  +{file.additions} −{file.deletions}
                </code>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button onClick={() => void api.openExternal(selected.url)} type="button">
              在 GitHub 打开
            </button>
            <button
              className="primary-button"
              disabled={fixing || props.project === undefined}
              onClick={() => {
                if (props.project === undefined) return;
                setFixing(true);
                void startAgentFix(props.project.workDir, selected)
                  .then((sessionId) => {
                    setSelected(undefined);
                    props.onOpenTask(sessionId);
                  })
                  .catch((cause) => props.onError(messageOf(cause)))
                  .finally(() => setFixing(false));
              }}
              type="button"
            >
              <Sparkles size={14} /> {fixing ? '正在启动…' : '让代理修复'}
            </button>
          </div>
        </Modal>
      )}
    </PageFrame>
  );
}

async function startAgentFix(workDir: string, detail: PullRequestDetail): Promise<string> {
  await api.gitFetch(workDir).catch(() => undefined);
  try {
    await api.gitCheckout(workDir, detail.headRefName);
  } catch (error) {
    throw new Error(
      `无法切换到分支 ${detail.headRefName}：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const snapshot = await api.createSession({
    workDir,
    permission: 'manual',
    target: 'local',
  });
  await api.prompt({
    sessionId: snapshot.id,
    text: buildPullRequestFixPrompt(detail),
  });
  return snapshot.id;
}

function checkTone(checks: string): 'success' | 'pending' | 'failure' {
  const lower = checks.toLowerCase();
  if (/(fail|error|cancel)/.test(lower)) return 'failure';
  if (/(pending|queued|progress|running)/.test(lower)) return 'pending';
  return 'success';
}

function NonGitRepositoryState(props: {
  readonly body: string;
  readonly workDir: string;
  readonly onError: (message: string) => void;
  readonly onProjectUpdated: (project: ProjectSummary) => void;
}): ReactNode {
  const [initializing, setInitializing] = useState(false);
  return (
    <EmptyState
      icon={<FolderGit2 size={22} />}
      title="当前目录不是 Git 仓库"
      body={props.body}
      action={
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
      }
    />
  );
}
