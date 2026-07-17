import type { QuestionView } from '../shared/contracts';

export type QuestionDraftKind = 'options' | 'other' | 'skipped';

export interface QuestionDraft {
  readonly kind: QuestionDraftKind;
  readonly labels: readonly string[];
  readonly otherText: string;
}

export function emptyQuestionDraft(): QuestionDraft {
  return { kind: 'options', labels: [], otherText: '' };
}

export function toggleQuestionOption(
  draft: QuestionDraft,
  label: string,
  multiple: boolean,
): QuestionDraft {
  if (draft.kind === 'skipped') {
    return multiple
      ? { kind: 'options', labels: [label], otherText: draft.otherText }
      : { kind: 'options', labels: [label], otherText: '' };
  }
  if (!multiple) {
    return { kind: 'options', labels: [label], otherText: '' };
  }
  const selected = draft.kind === 'options' || draft.kind === 'other';
  const previous = selected ? draft.labels : [];
  const next = previous.includes(label)
    ? previous.filter((item) => item !== label)
    : [...previous, label];
  return {
    kind: draft.kind === 'other' ? 'other' : 'options',
    labels: next,
    otherText: draft.otherText,
  };
}

export function selectQuestionOther(draft: QuestionDraft, multiple: boolean): QuestionDraft {
  if (multiple) {
    return {
      kind: 'other',
      labels: draft.kind === 'skipped' ? [] : draft.labels,
      otherText: draft.otherText,
    };
  }
  return { kind: 'other', labels: [], otherText: draft.otherText };
}

export function setQuestionOtherText(draft: QuestionDraft, otherText: string): QuestionDraft {
  return {
    kind: draft.kind === 'skipped' ? 'other' : draft.kind === 'options' ? 'other' : draft.kind,
    labels: draft.kind === 'skipped' ? [] : draft.labels,
    otherText,
  };
}

export function skipQuestionDraft(): QuestionDraft {
  return { kind: 'skipped', labels: [], otherText: '' };
}

export function canContinueQuestion(draft: QuestionDraft): boolean {
  if (draft.kind === 'skipped') return true;
  if (draft.kind === 'other') return draft.otherText.trim().length > 0;
  return draft.labels.length > 0;
}

export function draftAnswerValues(draft: QuestionDraft): readonly string[] | undefined {
  if (draft.kind === 'skipped') return undefined;
  if (draft.kind === 'other') {
    const text = draft.otherText.trim();
    if (text.length === 0) return undefined;
    if (draft.labels.length === 0) return [text];
    return [...draft.labels, text];
  }
  if (draft.labels.length === 0) return undefined;
  return draft.labels;
}

/**
 * Build the resolution payload. Skipped questions omit their key.
 * Returns `null` when every question was skipped / unanswered (dismiss).
 */
export function buildQuestionAnswers(
  questions: readonly QuestionView[],
  drafts: readonly QuestionDraft[],
): Record<string, readonly string[]> | null {
  const answers: Record<string, readonly string[]> = {};
  let answered = 0;
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const draft = drafts[index] ?? emptyQuestionDraft();
    if (question === undefined) continue;
    const values = draftAnswerValues(draft);
    if (values === undefined) continue;
    answers[question.prompt] = values;
    answered += 1;
  }
  if (answered === 0) return null;
  return answers;
}

export function nextQuestionIndex(
  current: number,
  total: number,
  direction: -1 | 1,
): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(current + direction, 0), total - 1);
}

export function otherOptionLabel(question: QuestionView): string {
  return question.otherLabel?.trim() || 'Other...';
}
