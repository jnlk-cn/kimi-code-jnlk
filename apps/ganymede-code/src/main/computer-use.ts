import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { app } from 'electron';

import { resourceRoot } from './app-paths';
import { createScopedLogger } from './logging';

interface Pending {
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
  readonly timer: NodeJS.Timeout;
}

const log = createScopedLogger('computer-use');

export class ComputerUse {
  private process: ChildProcessWithoutNullStreams | undefined;
  private readonly pending = new Map<string, Pending>();

  async call(method: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (process.platform !== 'darwin') {
      throw new Error('Computer Use currently requires macOS.');
    }
    const child = this.ensureProcess();
    const id = randomUUID();
    child.stdin.write(`${JSON.stringify({ id, method, ...args })}\n`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        log.warn('command timed out', { method, id });
        reject(new Error(`Computer Use command timed out: ${method}`));
      }, 45_000);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  close(): void {
    this.process?.kill('SIGTERM');
    this.process = undefined;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Computer Use stopped.'));
    }
    this.pending.clear();
    log.info('computer use helper stopped');
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.process !== undefined && this.process.exitCode === null) return this.process;
    const executable = app.isPackaged
      ? join(process.resourcesPath, 'resources', 'bin', 'ganymede-computer-use')
      : join(resourceRoot(), 'bin', 'ganymede-computer-use');
    const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.process = child;
    log.info('computer use helper started', { executable });
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => this.receive(line));
    child.stderr.on('data', (chunk: Buffer) => {
      log.warn('helper stderr', { text: chunk.toString('utf8') });
    });
    child.once('exit', (code) => {
      if (this.process === child) this.process = undefined;
      log.warn('computer use helper exited', { code });
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Computer Use helper exited.'));
      }
      this.pending.clear();
    });
    return child;
  }

  private receive(line: string): void {
    let response: Record<string, unknown>;
    try {
      response = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }
    const id = typeof response['id'] === 'string' ? response['id'] : undefined;
    if (id === undefined) return;
    const pending = this.pending.get(id);
    if (pending === undefined) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    if (response['ok'] === true) pending.resolve(response['result']);
    else pending.reject(new Error(String(response['error'] ?? 'Computer Use failed.')));
  }
}
