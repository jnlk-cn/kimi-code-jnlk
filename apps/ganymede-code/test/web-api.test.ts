import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createWebDesktopApi } from '../src/renderer/platform/web-api';
import { IPC } from '../src/shared/contracts';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close(): void {
    // no-op
  }

  emit(data: unknown): void {
    this.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify(data),
      }),
    );
  }
}

function stubBridgeFetch(options?: {
  readonly invoke?: () => Response | Promise<Response>;
  readonly healthSequence?: readonly boolean[];
}): void {
  let healthIndex = 0;
  const healthSequence = options?.healthSequence ?? [true];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/health')) {
        const ready = healthSequence[Math.min(healthIndex, healthSequence.length - 1)] ?? true;
        healthIndex += 1;
        return Response.json({ ok: true, ready });
      }
      if (url.includes('/api/invoke')) {
        if (options?.invoke !== undefined) return options.invoke();
        return Response.json({ result: { appName: 'Ganymede Code' } });
      }
      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
    }),
  );
}

describe('createWebDesktopApi', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    stubBridgeFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('invokes channels through /api/invoke', async () => {
    const api = createWebDesktopApi();
    const result = await api.bootstrap();
    expect(result).toEqual({ appName: 'Ganymede Code' });
    expect(fetch).toHaveBeenCalledWith('/api/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: IPC.bootstrap }),
    });
  });

  it('waits for bridge ready before invoking', async () => {
    stubBridgeFetch({
      healthSequence: [false, false, true],
    });
    const api = createWebDesktopApi();
    const result = await api.bootstrap();
    expect(result).toEqual({ appName: 'Ganymede Code' });
    const healthCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).includes('/api/health'));
    expect(healthCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('surfaces bridge errors', async () => {
    stubBridgeFetch({
      invoke: async () => Response.json({ error: 'denied' }, { status: 500 }),
    });
    const api = createWebDesktopApi();
    await expect(api.listProjects()).rejects.toThrow('denied');
  });

  it('dispatches SSE events to listeners', async () => {
    const api = createWebDesktopApi();
    const events: unknown[] = [];
    const approvals: unknown[] = [];
    const unsubEvent = api.onSessionEvent((event) => {
      events.push(event);
    });
    const unsubApproval = api.onApproval((request) => {
      approvals.push(request);
    });

    await vi.waitFor(() => {
      expect(FakeEventSource.instances).toHaveLength(1);
    });
    expect(FakeEventSource.instances[0]?.url).toBe('/api/events');

    FakeEventSource.instances[0]?.emit({
      channel: IPC.event,
      payload: { type: 'status', value: 'running' },
    });
    FakeEventSource.instances[0]?.emit({
      channel: IPC.approval,
      payload: { id: 'a1', tool: 'Shell' },
    });

    expect(events).toEqual([{ type: 'status', value: 'running' }]);
    expect(approvals).toEqual([{ id: 'a1', tool: 'Shell' }]);

    unsubEvent();
    unsubApproval();
    FakeEventSource.instances[0]?.emit({
      channel: IPC.event,
      payload: { type: 'ignored' },
    });
    expect(events).toHaveLength(1);
  });

  it('opens external URLs in a new tab', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const api = createWebDesktopApi();
    await api.openExternal('https://example.com');
    expect(open).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
