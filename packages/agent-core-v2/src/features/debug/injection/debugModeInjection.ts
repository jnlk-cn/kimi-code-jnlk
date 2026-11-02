import { Service } from '#/_base/di/service';
import { IAgentContextMemoryService } from '#/agent/contextMemory/contextMemory';
import { IAgentStateService } from '#/agent/state/agentState';
import { IAgentDebugModeService } from '#/features/debug/debug';
import { injectionCadence } from '#/features/reminder/injectionCadence';
import { IAgentReminderService } from '#/features/reminder/reminderService';
import { defineState } from '#/state/state';

import DEBUG_MODE_EXIT_REMINDER from './debug-mode-exit-reminder.md?raw';
import DEBUG_MODE_REMINDER from './debug-mode-reminder.md?raw';

const DEBUG_MODE_DEDUP_MIN_TURNS = 2;
const DEBUG_MODE_FULL_REFRESH_TURNS = 5;
const DEBUG_MODE_INJECTION_VARIANT = 'debug_mode';

export const debugWasActiveKey = defineState<boolean>('debug.wasActive', () => false);

export class DebugModeInjection extends Service {
  constructor(
    injector: IAgentReminderService,
    @IAgentDebugModeService private readonly debug: IAgentDebugModeService,
    @IAgentContextMemoryService private readonly context: IAgentContextMemoryService,
    @IAgentStateService private readonly states: IAgentStateService,
  ) {
    super();
    this.states.contributeState(debugWasActiveKey);

    this._register(
      injector.register(DEBUG_MODE_INJECTION_VARIANT, ({ lastInjectedAt }) => {
        if (!this.debug.isActive()) {
          if (!this.states.get(debugWasActiveKey)) return undefined;
          this.states.set(debugWasActiveKey, false);
          return DEBUG_MODE_EXIT_REMINDER;
        }
        if (!this.states.get(debugWasActiveKey)) {
          this.states.set(debugWasActiveKey, true);
          return DEBUG_MODE_REMINDER;
        }
        const cadence = injectionCadence(lastInjectedAt, this.context.get(), {
          dedupMinTurns: DEBUG_MODE_DEDUP_MIN_TURNS,
          fullRefreshTurns: DEBUG_MODE_FULL_REFRESH_TURNS,
        });
        return cadence === null ? undefined : DEBUG_MODE_REMINDER;
      }),
    );
  }
}
