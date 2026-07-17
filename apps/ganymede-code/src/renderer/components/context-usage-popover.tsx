import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import type { MenuAnchor } from '../app-menu';
import {
  CONTEXT_USAGE_CATEGORY_LABELS,
  CONTEXT_USAGE_CATEGORY_ORDER,
  estimateTokensFromCharCount,
  formatContextPercent,
  formatTokenCount,
  resolveContextUsageDisplay,
  sumContextUsageCategories,
  type ContextUsageCategoryId,
} from '../context-usage';
import type { ContextUsageSnapshot, IndexContextPreview } from '../../shared/contracts';

export function ContextUsagePopover(props: {
  readonly anchor: MenuAnchor;
  readonly snapshot: ContextUsageSnapshot | undefined;
  readonly loading: boolean;
  readonly sessionIndexTokens?: number;
  readonly pendingIndexPreview?: IndexContextPreview;
  readonly pendingIndexLoading?: boolean;
  readonly onClose: () => void;
}): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    const menu = host.current;
    if (menu === null) return;
    const bounds = menu.getBoundingClientRect();
    const gap = 7;
    let left: number;
    let top: number;
    if (props.anchor.kind === 'point') {
      left = props.anchor.x;
      top = props.anchor.y;
    } else {
      const rect = props.anchor.rect;
      left = rect.right - bounds.width;
      top = rect.top - bounds.height - gap;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - bounds.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8));
    setStyle({ left, top, opacity: 1 });
  }, [props.anchor, props.snapshot, props.loading]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      if (!(event.target instanceof Node)) return;
      if (host.current?.contains(event.target) === true) return;
      props.onClose();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') props.onClose();
    };
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', props.onClose);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', props.onClose);
    };
  }, [props.onClose]);

  const contextTokens = props.snapshot?.contextTokens ?? 0;
  const maxContextTokens = props.snapshot?.maxContextTokens ?? 0;
  const categories = props.snapshot?.categories;
  const categoryTotal = sumContextUsageCategories(categories);
  const { displayTokens, ratio } = resolveContextUsageDisplay({
    contextTokens,
    maxContextTokens,
    categories,
  });
  const sessionIndexTokens = props.sessionIndexTokens ?? 0;
  const pendingIndexTokens = estimateTokensFromCharCount(props.pendingIndexPreview?.totalChars ?? 0);
  const showIndexSection =
    sessionIndexTokens > 0 ||
    pendingIndexTokens > 0 ||
    props.pendingIndexLoading === true;

  return createPortal(
    <div
      aria-label="上下文用量"
      className="context-usage-popover"
      ref={host}
      role="dialog"
      style={style}
    >
      <div className="context-usage-popover-head">
        <strong>上下文用量</strong>
        <button
          aria-label="关闭"
          className="context-usage-popover-close"
          onClick={props.onClose}
          type="button"
        >
          <X size={14} />
        </button>
      </div>
      {props.loading && props.snapshot === undefined ? (
        <p className="context-usage-popover-loading">正在估算…</p>
      ) : maxContextTokens <= 0 ? (
        <p className="context-usage-popover-loading">暂无上下文窗口数据</p>
      ) : (
        <>
          <div className="context-usage-popover-summary">
            <span>{formatContextPercent(ratio)} 已满</span>
            <span>
              ~{formatTokenCount(displayTokens)} / {formatTokenCount(maxContextTokens)} Tokens
            </span>
          </div>
          <div className="context-usage-popover-bar" aria-hidden="true">
            {categories === undefined || categoryTotal <= 0 || maxContextTokens <= 0 ? (
              <div className="context-usage-bar-empty" />
            ) : (
              CONTEXT_USAGE_CATEGORY_ORDER.map((id) => {
                const tokens = categories[id];
                if (tokens <= 0) return null;
                return (
                  <div
                    className={`context-usage-bar-seg cat-${id}`}
                    key={id}
                    style={{ width: `${(tokens / maxContextTokens) * 100}%` }}
                    title={`${CONTEXT_USAGE_CATEGORY_LABELS[id]} · ${formatTokenCount(tokens)}`}
                  />
                );
              })
            )}
          </div>
          <ul className="context-usage-popover-list">
            {CONTEXT_USAGE_CATEGORY_ORDER.map((id) => (
              <CategoryRow
                id={id}
                key={id}
                tokens={categories?.[id] ?? 0}
              />
            ))}
          </ul>
          {showIndexSection ? (
            <ul className="context-usage-popover-list context-usage-popover-list-index">
              {sessionIndexTokens > 0 ? (
                <li className="context-usage-popover-row">
                  <span className="context-usage-popover-label">
                    <span aria-hidden="true" className="context-usage-swatch cat-projectIndex" />
                    索引上下文（已发送）
                  </span>
                  <span className="context-usage-popover-tokens">
                    ~{formatTokenCount(sessionIndexTokens)}
                  </span>
                </li>
              ) : null}
              {props.pendingIndexLoading === true && props.pendingIndexPreview === undefined ? (
                <li className="context-usage-popover-row muted">
                  <span className="context-usage-popover-label">索引上下文（待注入）</span>
                  <span className="context-usage-popover-tokens">估算中…</span>
                </li>
              ) : pendingIndexTokens > 0 ? (
                <li className="context-usage-popover-row">
                  <span className="context-usage-popover-label">
                    <span aria-hidden="true" className="context-usage-swatch cat-projectIndex" />
                    索引上下文（待注入）
                  </span>
                  <span className="context-usage-popover-tokens">~{formatTokenCount(pendingIndexTokens)}</span>
                </li>
              ) : null}
            </ul>
          ) : null}
          <p className="context-usage-popover-note">
            分类为估算值，总量以模型回报为准
            {sessionIndexTokens > 0 ? '；已发送索引上下文已计入「会话」分类' : ''}
          </p>
        </>
      )}
    </div>,
    document.body,
  );
}

function CategoryRow(props: {
  readonly id: ContextUsageCategoryId;
  readonly tokens: number;
}): ReactNode {
  return (
    <li className="context-usage-popover-row">
      <span className="context-usage-popover-label">
        <span aria-hidden="true" className={`context-usage-swatch cat-${props.id}`} />
        {CONTEXT_USAGE_CATEGORY_LABELS[props.id]}
      </span>
      <span className="context-usage-popover-tokens">{formatTokenCount(props.tokens)}</span>
    </li>
  );
}
