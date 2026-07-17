import { useState, type ReactNode } from 'react';
import { ArrowUp, ChevronDown, Pencil, Trash2, Zap } from 'lucide-react';

import {
  queuedComposerSummary,
  type QueuedComposerItem,
} from '../composer-queue';

export function ComposerQueueBar(props: {
  readonly items: readonly QueuedComposerItem[];
  readonly canSteer?: boolean;
  readonly platform?: NodeJS.Platform;
  readonly onEdit: (item: QueuedComposerItem) => void;
  readonly onPromote: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onSteer?: (item: QueuedComposerItem) => void;
}): ReactNode {
  const [expanded, setExpanded] = useState(true);
  if (props.items.length === 0) return null;

  const steerLabel =
    props.platform === 'darwin' ? '⌘↵ 立即注入当前运行' : 'Ctrl+Enter 立即注入当前运行';

  return (
    <div className="composer-queue-bar" role="region" aria-label="排队消息">
      <button
        type="button"
        className="composer-queue-header"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="composer-queue-header-main">
          <strong>
            {props.items.length} Queued
          </strong>
          {props.canSteer === true ? (
            <span className="composer-queue-hint">{steerLabel}</span>
          ) : null}
        </span>
        <ChevronDown size={14} className={expanded ? 'open' : undefined} />
      </button>
      {expanded ? (
        <ul className="composer-queue-list">
          {props.items.map((item, index) => (
            <li key={item.id} className="composer-queue-row">
              <span className="composer-queue-text" title={queuedComposerSummary(item)}>
                {queuedComposerSummary(item)}
              </span>
              <span className="composer-queue-actions">
                <button
                  type="button"
                  aria-label="编辑排队消息"
                  title="编辑"
                  onClick={() => props.onEdit(item)}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  aria-label="移到队首"
                  title="移到队首"
                  disabled={index === 0}
                  onClick={() => props.onPromote(item.id)}
                >
                  <ArrowUp size={13} />
                </button>
                {props.canSteer === true && props.onSteer !== undefined ? (
                  <button
                    type="button"
                    aria-label="立即注入当前运行"
                    title="立即注入"
                    onClick={() => props.onSteer?.(item)}
                  >
                    <Zap size={13} />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="删除排队消息"
                  title="删除"
                  onClick={() => props.onRemove(item.id)}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
