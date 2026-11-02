import { createDecorator } from '#/_base/di/instantiation';

export interface IAgentDebugModeService {
  readonly _serviceBrand: undefined;

  isActive(): boolean;
  enter(): Promise<void>;
  exit(): void;
}

export const IAgentDebugModeService =
  createDecorator<IAgentDebugModeService>('agentDebugModeService');
