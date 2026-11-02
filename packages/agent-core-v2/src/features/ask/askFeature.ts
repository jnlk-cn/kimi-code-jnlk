import { Feature } from '#/features/feature';
import { registerFeature } from '#/features/featureRegistry';

import { IAgentAskModeService } from './ask';
import { AgentAskModeService } from './askService';

export class AskFeature extends Feature {
  static override readonly name = 'ask';
  constructor() {
    super();
    this.contributeAgentService(IAgentAskModeService, AgentAskModeService);
  }
}

registerFeature(AskFeature);
