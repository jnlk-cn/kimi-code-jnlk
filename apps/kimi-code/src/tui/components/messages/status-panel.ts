/**
 * Status report line builder for `/status`.
 *
 * It mirrors `/usage` visual language but keeps runtime status formatting
 * separate from the TUI orchestration layer.
 */

import {
  effectiveModelAlias,
  type ModelAlias,
  type PermissionMode,
  type SessionStatus,
  type ThinkingEffort,
} from '@moonshot-ai/kimi-code-sdk';
import { visibleWidth } from '@moonshot-ai/pi-tui';

import { PRODUCT_NAME } from '#/constant/app';
import { t, tFormat } from '#/tui/i18n';
import { currentTheme } from '#/tui/theme';
import { PERMISSION_MODE_DISPLAY_NAMES } from '#/tui/utils/permission-mode';
import {
  formatTokenCount,
  ratioSeverity,
  renderProgressBar,
  safeUsageRatio,
  usagePercent,
} from '#/utils/usage/usage-format';

import {
  buildExtraUsageSection,
  buildManagedUsageReportLines,
  type ManagedUsageReport,
} from './usage-panel';

interface FieldRow {
  readonly label: string;
  readonly value: string;
  readonly severity?: 'error';
}

export interface StatusReportOptions {
  readonly version: string;
  readonly model: string;
  readonly workDir: string;
  readonly sessionId: string;
  readonly sessionTitle: string | null;
  readonly thinkingEffort: ThinkingEffort;
  readonly permissionMode: PermissionMode;
  readonly planMode: boolean;
  readonly towerMode: boolean;
  /** Whether the tower experiment is enabled on engine v2 — gates the Tower mode row. */
  readonly towerAvailable: boolean;
  readonly contextUsage: number;
  readonly contextTokens: number;
  readonly maxContextTokens: number;
  readonly availableModels: Record<string, ModelAlias>;
  readonly status?: SessionStatus;
  readonly statusError?: string;
  readonly managedUsage?: ManagedUsageReport;
  readonly managedUsageError?: string;
}

type Colorize = (text: string) => string;

function displayModelName(alias: string, models: Record<string, ModelAlias>): string {
  const model = models[alias];
  const effective = model === undefined ? undefined : effectiveModelAlias(model);
  return effective?.displayName ?? effective?.model ?? alias;
}

function formatModelStatus(options: StatusReportOptions): string {
  const model = options.status?.model ?? options.model;
  if (model.trim().length === 0) return t('not set');

  const effort = options.status?.thinkingEffort ?? options.thinkingEffort;
  return tFormat('{model} (thinking {effort})', {
    model: displayModelName(model, options.availableModels),
    effort,
  });
}

function addFieldRows(
  lines: string[],
  rows: readonly FieldRow[],
  muted: Colorize,
  value: Colorize,
  errorStyle: Colorize,
): void {
  const labelWidth = Math.max(10, ...rows.map((row) => visibleWidth(row.label)));
  for (const row of rows) {
    const colorize = row.severity === 'error' ? errorStyle : value;
    lines.push(`  ${muted(padToWidth(row.label, labelWidth))}  ${colorize(row.value)}`);
  }
}

function padToWidth(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - visibleWidth(text)));
}

function contextValues(options: StatusReportOptions): {
  ratio: number;
  tokens: number;
  maxTokens: number;
} {
  return {
    ratio: options.status?.contextUsage ?? options.contextUsage,
    tokens: options.status?.contextTokens ?? options.contextTokens,
    maxTokens: options.status?.maxContextTokens ?? options.maxContextTokens,
  };
}

export function buildStatusReportLines(options: StatusReportOptions): string[] {
  const accent = (text: string) => currentTheme.boldFg('primary', text);
  const value = (text: string) => currentTheme.fg('text', text);
  const muted = (text: string) => currentTheme.fg('textDim', text);
  const errorStyle = (text: string) => currentTheme.fg('error', text);
  const severityToken = (sev: 'ok' | 'warn' | 'danger'): 'error' | 'warning' | 'success' =>
    sev === 'danger' ? 'error' : sev === 'warn' ? 'warning' : 'success';

  const permission = options.status?.permission ?? options.permissionMode;
  const planMode = options.status?.planMode ?? options.planMode;
  const towerMode = options.status?.towerMode ?? options.towerMode;
  const sessionId = options.sessionId.trim().length > 0 ? options.sessionId : t('none');
  const rows: FieldRow[] = [
    { label: t('Model'), value: formatModelStatus(options) },
    { label: t('Directory'), value: options.workDir },
    { label: t('Permissions'), value: PERMISSION_MODE_DISPLAY_NAMES[permission] },
    { label: t('Plan mode'), value: planMode ? t('on') : t('off') },
  ];
  if (options.towerAvailable) {
    rows.push({ label: t('Tower mode'), value: towerMode ? t('on') : t('off') });
  }
  rows.push({ label: t('Session'), value: sessionId });
  const title = options.sessionTitle?.trim();
  if (title !== undefined && title.length > 0) rows.push({ label: t('Title'), value: title });
  if (options.statusError !== undefined) {
    rows.push({ label: t('Warning'), value: options.statusError, severity: 'error' });
  }

  const lines: string[] = [
    `${accent(`>_ ${PRODUCT_NAME}`)} ${muted(`(v${options.version})`)}`,
    '',
  ];
  addFieldRows(lines, rows, muted, value, errorStyle);

  const { ratio, tokens, maxTokens } = contextValues(options);
  lines.push('');
  lines.push(accent(t('Context window')));
  if (maxTokens > 0) {
    const safeRatio = safeUsageRatio(ratio);
    const bar = renderProgressBar(safeRatio, 20);
    const barColoured = currentTheme.fg(severityToken(ratioSeverity(safeRatio)), bar);
    lines.push(
      `  ${barColoured}  ${value(`${String(usagePercent(tokens, maxTokens))}%`.padStart(6, ' '))}  ` +
        muted(`(${formatTokenCount(tokens)} / ${formatTokenCount(maxTokens)})`),
    );
  } else {
    lines.push(`  ${muted(t('No context window data available.'))}`);
  }

  const managedSection = buildManagedUsageReportLines({
    managedUsage: options.managedUsage,
    managedUsageError: options.managedUsageError,
  });
  if (managedSection.length > 0) {
    lines.push('');
    lines.push(...managedSection);
  }

  const extraSection = buildExtraUsageSection(
    options.managedUsage?.extraUsage,
    accent,
    value,
    muted,
  );
  if (extraSection.length > 0) {
    lines.push('');
    lines.push(...extraSection);
  }

  return lines;
}
