import type { ReactNode } from 'react';

import { DeepSeekLogo } from './components/deepseek-logo';
import type { ModelOption } from '../shared/contracts';

export function isDeepSeekModel(
  model: string | undefined,
  models: readonly ModelOption[],
): boolean {
  if (model === undefined) return false;
  const option = models.find((candidate) => candidate.id === model);
  if (option !== undefined) {
    const provider = option.provider.toLowerCase();
    if (provider === 'deepseek' || provider.includes('deepseek')) return true;
  }
  const normalized = model.toLowerCase();
  return normalized.startsWith('deepseek/') || normalized.includes('deepseek');
}

export function modelProviderIcon(
  model: string | undefined,
  models: readonly ModelOption[],
  size = 13,
): ReactNode {
  if (!isDeepSeekModel(model, models)) return null;
  return <DeepSeekLogo className="model-provider-icon" size={size} />;
}
