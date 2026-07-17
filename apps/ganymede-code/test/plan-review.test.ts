import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildPlanReviewChoices,
  extractApprovedPlan,
  interpretExitPlanModeOutcome,
  isPlanReviewApproval,
  parsePlanReviewDisplay,
  planApprovalMatchesSelection,
  resolvePlanBody,
  resolvePlanPath,
} from '../src/renderer/plan-review';
import {
  latestExitPlanEntry,
  pendingPlanReviewForTimelineEntry,
  shouldShowPlanTimelineHint,
  shouldSuppressPlanAssistantStream,
} from '../src/renderer/plan-timeline';
import type { TimelineEntry } from '../src/renderer/timeline';

function exitPlanEntry(
  id: string,
  options?: { readonly toolCallId?: string; readonly streaming?: boolean; readonly content?: string },
): TimelineEntry {
  return {
    id,
    kind: 'tool',
    title: 'ExitPlanMode',
    content: options?.content ?? '',
    toolCallId: options?.toolCallId,
    streaming: options?.streaming,
  };
}

describe('parsePlanReviewDisplay', () => {
  it('parses a valid plan_review display', () => {
    const display = parsePlanReviewDisplay({
      kind: 'plan_review',
      plan: '# Plan\n\nDo the work',
      path: '/tmp/plan.md',
      options: [
        { label: 'Approach A', description: 'Simple' },
        { label: 'Approach B', description: 'Thorough' },
      ],
    });
    expect(display).toEqual({
      kind: 'plan_review',
      plan: '# Plan\n\nDo the work',
      path: '/tmp/plan.md',
      options: [
        { label: 'Approach A', description: 'Simple' },
        { label: 'Approach B', description: 'Thorough' },
      ],
    });
  });

  it('rejects empty or non-plan displays', () => {
    expect(parsePlanReviewDisplay({ kind: 'plan_review', plan: '   ' })).toBeUndefined();
    expect(parsePlanReviewDisplay({ kind: 'bash', command: 'ls' })).toBeUndefined();
    expect(parsePlanReviewDisplay(undefined)).toBeUndefined();
  });
});

describe('isPlanReviewApproval', () => {
  it('matches ExitPlanMode or plan_review display', () => {
    expect(
      isPlanReviewApproval({
        id: '1',
        sessionId: 's',
        toolName: 'ExitPlanMode',
        action: 'review',
      }),
    ).toBe(true);
    expect(
      isPlanReviewApproval({
        id: '1',
        sessionId: 's',
        toolName: 'Bash',
        action: 'run',
        display: { kind: 'plan_review', plan: '# x' },
      }),
    ).toBe(true);
    expect(
      isPlanReviewApproval({
        id: '1',
        sessionId: 's',
        toolName: 'Bash',
        action: 'run',
      }),
    ).toBe(false);
  });
});

describe('buildPlanReviewChoices', () => {
  it('returns Approve plus Reject/Revise for single-option plans', () => {
    const choices = buildPlanReviewChoices({
      kind: 'plan_review',
      plan: '# Plan',
    });
    expect(choices.map((c) => c.selectedLabel)).toEqual(['Approve', 'Reject', 'Revise']);
    expect(choices[2]?.requiresFeedback).toBe(true);
  });

  it('maps multi-option plans to option labels', () => {
    const choices = buildPlanReviewChoices({
      kind: 'plan_review',
      plan: '# Plan',
      options: [
        { label: 'Approach A', description: 'A' },
        { label: 'Approach B', description: 'B' },
      ],
    });
    expect(choices.map((c) => c.selectedLabel)).toEqual([
      'Approach A',
      'Approach B',
      'Reject',
      'Revise',
    ]);
  });
});

describe('interpretExitPlanModeOutcome', () => {
  it('parses approved with selected approach and path', () => {
    const output =
      'Exited plan mode. Selected approach: Approach A\nExecute ONLY the selected approach.\n\nPlan saved to: /tmp/plan.md\n\n## Approved Plan:\n# Hello';
    expect(interpretExitPlanModeOutcome(output)).toEqual({
      kind: 'approved',
      chosen: 'Approach A',
      path: '/tmp/plan.md',
    });
    expect(extractApprovedPlan(output)).toBe('# Hello');
  });

  it('parses reject with feedback', () => {
    expect(interpretExitPlanModeOutcome('User rejected the plan. Feedback:\n\nNeed more detail')).toEqual({
      kind: 'rejected',
      feedback: 'Need more detail',
    });
    expect(interpretExitPlanModeOutcome('Plan rejected by user. Plan mode remains active.')).toEqual({
      kind: 'rejected',
    });
  });
});

describe('resolvePlanBody / resolvePlanPath', () => {
  it('prefers args, then pending, then approved result', () => {
    expect(
      resolvePlanBody({
        toolArgs: { plan: 'from args' },
        pendingPlan: 'from pending',
        resultContent: '## Approved Plan:\nfrom result',
      }),
    ).toBe('from args');
    expect(
      resolvePlanBody({
        pendingPlan: 'from pending',
        resultContent: '## Approved Plan:\nfrom result',
      }),
    ).toBe('from pending');
    expect(resolvePlanBody({ resultContent: '## Approved Plan:\nfrom result' })).toBe('from result');
  });

  it('prefers path from result over pending', () => {
    expect(
      resolvePlanPath({
        pendingPath: '/tmp/pending.md',
        resultContent: 'Exited plan mode.\nPlan saved to: /tmp/result.md\n\n## Approved Plan:\nx',
      }),
    ).toBe('/tmp/result.md');
    expect(resolvePlanPath({ pendingPath: '/tmp/pending.md' })).toBe('/tmp/pending.md');
  });
});

describe('shouldSuppressPlanAssistantStream', () => {
  it('suppresses when interactionMode is plan even if plan file is missing', () => {
    expect(
      shouldSuppressPlanAssistantStream({
        interactionMode: 'plan',
        planMode: false,
        streaming: true,
      }),
    ).toBe(true);
  });

  it('suppresses when planMode is true', () => {
    expect(
      shouldSuppressPlanAssistantStream({
        interactionMode: 'agent',
        planMode: true,
        streaming: true,
      }),
    ).toBe(true);
  });

  it('does not suppress agent streaming without plan mode', () => {
    expect(
      shouldSuppressPlanAssistantStream({
        interactionMode: 'agent',
        planMode: false,
        streaming: true,
      }),
    ).toBe(false);
  });

  it('does not suppress non-streaming assistant messages', () => {
    expect(
      shouldSuppressPlanAssistantStream({
        interactionMode: 'plan',
        planMode: true,
        streaming: false,
      }),
    ).toBe(false);
  });
});

describe('plan timeline helpers', () => {
  const pending = parsePlanReviewDisplay({
    kind: 'plan_review',
    plan: '# Plan',
    path: '/tmp/plan.md',
  });

  it('shows only the latest ExitPlanMode hint', () => {
    const entries = [exitPlanEntry('old'), exitPlanEntry('new')];
    expect(latestExitPlanEntry(entries)?.id).toBe('new');
    expect(shouldShowPlanTimelineHint(entries[0]!, entries)).toBe(false);
    expect(shouldShowPlanTimelineHint(entries[1]!, entries)).toBe(true);
  });

  it('matches pending review by toolCallId', () => {
    const entry = exitPlanEntry('exit', { toolCallId: 'call-2' });
    expect(
      pendingPlanReviewForTimelineEntry(entry, pending, 'call-2', true),
    ).toEqual(pending);
    expect(
      pendingPlanReviewForTimelineEntry(entry, pending, 'call-1', true),
    ).toBeUndefined();
  });

  it('falls back to latest ExitPlanMode when toolCallId is missing', () => {
    const entry = exitPlanEntry('exit', { streaming: true });
    expect(
      pendingPlanReviewForTimelineEntry(entry, pending, undefined, false),
    ).toEqual(pending);
    expect(
      pendingPlanReviewForTimelineEntry(
        exitPlanEntry('old', { content: 'done' }),
        pending,
        undefined,
        false,
      ),
    ).toBeUndefined();
  });
});

describe('planApprovalMatchesSelection', () => {
  it('requires a plan-review approval and matching path', () => {
    const approval = {
      id: '1',
      sessionId: 's',
      toolName: 'ExitPlanMode',
      action: 'review',
      display: { kind: 'plan_review', plan: '# Plan', path: '/tmp/plan.md' },
    };
    expect(planApprovalMatchesSelection(approval, '/tmp/plan.md')).toBe(true);
    expect(planApprovalMatchesSelection(approval, '/tmp/other.md')).toBe(false);
    expect(planApprovalMatchesSelection(undefined, '/tmp/plan.md')).toBe(false);
  });

  it('falls back to selected path when approval path is missing', () => {
    const approval = {
      id: '1',
      sessionId: 's',
      toolName: 'ExitPlanMode',
      action: 'review',
      display: { kind: 'plan_review', plan: '# Plan' },
    };
    expect(planApprovalMatchesSelection(approval, '/tmp/plan.md')).toBe(true);
    expect(planApprovalMatchesSelection(approval, undefined)).toBe(false);
  });
});

describe('plan build controls wiring', () => {
  const controlsSource = readFileSync(
    join(import.meta.dirname, '../src/renderer/components/plan-build-controls.tsx'),
    'utf8',
  );
  const plansPanelSource = readFileSync(
    join(import.meta.dirname, '../src/renderer/components/plans-panel.tsx'),
    'utf8',
  );
  const appSource = readFileSync(
    join(import.meta.dirname, '../src/renderer/App.tsx'),
    'utf8',
  );
  const stylesCss = readFileSync(
    join(import.meta.dirname, '../src/renderer/styles.css'),
    'utf8',
  );

  it('defines Cursor-style model + Build controls without a modal backdrop', () => {
    expect(controlsSource).toContain('plan-build-controls');
    expect(controlsSource).toContain('plan-build-model');
    expect(controlsSource).toContain('plan-build-main');
    expect(controlsSource).not.toContain('modal-backdrop');
    expect(stylesCss).toContain('.composer-plan-build-bar');
    expect(stylesCss).toContain('.plan-build-group');
    expect(stylesCss).not.toMatch(/\.plan-review-modal\s*\{/);
  });

  it('mounts PlanBuildControls in the composer dock and plans panel', () => {
    expect(appSource).toContain('<PlanBuildControls');
    expect(appSource).toContain('composer-plan-build-bar');
    expect(appSource).toContain('planApproval=');
    expect(appSource).not.toContain('<PlanReviewBar');
    expect(plansPanelSource).toContain('<PlanBuildControls');
    expect(plansPanelSource).not.toContain('EditorShortcuts');
  });
});
