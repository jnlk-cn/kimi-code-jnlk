import { Service } from '#/_base/di/service';
import { IAgentContextMemoryService } from '#/agent/contextMemory/contextMemory';
import { IAgentStateService } from '#/agent/state/agentState';
import { IAgentAskModeService } from '#/features/ask/ask';
import { injectionCadence } from '#/features/reminder/injectionCadence';
import { IAgentReminderService } from '#/features/reminder/reminderService';
import { defineState } from '#/state/state';

import ASK_MODE_EXIT_REMINDER from './ask-mode-exit-reminder.md?raw';
import ASK_MODE_REMINDER from './ask-mode-reminder.md?raw';

const ASK_MODE_DEDUP_MIN_TURNS = 2;
const ASK_MODE_FULL_REFRESH_TURNS = 5;
const ASK_MODE_INJECTION_VARIANT = 'ask_mode';

export const askWasActiveKey = defineState<boolean>('ask.wasActive', () => false);

export class AskModeInjection extends Service {
  constructor(
    injector: IAgentReminderService,
    @IAgentAskModeService private readonly ask: IAgentAskModeService,
    @IAgentContextMemoryService private readonly context: IAgentContextMemoryService,
    @IAgentStateService private readonly states: IAgentStateService,
  ) {
    super();
    this.states.contributeState(askWasActiveKey);

    this._register(
      injector.register(ASK_MODE_INJECTION_VARIANT, ({ lastInjectedAt }) => {
        if (!this.ask.isActive()) {
          if (!this.states.get(askWasActiveKey)) return undefined;
          this.states.set(askWasActiveKey, false);
          return ASK_MODE_EXIT_REMINDER;
        }
        if (!this.states.get(askWasActiveKey)) {
          this.states.set(askWasActiveKey, true);
          return ASK_MODE_REMINDER;
        }
        const cadence = injectionCadence(lastInjectedAt, this.context.get(), {
          dedupMinTurns: ASK_MODE_DEDUP_MIN_TURNS,
          fullRefreshTurns: ASK_MODE_FULL_REFRESH_TURNS,
        });
        return cadence === null ? undefined : ASK_MODE_REMINDER;
      }),
    );
  }
}
