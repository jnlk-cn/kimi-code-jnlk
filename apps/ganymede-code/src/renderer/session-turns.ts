import { computeToolChangeStats } from './tool-change-stats';
import { parseToolDisplayFromEntry } from './tool-display';
import type { TimelineEntry } from './timeline';

const EDIT_TOOLS = new Set(['Write', 'Edit']);
const DEFAULT_FILE_LIMIT = 3;
const TITLE_MAX = 48;
const SUMMARY_MAX = 160;

export interface TurnFileEdit {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
}

export interface SessionTurn {
  readonly id: string;
  readonly userMessage: string;
  readonly assistantSummary: string;
  readonly fileEdits: readonly TurnFileEdit[];
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly startEntryId: string;
}

export function turnAnchorId(turnId: string): string {
  return `turn-${turnId}`;
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function formatTurnTitle(message: string, maxLength = TITLE_MAX): string {
  const collapsed = collapseWhitespace(message);
  if (collapsed.length === 0) return '（空消息）';
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, Math.max(1, maxLength - 1))}…`;
}

function truncateSummary(text: string, maxLength = SUMMARY_MAX): string {
  const collapsed = collapseWhitespace(text);
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, Math.max(1, maxLength - 1))}…`;
}

function collectFileEdits(entries: readonly TimelineEntry[]): TurnFileEdit[] {
  const byPath = new Map<string, { additions: number; deletions: number }>();
  for (const entry of entries) {
    if (entry.kind !== 'tool') continue;
    if (entry.title === undefined || !EDIT_TOOLS.has(entry.title)) continue;
    if (entry.streaming === true || entry.error === true) continue;
    const display = parseToolDisplayFromEntry(entry);
    const path = display.path;
    if (path === undefined || path.length === 0) continue;
    const stats = computeToolChangeStats(entry.title, entry.toolArgs);
    if (stats === undefined) continue;
    const previous = byPath.get(path) ?? { additions: 0, deletions: 0 };
    byPath.set(path, {
      additions: previous.additions + stats.additions,
      deletions: previous.deletions + stats.deletions,
    });
  }
  return [...byPath.entries()]
    .map(([path, stats]) => ({
      path,
      additions: stats.additions,
      deletions: stats.deletions,
    }))
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

function lastAssistantSummary(entries: readonly TimelineEntry[]): string {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.kind === 'assistant' && entry.content.trim().length > 0) {
      return truncateSummary(entry.content);
    }
  }
  return '';
}

function buildTurn(user: TimelineEntry, body: readonly TimelineEntry[]): SessionTurn {
  const fileEdits = collectFileEdits(body);
  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const edit of fileEdits) {
    totalAdditions += edit.additions;
    totalDeletions += edit.deletions;
  }
  return {
    id: user.id,
    userMessage: user.content,
    assistantSummary: lastAssistantSummary(body),
    fileEdits,
    totalAdditions,
    totalDeletions,
    startEntryId: user.id,
  };
}

export function buildSessionTurns(entries: readonly TimelineEntry[]): SessionTurn[] {
  const turns: SessionTurn[] = [];
  let currentUser: TimelineEntry | undefined;
  let body: TimelineEntry[] = [];

  for (const entry of entries) {
    if (entry.kind === 'user') {
      if (currentUser !== undefined) {
        turns.push(buildTurn(currentUser, body));
      }
      currentUser = entry;
      body = [];
      continue;
    }
    if (currentUser !== undefined) {
      body.push(entry);
    }
  }

  if (currentUser !== undefined) {
    turns.push(buildTurn(currentUser, body));
  }

  return turns;
}

export function latestCompletedTurnWithEdits(
  turns: readonly SessionTurn[],
  running: boolean,
): SessionTurn | undefined {
  if (running) return undefined;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn !== undefined && turn.fileEdits.length > 0) {
      return turn;
    }
  }
  return undefined;
}

export function visibleTurnFiles(
  edits: readonly TurnFileEdit[],
  expanded: boolean,
  limit = DEFAULT_FILE_LIMIT,
): { readonly visible: readonly TurnFileEdit[]; readonly hidden: number } {
  if (expanded || edits.length <= limit) {
    return { visible: edits, hidden: 0 };
  }
  return { visible: edits.slice(0, limit), hidden: edits.length - limit };
}

export function splitEditPath(path: string): { readonly dir: string; readonly name: string } {
  const normalized = path.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  if (slash < 0) return { dir: '', name: normalized };
  return {
    dir: normalized.slice(0, slash),
    name: normalized.slice(slash + 1),
  };
}
