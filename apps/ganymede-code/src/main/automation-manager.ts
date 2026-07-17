import { powerSaveBlocker } from 'electron';

import { IPC, type Automation, type PromptRequest } from '../shared/contracts';
import { nextOccurrence } from './schedule';
import type { AppStore } from './store';
import type { SessionManager } from './session-manager';
import type { WorkspaceService } from './workspace-service';
import type { NotificationBridge } from './notification-bridge';
import { createScopedLogger } from './logging';

type Emit = (channel: string, payload: unknown) => void;

const log = createScopedLogger('automation');

export class AutomationManager {
  private timer: NodeJS.Timeout | undefined;
  private readonly running = new Set<string>();

  constructor(
    private readonly store: AppStore,
    private readonly sessions: SessionManager,
    private readonly workspace: WorkspaceService,
    private readonly emit: Emit,
    private readonly inbox: NotificationBridge,
  ) {}

  start(): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 15_000);
    void this.tick();
    log.info('automation scheduler started');
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    log.info('automation scheduler stopped');
  }

  list(): readonly Automation[] {
    return this.store.listAutomations();
  }

  save(
    input: Omit<Automation, 'id' | 'createdAt'> & { readonly id?: string },
  ): Automation {
    const nextRunAt =
      input.nextRunAt > Date.now() ? input.nextRunAt : nextOccurrence(input.schedule, Date.now());
    const saved = this.store.saveAutomation({ ...input, nextRunAt });
    this.emit(IPC.automationState, undefined);
    return saved;
  }

  delete(id: string): void {
    if (this.running.has(id)) throw new Error('Cannot delete a running automation.');
    this.store.deleteAutomation(id);
    this.emit(IPC.automationState, undefined);
  }

  async run(id: string): Promise<void> {
    const automation = this.store.getAutomation(id);
    if (automation === undefined) throw new Error('Automation does not exist.');
    await this.execute(automation);
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const due = this.store
      .listAutomations()
      .filter((automation) => automation.enabled && automation.nextRunAt <= now);
    await Promise.allSettled(due.map((automation) => this.execute(automation)));
  }

  private async execute(automation: Automation): Promise<void> {
    if (this.running.has(automation.id)) return;
    this.running.add(automation.id);
    log.info('automation started', {
      id: automation.id,
      name: automation.name,
      mode: automation.mode,
      target: automation.target,
    });
    const blocker = powerSaveBlocker.start('prevent-app-suspension');
    let sessionId: string | undefined;
    try {
      let workDir = automation.projectPath;
      if (automation.target === 'worktree') {
        const worktree = await this.workspace.createWorktree(
          automation.projectPath,
          undefined,
          true,
        );
        workDir = worktree.path;
      }
      if (automation.mode === 'same-task' && automation.sessionId !== undefined) {
        const snapshot = await this.sessions.resumeSession(automation.sessionId);
        sessionId = snapshot.id;
      } else {
        const snapshot = await this.sessions.createSession({
          workDir,
          model: automation.model,
          permission: 'auto',
          target: automation.target,
        }, { unattended: true });
        sessionId = snapshot.id;
      }
      this.sessions.setUnattended(sessionId, true);
      const prompt: PromptRequest = { sessionId, text: automation.prompt };
      await this.sessions.runPrompt(prompt);
      const promptPreview = automation.prompt.trim().slice(0, 120);
      this.inbox.addInbox({
        automationId: automation.id,
        sessionId,
        title: `${automation.name} 已完成`,
        detail: [
          `自动化已在 ${new Date().toLocaleString()} 完成。`,
          workDir !== automation.projectPath ? `Worktree：${workDir}` : undefined,
          promptPreview.length > 0 ? `任务：${promptPreview}${automation.prompt.length > 120 ? '…' : ''}` : undefined,
        ]
          .filter((part): part is string => part !== undefined)
          .join('\n'),
        status: 'success',
      });
      log.info('automation completed', { id: automation.id, sessionId });
    } catch (error) {
      log.error('automation failed', { id: automation.id, sessionId, error });
      this.inbox.addInbox({
        automationId: automation.id,
        sessionId,
        title: `${automation.name} 运行失败`,
        detail: error instanceof Error ? error.message : String(error),
        status: 'failed',
      });
    } finally {
      if (sessionId !== undefined) this.sessions.setUnattended(sessionId, false);
      const now = Date.now();
      const nextRunAt = nextOccurrence(automation.schedule, now);
      this.store.saveAutomation({
        ...automation,
        lastRunAt: now,
        nextRunAt,
        enabled: Number.isFinite(nextRunAt) && automation.enabled,
      });
      if (powerSaveBlocker.isStarted(blocker)) powerSaveBlocker.stop(blocker);
      this.running.delete(automation.id);
      this.emit(IPC.automationState, undefined);
    }
  }
}
