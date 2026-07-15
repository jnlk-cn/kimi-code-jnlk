import type { Agent } from '..';

import DEBUG_MODE_ENTER_REMINDER from './enter-reminder.md?raw';
import DEBUG_MODE_EXIT_REMINDER from './exit-reminder.md?raw';

export class DebugMode {
  protected active = false;

  constructor(protected readonly agent: Agent) {}

  enter(): void {
    if (this.active) return;
    this.agent.records.logRecord({ type: 'debug_mode.enter' });
    this.active = true;
    this.agent.context.appendSystemReminder(DEBUG_MODE_ENTER_REMINDER, {
      kind: 'injection',
      variant: 'debug_mode',
    });
    this.agent.emitStatusUpdated();
  }

  restoreEnter(): void {
    this.active = true;
  }

  exit(): void {
    if (!this.active) return;
    this.agent.records.logRecord({ type: 'debug_mode.exit' });
    this.active = false;
    this.agent.emitStatusUpdated();
    if (
      this.agent.context.popMatchedMessage(
        (origin) => origin?.kind === 'injection' && origin.variant === 'debug_mode',
      )
    ) {
      return;
    }
    if (!this.agent.records.restoring) {
      this.agent.context.appendSystemReminder(DEBUG_MODE_EXIT_REMINDER, {
        kind: 'injection',
        variant: 'debug_mode_exit',
      });
    }
  }

  get isActive(): boolean {
    return this.active;
  }
}
