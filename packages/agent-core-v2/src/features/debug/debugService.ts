import { Service } from '#/_base/di/service';
import { Error2, ErrorCodes } from '#/errors';
import { IAgentContextMemoryService } from '#/agent/contextMemory/contextMemory';
import { IAgentReminderService } from '#/features/reminder/reminderService';
import { IAgentScopeContext } from '#/agent/scopeContext/scopeContext';
import { IAgentStateService } from '#/agent/state/agentState';
import { AgentStatusUpdated } from '#/agent/usage/usageEvents';
import { IEventBus } from '#/app/event/eventBus';
import { ITelemetryService } from '#/app/telemetry/telemetry';
import { MAIN_AGENT_ID } from '#/session/agentLifecycle/agentLifecycle';
import { IEventDispatcher } from '#/state/eventDispatcher';
import { ContextUndone } from '#/agent/undo/undoService';

import { IAgentDebugModeService } from './debug';
import { DebugModeEnter, DebugModeExit, debugKey } from './debugOps';
import { DebugModeInjection } from './injection/debugModeInjection';

export class AgentDebugModeService extends Service implements IAgentDebugModeService {
  declare readonly _serviceBrand: undefined;

  constructor(
    @IAgentContextMemoryService context: IAgentContextMemoryService,
    @IAgentReminderService reminder: IAgentReminderService,
    @IEventBus eventBus: IEventBus,
    @IEventDispatcher private readonly dispatcher: IEventDispatcher,
    @IAgentScopeContext private readonly agentCtx: IAgentScopeContext,
    @ITelemetryService private readonly telemetry: ITelemetryService,
    @IAgentStateService private readonly agentState: IAgentStateService,
  ) {
    super();
    this.agentState.contributeState(debugKey);

    this._register(
      this.dispatcher.hooks.onDidRestore.register('debug-mode', async (_ctx, next) => {
        this.restoreTelemetryMode();
        await next();
      }),
    );
    this._register(
      eventBus.subscribe(ContextUndone, () => {
        this.restoreTelemetryMode();
        void this.dispatcher.dispatch(
          new AgentStatusUpdated({ agentId: this.agentCtx.agentId, debugMode: this.isActive() }),
        );
      }),
    );

    this._register(new DebugModeInjection(reminder, this, context, agentState));
  }

  isActive(): boolean {
    return this.agentState.get(debugKey).active;
  }

  async enter(): Promise<void> {
    if (this.agentCtx.agentId !== MAIN_AGENT_ID) {
      throw new Error2(
        ErrorCodes.SESSION_AGENT_MODE_INVALID,
        'Debug mode is only available to the main agent',
      );
    }
    if (this.isActive()) return;
    await this.dispatcher.dispatch(new DebugModeEnter({ agentId: this.agentCtx.agentId }));
    this.telemetry.setContext({ mode: 'debug' });
  }

  exit(): void {
    if (!this.isActive()) return;
    void this.dispatcher.dispatch(new DebugModeExit({ agentId: this.agentCtx.agentId }));
    this.telemetry.setContext({ mode: 'agent' });
  }

  private restoreTelemetryMode(): void {
    this.telemetry.setContext({ mode: this.isActive() ? 'debug' : 'agent' });
  }
}

export { AgentDebugModeService as DebugMode };
