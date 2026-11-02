import { Feature } from '#/features/feature';
import { registerFeature } from '#/features/featureRegistry';

import { IAgentDebugModeService } from './debug';
import { AgentDebugModeService } from './debugService';

export class DebugFeature extends Feature {
  static override readonly name = 'debug';
  constructor() {
    super();
    this.contributeAgentService(IAgentDebugModeService, AgentDebugModeService);
  }
}

registerFeature(DebugFeature);
