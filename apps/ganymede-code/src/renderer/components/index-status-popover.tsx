import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import type { IndexStatus } from '../../shared/contracts';
import type { MenuAnchor } from '../app-menu';
import { indexBadgeLabel, indexStatusTitle } from '../project-index-status';

export function IndexStatusPopover(props: {
  readonly anchor: MenuAnchor;
  readonly indexStatus: IndexStatus | undefined;
  readonly onClose: () => void;
  readonly onCancelIndex?: () => void;
  readonly onForceIndex?: () => void;
  readonly onDisableIndex?: () => void;
  readonly onStartIndex?: () => void;
  readonly onEnableIndex?: () => void;
}): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });
  const [busy, setBusy] = useState(false);
  const indexLabel = indexBadgeLabel(props.indexStatus);

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
      left = rect.left;
      top = rect.bottom + gap;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - bounds.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8));
    setStyle({ left, top, opacity: 1 });
  }, [props.anchor, props.indexStatus]);

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

  const status = props.indexStatus;

  return createPortal(
    <div
      aria-label="项目索引"
      className="index-status-popover"
      ref={host}
      role="dialog"
      style={style}
    >
      <div className="index-status-popover-head">
        <strong>项目索引</strong>
        <button
          aria-label="关闭"
          className="index-status-popover-close"
          onClick={props.onClose}
          type="button"
        >
          <X size={14} />
        </button>
      </div>
      {indexLabel.length > 0 ? (
        <p className="index-status-popover-badge">{indexLabel}</p>
      ) : null}
      {status === undefined ? (
        <p className="index-status-popover-loading">{indexStatusTitle(undefined)}</p>
      ) : status.state === 'disabled' ? (
        <>
          <p className="index-status-popover-meta">{indexStatusTitle(status)}</p>
          <p className="index-status-popover-note">
            关闭后 @codebase 与代码库语义检索不可用；启用后索引仅保存在本机。
          </p>
          {props.onEnableIndex !== undefined ? (
            <div className="index-status-popover-actions">
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  props.onEnableIndex?.();
                  setBusy(false);
                }}
                type="button"
              >
                启用索引
              </button>
            </div>
          ) : null}
        </>
      ) : status.state === 'idle' ? (
        <>
          <p className="index-status-popover-meta">{indexStatusTitle(status)}</p>
          <p className="index-status-popover-note">
            建立索引后可在输入框使用 @codebase 注入相关代码片段。
          </p>
          {props.onStartIndex !== undefined ? (
            <div className="index-status-popover-actions">
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  props.onStartIndex?.();
                  setBusy(false);
                }}
                type="button"
              >
                开始索引
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="index-status-popover-meta">{indexStatusTitle(status)}</p>
          <dl className="index-status-popover-stats">
            <div>
              <dt>文件</dt>
              <dd>{String(status.fileCount)}</dd>
            </div>
            <div>
              <dt>文本块</dt>
              <dd>{String(status.chunkCount)}</dd>
            </div>
            <div>
              <dt>向量块</dt>
              <dd>{String(status.embeddedCount)}</dd>
            </div>
            <div>
              <dt>语义检索</dt>
              <dd>{status.semanticReady ? '已启用' : '未启用'}</dd>
            </div>
          </dl>
          {status.state === 'indexing' ? (
            <p className="index-status-popover-note">
              构建进度 {String(Math.round(status.progress * 100))}%
            </p>
          ) : null}
          {status.truncated === true ? (
            <p className="index-status-popover-error">
              已达 50,000 文件上限，索引结果可能不完整。
            </p>
          ) : null}
          {status.state === 'blocked' && status.error !== undefined ? (
            <p className="index-status-popover-error">{status.error}</p>
          ) : status.error !== undefined && status.state === 'error' ? (
            <p className="index-status-popover-error">{status.error}</p>
          ) : null}
          {status.state === 'indexing' && props.onCancelIndex !== undefined ? (
            <div className="index-status-popover-actions">
              <button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  props.onCancelIndex?.();
                  setBusy(false);
                }}
                type="button"
              >
                停止索引
              </button>
            </div>
          ) : null}
          {status.state === 'blocked' ? (
            <div className="index-status-popover-actions">
              {props.onForceIndex !== undefined ? (
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    props.onForceIndex?.();
                    setBusy(false);
                  }}
                  type="button"
                >
                  仍然索引
                </button>
              ) : null}
              {props.onDisableIndex !== undefined ? (
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    props.onDisableIndex?.();
                    setBusy(false);
                  }}
                  type="button"
                >
                  关闭索引
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="index-status-popover-note">
            在输入框使用 @codebase 注入本地索引片段；数据仅保存在本机。
          </p>
        </>
      )}
    </div>,
    document.body,
  );
}
