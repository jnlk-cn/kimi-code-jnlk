import { describe, expect, it } from 'vitest';

import {
  createDebugProbe,
  registerDebugProbe,
  sanitizeVerificationSteps,
  unregisterDebugProbe,
} from '../src/shared/debug-verification';
import { formatStepDebugTiming, parseStepTimingInput } from '../src/renderer/debug-timing';

describe('debug probe registry', () => {
  it('registers and replaces probes by marker', () => {
    const first = createDebugProbe({
      id: 'a',
      file: 'src/a.ts',
      label: 'enter',
      marker: 'ganymede-debug-probe:a',
      line: 10,
    });
    const second = createDebugProbe({
      id: 'b',
      file: 'src/a.ts',
      label: 'enter-updated',
      marker: 'ganymede-debug-probe:a',
      line: 12,
    });
    const listed = registerDebugProbe(registerDebugProbe([], first), second);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.label).toBe('enter-updated');
    expect(listed[0]?.id).toBe('b');
  });

  it('unregisters by id or marker', () => {
    const probe = createDebugProbe({
      id: 'x',
      file: 'src/x.ts',
      label: 'probe',
      marker: 'ganymede-debug-probe:x',
    });
    expect(unregisterDebugProbe([probe], 'x')).toEqual([]);
    expect(unregisterDebugProbe([probe], 'ganymede-debug-probe:x')).toEqual([]);
  });
});

describe('sanitizeVerificationSteps', () => {
  it('keeps up to 8 non-empty strings', () => {
    expect(sanitizeVerificationSteps(['  one ', '', 'two'])).toEqual(['one', 'two']);
    expect(
      sanitizeVerificationSteps(Array.from({ length: 12 }, (_, index) => `step ${String(index)}`)),
    ).toHaveLength(8);
    expect(sanitizeVerificationSteps([])).toBeUndefined();
    expect(sanitizeVerificationSteps('nope')).toBeUndefined();
  });
});

describe('formatStepDebugTiming', () => {
  it('requires both latency fields and keeps stream when usage is missing', () => {
    expect(formatStepDebugTiming({})).toBeUndefined();
    expect(formatStepDebugTiming({ llmFirstTokenLatencyMs: 100 })).toBeUndefined();
    expect(
      formatStepDebugTiming({
        llmFirstTokenLatencyMs: 100,
        llmStreamDurationMs: 200,
      }),
    ).toBe('[Debug] TTFT: 100ms | stream: 200ms');
  });

  it('parses event payloads with usage and TTFT split', () => {
    const text = formatStepDebugTiming(
      parseStepTimingInput({
        llmFirstTokenLatencyMs: 1200,
        llmStreamDurationMs: 1000,
        llmRequestBuildMs: 200,
        llmServerFirstTokenMs: 1000,
        usage: { output: 100, inputOther: 50, inputCacheRead: 50 },
      }),
    );
    expect(text).toContain('TTFT: 1.2s (api 1.0s + client 200ms)');
    expect(text).toContain('TPS: 100.0 tok/s');
    expect(text).toContain('cache read');
  });
});
