import type { ReactNode } from 'react';
import { useState } from 'react';
import { Bug, ChevronDown, CircleDot } from 'lucide-react';

import type {
  DebugVerificationResolution,
  PendingDebugVerification,
} from '../../shared/contracts';

export function DebugVerificationBar(props: {
  readonly request: PendingDebugVerification;
  readonly onResolve: (resolution: DebugVerificationResolution) => void;
}): ReactNode {
  const [panelOpen, setPanelOpen] = useState(true);
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [notes, setNotes] = useState('');
  const probeCount = props.request.probes.length;

  if (feedbackMode) {
    return (
      <div className="debug-verification-bar open feedback">
        <p className="debug-verification-feedback-hint">
          请描述仍存在的现象，代理会根据调试点结果继续排查。
        </p>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="例如：按步骤 2 后仍出现原错误，控制台有 ……"
          rows={3}
          autoFocus
        />
        <div className="debug-verification-actions">
          <button type="button" onClick={() => setFeedbackMode(false)}>
            返回
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              props.onResolve({
                id: props.request.id,
                outcome: 'not_fixed',
                userNotes: notes.trim().length > 0 ? notes.trim() : undefined,
              })
            }
          >
            提交：问题未修复
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`debug-verification-bar${panelOpen ? ' open' : ''}`}>
      <button
        type="button"
        className="debug-verification-header"
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen((value) => !value)}
      >
        <span className="debug-verification-header-main">
          <Bug size={14} />
          <strong>请按步骤验证</strong>
          <span className="debug-verification-summary">
            {props.request.steps.length} 步
            {probeCount > 0 ? ` · ${String(probeCount)} 个调试点` : ''}
          </span>
        </span>
        <ChevronDown size={14} className={panelOpen ? 'open' : undefined} />
      </button>
      {panelOpen ? (
        <>
          {props.request.hypothesis !== undefined && props.request.hypothesis.length > 0 ? (
            <p className="debug-verification-hypothesis" title={props.request.hypothesis}>
              假设：{props.request.hypothesis}
            </p>
          ) : null}
          <ol className="debug-verification-steps">
            {props.request.steps.map((step, index) => (
              <li key={`${String(index)}:${step}`}>{step}</li>
            ))}
          </ol>
          {probeCount > 0 ? (
            <ul className="debug-verification-probes">
              {props.request.probes.map((probe) => (
                <li key={probe.id}>
                  <CircleDot size={11} aria-hidden="true" />
                  <span title={probe.marker}>
                    {probe.file}
                    {probe.line !== undefined ? `:${String(probe.line)}` : ''}
                    {' — '}
                    {probe.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="debug-verification-actions">
            <button type="button" onClick={() => setFeedbackMode(true)}>
              问题未修复
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                props.onResolve({
                  id: props.request.id,
                  outcome: 'fixed',
                })
              }
            >
              问题已修复
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
