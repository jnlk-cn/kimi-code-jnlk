import { type IDisposable } from '#/_base/di/lifecycle';
import { Service } from '#/_base/di/service';
import { Error2, ErrorCodes } from '#/errors';
import { IAgentContextMemoryService } from '#/agent/contextMemory/contextMemory';
import { IAgentReminderService } from '#/features/reminder/reminderService';
import { IAgentScopeContext } from '#/agent/scopeContext/scopeContext';
import { IAgentStateService } from '#/agent/state/agentState';
import { IAgentToolApprovalService } from '#/agent/toolApproval/toolApproval';
import { denyToolExecution } from '#/agent/toolExecutor/beforeToolExecuteEvent';
import { IAgentToolExecutorService } from '#/agent/toolExecutor/toolExecutor';
import type { BeforeToolExecuteEvent } from '#/agent/toolExecutor/toolHooks';
import { AgentStatusUpdated } from '#/agent/usage/usageEvents';
import { IEventBus } from '#/app/event/eventBus';
import { ITelemetryService } from '#/app/telemetry/telemetry';
import { MAIN_AGENT_ID } from '#/session/agentLifecycle/agentLifecycle';
import { IEventDispatcher } from '#/state/eventDispatcher';
import { ContextUndone } from '#/agent/undo/undoService';

import { IAgentAskModeService } from './ask';
import { AskModeEnter, AskModeExit, askKey } from './askOps';
import { AskModeInjection } from './injection/askModeInjection';

const ASK_MODE_ALLOWED_TOOLS: ReadonlySet<string> = new Set([
  'Read',
  'ReadMediaFile',
  'Glob',
  'Grep',
  'WebSearch',
  'FetchURL',
  'NotifyUser',
  'AskUserQuestion',
  'TodoList',
  'TaskList',
  'TaskOutput',
  'WaitFor',
  'GetGoal',
]);

export class AgentAskModeService extends Service implements IAgentAskModeService {
  declare readonly _serviceBrand: undefined;

  constructor(
    @IAgentContextMemoryService context: IAgentContextMemoryService,
    @IAgentReminderService reminder: IAgentReminderService,
    @IEventBus eventBus: IEventBus,
    @IEventDispatcher private readonly dispatcher: IEventDispatcher,
    @IAgentScopeContext private readonly agentCtx: IAgentScopeContext,
    @IAgentToolExecutorService toolExecutor: IAgentToolExecutorService,
    @IAgentToolApprovalService private readonly toolApproval: IAgentToolApprovalService,
    @ITelemetryService private readonly telemetry: ITelemetryService,
    @IAgentStateService private readonly agentState: IAgentStateService,
  ) {
    super();
    this.agentState.contributeState(askKey);

    this._register(
      this.dispatcher.hooks.onDidRestore.register('ask-mode', async (_ctx, next) => {
        this.restoreTelemetryMode();
        await next();
      }),
    );
    this._register(
      eventBus.subscribe(ContextUndone, () => {
        this.restoreTelemetryMode();
        void this.dispatcher.dispatch(
          new AgentStatusUpdated({ agentId: this.agentCtx.agentId, askMode: this.isActive() }),
        );
      }),
    );

    this._register(new AskModeInjection(reminder, this, context, agentState));
    this._register(this.registerAskGuard(toolExecutor));
  }

  isActive(): boolean {
    return this.agentState.get(askKey).active;
  }

  async enter(): Promise<void> {
    if (this.agentCtx.agentId !== MAIN_AGENT_ID) {
      throw new Error2(
        ErrorCodes.SESSION_AGENT_MODE_INVALID,
        'Ask mode is only available to the main agent',
      );
    }
    if (this.isActive()) return;
    await this.dispatcher.dispatch(new AskModeEnter({ agentId: this.agentCtx.agentId }));
    this.telemetry.setContext({ mode: 'ask' });
  }

  exit(): void {
    if (!this.isActive()) return;
    void this.dispatcher.dispatch(new AskModeExit({ agentId: this.agentCtx.agentId }));
    this.telemetry.setContext({ mode: 'agent' });
  }

  private registerAskGuard(toolExecutor: IAgentToolExecutorService): IDisposable {
    return toolExecutor.onBeforeExecuteTool((event) => {
      this.guardToolExecution(event);
    });
  }

  private guardToolExecution(event: BeforeToolExecuteEvent): void {
    if (!this.isActive()) return;
    if (ASK_MODE_ALLOWED_TOOLS.has(event.toolCall.name)) return;
    event.veto(
      denyToolExecution(
        this.toolApproval.formatDenyMessage(
          `Ask mode is read-only, so ${event.toolCall.name} is not available. ` +
            'Answer the question from what you can read, and tell the user to leave Ask mode ' +
            '(Shift-Tab cycles modes; /ask off exits) when they want changes made.',
        ),
      ),
    );
  }

  private restoreTelemetryMode(): void {
    this.telemetry.setContext({ mode: this.isActive() ? 'ask' : 'agent' });
  }
}

export { AgentAskModeService as AskMode };
