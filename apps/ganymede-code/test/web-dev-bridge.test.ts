import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { WebDevBridge } from '../src/main/web-dev-bridge';

async function freePort(): Promise<number> {
  const { createServer } = await import('node:net');
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Failed to allocate port'));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

describe('WebDevBridge', () => {
  let bridge: WebDevBridge | undefined;

  afterEach(async () => {
    await bridge?.stop();
    bridge = undefined;
  });

  it('serves health and invoke over HTTP', async () => {
    const handlers = new Map([
      [
        'app:bootstrap',
        {
          schema: z.undefined(),
          handler: async () => ({ ok: true, name: 'Ganymede' }),
        },
      ],
    ]);
    const port = await freePort();
    bridge = new WebDevBridge({ port, handlers });
    await bridge.start();

    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ ok: true, ready: false });

    bridge.setReady(true);
    const ready = await fetch(`http://127.0.0.1:${port}/api/health`);
    await expect(ready.json()).resolves.toEqual({ ok: true, ready: true });

    const invoke = await fetch(`http://127.0.0.1:${port}/api/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'app:bootstrap' }),
    });
    expect(invoke.status).toBe(200);
    await expect(invoke.json()).resolves.toEqual({
      result: { ok: true, name: 'Ganymede' },
    });
  });

  it('returns errors for unknown channels and handler failures', async () => {
    const handlers = new Map([
      [
        'fail',
        {
          schema: z.undefined(),
          handler: async () => {
            throw new Error('boom');
          },
        },
      ],
    ]);
    const port = await freePort();
    bridge = new WebDevBridge({ port, handlers });
    await bridge.start();

    const missing = await fetch(`http://127.0.0.1:${port}/api/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'missing' }),
    });
    expect(missing.status).toBe(404);

    const fail = await fetch(`http://127.0.0.1:${port}/api/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'fail' }),
    });
    expect(fail.status).toBe(500);
    await expect(fail.json()).resolves.toEqual({ error: 'boom' });
  });

  it('broadcasts events to SSE clients', async () => {
    const port = await freePort();
    bridge = new WebDevBridge({ port, handlers: new Map() });
    await bridge.start();

    const response = await fetch(`http://127.0.0.1:${port}/api/events`);
    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    if (reader === undefined) throw new Error('missing body');

    const decoder = new TextDecoder();
    let buffer = '';
    const readChunk = async (): Promise<string> => {
      const { value, done } = await reader.read();
      if (done) return buffer;
      buffer += decoder.decode(value, { stream: true });
      return buffer;
    };

    await vi.waitFor(async () => {
      const text = await readChunk();
      expect(text).toContain(': connected');
    });

    bridge.broadcast('event:session', { type: 'ping' });
    await vi.waitFor(async () => {
      const text = await readChunk();
      expect(text).toContain('"channel":"event:session"');
      expect(text).toContain('"type":"ping"');
    });

    await reader.cancel();
  });
});
