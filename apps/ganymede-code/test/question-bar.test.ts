import { describe, expect, it } from 'vitest';

import type { QuestionView } from '../src/shared/contracts';
import {
  buildQuestionAnswers,
  canContinueQuestion,
  emptyQuestionDraft,
  nextQuestionIndex,
  otherOptionLabel,
  selectQuestionOther,
  setQuestionOtherText,
  skipQuestionDraft,
  toggleQuestionOption,
} from '../src/renderer/question-answers';

const questions: readonly QuestionView[] = [
  {
    id: 'q0',
    prompt: 'Prefer A or B?',
    options: [
      { label: 'A', description: 'Option A' },
      { label: 'B', description: 'Option B' },
    ],
    multiple: false,
  },
  {
    id: 'q1',
    prompt: 'Pick tags',
    options: [
      { label: 'x', description: '' },
      { label: 'y', description: '' },
    ],
    multiple: true,
    otherLabel: 'Custom',
  },
];

describe('question-answers', () => {
  it('toggles single and multi select', () => {
    const single = toggleQuestionOption(emptyQuestionDraft(), 'A', false);
    expect(single.labels).toEqual(['A']);
    expect(toggleQuestionOption(single, 'B', false).labels).toEqual(['B']);

    const multi = toggleQuestionOption(emptyQuestionDraft(), 'x', true);
    expect(toggleQuestionOption(multi, 'y', true).labels).toEqual(['x', 'y']);
    expect(toggleQuestionOption(toggleQuestionOption(multi, 'y', true), 'x', true).labels).toEqual(
      ['y'],
    );
  });

  it('supports Other free text', () => {
    const draft = setQuestionOtherText(selectQuestionOther(emptyQuestionDraft(), false), 'custom');
    expect(canContinueQuestion(draft)).toBe(true);
    expect(buildQuestionAnswers([questions[0]!], [draft])).toEqual({
      'Prefer A or B?': ['custom'],
    });
  });

  it('omits skipped questions and dismisses when none answered', () => {
    const drafts = [skipQuestionDraft(), skipQuestionDraft()];
    expect(buildQuestionAnswers(questions, drafts)).toBeNull();

    const partial = [
      toggleQuestionOption(emptyQuestionDraft(), 'A', false),
      skipQuestionDraft(),
    ];
    expect(buildQuestionAnswers(questions, partial)).toEqual({
      'Prefer A or B?': ['A'],
    });
  });

  it('pages within bounds and reads other label', () => {
    expect(nextQuestionIndex(0, 2, 1)).toBe(1);
    expect(nextQuestionIndex(1, 2, 1)).toBe(1);
    expect(nextQuestionIndex(0, 2, -1)).toBe(0);
    expect(otherOptionLabel(questions[1]!)).toBe('Custom');
    expect(otherOptionLabel(questions[0]!)).toBe('Other...');
  });
});
