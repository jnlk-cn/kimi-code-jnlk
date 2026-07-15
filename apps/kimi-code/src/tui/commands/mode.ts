import {
  interactionModeToToggles,
  type InteractionMode,
} from '@moonshot-ai/kimi-code-sdk';

import { ModeSelectorComponent } from '../components/dialogs/mode-selector';
import { NO_ACTIVE_SESSION_MESSAGE } from '../constant/kimi-tui';
import { formatErrorMessage } from '../utils/event-payload';
import {
  interactionModeLabel,
  isInteractionMode,
} from '../utils/interaction-mode-ui';
import type { SlashCommandHost } from './dispatch';

export async function handleModeCommand(host: SlashCommandHost, args: string): Promise<void> {
  const trimmed = args.trim().toLowerCase();
  if (trimmed.length === 0) {
    showModePicker(host);
    return;
  }
  if (!isInteractionMode(trimmed)) {
    host.showError(`Unknown mode: ${trimmed}. Use agent, plan, debug, multitask, or ask.`);
    return;
  }
  await applyInteractionMode(host, trimmed);
}

export function showModePicker(host: SlashCommandHost): void {
  host.mountEditorReplacement(
    new ModeSelectorComponent({
      currentValue: host.state.appState.interactionMode,
      onSelect: (value) => {
        host.restoreEditor();
        void applyInteractionMode(host, value);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}

export async function applyInteractionMode(
  host: SlashCommandHost,
  mode: InteractionMode,
): Promise<void> {
  const session = host.session;
  if (session === undefined) {
    host.showError(NO_ACTIVE_SESSION_MESSAGE);
    return;
  }

  if (mode === host.state.appState.interactionMode) {
    host.showStatus(`Interaction mode unchanged: ${interactionModeLabel(mode)}.`);
    return;
  }

  const from = host.state.appState.interactionMode;
  try {
    await session.setInteractionMode(mode);
  } catch (error) {
    host.showError(`Failed to set interaction mode: ${formatErrorMessage(error)}`);
    return;
  }

  const toggles = interactionModeToToggles(mode);
  host.setAppState({
    interactionMode: mode,
    planMode: toggles.plan,
    swarmMode: toggles.swarm,
    askMode: toggles.ask,
    debugMode: toggles.debug,
  });
  if (mode !== 'multitask') {
    host.state.swarmModeEntry = undefined;
  }
  host.track('mode_switch', { from_mode: from, to_mode: mode });
  host.showNotice(`Interaction mode: ${interactionModeLabel(mode)}`);
}
