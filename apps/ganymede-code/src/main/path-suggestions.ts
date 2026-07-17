import type { PathSuggestion } from '../shared/contracts';

export function filterPathSuggestions(
  suggestions: readonly PathSuggestion[],
  query: string,
  limit = 80,
): readonly PathSuggestion[] {
  const needle = query.trim().toLocaleLowerCase();
  return suggestions
    .map((suggestion) => ({ suggestion, score: pathSuggestionScore(suggestion, needle) }))
    .filter((item): item is { suggestion: PathSuggestion; score: number } => item.score !== undefined)
    .sort(
      (a, b) =>
        a.score - b.score ||
        Number(b.suggestion.kind === 'directory') - Number(a.suggestion.kind === 'directory') ||
        a.suggestion.path.length - b.suggestion.path.length ||
        a.suggestion.path.localeCompare(b.suggestion.path),
    )
    .slice(0, limit)
    .map((item) => item.suggestion);
}

function pathSuggestionScore(suggestion: PathSuggestion, needle: string): number | undefined {
  if (needle.length === 0) return suggestion.path.split('/').length * 4;
  const path = suggestion.path.toLocaleLowerCase();
  const name = suggestion.name.toLocaleLowerCase();
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1 + name.length / 1_000;
  const nameIndex = name.indexOf(needle);
  if (nameIndex >= 0) return 10 + nameIndex + name.length / 1_000;
  const pathIndex = path.indexOf(needle);
  if (pathIndex >= 0) return 30 + pathIndex + path.length / 1_000;
  let cursor = 0;
  for (const character of path) {
    if (character === needle[cursor]) cursor += 1;
    if (cursor === needle.length) return 100 + path.length / 1_000;
  }
  return undefined;
}
