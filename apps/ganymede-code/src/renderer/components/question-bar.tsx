import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';

import type { PendingQuestion, QuestionResolution } from '../../shared/contracts';
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
  type QuestionDraft,
} from '../question-answers';

export function QuestionBar(props: {
  readonly request: PendingQuestion;
  readonly onResolve: (resolution: QuestionResolution) => void;
}): ReactNode {
  const questions = props.request.questions;
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<QuestionDraft[]>(() =>
    questions.map(() => emptyQuestionDraft()),
  );

  useEffect(() => {
    setIndex(0);
    setDrafts(questions.map(() => emptyQuestionDraft()));
  }, [props.request.id, questions]);

  const question = questions[index];
  const draft = drafts[index] ?? emptyQuestionDraft();
  const total = questions.length;
  const otherLabel = question === undefined ? 'Other...' : otherOptionLabel(question);
  const otherSelected = draft.kind === 'other';
  const canContinue = question !== undefined && canContinueQuestion(draft);
  const isLast = index >= total - 1;

  const pageLabel = useMemo(
    () => `${String(index + 1)} of ${String(Math.max(total, 1))}`,
    [index, total],
  );

  function updateDraft(next: QuestionDraft): void {
    setDrafts((current) => current.map((item, i) => (i === index ? next : item)));
  }

  function dismiss(): void {
    props.onResolve({ id: props.request.id, answers: {}, cancelled: true });
  }

  function skipCurrent(): void {
    const nextDrafts = drafts.map((item, i) => (i === index ? skipQuestionDraft() : item));
    setDrafts(nextDrafts);
    if (isLast) {
      submit(nextDrafts);
      return;
    }
    setIndex(index + 1);
  }

  function continueCurrent(): void {
    if (question === undefined || !canContinue) return;
    if (isLast) {
      submit(drafts);
      return;
    }
    setIndex(index + 1);
  }

  function submit(nextDrafts: readonly QuestionDraft[]): void {
    const answers = buildQuestionAnswers(questions, nextDrafts);
    if (answers === null) {
      props.onResolve({ id: props.request.id, answers: {}, cancelled: true });
      return;
    }
    props.onResolve({ id: props.request.id, answers });
  }

  if (question === undefined) return null;

  return (
    <div className="question-bar" role="dialog" aria-label="Questions">
      <header className="question-bar-header">
        <div className="question-bar-title">
          <strong>Questions</strong>
          <span className="question-bar-page">{pageLabel}</span>
          <span className="question-bar-nav">
            <button
              type="button"
              aria-label="上一题"
              disabled={index <= 0}
              onClick={() => setIndex(nextQuestionIndex(index, total, -1))}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              aria-label="下一题"
              disabled={index >= total - 1}
              onClick={() => setIndex(nextQuestionIndex(index, total, 1))}
            >
              <ChevronRight size={14} />
            </button>
          </span>
        </div>
        <button type="button" className="question-bar-close" aria-label="关闭" onClick={dismiss}>
          <X size={14} />
        </button>
      </header>

      <div className="question-bar-body">
        {question.header !== undefined && question.header.length > 0 ? (
          <p className="question-bar-tag">{question.header}</p>
        ) : null}
        <p className="question-bar-prompt">
          {String(index + 1)}. {question.prompt}
        </p>
        <div className="question-bar-options" role="group" aria-label={question.prompt}>
          {question.options.map((option) => {
            const selected =
              (draft.kind === 'options' || draft.kind === 'other') &&
              draft.labels.includes(option.label);
            return (
              <button
                key={option.label}
                type="button"
                className={selected ? 'selected' : undefined}
                onClick={() =>
                  updateDraft(toggleQuestionOption(draft, option.label, question.multiple))
                }
              >
                <span className="question-bar-check">{selected ? <Check size={13} /> : null}</span>
                <span className="question-bar-option-copy">
                  <strong>{option.label}</strong>
                  {option.description !== undefined && option.description.length > 0 ? (
                    <small>{option.description}</small>
                  ) : null}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className={otherSelected ? 'selected' : undefined}
            onClick={() => updateDraft(selectQuestionOther(draft, question.multiple))}
          >
            <span className="question-bar-check">{otherSelected ? <Check size={13} /> : null}</span>
            <span className="question-bar-option-copy">
              <strong>{otherLabel}</strong>
              {question.otherDescription !== undefined && question.otherDescription.length > 0 ? (
                <small>{question.otherDescription}</small>
              ) : (
                <small>输入自定义答案</small>
              )}
            </span>
          </button>
        </div>
        {otherSelected ? (
          <input
            className="question-bar-other-input"
            autoFocus
            value={draft.otherText}
            placeholder="输入你的答案…"
            onChange={(event) => updateDraft(setQuestionOtherText(draft, event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                continueCurrent();
              }
            }}
          />
        ) : null}
      </div>

      <footer className="question-bar-footer">
        <button type="button" onClick={skipCurrent}>
          Skip
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!canContinue}
          onClick={continueCurrent}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}
