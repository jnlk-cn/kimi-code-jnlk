import type { Agent } from '..';
import { isInteractionMode, type InteractionMode } from './types';

export type { InteractionMode } from './types';
export { INTERACTION_MODES, isInteractionMode } from './types';

/**
 * Coordinates mutually exclusive interaction modes on a single agent.
 * Derives the current mode from Ask / Debug / Plan / Swarm flags.
 */
export class InteractionModeManager {
  constructor(protected readonly agent: Agent) {}

  getMode(): InteractionMode {
    if (this.agent.askMode.isActive) return 'ask';
    if (this.agent.debugMode.isActive) return 'debug';
    if (this.agent.planMode.isActive) return 'plan';
    if (this.agent.swarmMode.isActive) return 'multitask';
    return 'agent';
  }

  async setMode(mode: InteractionMode): Promise<void> {
    if (!isInteractionMode(mode)) {
      throw new Error(`Unknown interaction mode: ${String(mode)}`);
    }
    if (this.getMode() === mode) return;

    await this.exitAll();

    switch (mode) {
      case 'agent':
        break;
      case 'plan':
        await this.agent.planMode.enter();
        break;
      case 'ask':
        this.agent.askMode.enter();
        break;
      case 'debug':
        this.agent.debugMode.enter();
        break;
      case 'multitask':
        this.agent.swarmMode.enter('manual');
        break;
      default: {
        const _exhaustive: never = mode;
        throw new Error(`Unhandled InteractionMode: ${String(_exhaustive)}`);
      }
    }
  }

  /** Exit conflicting modes before a legacy plan/swarm enter. */
  async prepareForLegacyPlan(): Promise<void> {
    this.agent.askMode.exit();
    this.agent.debugMode.exit();
    if (this.agent.swarmMode.isActive) {
      this.agent.swarmMode.exit();
    }
  }

  prepareForLegacySwarm(): void {
    this.agent.askMode.exit();
    this.agent.debugMode.exit();
    if (this.agent.planMode.isActive) {
      this.agent.planMode.cancel();
    }
  }

  private async exitAll(): Promise<void> {
    this.agent.askMode.exit();
    this.agent.debugMode.exit();
    if (this.agent.planMode.isActive) {
      this.agent.planMode.cancel();
    }
    if (this.agent.swarmMode.isActive) {
      this.agent.swarmMode.exit();
    }
  }
}
