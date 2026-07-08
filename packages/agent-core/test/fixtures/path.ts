import { expect } from 'vitest';

/** Normalize path separators for cross-platform assertions. */
export function toPosix(path: string): string {
  return path.replaceAll('\\', '/');
}

/** Assert two paths are equal after normalizing separators. */
export function expectPathEqual(actual: string | undefined, expected: string): void {
  expect(actual).toBeDefined();
  expect(toPosix(actual!)).toBe(toPosix(expected));
}
