import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, Inbox, Trash2 } from 'lucide-react';

import type { InboxItem } from '../../shared/contracts';
import { EmptyState, PageFrame, formatRelative, messageOf } from '../page-chrome';

const api = window.ganymede;

type InboxFilter = 'all' | 'unread' | 'attention';

export function InboxPage(props: {
  readonly onOpenTask: (id: string) => void;
  readonly onError: (message: string) => void;
  readonly initialAutomationId?: string;
}): ReactNode {
  const [items, setItems] = useState<readonly InboxItem[]>([]);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [automationId, setAutomationId] = useState(props.initialAutomationId);

  const refresh = useCallback(() => {
    void api.listInbox().then(setItems).catch((cause) => props.onError(messageOf(cause)));
  }, [props.onError]);

  useEffect(refresh, [refresh]);
  useEffect(() => {
    const unsubscribers = [
      api.onInboxState(refresh),
      api.onAutomationState(refresh),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [refresh]);

  useEffect(() => {
    setAutomationId(props.initialAutomationId);
  }, [props.initialAutomationId]);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (automationId !== undefined && item.automationId !== automationId) return false;
      if (filter === 'unread') return item.unread;
      if (filter === 'attention') return item.status === 'attention';
      return true;
    });
  }, [items, filter, automationId]);

  return (
    <PageFrame
      icon={<Inbox />}
      title="收件箱"
      subtitle="自动化结果、后台任务与需要处理的通知。"
      action={
        items.some((item) => item.unread) ? (
          <button
            onClick={() => void api.markAllInboxRead().then(refresh).catch((cause) => props.onError(messageOf(cause)))}
          >
            全部标为已读
          </button>
        ) : undefined
      }
    >
      <div className="page-toolbar">
        <div className="segmented-control" role="tablist" aria-label="收件箱筛选">
          {(
            [
              ['all', '全部'],
              ['unread', '未读'],
              ['attention', '需处理'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-selected={filter === value}
              className={filter === value ? 'selected' : undefined}
              onClick={() => setFilter(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        {automationId === undefined ? null : (
          <button onClick={() => setAutomationId(undefined)} type="button">
            清除安排筛选
          </button>
        )}
      </div>
      <div className="card-list">
        {visible.map((item) => (
          <article key={item.id} className={`inbox-card ${item.status}${item.unread ? ' unread' : ''}`}>
            <span className="status-dot" />
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <small>{formatRelative(item.createdAt)}</small>
              <div className="inbox-card-actions">
                {item.unread ? (
                  <button
                    onClick={() =>
                      void api.markInboxRead(item.id).then(refresh).catch((cause) => props.onError(messageOf(cause)))
                    }
                    type="button"
                  >
                    标为已读
                  </button>
                ) : null}
                {item.sessionId === undefined ? null : (
                  <button
                    className="primary-button"
                    onClick={() => {
                      void api.markInboxRead(item.id).then(refresh);
                      props.onOpenTask(item.sessionId!);
                    }}
                    type="button"
                  >
                    打开任务 <ChevronRight size={14} />
                  </button>
                )}
                <button
                  aria-label={`删除 ${item.title}`}
                  onClick={() =>
                    void api.deleteInbox(item.id).then(refresh).catch((cause) => props.onError(messageOf(cause)))
                  }
                  title="删除"
                  type="button"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </article>
        ))}
        {visible.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={items.length === 0 ? '收件箱为空' : '没有匹配的通知'}
            body={
              items.length === 0
                ? 'Scheduled 任务、后台任务与子代理完成后的结果会出现在这里。'
                : '试试切换筛选，或清除安排筛选。'
            }
          />
        ) : null}
      </div>
    </PageFrame>
  );
}
