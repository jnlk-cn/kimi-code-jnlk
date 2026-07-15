import { chmod, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server, type Socket } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { resourceRoot } from './app-paths';
import { createScopedLogger } from './logging';

interface PendingCommand {
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
  readonly timer: NodeJS.Timeout;
}

const log = createScopedLogger('chrome-bridge');

export class ChromeBridge {
  private server: Server | undefined;
  private client: Socket | undefined;
  private buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private readonly pending = new Map<string, PendingCommand>();

  constructor(private readonly userData: string) {}

  get connected(): boolean {
    return this.client !== undefined && !this.client.destroyed;
  }

  async start(): Promise<void> {
    if (process.platform !== 'darwin') return;
    const socketPath = join(this.userData, 'browser-bridge.sock');
    await mkdir(this.userData, { recursive: true });
    await rm(socketPath, { force: true });
    this.server = createServer((socket) => this.attach(socket));
    await new Promise<void>((resolveListen, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(socketPath, () => resolveListen());
    });
    await this.registerNativeHost();
    log.info('chrome bridge started', { socketPath });
  }

  async stop(): Promise<void> {
    this.client?.destroy();
    this.client = undefined;
    for (const command of this.pending.values()) {
      clearTimeout(command.timer);
      command.reject(new Error('Chrome bridge stopped.'));
    }
    this.pending.clear();
    const server = this.server;
    this.server = undefined;
    if (server !== undefined) {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
    await rm(join(this.userData, 'browser-bridge.sock'), { force: true });
    log.info('chrome bridge stopped');
  }

  send(method: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    const client = this.client;
    if (client === undefined || client.destroyed) {
      return Promise.reject(new Error('Chrome extension is not connected.'));
    }
    const id = randomUUID();
    const body = Buffer.from(JSON.stringify({ id, method, ...payload }));
    client.write(frame(body));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        log.warn('chrome command timed out', { method, id });
        reject(new Error(`Chrome command timed out: ${method}`));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  private attach(socket: Socket): void {
    this.client?.destroy();
    this.client = socket;
    this.buffer = Buffer.alloc(0);
    log.info('chrome extension connected');
    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.buffer = drainFrames(this.buffer, (payload) => this.receive(payload));
    });
    socket.on('close', () => {
      if (this.client === socket) this.client = undefined;
      log.info('chrome extension disconnected');
    });
  }

  private receive(payload: Buffer<ArrayBufferLike>): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(payload.toString('utf8')) as Record<string, unknown>;
    } catch {
      return;
    }
    const id = typeof message['id'] === 'string' ? message['id'] : undefined;
    if (id === undefined) return;
    const pending = this.pending.get(id);
    if (pending === undefined) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    if (message['ok'] === true) pending.resolve(message['result']);
    else pending.reject(new Error(String(message['error'] ?? 'Chrome command failed.')));
  }

  private async registerNativeHost(): Promise<void> {
    const hostSource = join(resourceRoot(), 'native-host', 'ganymede-browser-host.mjs');
    const hostPath = join(this.userData, 'ganymede-browser-host.mjs');
    await copyFile(hostSource, hostPath);
    await chmod(hostPath, 0o755);
    const manifest = JSON.stringify(
      {
        name: 'com.ganymede.code.browser',
        description: 'Ganymede Code browser native messaging bridge',
        path: hostPath,
        type: 'stdio',
        allowed_origins: ['chrome-extension://flmokdopkmpffbnjblcooancmeaijobk/'],
      },
      null,
      2,
    );
    const roots = [
      join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
      join(homedir(), 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'),
      join(
        homedir(),
        'Library',
        'Application Support',
        'BraveSoftware',
        'Brave-Browser',
        'NativeMessagingHosts',
      ),
    ];
    await Promise.all(
      roots.map(async (root) => {
        await mkdir(root, { recursive: true });
        await writeFile(join(root, 'com.ganymede.code.browser.json'), manifest, 'utf8');
      }),
    );
  }
}

function frame(payload: Buffer<ArrayBufferLike>): Buffer<ArrayBufferLike> {
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

function drainFrames(
  buffer: Buffer<ArrayBufferLike>,
  onMessage: (payload: Buffer<ArrayBufferLike>) => void,
): Buffer<ArrayBufferLike> {
  let offset = 0;
  while (buffer.length - offset >= 4) {
    const length = buffer.readUInt32LE(offset);
    if (buffer.length - offset - 4 < length) break;
    const start = offset + 4;
    onMessage(buffer.subarray(start, start + length));
    offset = start + length;
  }
  return buffer.subarray(offset);
}
