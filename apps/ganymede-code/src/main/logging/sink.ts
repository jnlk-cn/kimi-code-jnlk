import { appendFileSync, mkdirSync } from 'node:fs';
import { mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

const PENDING_MAX = 1_000;

class AsyncSerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task, task);
    this.tail = next.catch(() => {});
    return next;
  }
}

export interface RotatingFileSinkOptions {
  readonly path: string;
  readonly maxBytes: number;
  readonly files: number;
}

export class RotatingFileSink {
  private readonly queue = new AsyncSerialQueue();
  private pending: string[] = [];
  private dropped = 0;
  private closed = false;
  private currentBytes = -1;

  constructor(private readonly options: RotatingFileSinkOptions) {}

  enqueue(line: string): void {
    if (this.closed) return;
    if (this.pending.length >= PENDING_MAX) {
      this.pending.shift();
      this.dropped += 1;
    }
    this.pending.push(line);
    void this.queue.run(() => this.drain());
  }

  async flush(): Promise<boolean> {
    return this.queue.run(() => this.drain());
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.flush();
    } catch {
      // close must not throw
    }
  }

  flushSync(): void {
    if (this.closed || this.pending.length === 0) return;
    try {
      mkdirSync(dirname(this.options.path), { recursive: true });
      const body = this.pending.join('') + this.takeDroppedNotice();
      this.pending = [];
      appendFileSync(this.options.path, body);
    } catch {
      // best effort
    }
  }

  private async drain(): Promise<boolean> {
    if (this.pending.length === 0) return true;
    const body = this.pending.join('') + this.takeDroppedNotice();
    this.pending = [];
    try {
      await mkdir(dirname(this.options.path), { recursive: true });
      if (this.currentBytes < 0) {
        try {
          const info = await stat(this.options.path);
          this.currentBytes = info.size;
        } catch {
          this.currentBytes = 0;
        }
      }
      if (this.currentBytes + Buffer.byteLength(body, 'utf8') > this.options.maxBytes) {
        await this.rotate();
        this.currentBytes = 0;
      }
      const handle = await open(this.options.path, 'a');
      try {
        await handle.write(body);
      } finally {
        await handle.close();
      }
      this.currentBytes += Buffer.byteLength(body, 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  private takeDroppedNotice(): string {
    if (this.dropped === 0) return '';
    const notice = JSON.stringify({
      t: new Date().toISOString(),
      level: 'warn',
      scope: 'logging',
      msg: 'log lines dropped due to backpressure',
      ctx: { dropped: this.dropped },
    });
    this.dropped = 0;
    return `${notice}\n`;
  }

  private async rotate(): Promise<void> {
    const { path, files } = this.options;
    if (files <= 1) {
      await unlink(path).catch(() => {});
      return;
    }
    const oldest = `${path}.${String(files - 1)}`;
    await unlink(oldest).catch(() => {});
    for (let index = files - 2; index >= 1; index -= 1) {
      await rename(`${path}.${String(index)}`, `${path}.${String(index + 1)}`).catch(() => {});
    }
    await rename(path, `${path}.1`).catch(() => {});
  }
}
