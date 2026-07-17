import type { ReactNode } from 'react';
import { Bot, Check, ChevronDown, LoaderCircle, X } from 'lucide-react';

import type { SwarmMemberView, SwarmProgressView } from '../agent-swarm';

const PHASE_LABELS: Record<SwarmMemberView['phase'], string> = {
  pending: '排队中',
  queued: '排队中',
  suspended: '限流中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

function phaseClass(phase: SwarmMemberView['phase']): string {
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  if (phase === 'cancelled') return 'cancelled';
  if (phase === 'suspended') return 'suspended';
  if (phase === 'running') return 'running';
  return 'queued';
}

function statusBarSegments(members: readonly SwarmMemberView[]): readonly {
  readonly key: string;
  readonly count: number;
}[] {
  const counts = {
    completed: 0,
    working: 0,
    suspended: 0,
    queued: 0,
    cancelled: 0,
    failed: 0,
  };
  for (const member of members) {
    if (member.phase === 'completed') counts.completed += 1;
    else if (member.phase === 'failed') counts.failed += 1;
    else if (member.phase === 'cancelled') counts.cancelled += 1;
    else if (member.phase === 'suspended') counts.suspended += 1;
    else if (member.phase === 'running') counts.working += 1;
    else counts.queued += 1;
  }
  return (Object.entries(counts) as [keyof typeof counts, number][])
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, count }));
}

export function AgentSwarmProgressView(props: {
  readonly swarm: SwarmProgressView;
}): ReactNode {
  const { swarm } = props;
  const open = swarm.streaming || !swarm.ended;
  const workingCount = swarm.members.filter(
    (member) => member.phase === 'running' || member.phase === 'queued' || member.phase === 'pending',
  ).length;
  const statusLabel = swarm.streaming
    ? workingCount > 0
      ? '执行中…'
      : '编排中…'
    : swarm.aborted
      ? '已中止'
      : swarm.failed
        ? '失败'
        : swarm.summaryLabel ?? '完成';
  const statusClass = swarm.streaming
    ? 'running'
    : swarm.aborted
      ? 'cancelled'
      : swarm.failed
        ? 'failed'
        : 'completed';
  const segments = statusBarSegments(swarm.members);
  const total = Math.max(1, swarm.members.length);

  return (
    <details
      className={`agent-swarm-progress tool-block${swarm.failed ? ' error' : ''}`}
      open={open}
    >
      <summary>
        {swarm.streaming ? <LoaderCircle className="spin" size={14} /> : <Bot size={14} />}
        <strong>AgentSwarm</strong>
        <span className={`tool-status ${statusClass}`}>{statusLabel}</span>
        <ChevronDown size={14} />
      </summary>
      <div className="agent-swarm-body">
        {swarm.description.length > 0 ? (
          <div className="agent-swarm-description">{swarm.description}</div>
        ) : null}
        {segments.length > 0 ? (
          <div className="swarm-status-bar" aria-hidden>
            {segments.map((segment) => (
              <i
                className={`swarm-status-seg ${segment.key}`}
                key={segment.key}
                style={{ flexGrow: segment.count / total }}
              />
            ))}
          </div>
        ) : null}
        {swarm.errorMessage !== undefined ? (
          <div className="agent-swarm-error">{swarm.errorMessage}</div>
        ) : null}
        {swarm.ended && swarm.summaryLabel !== undefined && !swarm.failed ? (
          <div className="agent-swarm-summary">{swarm.summaryLabel}</div>
        ) : null}
        {swarm.members.length > 0 ? (
          <div
            className="swarm-member-grid"
            style={{ gridTemplateColumns: `repeat(${String(Math.max(1, swarm.columns))}, minmax(0, 1fr))` }}
          >
            {swarm.members.map((member) => (
              <article className={`swarm-member-cell ${phaseClass(member.phase)}`} key={member.id}>
                <header>
                  <em>#{String(member.index)}</em>
                  <span className={`task-status ${phaseClass(member.phase)}`}>
                    {member.phase === 'running' ? (
                      <LoaderCircle className="spin" size={11} />
                    ) : member.phase === 'completed' ? (
                      <Check size={11} />
                    ) : member.phase === 'failed' ? (
                      <X size={11} />
                    ) : null}
                    {PHASE_LABELS[member.phase]}
                  </span>
                </header>
                <strong title={member.itemText}>{member.itemText || member.agentId || '子 Agent'}</strong>
                {member.phase === 'running' && member.latestModelText.length > 0 ? (
                  <small className="swarm-member-activity" title={member.latestModelText}>
                    {activityTail(member.latestModelText)}
                  </small>
                ) : null}
                {member.completedText !== undefined && member.completedText.length > 0 ? (
                  <small>{member.completedText}</small>
                ) : null}
                {member.failureText !== undefined && member.failureText.length > 0 ? (
                  <small className="swarm-member-error">{member.failureText}</small>
                ) : null}
                {member.suspendedReason !== undefined && member.suspendedReason.length > 0 ? (
                  <small>{member.suspendedReason}</small>
                ) : null}
                {(member.phase === 'running' || member.phase === 'queued' || member.phase === 'pending') ? (
                  <div className="swarm-member-progress" aria-hidden>
                    <i className={phaseClass(member.phase)} />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : swarm.streaming ? (
          <div className="agent-swarm-placeholder">正在编排子 Agent…</div>
        ) : null}
      </div>
    </details>
  );
}

function activityTail(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `…${trimmed.slice(-max)}`;
}
