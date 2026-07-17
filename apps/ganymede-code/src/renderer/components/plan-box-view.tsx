import type { ReactNode } from 'react';
import { ChevronRight, ListTodo, LoaderCircle } from 'lucide-react';

import type { TimelineEntry } from '../timeline';
import {
  parsePlanReviewDisplay,
  resolvePlanPath,
  type PlanReviewDisplay,
} from '../plan-review';
import {
  pendingPlanReviewForTimelineEntry,
  planTimelineHintStatus,
} from '../plan-timeline';
import { PlanStatusIcon } from './plan-status-icon';

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts.at(-1) ?? path;
}

export function PlanBoxView(props: {
  readonly entry: TimelineEntry;
  readonly pendingReview?: PlanReviewDisplay;
  readonly onOpenInPanel?: (path?: string) => void;
}): ReactNode {
  const pending = props.pendingReview;
  const path = resolvePlanPath({
    pendingPath: pending?.path,
    resultContent: props.entry.streaming === true ? undefined : props.entry.content,
  });
  const status = planTimelineHintStatus(props.entry, pending);
  const waiting = status.tone === 'pending' || status.tone === 'preparing';

  return (
    <button
      type="button"
      className={`plan-timeline-hint${props.entry.error ? ' error' : ''}${status.tone === 'rejected' ? ' rejected' : ''}`}
      onClick={() => props.onOpenInPanel?.(path)}
    >
      <span className="plan-timeline-hint-main">
        {waiting ? <LoaderCircle className="spin" size={14} /> : <ListTodo size={14} />}
        <strong>当前计划</strong>
        {path !== undefined ? <code className="plan-box-path">{basename(path)}</code> : null}
        <span className={`plan-box-status ${status.tone}`}>
          <PlanStatusIcon tone={status.tone === 'preparing' ? 'pending' : status.tone} />
          {status.label}
        </span>
      </span>
      <span className="plan-timeline-hint-action">
        在计划面板查看
        <ChevronRight size={14} />
      </span>
    </button>
  );
}

export function pendingPlanReviewForEntry(
  entry: TimelineEntry,
  approvalDisplay: unknown,
  approvalToolCallId?: string,
  isLatestExitPlan = false,
): PlanReviewDisplay | undefined {
  if (entry.title !== 'ExitPlanMode') return undefined;
  const parsed = parsePlanReviewDisplay(approvalDisplay);
  if (parsed === undefined) return undefined;
  if (approvalToolCallId !== undefined && approvalToolCallId.length > 0) {
    return pendingPlanReviewForTimelineEntry(entry, parsed, approvalToolCallId);
  }
  return isLatestExitPlan ? parsed : undefined;
}

export { PlanStatusIcon } from './plan-status-icon';
