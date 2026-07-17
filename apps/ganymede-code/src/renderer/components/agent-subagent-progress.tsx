import type { ReactNode } from 'react';
import { Bot, Check, LoaderCircle, X } from 'lucide-react';

import type { AgentSubagentView } from '../agent-subagent';

const PHASE_LABELS: Record<AgentSubagentView['phase'], string> = {
  queued: '排队中',
  running: '运行中',
  suspended: '限流中',
  completed: '已完成',
  failed: '失败',
};

function phaseClass(phase: AgentSubagentView['phase']): string {
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  if (phase === 'suspended') return 'suspended';
  if (phase === 'running') return 'running';
  return 'queued';
}

function activityTail(text: string, max = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `…${trimmed.slice(-max)}`;
}

export function AgentSubagentProgressView(props: {
  readonly subagent: AgentSubagentView;
}): ReactNode {
  const { subagent } = props;
  const statusClass = phaseClass(subagent.phase);
  const activity =
    subagent.phase === 'completed' && subagent.completedText
      ? subagent.completedText
      : subagent.phase === 'failed' && subagent.failureText
        ? subagent.failureText
        : activityTail(subagent.latestActivity);

  return (
    <div className={`agent-subagent-progress ${statusClass}`}>
      <header>
        {subagent.phase === 'running' || subagent.phase === 'queued' ? (
          <LoaderCircle className="spin" size={12} />
        ) : subagent.phase === 'completed' ? (
          <Check size={12} />
        ) : subagent.phase === 'failed' ? (
          <X size={12} />
        ) : (
          <Bot size={12} />
        )}
        <strong>{subagent.name}</strong>
        <span className={`task-status ${statusClass}`}>{PHASE_LABELS[subagent.phase]}</span>
        {subagent.toolCount > 0 ? (
          <em>{String(subagent.toolCount)} 次工具</em>
        ) : null}
      </header>
      {subagent.description.length > 0 ? (
        <div className="agent-subagent-description" title={subagent.description}>
          {subagent.description}
        </div>
      ) : null}
      {activity.length > 0 ? (
        <div className="agent-subagent-activity" title={subagent.latestActivity}>
          {activity}
        </div>
      ) : subagent.phase === 'running' || subagent.phase === 'queued' ? (
        <div className="agent-subagent-activity muted">子 Agent 工作中…</div>
      ) : null}
      {subagent.currentTool !== undefined ? (
        <div className="agent-subagent-tool">Using {subagent.currentTool}</div>
      ) : null}
    </div>
  );
}
