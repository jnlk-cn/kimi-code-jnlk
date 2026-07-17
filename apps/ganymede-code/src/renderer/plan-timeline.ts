import type { InteractionMode } from '../shared/contracts';
import type { TimelineEntry } from './timeline';
import {
  interpretExitPlanModeOutcome,
  isExitPlanModeOutcomeOutput,
  type PlanReviewDisplay,
} from './plan-review';

/** Suppress assistant streaming body + accent cursor while Plan mode is active. */
export function shouldSuppressPlanAssistantStream(input: {
  readonly interactionMode?: InteractionMode;
  readonly planMode?: boolean;
  readonly streaming?: boolean;
}): boolean {
  if (input.streaming !== true) return false;
  return input.interactionMode === 'plan' || input.planMode === true;
}

export type PlanTimelineHintStatus =
  | { readonly tone: 'pending'; readonly label: string }
  | { readonly tone: 'approved'; readonly label: string }
  | { readonly tone: 'rejected'; readonly label: string }
  | { readonly tone: 'preparing'; readonly label: string };

export function isExitPlanModeEntry(entry: TimelineEntry): boolean {
  return entry.kind === 'tool' && entry.title === 'ExitPlanMode';
}

export function latestExitPlanEntry(
  entries: readonly TimelineEntry[],
): TimelineEntry | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry !== undefined && isExitPlanModeEntry(entry)) return entry;
  }
  return undefined;
}

export function shouldShowPlanTimelineHint(
  entry: TimelineEntry,
  entries: readonly TimelineEntry[],
): boolean {
  if (!isExitPlanModeEntry(entry)) return false;
  const latest = latestExitPlanEntry(entries);
  return latest !== undefined && latest.id === entry.id;
}

export function pendingPlanReviewForTimelineEntry(
  entry: TimelineEntry,
  pending: PlanReviewDisplay | undefined,
  approvalToolCallId: string | undefined,
  isLatestExitPlan = false,
): PlanReviewDisplay | undefined {
  if (pending === undefined || !isExitPlanModeEntry(entry)) return undefined;
  if (approvalToolCallId !== undefined && approvalToolCallId.length > 0) {
    return entry.toolCallId === approvalToolCallId ? pending : undefined;
  }
  // Fallback when toolCallId is unavailable: only the latest ExitPlanMode entry.
  return isLatestExitPlan || entry.streaming === true ? pending : undefined;
}

export function planTimelineHintStatus(
  entry: TimelineEntry,
  pending: PlanReviewDisplay | undefined,
): PlanTimelineHintStatus {
  if (entry.streaming === true || pending !== undefined) {
    return { tone: 'pending', label: '待确认' };
  }
  if (entry.content.length === 0) {
    return { tone: 'preparing', label: '准备中' };
  }
  if (!isExitPlanModeOutcomeOutput(entry.content)) {
    return { tone: 'preparing', label: '准备中' };
  }
  const outcome = interpretExitPlanModeOutcome(entry.content);
  if (outcome.kind === 'rejected') {
    return { tone: 'rejected', label: '已拒绝' };
  }
  if (outcome.chosen !== undefined && outcome.chosen.length > 0) {
    return { tone: 'approved', label: `已批准: ${outcome.chosen}` };
  }
  return { tone: 'approved', label: '已批准' };
}
