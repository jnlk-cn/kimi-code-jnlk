import * as vscode from 'vscode';

import { KimiChatViewProvider } from './chat-view-provider.js';
import { AcpSessionManager } from './acp/session-manager.js';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Kimi ACP');
  const manager = new AcpSessionManager(output);
  const provider = new KimiChatViewProvider(context.extensionUri, manager);

  context.subscriptions.push(
    output,
    manager,
    vscode.window.registerWebviewViewProvider(KimiChatViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('kimi.chat.open', async () => {
      await vscode.commands.executeCommand('kimi.chatView.focus');
    }),
    vscode.commands.registerCommand('kimi.chat.restart', async () => {
      await manager.restart();
      provider.postSystem('ACP agent restarted.');
    }),
  );
}

export function deactivate(): void {
  // Disposables on the extension context handle cleanup.
}
