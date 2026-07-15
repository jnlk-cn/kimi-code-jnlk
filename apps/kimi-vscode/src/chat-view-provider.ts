import * as vscode from 'vscode';

import type { SessionNotification } from '@agentclientprotocol/sdk';

import type { AcpSessionManager } from './acp/session-manager.js';

type WebviewInbound =
  | { type: 'ready' }
  | { type: 'prompt'; text: string }
  | { type: 'restart' };

export class KimiChatViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'kimi.chatView';

  private view: vscode.WebviewView | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly manager: AcpSessionManager,
  ) {
    this.manager.onUpdate((notification) => {
      this.postUpdate(notification);
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: WebviewInbound) => {
      if (message.type === 'ready') {
        this.postSystem('Ready. Messages go through `kimi acp` (login required).');
        return;
      }
      if (message.type === 'restart') {
        try {
          await this.manager.restart();
          this.postSystem('ACP agent restarted.');
        } catch (error) {
          this.postSystem(`Restart failed: ${errorMessage(error)}`);
        }
        return;
      }
      if (message.type === 'prompt') {
        const text = message.text.trim();
        if (!text) {
          return;
        }
        this.postUser(text);
        try {
          await this.manager.prompt(text);
        } catch (error) {
          this.postSystem(`Prompt failed: ${errorMessage(error)}`);
        }
      }
    });
  }

  postSystem(text: string): void {
    void this.view?.webview.postMessage({ type: 'system', text });
  }

  private postUser(text: string): void {
    void this.view?.webview.postMessage({ type: 'user', text });
  }

  private postUpdate(notification: SessionNotification): void {
    const update = notification.update;
    if (update.sessionUpdate === 'agent_message_chunk') {
      const content = update.content;
      if (content.type === 'text') {
        void this.view?.webview.postMessage({
          type: 'assistant_delta',
          text: content.text,
        });
      }
      return;
    }
    if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') {
      const title = 'title' in update ? update.title : undefined;
      const status = 'status' in update ? update.status : undefined;
      void this.view?.webview.postMessage({
        type: 'system',
        text: `tool: ${title ?? update.sessionUpdate} (${status ?? ''})`,
      });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource} 'unsafe-inline'`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kimi Chat</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
    }
    body { margin: 0; display: flex; flex-direction: column; height: 100vh; }
    header { padding: 8px 10px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 12px; opacity: 0.85; }
    #log { flex: 1; overflow: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .bubble { padding: 8px 10px; border-radius: 8px; white-space: pre-wrap; line-height: 1.4; border: 1px solid var(--vscode-panel-border); }
    .user { align-self: flex-end; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .assistant { align-self: stretch; background: var(--vscode-editor-background); }
    .system { align-self: stretch; opacity: 0.8; font-size: 12px; }
    form { display: flex; gap: 6px; padding: 8px; border-top: 1px solid var(--vscode-panel-border); }
    input { flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--vscode-input-border, transparent); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
    button { padding: 6px 10px; border-radius: 6px; border: none; background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; }
  </style>
</head>
<body>
  <header>Kimi VS Code · ACP Client（路线 B MVP）</header>
  <div id="log"></div>
  <form id="form">
    <input id="input" type="text" placeholder="发送一条消息…" autocomplete="off" />
    <button type="submit">发送</button>
    <button id="restart" type="button">重启</button>
  </form>
  <script>
    const vscode = acquireVsCodeApi();
    const log = document.getElementById('log');
    const form = document.getElementById('form');
    const input = document.getElementById('input');
    const restart = document.getElementById('restart');
    let streaming = null;

    function bubble(role, text) {
      const el = document.createElement('div');
      el.className = 'bubble ' + role;
      el.textContent = text;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      streaming = null;
      vscode.postMessage({ type: 'prompt', text });
    });

    restart.addEventListener('click', () => {
      vscode.postMessage({ type: 'restart' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'user') {
        bubble('user', msg.text);
        return;
      }
      if (msg.type === 'system') {
        bubble('system', msg.text);
        return;
      }
      if (msg.type === 'assistant_delta') {
        if (!streaming) streaming = bubble('assistant', '');
        streaming.textContent += msg.text || '';
        log.scrollTop = log.scrollHeight;
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
