import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

import type { IPty } from 'node-pty';

import { IPC, type TerminalInfo } from '../shared/contracts';

type Emit = (channel: string, payload: unknown) => void;

interface ManagedTerminal {
  readonly info: TerminalInfo;
  readonly process: IPty;
}

export class TerminalManager {
  private readonly terminals = new Map<string, ManagedTerminal>();

  constructor(private readonly emit: Emit) {}

  async create(cwd: string, sessionId?: string, preferredShell?: string): Promise<TerminalInfo> {
    const pty = await import('node-pty');
    const shell = resolveShell(preferredShell);
    const id = randomUUID();
    const info: TerminalInfo = {
      id,
      sessionId,
      title: shell.split('/').at(-1) ?? 'Terminal',
      cwd,
    };
    const process = pty.spawn(shell, [], {
      cwd,
      cols: 100,
      rows: 30,
      name: 'xterm-256color',
      env: {
        ...processEnv(),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });
    const managed: ManagedTerminal = { info, process };
    this.terminals.set(id, managed);
    process.onData((data) => {
      this.emit(IPC.terminalData, { id, data });
    });
    process.onExit(({ exitCode }) => {
      this.terminals.delete(id);
      this.emit(IPC.terminalExit, { id, exitCode });
    });
    return info;
  }

  input(id: string, data: string): void {
    this.require(id).process.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.require(id).process.resize(Math.max(2, cols), Math.max(1, rows));
  }

  close(id: string): void {
    const terminal = this.terminals.get(id);
    if (terminal === undefined) return;
    this.terminals.delete(id);
    terminal.process.kill();
  }

  closeAll(): void {
    for (const id of [...this.terminals.keys()]) this.close(id);
  }

  private require(id: string): ManagedTerminal {
    const terminal = this.terminals.get(id);
    if (terminal === undefined) throw new Error('Terminal no longer exists.');
    return terminal;
  }
}

function resolveShell(preferred?: string): string {
  if (preferred !== undefined && existsSync(preferred)) return preferred;
  const configured = process.env['SHELL'];
  if (configured !== undefined && existsSync(configured)) return configured;
  return process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh';
}

function processEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  return env;
}
