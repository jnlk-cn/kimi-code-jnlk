import { describe, expect, it } from 'vitest';

import type { TimelineEntry } from '../src/renderer/timeline';
import {
  latestExitPlanEntry,
  pendingPlanReviewForTimelineEntry,
  planTimelineHintStatus,
  shouldShowPlanTimelineHint,
} from '../src/renderer/plan-timeline';

function exitPlan(
  id: string,
  options: Partial<TimelineEntry> = {},
): TimelineEntry {
  return {
    id,
    kind: 'tool',
    title: 'ExitPlanMode',
    content: options.content ?? '',
    toolCallId: options.toolCallId ?? id,
    streaming: options.streaming,
    error: options.error,
  };
}

describe('plan-timeline', () => {
  const older = exitPlan('tool:old', {
    content: 'Exited plan mode.\nPlan saved to: /tmp/old.md\n\n## Approved Plan:\n\nold',
  });
  const newer = exitPlan('tool:new', { streaming: true, toolCallId: 'call_new' });
  const entries = [older, newer] as const;

  it('returns only the latest ExitPlanMode entry', () => {
    expect(latestExitPlanEntry(entries)?.id).toBe('tool:new');
  });

  it('shows the timeline hint only for the latest ExitPlanMode', () => {
    expect(shouldShowPlanTimelineHint(older, entries)).toBe(false);
    expect(shouldShowPlanTimelineHint(newer, entries)).toBe(true);
  });

  it('matches pending review by toolCallId', () => {
    const pending = {
      kind: 'plan_review' as const,
      plan: '# Plan',
      path: '/tmp/new.md',
    };
    expect(pendingPlanReviewForTimelineEntry(older, pending, 'call_new')).toBeUndefined();
    expect(pendingPlanReviewForTimelineEntry(newer, pending, 'call_new')).toEqual(pending);
  });

  it('falls back to the latest ExitPlanMode when toolCallId is missing', () => {
    const pending = {
      kind: 'plan_review' as const,
      plan: '# Plan',
      path: '/tmp/new.md',
    };
    expect(pendingPlanReviewForTimelineEntry(older, pending, undefined, false)).toBeUndefined();
    expect(pendingPlanReviewForTimelineEntry(newer, pending, undefined, true)).toEqual(pending);
  });

  it('derives hint status from outcome and pending review', () => {
    expect(planTimelineHintStatus(newer, { kind: 'plan_review', plan: '# x' }).tone).toBe('pending');
    expect(
      planTimelineHintStatus(
        exitPlan('approved', {
          content: 'Exited plan mode.\nPlan saved to: /tmp/a.md\n\n## Approved Plan:\n\nok',
        }),
        undefined,
      ),
    ).toMatchObject({ tone: 'approved' });
    expect(
      planTimelineHintStatus(
        exitPlan('rejected', {
          content: 'User rejected the plan.',
          error: true,
        }),
        undefined,
      ),
    ).toMatchObject({ tone: 'rejected' });
  });
});
