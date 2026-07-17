import type { GitStatus, InteractionMode, ModelOption, PermissionMode } from '../shared/contracts';
import { INTERACTION_MODE_LABELS } from '../shared/contracts';
import { safeContextRatio } from './context-usage';

const MAX_CWD_SEGMENTS = 3;

export function shortenFooterWorkDir(workDir: string): string {
  if (workDir.length === 0) return workDir;
  const homeMatch = /^(\/Users\/[^/]+|\/home\/[^/]+)/.exec(workDir);
  let work = workDir;
  if (homeMatch?.[1] !== undefined) {
    const home = homeMatch[1];
    if (workDir === home) return '~';
    if (workDir.startsWith(`${home}/`)) {
      work = `~${workDir.slice(home.length)}`;
    }
  }

  const segments = work.split(/[/\\]/).filter((segment) => segment.length > 0);
  if (segments.length <= MAX_CWD_SEGMENTS) return work;
  const tail = segments.slice(-MAX_CWD_SEGMENTS).join('/');
  return `…/${tail}`;
}

export function formatFooterGitBadge(status: GitStatus): string {
  const parts: string[] = [];
  if (!status.clean) {
    parts.push(status.files.length > 0 ? String(status.files.length) : '±');
  }
  let sync = '';
  if (status.ahead > 0) sync += `↑${String(status.ahead)}`;
  if (status.behind > 0) sync += `↓${String(status.behind)}`;
  if (sync.length > 0) parts.push(sync);
  return parts.length === 0 ? status.branch : `${status.branch} [${parts.join(' ')}]`;
}

export function formatFooterContextStatus(contextTokens: number, maxContextTokens: number): string {
  const ratio = safeContextRatio(contextTokens, maxContextTokens);
  const pct = `${(ratio * 100).toFixed(1)}%`;
  if (maxContextTokens > 0) {
    return `context: ${pct} (${formatFooterTokenCount(contextTokens)}/${formatFooterTokenCount(maxContextTokens)})`;
  }
  return `context: ${pct}`;
}

export function footerPermissionBadges(permission: PermissionMode): readonly string[] {
  if (permission === 'yolo') return ['yolo'];
  if (permission === 'auto') return ['auto'];
  return [];
}

export function footerInteractionModeLabel(mode: InteractionMode): string {
  return INTERACTION_MODE_LABELS[mode];
}

export function footerModelLabel(
  model: string | undefined,
  thinking: string | undefined,
  models: readonly ModelOption[],
): string | null {
  if (model === undefined) return null;
  const option = models.find((candidate) => candidate.id === model);
  const label = option?.label ?? model;
  const effort = thinking ?? option?.defaultThinking;
  if (effort === undefined || effort === 'off') return label;
  const hasEfforts = (option?.thinkingEfforts.length ?? 0) > 0;
  if (hasEfforts && effort !== 'on') return `${label} thinking: ${effort}`;
  return `${label} thinking`;
}

function formatFooterTokenCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
