import { t } from '#/tui/i18n';

import type { AgentMode } from './agent-mode';

export function agentModeLabel(mode: AgentMode): string {
  if (mode === 'plan') return t('Plan');
  if (mode === 'ask') return t('Ask');
  if (mode === 'debug') return t('Debug');
  return t('Agent');
}
