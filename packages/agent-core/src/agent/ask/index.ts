import type { Agent } from '..';

import ASK_MODE_ENTER_REMINDER from './enter-reminder.md?raw';
import ASK_MODE_EXIT_REMINDER from './exit-reminder.md?raw';

export class AskMode {
  protected active = false;

  constructor(protected readonly agent: Agent) {}

  enter(): void {
    if (this.active) return;
    this.agent.records.logRecord({ type: 'ask_mode.enter' });
    this.active = true;
    this.agent.context.appendSystemReminder(ASK_MODE_ENTER_REMINDER, {
      kind: 'injection',
      variant: 'ask_mode',
    });
    this.agent.emitStatusUpdated();
  }

  restoreEnter(): void {
    this.active = true;
  }

  exit(): void {
    if (!this.active) return;
    this.agent.records.logRecord({ type: 'ask_mode.exit' });
    this.active = false;
    this.agent.emitStatusUpdated();
    if (
      this.agent.context.popMatchedMessage(
        (origin) => origin?.kind === 'injection' && origin.variant === 'ask_mode',
      )
    ) {
      return;
    }
    if (!this.agent.records.restoring) {
      this.agent.context.appendSystemReminder(ASK_MODE_EXIT_REMINDER, {
        kind: 'injection',
        variant: 'ask_mode_exit',
      });
    }
  }

  get isActive(): boolean {
    return this.active;
  }
}
