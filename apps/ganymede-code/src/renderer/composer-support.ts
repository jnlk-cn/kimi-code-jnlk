export type ComposerTrigger = '@' | '/' | '$' | '#';

export interface TriggerContext {
  readonly trigger: ComposerTrigger;
  readonly query: string;
  readonly start: number;
  readonly end: number;
}

export function composerTriggerAt(value: string, cursor: number): TriggerContext | undefined {
  const before = value.slice(0, cursor);
  let start = 0;
  for (let index = before.length - 1; index >= 0; index -= 1) {
    if (/[\s([{]/u.test(before[index] ?? '')) {
      start = index + 1;
      break;
    }
  }
  const token = before.slice(start);
  const trigger = token[0] as ComposerTrigger | undefined;
  if (trigger !== '@' && trigger !== '/' && trigger !== '$' && trigger !== '#') return undefined;
  const query = token.slice(1);
  if (/[@$#]/u.test(query) || (trigger === '/' && query.includes('/'))) return undefined;
  return { trigger, query, start, end: cursor };
}

export function removeComposerTrigger(value: string, context: TriggerContext): string {
  const before = value.slice(0, context.start);
  const after = value.slice(context.end);
  const needsSpace = before.length > 0 && !/\s$/u.test(before) && after.length > 0 && !/^\s/u.test(after);
  return `${before}${needsSpace ? ' ' : ''}${after}`;
}

export function fuzzyTextMatch(value: string, query: string): boolean {
  const haystack = value.toLocaleLowerCase();
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0 || haystack.includes(needle)) return true;
  let cursor = 0;
  for (const character of haystack) {
    if (character === needle[cursor]) cursor += 1;
    if (cursor === needle.length) return true;
  }
  return false;
}
