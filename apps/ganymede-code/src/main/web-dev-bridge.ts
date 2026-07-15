import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { z } from 'zod';

export interface IpcHandlerEntry {
  readonly schema: z.ZodType;
  readonly handler: (input: unknown) => unknown | Promise<unknown>;
}

export interface WebDevBridgeOptions {
  readonly port: number;
  readonly handlers: Map<string, IpcHandlerEntry>;
  readonly onLog?: (message: string) => void;
}

export class WebDevBridge {
  private readonly clients = new Set<ServerResponse>();
  private server: Server | undefined;
  private readonly port: number;
  private readonly handlers: Map<string, IpcHandlerEntry>;
  private readonly onLog: (message: string) => void;
  private ready = false;

  constructor(options: WebDevBridgeOptions) {
    this.port = options.port;
    this.handlers = options.handlers;
    this.onLog = options.onLog ?? (() => undefined);
  }

  setReady(ready: boolean): void {
    this.ready = ready;
  }

  broadcast(channel: string, payload: unknown): void {
    const data = `data: ${JSON.stringify({ channel, payload })}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(data);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  async start(): Promise<number> {
    if (this.server !== undefined) return this.port;
    this.server = createServer((req, res) => {
      void this.handleRequest(req, res);
    });
    await new Promise<void>((resolve, reject) => {
      const server = this.server;
      if (server === undefined) {
        reject(new Error('WebDevBridge server was not created.'));
        return;
      }
      server.once('error', reject);
      server.listen(this.port, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    this.onLog(`listening on http://127.0.0.1:${this.port}`);
    return this.port;
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
    const server = this.server;
    this.server = undefined;
    if (server === undefined) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        writeJson(res, 200, { ok: true, ready: this.ready });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/events') {
        this.attachSse(res);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/invoke') {
        await this.handleInvoke(req, res);
        return;
      }

      writeJson(res, 404, { error: 'Not found' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 500, { error: message });
    }
  }

  private attachSse(res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  private async handleInvoke(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      writeJson(res, 400, { error: 'Expected JSON object body.' });
      return;
    }
    const channel = (body as { channel?: unknown }).channel;
    if (typeof channel !== 'string' || channel.length === 0) {
      writeJson(res, 400, { error: 'Missing channel.' });
      return;
    }
    const entry = this.handlers.get(channel);
    if (entry === undefined) {
      writeJson(res, 404, { error: `Unknown channel: ${channel}` });
      return;
    }
    const rawInput = (body as { input?: unknown }).input;
    try {
      const input = entry.schema.parse(rawInput);
      const result = await entry.handler(input);
      writeJson(res, 200, { result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(res, 500, { error: message });
    }
  }
}

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw.length === 0) return {};
  return JSON.parse(raw) as unknown;
}
