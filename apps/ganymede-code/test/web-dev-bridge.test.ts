import { createServer } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { gateResponse, isPortOpen } from '../scripts/vite-web-api-gate.mjs';
import { WebDevBridge } from '../src/main/web-dev-bridge';

async function freePort(): Promise<number> {
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

describe('vite web-api gate', () => {
  it('returns health ready:false and 503 for other /api routes', () => {
    expect(gateResponse('GET', '/api/health')).toEqual({
      status: 200,
      body: { ok: true, ready: false },
    });
    expect(gateResponse('POST', '/api/invoke')).toEqual({
      status: 503,
      body: { error: 'Web bridge not ready' },
    });
    expect(gateResponse('GET', '/api/events')).toEqual({
      status: 503,
      body: { error: 'Web bridge not ready' },
    });
    expect(gateResponse('GET', '/assets/app.js')).toBeNull();
  });

  it('detects whether the API port is listening', async () => {
    const port = await freePort();
    await expect(isPortOpen(port, 100)).resolves.toBe(false);

    const server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(port, '127.0.0.1', () => resolve());
    });
    try {
      await expect(isPortOpen(port, 100)).resolves.toBe(true);
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });
});

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
