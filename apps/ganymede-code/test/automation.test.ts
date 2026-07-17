import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { nextOccurrence } from '../src/main/schedule';
import { NotificationBridge } from '../src/main/notification-bridge';
import { AppStore } from '../src/main/store';
import { computeUpdateStatus, isNewerSemver } from '../src/main/plugin-marketplace';

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

describe('NotificationBridge', () => {
  let directory = '';
  let store: AppStore | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ganymede-inbox-'));
    store = new AppStore(join(directory, 'test.sqlite'), join(directory, 'worktrees'));
  });

  afterEach(async () => {
    store?.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('maps background and subagent events into inbox statuses', () => {
    const emit = vi.fn();
    const notify = vi.fn();
    const bridge = new NotificationBridge(store!, emit, notify);

    bridge.handleSessionEvent({
      seq: 1,
      sessionId: 'session-1',
      event: {
        type: 'background.task.terminated',
        status: 'failed',
        description: '长任务',
      },
    });
    bridge.handleSessionEvent({
      seq: 2,
      sessionId: 'session-1',
      event: {
        type: 'subagent.completed',
        name: 'explore',
        success: false,
        error: 'timed out',
      },
    });

    const items = store!.listInbox();
    expect(items).toHaveLength(2);
    expect(items.some((item) => item.status === 'failed' && item.title.includes('长任务'))).toBe(true);
    expect(items.some((item) => item.status === 'attention' && item.title.includes('explore'))).toBe(true);
    expect(emit).toHaveBeenCalled();
    expect(notify).toHaveBeenCalled();
  });
});

describe('plugin marketplace version compare', () => {
  it('detects updates only for valid newer semver', () => {
    expect(isNewerSemver('1.2.0', '1.1.9')).toBe(true);
    expect(isNewerSemver('1.1.9', '1.2.0')).toBe(false);
    expect(computeUpdateStatus('2.0.0', '1.5.0', true)).toEqual({
      kind: 'update',
      local: '1.5.0',
      latest: '2.0.0',
    });
    expect(computeUpdateStatus(undefined, '1.0.0', false)).toEqual({ kind: 'not-installed' });
  });
});
