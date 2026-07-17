import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Check,
  Circle,
  ListTodo,
  LoaderCircle,
  RefreshCw,
  X,
} from 'lucide-react';

import type {
  ApprovalResolution,
  ModelOption,
  PendingApproval,
  ProjectPlanSummary,
  ProjectSummary,
} from '../../shared/contracts';
import {
  WORKSPACE_SPEC_SESSION_ID,
  WORKSPACE_SPEC_SESSION_TITLE,
  isWorkspaceSpecPath,
} from '../../shared/plan-paths';
import type { ModelConfigureInput } from '../model-menu';
import {
  parsePlanDocument,
  planTodoProgressSummary,
  type PlanDocumentTodo,
  type PlanTodoStatus,
} from '../plan-document';
import { planApprovalMatchesSelection } from '../plan-review';
import {
  readProjectUi,
  writeProjectUi,
} from '../workspace-ui-persistence';
import { MarkdownMessage } from './markdown-message';
import { PlanBuildControls } from './plan-build-controls';

const api = window.ganymede;

function openExternalFromPlan(url: string): void {
  void api.openExternal(url);
}

function provisionalPlanSummary(
  path: string,
  workDir: string | undefined,
): ProjectPlanSummary {
  const normalized = path.replaceAll('\\', '/');
  const fileName = normalized.split('/').at(-1) ?? path;
  const id = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
  const isSpec = isWorkspaceSpecPath(path, workDir);
  return {
    id,
    path,
    fileName,
    sessionId: isSpec ? WORKSPACE_SPEC_SESSION_ID : 'session',
    sessionTitle: isSpec ? WORKSPACE_SPEC_SESSION_TITLE : '会话',
    updatedAt: Date.now(),
    title: id,
    kind: isSpec ? 'spec' : 'implementation',
  };
}

function formatUpdatedAt(value: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);
  } catch {
    return new Date(value).toLocaleString();
  }
}

function kindLabel(kind: ProjectPlanSummary['kind']): string {
  return kind === 'spec' ? '设计规格' : '实现计划';
}

function samePlanPath(left: string, right: string): boolean {
  return left.replaceAll('\\', '/').replace(/\/+$/, '')
    === right.replaceAll('\\', '/').replace(/\/+$/, '');
}

function TodoStatusIcon(props: { readonly status: PlanTodoStatus }): ReactNode {
  if (props.status === 'completed') return <Check size={12} />;
  if (props.status === 'cancelled') return <X size={12} />;
  if (props.status === 'in_progress') return <LoaderCircle className="spin" size={12} />;
  return <Circle size={12} />;
}

function PlanTodosView(props: { readonly todos: readonly PlanDocumentTodo[] }): ReactNode {
  if (props.todos.length === 0) return null;
  const summary = planTodoProgressSummary(props.todos);
  return (
    <div className="plan-todos">
      <div className="plan-todos-head">
        <ListTodo size={14} />
        <strong>待办</strong>
        {summary.length > 0 ? <span className="plan-todos-summary">{summary}</span> : null}
      </div>
      <ul className="plan-todos-list">
        {props.todos.map((todo) => (
          <li key={todo.id} className={`plan-todos-row status-${todo.status}`}>
            <TodoStatusIcon status={todo.status} />
            <span>{todo.content}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlansPanel(props: {
  readonly project?: ProjectSummary;
  readonly selectedPath?: string;
  readonly onSelectedPathChange?: (path: string | undefined) => void;
  readonly onError: (message: string) => void;
  readonly onPreviewFile?: (relativePath: string) => void;
  readonly planApproval?: PendingApproval;
  readonly models?: readonly ModelOption[];
  readonly model?: string;
  readonly thinking?: string;
  readonly platform?: NodeJS.Platform;
  readonly onConfigureModel?: (config: ModelConfigureInput) => void;
  readonly onResolvePlanApproval?: (resolution: ApprovalResolution) => void;
  /** Bump to reload selected plan content (e.g. after TodoList sync). */
  readonly refreshToken?: number;
}): ReactNode {
  const [plans, setPlans] = useState<readonly ProjectPlanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string>();
  const [reading, setReading] = useState(false);
  const workDir = props.project?.workDir;
  const persistedPath =
    workDir === undefined ? undefined : readProjectUi(workDir).selectedPlanPath;
  const selectedPath = props.selectedPath ?? persistedPath;
  const selected =
    (selectedPath === undefined
      ? undefined
      : plans.find((plan) => samePlanPath(plan.path, selectedPath)))
    ?? (selectedPath !== undefined
      ? provisionalPlanSummary(selectedPath, workDir)
      : undefined);
  const document = useMemo(
    () => (content === undefined ? undefined : parsePlanDocument(content)),
    [content],
  );
  const showBuild =
    selected?.kind !== 'spec'
    && planApprovalMatchesSelection(props.planApproval, selected?.path)
    && props.planApproval !== undefined
    && props.onResolvePlanApproval !== undefined
    && props.onConfigureModel !== undefined;

  const onError = props.onError;
  const onSelectedPathChange = props.onSelectedPathChange;

  const refresh = useCallback(async () => {
    if (workDir === undefined) {
      setPlans([]);
      return;
    }
    setLoading(true);
    try {
      const next = await api.listProjectPlans(workDir);
      setPlans(next);
      const current = props.selectedPath ?? readProjectUi(workDir).selectedPlanPath;
      if (current !== undefined) {
        // Keep an explicit selection even if the list has not caught up yet
        // (e.g. a just-written workspace spec).
        return;
      }
      const preferred = next[0]?.path;
      if (preferred !== undefined) {
        onSelectedPathChange?.(preferred);
        writeProjectUi(workDir, { selectedPlanPath: preferred });
      }
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [workDir, onError, onSelectedPathChange, props.selectedPath]);

  useEffect(() => {
    void refresh();
  }, [workDir, props.refreshToken]);

  useEffect(() => {
    if (selectedPath === undefined) {
      setContent(undefined);
      return;
    }
    if (workDir === undefined) {
      setContent(undefined);
      return;
    }
    let cancelled = false;
    setReading(true);
    void api
      .readPlanFile({ path: selectedPath, workDir })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setContent(undefined);
          props.onError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (!cancelled) setReading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPath, workDir, props.onError, props.refreshToken]);

  function selectPlan(path: string): void {
    props.onSelectedPathChange?.(path);
    if (props.project !== undefined) {
      writeProjectUi(props.project.workDir, { selectedPlanPath: path });
    }
  }

  if (props.project === undefined) {
    return (
      <div className="plans-panel plans-panel-empty">
        <ListTodo size={22} />
        <p>选择项目后查看已创建的计划</p>
      </div>
    );
  }

  const displayTitle = document?.meta.name ?? selected?.title;
  const overview = document?.meta.overview;

  return (
    <div className="plans-panel">
      <div className="plans-list">
        <div className="plans-list-head">
          <strong>计划</strong>
          <button
            type="button"
            className="icon-button"
            title="刷新"
            aria-label="刷新计划列表"
            onClick={() => void refresh()}
          >
            <RefreshCw size={13} className={loading ? 'spin' : undefined} />
          </button>
        </div>
        {loading && plans.length === 0 ? (
          <div className="plans-list-state">
            <LoaderCircle className="spin" size={15} /> 正在读取计划…
          </div>
        ) : plans.length === 0 ? (
          <div className="plans-list-state">
            <ListTodo size={15} />
            工程模式的设计规格或 Plan 模式的实现计划会显示在这里
          </div>
        ) : (
          <ul className="plans-list-items">
            {plans.map((plan) => {
              const active =
                selectedPath !== undefined && samePlanPath(plan.path, selectedPath);
              return (
                <li key={plan.path}>
                  <button
                    type="button"
                    className={`plans-list-item${active ? ' selected' : ''}`}
                    onClick={() => selectPlan(plan.path)}
                  >
                    <span className="plans-list-item-title">{plan.title}</span>
                    <span className="plans-list-item-meta">
                      <span className={`plans-list-item-kind kind-${plan.kind}`}>
                        {kindLabel(plan.kind)}
                      </span>
                      <code>{plan.fileName}</code>
                      <span>{plan.sessionTitle}</span>
                      <span>{formatUpdatedAt(plan.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="plans-preview">
        {selected === undefined ? (
          <div className="plans-preview-empty">
            <ListTodo size={22} />
            <p>选择左侧计划进行阅读</p>
          </div>
        ) : (
          <>
            <div className="plans-preview-head">
              <div className="plans-preview-titles">
                <strong>{displayTitle}</strong>
                {overview !== undefined ? (
                  <p className="plans-preview-overview">{overview}</p>
                ) : null}
                <span className="plans-preview-meta">
                  <span className={`plans-list-item-kind kind-${selected.kind}`}>
                    {kindLabel(selected.kind)}
                  </span>
                  <code>{selected.fileName}</code>
                  <span>{selected.sessionTitle}</span>
                </span>
              </div>
              <div className="plans-preview-actions">
                {showBuild ? (
                  <PlanBuildControls
                    variant="inline"
                    request={props.planApproval!}
                    models={props.models ?? []}
                    model={props.model}
                    thinking={props.thinking}
                    platform={props.platform}
                    onConfigureModel={props.onConfigureModel!}
                    onResolve={props.onResolvePlanApproval!}
                  />
                ) : null}
              </div>
            </div>
            <div className="plans-preview-body">
              {reading ? (
                <div className="plans-list-state">
                  <LoaderCircle className="spin" size={15} /> 正在加载…
                </div>
              ) : content !== undefined && content.length > 0 && document !== undefined ? (
                <>
                  <PlanTodosView todos={document.todos} />
                  {document.body.trim().length > 0 ? (
                    <MarkdownMessage
                      content={document.body}
                      workDir={props.project.workDir}
                      onPreviewFile={props.onPreviewFile}
                      onOpenExternal={openExternalFromPlan}
                    />
                  ) : document.todos.length === 0 ? (
                    <p className="plans-preview-empty-text">此计划文件为空。</p>
                  ) : null}
                </>
              ) : (
                <p className="plans-preview-empty-text">此计划文件为空。</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
