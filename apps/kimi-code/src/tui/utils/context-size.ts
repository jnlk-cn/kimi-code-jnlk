import type { ModelAlias } from '@moonshot-ai/kimi-code-sdk';

import type { SlashCommandHost } from '#/tui/commands/dispatch';
import { t, tFormat } from '#/tui/i18n';
import { formatTokenCount } from '#/utils/usage/usage-format';

import { formatErrorMessage } from './event-payload';

/** Selectable working budgets, in tokens (128k … 1M, 1024-based). */
export const CONTEXT_SIZE_PRESETS = [
  131_072, 262_144, 327_680, 524_288, 786_432, 1_048_576,
] as const;

/** Share of the working budget the engine fills before compacting. */
export const COMPACTION_TRIGGER_RATIO = 0.85;

/** The window the model declares; config's `max_context_size`. */
export function declaredContextSize(model: ModelAlias): number {
  return model.maxContextSize;
}

/**
 * The working budget the agent actually fills; config's `max_input_size`,
 * falling back to the declared window. Mirrors the engine, which reads
 * `max_input_tokens ?? max_context_tokens`.
 */
export function effectiveContextSize(model: ModelAlias): number {
  const input = model.maxInputSize;
  if (input === undefined || input <= 0) return model.maxContextSize;
  return Math.min(input, model.maxContextSize);
}

/** Segment values for the picker: presets within the declared window, plus the current budget. */
export function contextSizeOptions(model: ModelAlias): readonly number[] {
  const current = effectiveContextSize(model);
  const options = new Set<number>(
    CONTEXT_SIZE_PRESETS.filter((preset) => preset <= model.maxContextSize),
  );
  if (current > 0) options.add(current);
  return [...options].toSorted((a, b) => a - b);
}

export function contextSizeLabel(size: number): string {
  return formatTokenCount(size);
}

/** Parses `/context 256k`, `/context 1m`, or a bare token count from the preset ladder. */
export function parseContextSizeArg(raw: string): number | undefined {
  const value = raw.trim().toLowerCase();
  if (value.length === 0) return undefined;
  const match = /^(\d+)([km])?$/.exec(value);
  if (match === null) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const multiplier = match[2] === 'm' ? 1024 * 1024 : match[2] === 'k' ? 1024 : 1;
  const size = amount * multiplier;
  return (CONTEXT_SIZE_PRESETS as readonly number[]).includes(size) ? size : undefined;
}

export function contextSizeChoices(): string {
  return CONTEXT_SIZE_PRESETS.map((size) => contextSizeLabel(size).toLowerCase()).join(', ');
}

/**
 * Persists `max_input_size` for the current model and points the running UI at
 * the new window. The engine reads the budget from config, so a live session
 * picks it up through its model catalog without a restart.
 */
export async function applyContextSize(host: SlashCommandHost, size: number): Promise<void> {
  const alias = host.state.appState.model;
  const model = host.state.appState.availableModels[alias];
  if (model === undefined) {
    host.showError(t('No model selected. Run /model to select one first.'));
    return;
  }
  if (effectiveContextSize(model) === size) {
    host.showStatus(
      tFormat('Already using a {size} context window.', { size: contextSizeLabel(size) }),
      'success',
    );
    return;
  }
  try {
    await host.harness.setConfig({ models: { [alias]: { maxInputSize: size } } });
  } catch (error) {
    host.showError(
      tFormat('Failed to set the context window: {error}', { error: formatErrorMessage(error) }),
    );
    return;
  }
  host.setAppState({
    availableModels: { ...host.state.appState.availableModels, [alias]: { ...model, maxInputSize: size } },
    maxContextTokens: size,
  });
  host.track('context_size_switch', { size });
  host.showStatus(
    tFormat('Context window set to {size} (compaction at about {compaction}).', {
      size: contextSizeLabel(size),
      compaction: contextSizeLabel(Math.floor(size * COMPACTION_TRIGGER_RATIO)),
    }),
    'success',
  );
  const used = host.state.appState.contextTokens;
  if (used > size * COMPACTION_TRIGGER_RATIO) {
    host.showStatus(
      tFormat('Current usage ({used}) already exceeds that budget; the next step compacts.', {
        used: contextSizeLabel(used),
      }),
      'warning',
    );
  }
}
