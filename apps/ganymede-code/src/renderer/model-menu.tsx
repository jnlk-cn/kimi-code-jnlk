import { Brain, ShieldAlert, Sparkles } from 'lucide-react';

import type { ModelOption } from '../shared/contracts';
import type { AppMenuItem } from './app-menu';
import { DeepSeekLogo } from './components/deepseek-logo';
import { isDeepSeekModel } from './model-provider-icon';

export type ModelConfigureInput = {
  readonly model?: string;
  readonly thinking?: string;
};

export function thinkingLabel(effort: string): string {
  if (effort === 'off') return '关闭';
  if (effort === 'on') return '开启';
  return effort.charAt(0).toUpperCase() + effort.slice(1);
}

export function modelLabel(
  model: string | undefined,
  thinking: string | undefined,
  models: readonly ModelOption[],
): string {
  if (model === undefined) return '未配置模型';
  const option = models.find((candidate) => candidate.id === model);
  const label = option?.label ?? model;
  const effort = thinking ?? option?.defaultThinking;
  return effort === undefined ? label : `${label} · ${thinkingLabel(effort)}`;
}

export function modelMenuItems(
  current: string | undefined,
  currentThinking: string | undefined,
  models: readonly ModelOption[],
  onConfigure: (config: ModelConfigureInput) => void,
): readonly AppMenuItem[] {
  if (models.length === 0) {
    return [{ id: 'missing-model', label: '未配置可用模型', icon: <ShieldAlert />, disabled: true }];
  }
  return models.map((model) => ({
    id: model.id,
    label: model.label,
    description: `${model.provider} · 思考默认 ${thinkingLabel(model.defaultThinking)}`,
    icon: isDeepSeekModel(model.id, models) ? <DeepSeekLogo size={13} /> : <Sparkles />,
    checked: model.id === current,
    children: model.thinkingEfforts.length > 1
      ? model.thinkingEfforts.map((thinking): AppMenuItem => ({
          id: `${model.id}:${thinking}`,
          label: `思考 ${thinkingLabel(thinking)}`,
          description: thinking === model.defaultThinking ? '模型默认' : undefined,
          checked: model.id === current && thinking === currentThinking,
          icon: <Brain size={13} />,
          onSelect: () => onConfigure({ model: model.id, thinking }),
        }))
      : undefined,
    // Always selectable: click applies the model default (or only) thinking effort.
    // Hover / → still opens the thinking submenu when multiple efforts exist.
    onSelect: () => onConfigure({
      model: model.id,
      thinking: model.thinkingEfforts.length === 1
        ? model.thinkingEfforts[0]
        : model.defaultThinking,
    }),
  }));
}

/** Narrow label for compact toolbar buttons (omit thinking effort). */
export function modelShortLabel(
  model: string | undefined,
  models: readonly ModelOption[],
): string {
  if (model === undefined) return '未配置模型';
  return models.find((candidate) => candidate.id === model)?.label ?? model;
}

export function buildShortcutLabel(platform?: NodeJS.Platform): string {
  const mod = platform === 'darwin' ? '⌘' : 'Ctrl';
  return `${mod}↵`;
}
