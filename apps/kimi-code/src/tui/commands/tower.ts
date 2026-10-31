import type { Session } from '@moonshot-ai/kimi-code-sdk';

import { t, tFormat } from '#/tui/i18n';

import { TOWER_TEARDOWN_PROMPT } from '../constant/kimi-tui';
import { formatErrorMessage } from '../utils/event-payload';
import type { SlashCommandHost } from './dispatch';

export async function handleTowerCommand(host: SlashCommandHost, args: string): Promise<void> {
  const input = args.trim();
  const sub = input.toLowerCase();

  if (sub === 'on') {
    await applyTowerMode(host, true);
    return;
  }
  if (sub === 'off') {
    await applyTowerMode(host, false);
    return;
  }
  if (sub === '' || sub === 'status') {
    const session = await requireSessionEnsured(host);
    if (session === undefined) return;
    try {
      // The SDK returns the engine-rendered summary; its first line is the
      // state headline, which the notice lifts into the title.
      const [title, ...rest] = (await session.getTowerStatus()).split('\n');
      host.showNotice(title ?? t('Tower status'), rest.length > 0 ? rest.join('\n') : undefined);
    } catch (error) {
      host.showError(
        tFormat('Failed to read tower status: {error}', { error: formatErrorMessage(error) }),
      );
    }
    return;
  }
  if (sub === 'teardown') {
    host.sendNormalUserInput(TOWER_TEARDOWN_PROMPT);
    return;
  }

  await startTowerWithBase(host, input);
}

async function startTowerWithBase(host: SlashCommandHost, base: string): Promise<void> {
  // `/tower <base>` is manual activation too: it turns tower mode on and pins
  // the branch missions merge back into (the engine validates that it is a
  // local branch). Only the agent can never enter the mode by itself.
  const wasActive = host.state.appState.towerMode;
  if (!(await setTowerMode(host, true, base))) return;
  host.showNotice(
    wasActive
      ? tFormat('Tower base: {base}', { base })
      : tFormat('Tower mode: ON (base: {base})', { base }),
  );
}

async function applyTowerMode(host: SlashCommandHost, enabled: boolean): Promise<void> {
  const wasActive = host.state.appState.towerMode;
  // The setter is idempotent engine-side, so always reassert — a stale cache
  // must not leave the authoritative mode unchanged.
  if (!(await setTowerMode(host, enabled))) return;
  if (wasActive === enabled) {
    host.showStatus(
      enabled ? t('Tower mode is already on.') : t('Tower mode is already off.'),
    );
    return;
  }
  host.showNotice(enabled ? t('Tower mode: ON') : t('Tower mode: OFF'));
}

async function setTowerMode(
  host: SlashCommandHost,
  enabled: boolean,
  base?: string,
): Promise<boolean> {
  const session = await requireSessionEnsured(host);
  if (session === undefined) return false;
  try {
    await session.setTowerMode(enabled, base);
    // The engine may silently refuse entry (flag off, feature not assembled
    // until a restart, another session owning the workspace tower) — confirm
    // the mode actually took before reporting success.
    const status = await session.getStatus();
    const effective = status.towerMode ?? false;
    if (effective !== enabled) {
      host.setAppState({ towerMode: effective });
      host.showError(
        enabled
          ? t(
              'Tower mode could not be enabled — another session owns this workspace tower, or the experiment is off / was just turned on and needs a restart.',
            )
          : t('Tower mode could not be disabled.'),
      );
      return false;
    }
  } catch (error) {
    host.showError(
      enabled
        ? tFormat('Failed to enable tower mode: {error}', { error: formatErrorMessage(error) })
        : tFormat('Failed to disable tower mode: {error}', { error: formatErrorMessage(error) }),
    );
    return false;
  }
  host.setAppState({ towerMode: enabled });
  return true;
}

async function requireSessionEnsured(host: SlashCommandHost): Promise<Session | undefined> {
  if (host.session !== undefined) return host.session;
  // v2 session-less: lazy-create the session on first use — the same path
  // the first prompt takes.
  return host.ensureSession();
}
