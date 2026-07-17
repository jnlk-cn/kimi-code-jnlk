export interface CodeChunk {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly content: string;
}

const MAX_CHUNK_LINES = 120;
const WINDOW_LINES = 80;
const WINDOW_OVERLAP = 20;

const BOUNDARY =
  /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var|def|fn|impl|struct|trait|pub\s+(?:fn|struct|enum|trait)|module)\b|^#{1,6}\s+/;

export function chunkFile(path: string, content: string): readonly CodeChunk[] {
  const normalized = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  if (normalized.trim().length === 0) return [];
  const lines = normalized.split('\n');
  const lower = path.toLocaleLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.mdx')) {
    return chunkByHeading(path, lines);
  }
  if (isCodePath(lower)) {
    return chunkByBoundary(path, lines);
  }
  return chunkByWindow(path, lines, WINDOW_LINES, WINDOW_OVERLAP);
}

function isCodePath(lower: string): boolean {
  return (
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.js') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.mjs') ||
    lower.endsWith('.cjs') ||
    lower.endsWith('.py') ||
    lower.endsWith('.go') ||
    lower.endsWith('.rs') ||
    lower.endsWith('.java') ||
    lower.endsWith('.kt') ||
    lower.endsWith('.swift') ||
    lower.endsWith('.cs') ||
    lower.endsWith('.rb') ||
    lower.endsWith('.php')
  );
}

function chunkByHeading(path: string, lines: readonly string[]): readonly CodeChunk[] {
  const starts: number[] = [0];
  for (let i = 0; i < lines.length; i += 1) {
    if (/^#{1,6}\s+\S/.test(lines[i]!)) starts.push(i);
  }
  return slicesFromStarts(path, lines, starts);
}

function chunkByBoundary(path: string, lines: readonly string[]): readonly CodeChunk[] {
  const starts: number[] = [0];
  for (let i = 1; i < lines.length; i += 1) {
    if (BOUNDARY.test(lines[i]!)) starts.push(i);
  }
  const slices = slicesFromStarts(path, lines, starts);
  const out: CodeChunk[] = [];
  for (const slice of slices) {
    if (slice.endLine - slice.startLine + 1 <= MAX_CHUNK_LINES) {
      out.push(slice);
      continue;
    }
    out.push(
      ...chunkByWindow(
        path,
        lines.slice(slice.startLine - 1, slice.endLine),
        MAX_CHUNK_LINES,
        WINDOW_OVERLAP,
        slice.startLine,
      ),
    );
  }
  return out;
}

function chunkByWindow(
  path: string,
  lines: readonly string[],
  window: number,
  overlap: number,
  lineOffset = 1,
): readonly CodeChunk[] {
  if (lines.length === 0) return [];
  const step = Math.max(1, window - overlap);
  const chunks: CodeChunk[] = [];
  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(lines.length, start + window);
    const content = lines.slice(start, end).join('\n');
    if (content.trim().length > 0) {
      chunks.push({
        path,
        startLine: lineOffset + start,
        endLine: lineOffset + end - 1,
        content,
      });
    }
    if (end >= lines.length) break;
  }
  return chunks;
}

function slicesFromStarts(
  path: string,
  lines: readonly string[],
  starts: readonly number[],
): readonly CodeChunk[] {
  const unique = [...new Set(starts)].toSorted((a, b) => a - b);
  const chunks: CodeChunk[] = [];
  for (let i = 0; i < unique.length; i += 1) {
    const start = unique[i]!;
    const end = (unique[i + 1] ?? lines.length) - 1;
    if (end < start) continue;
    const content = lines.slice(start, end + 1).join('\n');
    if (content.trim().length === 0) continue;
    chunks.push({
      path,
      startLine: start + 1,
      endLine: end + 1,
      content,
    });
  }
  return chunks;
}
