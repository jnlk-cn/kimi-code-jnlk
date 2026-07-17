import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Clock3, Pencil, Play, Plus, Trash2 } from 'lucide-react';

import type { Automation, ProjectSummary } from '../../shared/contracts';
import { EmptyState, Modal, PageFrame, formatRelative, messageOf } from '../page-chrome';

const api = window.ganymede;

const SCHEDULE_PRESETS = [
  { label: '每 15 分钟', value: 'every:15m' },
  { label: '每小时', value: 'every:1h' },
  { label: '每天', value: 'every:1d' },
  { label: '每周', value: 'RRULE:FREQ=WEEKLY;INTERVAL=1' },
] as const;

export function ScheduledPage(props: {
  readonly project?: ProjectSummary;
  readonly onError: (message: string) => void;
  readonly onViewInbox?: (automationId: string) => void;
}): ReactNode {
  const [items, setItems] = useState<readonly Automation[]>([]);
  const [editing, setEditing] = useState<Automation | 'new'>();
  const refresh = useCallback(() => {
    void api.listAutomations().then(setItems).catch((cause) => props.onError(messageOf(cause)));
  }, [props.onError]);
  useEffect(refresh, [refresh]);
  useEffect(() => api.onAutomationState(refresh), [refresh]);

  return (
    <PageFrame
      icon={<Clock3 />}
      title="已安排"
      subtitle="在本机或隔离 Worktree 中按计划运行任务。"
      action={
        <button className="primary-button" onClick={() => setEditing('new')} type="button">
          <Plus size={14} /> 新建安排
        </button>
      }
    >
      <div className="automation-grid">
        {items.map((item) => (
          <article className="automation-card" key={item.id}>
            <div className="automation-icon"><Clock3 size={18} /></div>
            <div className="automation-copy">
              <strong>
                {item.name}
                {item.enabled ? null : <small> · 已暂停</small>}
              </strong>
              <p>{item.prompt}</p>
              <span>
                {item.schedule} · {item.target === 'worktree' ? 'Worktree' : '本机'} ·{' '}
                {item.mode === 'same-task' ? '同一任务' : '新任务'}
              </span>
              <span>
                下次 {formatRelative(item.nextRunAt)}
                {item.lastRunAt === undefined ? null : ` · 上次 ${formatRelative(item.lastRunAt)}`}
              </span>
            </div>
            <div className="automation-actions">
              <button
                aria-label={`立即运行 ${item.name}`}
                onClick={() => void api.runAutomation(item.id).catch((cause) => props.onError(messageOf(cause)))}
                title="立即运行"
                type="button"
              >
                <Play size={14} />
              </button>
              <button
                aria-label={`编辑 ${item.name}`}
                onClick={() => setEditing(item)}
                title="编辑"
                type="button"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() =>
                  void api
                    .saveAutomation({ ...item, enabled: !item.enabled })
                    .then(refresh)
                    .catch((cause) => props.onError(messageOf(cause)))
                }
                type="button"
              >
                {item.enabled ? '暂停' : '启用'}
              </button>
              {props.onViewInbox === undefined ? null : (
                <button onClick={() => props.onViewInbox?.(item.id)} type="button">
                  查看结果
                </button>
              )}
              <button
                aria-label={`删除安排 ${item.name}`}
                onClick={() =>
                  void api.deleteAutomation(item.id).then(refresh).catch((cause) => props.onError(messageOf(cause)))
                }
                title="删除安排"
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </article>
        ))}
        {items.length === 0 ? (
          <EmptyState icon={<Clock3 />} title="还没有安排" body="创建代码审查、依赖更新或定期报告。" />
        ) : null}
      </div>
      {editing === undefined ? null : (
        <AutomationModal
          project={props.project}
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            refresh();
          }}
          onError={props.onError}
        />
      )}
    </PageFrame>
  );
}

function AutomationModal(props: {
  readonly project?: ProjectSummary;
  readonly initial?: Automation;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  const [name, setName] = useState(props.initial?.name ?? '');
  const [prompt, setPrompt] = useState(props.initial?.prompt ?? '');
  const [schedule, setSchedule] = useState(props.initial?.schedule ?? 'every:1d');
  const [mode, setMode] = useState<Automation['mode']>(props.initial?.mode ?? 'new-task');
  const [target, setTarget] = useState<Automation['target']>(props.initial?.target ?? 'worktree');
  const [model, setModel] = useState(props.initial?.model ?? '');
  const [models, setModels] = useState<readonly string[]>([]);

  useEffect(() => {
    void api.modelConfiguration().then((configuration) => {
      const aliases = configuration.models.map((item) => item.id);
      setModels([...new Set(aliases)]);
      if (model.length === 0 && configuration.defaultModel !== undefined) {
        setModel(configuration.defaultModel);
      }
    }).catch(() => undefined);
  }, [model.length]);

  return (
    <Modal title={props.initial === undefined ? '新建安排' : '编辑安排'} onClose={props.onClose}>
      <label>
        名称
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="每日代码健康检查" />
      </label>
      <label>
        任务
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="检查最近改动并修复确定的问题…"
        />
      </label>
      <label>
        计划
        <input
          value={schedule}
          onChange={(event) => setSchedule(event.target.value)}
          placeholder="every:1d 或 RRULE:FREQ=DAILY"
        />
      </label>
      <div className="schedule-presets">
        {SCHEDULE_PRESETS.map((preset) => (
          <button key={preset.value} onClick={() => setSchedule(preset.value)} type="button">
            {preset.label}
          </button>
        ))}
      </div>
      <label>
        执行模式
        <select value={mode} onChange={(event) => setMode(event.target.value as Automation['mode'])}>
          <option value="new-task">每次新建任务</option>
          <option value="same-task">复用同一任务</option>
        </select>
      </label>
      <label>
        运行目标
        <select value={target} onChange={(event) => setTarget(event.target.value as Automation['target'])}>
          <option value="worktree">隔离 Worktree</option>
          <option value="local">本机工作区</option>
        </select>
      </label>
      <label>
        模型
        <select value={model} onChange={(event) => setModel(event.target.value)}>
          <option value="">默认模型</option>
          {models.map((alias) => (
            <option key={alias} value={alias}>
              {alias}
            </option>
          ))}
        </select>
      </label>
      <div className="modal-actions">
        <button onClick={props.onClose} type="button">
          取消
        </button>
        <button
          className="primary-button"
          disabled={props.project === undefined || name.length === 0 || prompt.length === 0}
          onClick={() => {
            if (props.project === undefined) return;
            void api
              .saveAutomation({
                id: props.initial?.id,
                name,
                prompt,
                projectPath: props.project.workDir,
                schedule,
                nextRunAt: props.initial?.nextRunAt ?? Date.now(),
                enabled: props.initial?.enabled ?? true,
                mode,
                target,
                model: model.trim().length > 0 ? model.trim() : undefined,
                sessionId: props.initial?.sessionId,
                lastRunAt: props.initial?.lastRunAt,
              })
              .then(props.onSaved)
              .catch((cause) => props.onError(messageOf(cause)));
          }}
          type="button"
        >
          保存
        </button>
      </div>
    </Modal>
  );
}
