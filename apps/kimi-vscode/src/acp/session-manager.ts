import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { Readable, Writable } from 'node:stream';

import {
  ClientSideConnection,
  PROTOCOL_VERSION,
  ndJsonStream,
  type Client,
  type ClientSideConnection as AcpConnection,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
} from '@agentclientprotocol/sdk';
import * as vscode from 'vscode';

export type AcpStreamListener = (update: SessionNotification) => void;

/**
 * Spawns `kimi acp` and speaks ACP as a Client.
 */
export class AcpSessionManager implements vscode.Disposable {
  private child: ChildProcessWithoutNullStreams | undefined;
  private connection: AcpConnection | undefined;
  private sessionId: string | undefined;
  private readonly listeners = new Set<AcpStreamListener>();
  private starting: Promise<void> | undefined;

  constructor(private readonly output: vscode.OutputChannel) {}

  onUpdate(listener: AcpStreamListener): vscode.Disposable {
    this.listeners.add(listener);
    return new vscode.Disposable(() => {
      this.listeners.delete(listener);
    });
  }

  async ensureSession(): Promise<{ sessionId: string }> {
    await this.ensureConnection();
    if (this.sessionId !== undefined && this.connection !== undefined) {
      return { sessionId: this.sessionId };
    }

    const cwd = resolveWorkDir();
    const result = await this.connection!.newSession({
      cwd,
      mcpServers: [],
    });
    this.sessionId = result.sessionId;
    this.output.appendLine(`session/new → ${result.sessionId} (cwd=${cwd})`);
    return { sessionId: result.sessionId };
  }

  async prompt(text: string): Promise<void> {
    const { sessionId } = await this.ensureSession();
    await this.connection!.prompt({
      sessionId,
      prompt: [{ type: 'text', text }],
    });
  }

  async restart(): Promise<void> {
    this.disposeProcess();
    this.sessionId = undefined;
    await this.ensureConnection();
  }

  dispose(): void {
    this.disposeProcess();
    this.listeners.clear();
  }

  private async ensureConnection(): Promise<void> {
    if (this.connection !== undefined) {
      return;
    }
    if (this.starting !== undefined) {
      await this.starting;
      return;
    }

    this.starting = this.startConnection().finally(() => {
      this.starting = undefined;
    });
    await this.starting;
  }

  private async startConnection(): Promise<void> {
    const cliPath = vscode.workspace.getConfiguration('kimi').get<string>('cliPath') ?? 'kimi';
    this.output.appendLine(`spawn: ${cliPath} acp`);

    const child = spawn(cliPath, ['acp'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    this.child = child as ChildProcessWithoutNullStreams;

    child.stderr.on('data', (chunk: Buffer) => {
      this.output.append(chunk.toString('utf8'));
    });
    child.on('exit', (code, signal) => {
      this.output.appendLine(`kimi acp exited code=${String(code)} signal=${String(signal)}`);
      this.connection = undefined;
      this.sessionId = undefined;
      this.child = undefined;
    });

    if (child.stdin === null || child.stdout === null) {
      throw new Error('Failed to open stdio pipes for kimi acp');
    }

    const input = Writable.toWeb(child.stdin);
    const output = Readable.toWeb(child.stdout as Readable);
    const stream = ndJsonStream(input, output);

    const client: Client = {
      requestPermission: async (params: RequestPermissionRequest): Promise<RequestPermissionResponse> => {
        return this.handlePermission(params);
      },
      sessionUpdate: async (notification: SessionNotification): Promise<void> => {
        for (const listener of this.listeners) {
          listener(notification);
        }
      },
      readTextFile: async (params: ReadTextFileRequest): Promise<ReadTextFileResponse> => {
        return this.handleReadTextFile(params);
      },
      writeTextFile: async (params: WriteTextFileRequest): Promise<WriteTextFileResponse> => {
        return this.handleWriteTextFile(params);
      },
    };

    const connection = new ClientSideConnection(() => client, stream);
    this.connection = connection;

    await connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
      },
      clientInfo: {
        name: 'kimi-vscode',
        version: '0.0.1',
      },
    });
    this.output.appendLine('ACP initialize OK');
  }

  private async handlePermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const title = params.toolCall.title ?? 'Permission request';
    const options = params.options;
    const preferred =
      options.find((o) => o.kind === 'allow_once') ??
      options.find((o) => o.kind === 'allow_always') ??
      options[0];

    if (preferred === undefined) {
      void vscode.window.showWarningMessage(`Kimi permission with no options: ${title}`);
      return { outcome: { outcome: 'cancelled' } };
    }

    void vscode.window.showInformationMessage(
      `Kimi auto-approved (stub): ${title} → ${preferred.name}`,
    );
    return {
      outcome: {
        outcome: 'selected',
        optionId: preferred.optionId,
      },
    };
  }

  private async handleReadTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    const uri = vscode.Uri.file(params.path);
    const bytes = await vscode.workspace.fs.readFile(uri);
    let content = Buffer.from(bytes).toString('utf8');
    const line = params.line ?? undefined;
    const limit = params.limit ?? undefined;
    if (line !== undefined || limit !== undefined) {
      const lines = content.split('\n');
      const start = Math.max((line ?? 1) - 1, 0);
      const end = limit === undefined ? lines.length : start + limit;
      content = lines.slice(start, end).join('\n');
    }
    return { content };
  }

  private async handleWriteTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    const uri = vscode.Uri.file(params.path);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(params.content, 'utf8'));
    return {};
  }

  private disposeProcess(): void {
    if (this.child !== undefined && !this.child.killed) {
      this.child.kill();
    }
    this.child = undefined;
    this.connection = undefined;
  }
}

function resolveWorkDir(): string {
  const configured = vscode.workspace.getConfiguration('kimi').get<string>('workDir')?.trim();
  if (configured) {
    return configured;
  }
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (folder) {
    return folder;
  }
  return process.cwd();
}
