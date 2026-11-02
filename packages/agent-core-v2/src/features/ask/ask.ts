import { createDecorator } from '#/_base/di/instantiation';

export interface IAgentAskModeService {
  readonly _serviceBrand: undefined;

  isActive(): boolean;
  enter(): Promise<void>;
  exit(): void;
}

export const IAgentAskModeService = createDecorator<IAgentAskModeService>('agentAskModeService');
