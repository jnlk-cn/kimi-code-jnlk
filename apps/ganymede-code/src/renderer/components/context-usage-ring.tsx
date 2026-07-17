import type { ReactNode, MouseEvent } from 'react';

import {
  contextUsageSeverity,
  formatContextPercent,
  formatTokenCount,
  safeContextRatio,
} from '../context-usage';

export function ContextUsageRing(props: {
  readonly contextTokens: number;
  readonly maxContextTokens: number;
  readonly disabled?: boolean;
  readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}): ReactNode {
  const ratio = safeContextRatio(props.contextTokens, props.maxContextTokens);
  const percent = formatContextPercent(ratio);
  const severity = contextUsageSeverity(ratio);
  const size = 18;
  const stroke = 2.25;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ratio;
  const title =
    props.maxContextTokens > 0
      ? `${percent} · ${formatTokenCount(props.contextTokens)}/${formatTokenCount(props.maxContextTokens)}`
      : '暂无上下文用量数据';

  return (
    <button
      aria-label="上下文用量"
      className={`context-usage-ring severity-${severity}${props.disabled === true ? ' disabled' : ''}`}
      disabled={props.disabled === true}
      onClick={props.onClick}
      title={title}
      type="button"
    >
      <svg aria-hidden="true" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle
          className="context-usage-ring-track"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="context-usage-ring-progress"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          strokeWidth={stroke}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </button>
  );
}
