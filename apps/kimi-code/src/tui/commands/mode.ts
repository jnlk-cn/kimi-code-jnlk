import type { Session } from '@moonshot-ai/kimi-code-sdk';

import { t, tFormat } from '#/tui/i18n';

import { AgentModeSelectorComponent } from '../components/dialogs/agent-mode-selector';
import { NO_ACTIVE_SESSION_MESSAGE } from '../constant/kimi-tui';
import {
  agentModeAppStatePatch,
  currentAgentMode,
  type AgentMode,
} from '../utils/agent-mode';
import { agentModeLabel } from '../utils/agent-mode-display';
import { formatErrorMessage } from '../utils/event-payload';
import type { SlashCommandHost } from './dispatch';

function modeDetail(mode: AgentMode): string | undefined {
  if (mode === 'ask') return t('Ask mode is read-only: answers only, no file changes or commands.');
  if (mode === 'debug') {
    return t('Debug mode: reproduce and gather evidence before fixing, then verify.');
  }
  if (mode === 'agent') return t('Agent mode: full access again.');
  return undefined;
}

async function exitAgentMode(session: Session, mode: AgentMode): Promise<void> {
  if (mode === 'plan') await session.setPlanMode(false);
  else if (mode === 'ask') await session.setAskMode(false);
  else if (mode === 'debug') await session.setDebugMode(false);
}

export async function applyAgentModeSelection(
  host: SlashCommandHost,
  mode: AgentMode,
): Promise<void> {
  const session = host.session;
  if (session === undefined) {
    host.showError(NO_ACTIVE_SESSION_MESSAGE);
    return;
  }
  const current = currentAgentMode(host.state.appState);
  if (current === mode) {
    host.showNotice(tFormat('{mode} mode is already on', { mode: agentModeLabel(mode) }));
    return;
  }

  let detail = modeDetail(mode);
  try {
    if (mode === 'agent') {
      await exitAgentMode(session, current);
    } else if (mode === 'plan') {
      await session.setPlanMode(true);
      const plan = await session.getPlan().catch(() => null);
      if (typeof plan?.path === 'string') {
        detail = tFormat('Plan will be created here: {path}', { path: plan.path });
      }
    } else if (mode === 'ask') {
      await session.setAskMode(true);
    } else {
      await session.setDebugMode(true);
    }
  } catch (error) {
    host.showError(
      tFormat('Failed to switch agent mode: {error}', { error: formatErrorMessage(error) }),
    );
    return;
  }

  host.setAppState(agentModeAppStatePatch(mode));
  host.track('agent_mode_switch', { to_mode: mode });
  host.showNotice(tFormat('{mode} mode: ON', { mode: agentModeLabel(mode) }), detail);
}

async function handleModeToggle(
  host: SlashCommandHost,
  mode: 'ask' | 'debug',
  args: string,
): Promise<void> {
  const subcmd = args.trim().toLowerCase();
  let enabled: boolean;
  if (subcmd.length === 0) enabled = currentAgentMode(host.state.appState) !== mode;
  else if (subcmd === 'on') enabled = true;
  else if (subcmd === 'off') enabled = false;
  else {
    host.showError(
      tFormat('Unknown {mode} subcommand: {subcommand}', {
        mode: agentModeLabel(mode),
        subcommand: subcmd,
      }),
    );
    return;
  }

  if (enabled) {
    await applyAgentModeSelection(host, mode);
    return;
  }
  if (currentAgentMode(host.state.appState) !== mode) {
    host.showNotice(tFormat('{mode} mode is already off', { mode: agentModeLabel(mode) }));
    return;
  }
  await applyAgentModeSelection(host, 'agent');
}

export async function handleAskCommand(host: SlashCommandHost, args: string): Promise<void> {
  await handleModeToggle(host, 'ask', args);
}

export async function handleDebugCommand(host: SlashCommandHost, args: string): Promise<void> {
  await handleModeToggle(host, 'debug', args);
}

export function handleModeCommand(host: SlashCommandHost, args: string): void {
  if (args.trim().length > 0) {
    host.showError(t('Usage: /mode'));
    return;
  }
  host.mountEditorReplacement(
    new AgentModeSelectorComponent({
      currentValue: currentAgentMode(host.state.appState),
      onSelect: (mode) => {
        host.restoreEditor();
        void applyAgentModeSelection(host, mode);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}
