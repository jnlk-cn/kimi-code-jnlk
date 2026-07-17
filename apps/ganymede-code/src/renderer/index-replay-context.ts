const CODEBASE_CONTEXT_OPEN = '<ganymede_codebase_context>';
const CODEBASE_CONTEXT_CLOSE = '</ganymede_codebase_context>';

function replayMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part !== 'object' || part === null) return '';
      const record = part as Record<string, unknown>;
      if (record['type'] === 'text') return String(record['text'] ?? '');
      return '';
    })
    .join('');
}

function extractCodebaseContextBlocks(content: string): readonly string[] {
  const blocks: string[] = [];
  let start = 0;
  while (true) {
    const open = content.indexOf(CODEBASE_CONTEXT_OPEN, start);
    if (open < 0) break;
    const close = content.indexOf(CODEBASE_CONTEXT_CLOSE, open);
    if (close < 0) break;
    blocks.push(content.slice(open, close + CODEBASE_CONTEXT_CLOSE.length));
    start = close + CODEBASE_CONTEXT_CLOSE.length;
  }
  return blocks;
}

export function estimateReplayIndexContextChars(replay: readonly unknown[]): number {
  let total = 0;
  for (const rawRecord of replay) {
    if (typeof rawRecord !== 'object' || rawRecord === null) continue;
    const record = rawRecord as Record<string, unknown>;
    if (record['type'] !== 'message') continue;
    const message = record['message'];
    if (typeof message !== 'object' || message === null) continue;
    const messageRecord = message as Record<string, unknown>;
    if (String(messageRecord['role'] ?? '') !== 'user') continue;
    const content = replayMessageText(messageRecord['content']);
    for (const block of extractCodebaseContextBlocks(content)) {
      total += block.length;
    }
  }
  return total;
}
