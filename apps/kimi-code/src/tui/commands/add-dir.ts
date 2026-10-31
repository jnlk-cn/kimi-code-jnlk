import { t, tFormat } from '#/tui/i18n';

import { NO_ACTIVE_SESSION_MESSAGE } from '../constant/kimi-tui';
import { ChoicePickerComponent } from '../components/dialogs/choice-picker';
import type { SlashCommandHost } from './dispatch';
import { slashBusyMessage, slashCommandBusyReason } from './resolve';

type AddDirChoice = 'session' | 'remember' | 'cancel';

export async function handleAddDirCommand(host: SlashCommandHost, args: string): Promise<void> {
  const input = args.trim();
  let session = host.session;

  if (input.length === 0 || input.toLowerCase() === 'list') {
    // With no session yet (v2 session-less startup) the pending startup
    // directories live in appState and will be passed to the lazy-created
    // session; reflect them instead of reporting an empty list.
    const additionalDirs = session?.summary?.additionalDirs ?? host.state.appState.additionalDirs;
    if (additionalDirs.length === 0) {
      host.showStatus(t('No additional directories configured.'));
      return;
    }
    host.showStatus(formatAdditionalDirsStatus(additionalDirs));
    return;
  }

  if (session === undefined) {
    // The path-adding form needs a live session; lazy-create it on first use
    // (the read-only `list`/bare forms above tolerate a missing session).
    session = await host.ensureSession();
    if (session === undefined) return;
    // A first prompt may have started a turn during the await; /add-dir is
    // idle-only, so re-check the busy gate resolved before it.
    const busyReason = slashCommandBusyReason({
      isStreaming: host.state.appState.streamingPhase !== 'idle',
      isCompacting: host.state.appState.isCompacting,
    });
    if (busyReason !== undefined) {
      host.showError(slashBusyMessage('add-dir', busyReason));
      return;
    }
  }

  host.mountEditorReplacement(
    new ChoicePickerComponent({
      title: tFormat('Add directory to workspace: {path}', { path: input }),
      hint: t('↑↓ navigate · Enter confirm · Esc cancel'),
      options: [
        {
          value: 'session',
          label: t('Yes, for this session'),
        },
        {
          value: 'remember',
          label: t('Yes, and remember this directory'),
        },
        {
          value: 'cancel',
          label: t('No'),
        },
      ],
      onSelect: (value) => {
        void handleAddDirChoice(host, session.id, input, value as AddDirChoice);
      },
      onCancel: () => {
        host.restoreEditor();
        host.showStatus(tFormat('Did not add {path} as a working directory.', { path: input }));
      },
    }),
  );
}

function formatAdditionalDirsStatus(additionalDirs: readonly string[]): string {
  return [t('Additional directories:'), ...additionalDirs.map((dir) => `  ${dir}`)].join('\n');
}

async function handleAddDirChoice(
  host: SlashCommandHost,
  sessionId: string,
  path: string,
  choice: AddDirChoice,
): Promise<void> {
  host.restoreEditor();

  if (choice === 'cancel') {
    host.showStatus(tFormat('Did not add {path} as a working directory.', { path }));
    return;
  }

  const session = host.session;
  if (session === undefined || session.id !== sessionId) {
    host.showError(NO_ACTIVE_SESSION_MESSAGE);
    return;
  }

  try {
    const result = await session.addAdditionalDir(path, { persist: choice === 'remember' });
    host.setAppState({ additionalDirs: result.additionalDirs });
    host.refreshSlashCommandAutocomplete();
    host.showStatus(
      choice === 'remember'
        ? tFormat(
            'Added workspace directory:\n  {path}\n  Remembered in the workspace registry',
            { path },
          )
        : tFormat('Added workspace directory:\n  {path}\n  For this session only', { path }),
      'success',
    );
  } catch (error) {
    host.showError(error instanceof Error ? error.message : String(error));
  }
}
