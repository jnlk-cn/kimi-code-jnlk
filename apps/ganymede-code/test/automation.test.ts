import { afterEach, describe, expect, it, vi } from 'vitest';

import { nextOccurrence } from '../src/main/schedule';

describe('nextOccurrence', () => {
  afterEach(() => vi.useRealTimers());

  it('computes every:N schedules from the current timestamp', () => {
    const after = Date.parse('2026-07-13T00:00:00.000Z');
    expect(nextOccurrence('every:15m', after)).toBe(after + 15 * 60_000);
    expect(nextOccurrence('every:2h', after)).toBe(after + 2 * 3_600_000);
  });

  it('parses RFC 5545 RRULE schedules', () => {
    const after = Date.parse('2026-07-13T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(after);
    const next = nextOccurrence('RRULE:FREQ=DAILY;INTERVAL=1', after);
    expect(next).toBeGreaterThan(after);
    expect(next - after).toBeLessThanOrEqual(86_400_000);
  });

  it('returns infinity for one-time schedules in the past', () => {
    const after = Date.parse('2026-07-13T12:00:00.000Z');
    expect(nextOccurrence('2026-07-13T00:00:00.000Z', after)).toBe(Number.POSITIVE_INFINITY);
  });
});
