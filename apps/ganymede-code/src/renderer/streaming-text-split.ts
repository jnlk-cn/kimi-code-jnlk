/** Preferred length of the animated streaming tail (characters). */
export const STREAMING_TAIL_TARGET = 80;

/** Soft floor — if content is shorter than this, keep everything in the tail. */
const STREAMING_TAIL_MIN = 24;

const FENCE_RE = /^(`{3,}|~{3,})/;

export interface StreamingTextParts {
  readonly committed: string;
  readonly tail: string;
}

/**
 * Split streaming assistant/thinking text so committed Markdown stays stable
 * while the newest characters animate as a plain-text tail.
 *
 * Prefer splitting on newlines; never split inside an open code fence.
 */
export function splitStreamingText(content: string, streaming: boolean): StreamingTextParts {
  if (!streaming || content.length === 0) {
    return { committed: content, tail: '' };
  }

  if (content.length <= STREAMING_TAIL_MIN) {
    return { committed: '', tail: content };
  }

  const targetStart = Math.max(0, content.length - STREAMING_TAIL_TARGET);
  const splitAt = findSafeSplitIndex(content, targetStart);
  if (splitAt <= 0) {
    return { committed: '', tail: content };
  }

  return {
    committed: content.slice(0, splitAt),
    tail: content.slice(splitAt),
  };
}

function findSafeSplitIndex(content: string, preferredStart: number): number {
  // When a fence is still open, the split must be at or before its start so the
  // unfinished fence stays entirely in the plain-text tail.
  const openFenceStart = openFenceStartIndex(content);
  const maxSplit = openFenceStart ?? content.length;
  if (maxSplit <= 0) {
    return 0;
  }

  const searchFrom = Math.min(preferredStart, maxSplit);

  // Prefer a newline at or after preferredStart (keep the newline with committed).
  for (let index = searchFrom; index < maxSplit; index += 1) {
    if (content[index] === '\n') {
      return index + 1;
    }
  }

  // Walk backward from preferredStart for a newline still before the open fence.
  for (let index = searchFrom - 1; index >= 0; index -= 1) {
    if (content[index] === '\n') {
      return index + 1;
    }
  }

  // Prefer a space / CJK punctuation boundary after preferredStart.
  for (let index = searchFrom; index < maxSplit; index += 1) {
    if (isSoftBoundary(content[index]!)) {
      return index + 1;
    }
  }

  for (let index = searchFrom - 1; index >= 0; index -= 1) {
    if (isSoftBoundary(content[index]!)) {
      return index + 1;
    }
  }

  // Open fence covers the preferred region — commit everything before it.
  if (openFenceStart !== undefined && openFenceStart > 0) {
    return openFenceStart;
  }

  // No safe boundary: leave everything in the tail so Markdown stays intact.
  return 0;
}

function isSoftBoundary(char: string): boolean {
  return (
    char === ' ' ||
    char === '\t' ||
    char === '，' ||
    char === '。' ||
    char === '、' ||
    char === '；' ||
    char === '：' ||
    char === '！' ||
    char === '？' ||
    char === ',' ||
    char === '.' ||
    char === ';' ||
    char === ':' ||
    char === '!' ||
    char === '?'
  );
}

/** Index of the opening fence line start when the fence is still open; otherwise undefined. */
function openFenceStartIndex(content: string): number | undefined {
  let openFence: string | undefined;
  let openStart = 0;
  let lineStart = 0;

  while (lineStart <= content.length) {
    const nextNl = content.indexOf('\n', lineStart);
    const lineEnd = nextNl === -1 ? content.length : nextNl;
    const line = content.slice(lineStart, lineEnd);
    const trimmed = line.trimStart();
    const match = FENCE_RE.exec(trimmed);

    if (match !== null) {
      const marker = match[1]!;
      if (openFence === undefined) {
        openFence = marker[0]!;
        openStart = lineStart;
      } else if (marker[0] === openFence && marker.length >= 3) {
        openFence = undefined;
      }
    }

    if (nextNl === -1) break;
    lineStart = nextNl + 1;
  }

  return openFence === undefined ? undefined : openStart;
}
