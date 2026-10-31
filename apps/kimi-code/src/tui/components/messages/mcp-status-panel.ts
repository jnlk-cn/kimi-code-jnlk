import type { McpServerInfo } from '@moonshot-ai/kimi-code-sdk';
import { visibleWidth } from '@moonshot-ai/pi-tui';

import { t, tFormat } from '#/tui/i18n';
import { currentTheme } from '#/tui/theme';

export interface McpStatusReportOptions {
  readonly servers: readonly McpServerInfo[];
}

const STATUS_PRIORITY: Record<McpServerInfo['status'], number> = {
  failed: 0,
  'needs-auth': 1,
  pending: 2,
  connected: 3,
  disabled: 4,
  removed: 5,
};

const STATUS_LABEL: Record<McpServerInfo['status'], string> = {
  connected: 'connected',
  pending: 'pending',
  'needs-auth': 'needs auth',
  failed: 'failed',
  disabled: 'disabled',
  removed: 'removed',
};

const SUMMARY_ORDER: readonly McpServerInfo['status'][] = [
  'connected',
  'pending',
  'needs-auth',
  'failed',
  'disabled',
  'removed',
];

function statusPainter(
  status: McpServerInfo['status'],
): (text: string) => string {
  switch (status) {
    case 'connected':
      return (text) => currentTheme.fg('success', text);
    case 'failed':
      return (text) => currentTheme.fg('error', text);
    case 'needs-auth':
    case 'pending':
      return (text) => currentTheme.fg('warning', text);
    case 'disabled':
    case 'removed':
      return (text) => currentTheme.fg('textDim', text);
  }
}

function formatToolCount(server: McpServerInfo): string {
  if (server.status === 'disabled' || server.status === 'removed') return '—';
  return tFormat(server.toolCount === 1 ? '{count} tool' : '{count} tools', {
    count: server.toolCount,
  });
}

function formatToolsAvailable(count: number): string {
  return tFormat(count === 1 ? '{count} tool available' : '{count} tools available', { count });
}

/**
 * Collapse a (possibly multi-line) MCP error into a single line. The status
 * panel renders each returned string as exactly one boxed row (see
 * `UsagePanelComponent.render`), so an embedded newline — e.g. the
 * `\nstderr: ...` a failed stdio server appends — would drop the trailing
 * text to column 0 and punch through the rounded border. Folding every run
 * of whitespace to a single space keeps the error on one row, which the
 * panel then truncates to the available width.
 */
function formatErrorLine(error: string): string {
  return error.trim().replaceAll(/\s+/g, ' ');
}

function sortedServers(servers: readonly McpServerInfo[]): McpServerInfo[] {
  return servers.toSorted(
    (a, b) =>
      STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || a.name.localeCompare(b.name),
  );
}

function buildSummary(servers: readonly McpServerInfo[]): string {
  const counts: Partial<Record<McpServerInfo['status'], number>> = {};
  let toolsAvailable = 0;
  for (const server of servers) {
    counts[server.status] = (counts[server.status] ?? 0) + 1;
    if (server.status === 'connected') toolsAvailable += server.toolCount;
  }
  const parts: string[] = [];
  for (const status of SUMMARY_ORDER) {
    const n = counts[status];
    if (n === undefined || n === 0) continue;
    parts.push(tFormat('{count} {label}', { count: n, label: t(STATUS_LABEL[status]) }));
  }
  parts.push(formatToolsAvailable(toolsAvailable));
  return parts.join(' · ');
}

export function buildMcpStatusReportLines(options: McpStatusReportOptions): string[] {
  const servers = sortedServers(options.servers);
  const accent = (text: string) => currentTheme.boldFg('primary', text);
  const muted = (text: string) => currentTheme.fg('textDim', text);
  const value = (text: string) => currentTheme.fg('text', text);
  const error = (text: string) => currentTheme.fg('error', text);

  const lines: string[] = [accent(t('Servers'))];

  if (servers.length === 0) {
    lines.push(muted(t('  No MCP servers configured. Run /mcp-config to add one.')));
    return lines;
  }

  const nameHeader = t('Name');
  const statusHeader = t('Status');
  const transportHeader = t('Transport');
  const toolsHeader = t('Tools');
  const statusLabels = new Map(
    servers.map((server) => [server.status, t(STATUS_LABEL[server.status])]),
  );

  const nameWidth = Math.max(
    visibleWidth(nameHeader),
    ...servers.map((server) => visibleWidth(server.name)),
  );
  const statusWidth = Math.max(
    visibleWidth(statusHeader),
    ...[...statusLabels.values()].map((label) => visibleWidth(label)),
  );
  const transportWidth = Math.max(
    visibleWidth(transportHeader),
    ...servers.map((server) => visibleWidth(server.transport)),
  );

  lines.push(
    `  ${muted(padToWidth(nameHeader, nameWidth))}  ${muted(
      padToWidth(statusHeader, statusWidth),
    )}  ${muted(padToWidth(transportHeader, transportWidth))}  ${muted(toolsHeader)}`,
  );

  for (const server of servers) {
    const status = statusPainter(server.status)(
      padToWidth(statusLabels.get(server.status) ?? STATUS_LABEL[server.status], statusWidth),
    );
    lines.push(
      `  ${value(padToWidth(server.name, nameWidth))}  ${status}  ${muted(
        padToWidth(server.transport, transportWidth),
      )}  ${value(formatToolCount(server))}`,
    );

    if (
      server.status === 'failed' &&
      server.error !== undefined &&
      server.error.trim().length > 0
    ) {
      lines.push(`    ${muted(t('error:'))} ${error(formatErrorLine(server.error))}`);
    }
    if (server.status === 'needs-auth') {
      lines.push(`    ${muted(t('action:'))} ${value(`run /mcp-config login ${server.name}`)}`);
    }
  }

  lines.push('');
  lines.push(`  ${value(buildSummary(servers))}`);
  lines.push(`  ${muted(t('Configure with'))} ${value('/mcp-config')}`);

  return lines;
}

function padToWidth(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - visibleWidth(text)));
}
