import { IPC, type EventEnvelope, type InboxItem } from '../shared/contracts';
import type { AppStore } from './store';

type Emit = (channel: string, payload: unknown) => void;
type Notify = (title: string, body: string) => void;

/**
 * Persists inbox notifications from automations and session events, then
 * broadcasts `inboxState` so the renderer can refresh badges and lists.
 */
export class NotificationBridge {
  constructor(
    private readonly store: AppStore,
    private readonly emit: Emit,
    private readonly notify: Notify,
  ) {}

  addInbox(
    input: Omit<InboxItem, 'id' | 'createdAt' | 'unread'> & { readonly id?: string },
    options?: { readonly desktopNotify?: boolean },
  ): InboxItem {
    const item = this.store.addInbox(input);
    this.emit(IPC.inboxState, undefined);
    if (options?.desktopNotify !== false) {
      this.notify('Ganymede Code', item.title);
    }
    return item;
  }

  markRead(id: string): void {
    this.store.markInboxRead(id);
    this.emit(IPC.inboxState, undefined);
  }

  markAllRead(): void {
    this.store.markAllInboxRead();
    this.emit(IPC.inboxState, undefined);
  }

  delete(id: string): void {
    this.store.deleteInbox(id);
    this.emit(IPC.inboxState, undefined);
  }

  unreadCount(): number {
    return this.store.countUnreadInbox();
  }

  handleSessionEvent(envelope: EventEnvelope): void {
    const event = envelope.event as Record<string, unknown>;
    const type = typeof event['type'] === 'string' ? event['type'] : undefined;
    if (type === undefined) return;

    if (type === 'background.task.terminated') {
      const status = typeof event['status'] === 'string' ? event['status'] : 'completed';
      const description =
        typeof event['description'] === 'string' ? event['description'] : '后台任务';
      const failed = status === 'failed' || status === 'timed_out' || status === 'killed' || status === 'lost';
      this.addInbox({
        sessionId: envelope.sessionId,
        title: failed ? `${description} 未完成` : `${description} 已完成`,
        detail: `状态：${status}`,
        status: failed ? 'failed' : 'success',
      });
      return;
    }

    if (type === 'subagent.completed') {
      const name =
        typeof event['name'] === 'string'
          ? event['name']
          : typeof event['agentId'] === 'string'
            ? event['agentId']
            : '子代理';
      const ok = event['success'] !== false && event['error'] === undefined;
      this.addInbox({
        sessionId: envelope.sessionId,
        title: ok ? `${name} 已完成` : `${name} 需要关注`,
        detail: ok
          ? '子代理任务已结束，可打开关联任务查看结果。'
          : typeof event['error'] === 'string'
            ? event['error']
            : '子代理结束时出现问题。',
        status: ok ? 'success' : 'attention',
      });
      return;
    }

    if (type === 'error' && this.isUnattendedAttention(envelope.sessionId, event)) {
      const message =
        typeof event['message'] === 'string'
          ? event['message']
          : '无人值守任务遇到错误，需要你处理。';
      this.addInbox({
        sessionId: envelope.sessionId,
        title: '任务需要关注',
        detail: message,
        status: 'attention',
      });
    }
  }

  private isUnattendedAttention(sessionId: string, event: Record<string, unknown>): boolean {
    // Prefer explicit unattended / approval-blocked signals when present.
    if (event['unattended'] === true) return true;
    if (event['blocked'] === true) return true;
    const message = typeof event['message'] === 'string' ? event['message'].toLowerCase() : '';
    if (message.includes('approval') || message.includes('批准') || message.includes('permission')) {
      return true;
    }
    void sessionId;
    return false;
  }
}
