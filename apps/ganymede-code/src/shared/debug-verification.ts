/**
 * Session-scoped debug probe registry helpers (pure, unit-testable).
 */

import type { DebugProbe } from '../shared/contracts';

export function createDebugProbe(input: {
  readonly file: string;
  readonly label: string;
  readonly marker: string;
  readonly line?: number;
  readonly id?: string;
}): DebugProbe {
  return {
    id: input.id ?? cryptoRandomId(),
    file: input.file,
    label: input.label,
    marker: input.marker,
    line: input.line,
  };
}

export function registerDebugProbe(
  probes: readonly DebugProbe[],
  probe: DebugProbe,
): readonly DebugProbe[] {
  const without = probes.filter((item) => item.id !== probe.id && item.marker !== probe.marker);
  return [...without, probe];
}

export function unregisterDebugProbe(
  probes: readonly DebugProbe[],
  id: string,
): readonly DebugProbe[] {
  return probes.filter((item) => item.id !== id && item.marker !== id);
}

export function sanitizeVerificationSteps(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const steps = raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
  return steps.length > 0 ? steps : undefined;
}

function cryptoRandomId(): string {
  // Prefer Web Crypto / Node crypto when available; fallback for tests.
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `probe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
