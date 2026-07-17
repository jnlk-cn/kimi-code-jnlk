import { type ReactNode } from 'react';
import { X } from 'lucide-react';

export function PageFrame(props: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly subtitle: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="route-page">
      <header className="page-heading">
        <span>{props.icon}</span>
        <div>
          <h1>{props.title}</h1>
          <p>{props.subtitle}</p>
        </div>
        {props.action}
      </header>
      <div className="page-content">{props.children}</div>
    </div>
  );
}

export function EmptyState(props: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly body: string;
  readonly action?: ReactNode;
}): ReactNode {
  return (
    <div className="empty-state">
      <span>{props.icon}</span>
      <strong>{props.title}</strong>
      <p>{props.body}</p>
      {props.action}
    </div>
  );
}

export function Modal(props: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <header>
          <strong>{props.title}</strong>
          <button aria-label="关闭" onClick={props.onClose} title="关闭">
            <X size={16} />
          </button>
        </header>
        <div className="modal-body">{props.children}</div>
      </div>
    </div>
  );
}

export function ConfirmSheet(props: {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly danger?: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}): ReactNode {
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <div className="confirm-sheet">
        <p>{props.body}</p>
        <div className="modal-actions">
          <button onClick={props.onClose}>取消</button>
          <button
            className={props.danger ? 'danger-button' : 'primary-button'}
            onClick={props.onConfirm}
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function formatRelative(timestamp: number): string {
  const delta = timestamp - Date.now();
  const absolute = Math.abs(delta);
  if (!Number.isFinite(timestamp)) return '不再运行';
  if (absolute < 60_000) return delta > 0 ? '不到 1 分钟后' : '刚刚';
  if (absolute < 3_600_000) return `${Math.round(absolute / 60_000)} 分钟${delta > 0 ? '后' : '前'}`;
  if (absolute < 86_400_000) return `${Math.round(absolute / 3_600_000)} 小时${delta > 0 ? '后' : '前'}`;
  return new Date(timestamp).toLocaleDateString();
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
