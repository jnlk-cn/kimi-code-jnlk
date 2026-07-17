import type { PendingApproval } from '../shared/contracts';

export interface PlanReviewOption {
  readonly label: string;
  readonly description: string;
}

export interface PlanReviewDisplay {
  readonly kind: 'plan_review';
  readonly plan: string;
  readonly path?: string;
  readonly options?: readonly PlanReviewOption[];
}

export type PlanReviewChoiceResponse = 'approved' | 'rejected';

export interface PlanReviewChoice {
  readonly label: string;
  readonly response: PlanReviewChoiceResponse;
  readonly selectedLabel: string;
  readonly requiresFeedback?: boolean;
  readonly description?: string;
}

export interface ExitPlanModeOutcome {
  readonly kind: 'approved' | 'rejected';
  readonly chosen?: string;
  readonly feedback?: string;
  readonly path?: string;
}

const APPROVED_PLAN_MARKER = '## Approved Plan:';
const REJECT_PREFIX = 'User rejected the plan.';
const REJECT_FEEDBACK_PREFIX = 'User rejected the plan. Feedback:';
const APPROVED_OPTION_RE = /^User approved option "([^"]+)"\./;
const PLAN_REJECT_PREFIX = 'Plan rejected by user.';
const SELECTED_APPROACH_RE = /^Exited plan mode\. Selected approach: ([^\n]+)\n/;
const PLAN_SAVED_TO_RE = /\nPlan saved to: ([^\n]+)\n/;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseOptions(raw: unknown): readonly PlanReviewOption[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const options: PlanReviewOption[] = [];
  for (const item of raw) {
    const record = asRecord(item);
    if (record === undefined) continue;
    const label = record['label'];
    const description = record['description'];
    if (typeof label !== 'string' || label.length === 0) continue;
    if (typeof description !== 'string') continue;
    options.push({ label, description });
  }
  return options.length > 0 ? options : undefined;
}

export function parsePlanReviewDisplay(display: unknown): PlanReviewDisplay | undefined {
  const record = asRecord(display);
  if (record === undefined) return undefined;
  if (record['kind'] !== 'plan_review') return undefined;
  const plan = record['plan'];
  if (typeof plan !== 'string' || plan.trim().length === 0) return undefined;
  const path = typeof record['path'] === 'string' && record['path'].length > 0 ? record['path'] : undefined;
  const options = parseOptions(record['options']);
  return {
    kind: 'plan_review',
    plan,
    path,
    options,
  };
}

export function isPlanReviewApproval(request: PendingApproval): boolean {
  if (request.toolName === 'ExitPlanMode') return true;
  return parsePlanReviewDisplay(request.display) !== undefined;
}

/** True when a pending plan approval should show Build controls for the selected plan path. */
export function planApprovalMatchesSelection(
  approval: PendingApproval | undefined,
  selectedPath: string | undefined,
): boolean {
  if (approval === undefined || !isPlanReviewApproval(approval)) return false;
  const display = parsePlanReviewDisplay(approval.display);
  const approvalPath = display?.path;
  if (approvalPath === undefined || approvalPath.length === 0) {
    // Path missing from the approval payload — still treat as matching when a plan is selected
    // (openPlanInPanel may have already focused the right file).
    return selectedPath !== undefined && selectedPath.length > 0;
  }
  return selectedPath === approvalPath;
}

export function buildPlanReviewChoices(display: PlanReviewDisplay | undefined): readonly PlanReviewChoice[] {
  const options = display?.options;
  const optionChoices: PlanReviewChoice[] =
    options !== undefined && options.length >= 2
      ? options.map((option) => ({
          label: option.label,
          response: 'approved' as const,
          selectedLabel: option.label,
          description: option.description,
        }))
      : [
          {
            label: 'Approve',
            response: 'approved' as const,
            selectedLabel: 'Approve',
          },
        ];

  return [
    ...optionChoices,
    { label: 'Reject', response: 'rejected', selectedLabel: 'Reject' },
    {
      label: 'Revise',
      response: 'rejected',
      selectedLabel: 'Revise',
      requiresFeedback: true,
    },
  ];
}

export function extractApprovedPlan(output: string): string {
  const markerIndex = output.indexOf(APPROVED_PLAN_MARKER);
  if (markerIndex < 0) return '';
  return output.slice(markerIndex + APPROVED_PLAN_MARKER.length).trim();
}

export function interpretExitPlanModeOutcome(output: string): ExitPlanModeOutcome {
  if (output.startsWith(REJECT_PREFIX)) {
    if (output.startsWith(REJECT_FEEDBACK_PREFIX)) {
      const feedback = output.slice(REJECT_FEEDBACK_PREFIX.length).trimStart();
      return { kind: 'rejected', feedback };
    }
    return { kind: 'rejected' };
  }
  if (output.startsWith(PLAN_REJECT_PREFIX)) {
    return { kind: 'rejected' };
  }
  const pathMatch = PLAN_SAVED_TO_RE.exec(output);
  const path = pathMatch?.[1]?.trim();
  const optionMatch = SELECTED_APPROACH_RE.exec(output) ?? APPROVED_OPTION_RE.exec(output);
  if (optionMatch !== null) {
    return path !== undefined && path.length > 0
      ? { kind: 'approved', chosen: optionMatch[1], path }
      : { kind: 'approved', chosen: optionMatch[1] };
  }
  return path !== undefined && path.length > 0 ? { kind: 'approved', path } : { kind: 'approved' };
}

export function isExitPlanModeOutcomeOutput(output: string): boolean {
  return (
    output.startsWith(REJECT_PREFIX) ||
    output.startsWith(PLAN_REJECT_PREFIX) ||
    output.startsWith('Exited plan mode.') ||
    APPROVED_OPTION_RE.test(output) ||
    output.includes(APPROVED_PLAN_MARKER)
  );
}

export function resolvePlanBody(input: {
  readonly toolArgs?: Record<string, unknown>;
  readonly pendingPlan?: string;
  readonly resultContent?: string;
}): string {
  const fromArgs = input.toolArgs?.['plan'];
  if (typeof fromArgs === 'string' && fromArgs.trim().length > 0) return fromArgs;
  if (input.pendingPlan !== undefined && input.pendingPlan.trim().length > 0) {
    return input.pendingPlan;
  }
  if (input.resultContent !== undefined) {
    const approved = extractApprovedPlan(input.resultContent);
    if (approved.length > 0) return approved;
  }
  return '';
}

export function resolvePlanPath(input: {
  readonly pendingPath?: string;
  readonly resultContent?: string;
}): string | undefined {
  if (input.resultContent !== undefined && isExitPlanModeOutcomeOutput(input.resultContent)) {
    const fromResult = interpretExitPlanModeOutcome(input.resultContent).path;
    if (fromResult !== undefined && fromResult.length > 0) return fromResult;
  }
  if (input.pendingPath !== undefined && input.pendingPath.length > 0) return input.pendingPath;
  return undefined;
}
