import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { getDataDir } from '#/utils/paths';

import {
  applyPreferenceBlock,
  renderPreferenceBlock,
  type AgentPreferences,
} from './agent-preferences';

export function globalInstructionsPath(): string {
  return join(getDataDir(), 'AGENTS.md');
}

export async function writeAgentPreferences(preferences: AgentPreferences): Promise<void> {
  const filePath = globalInstructionsPath();
  let existing = '';
  try {
    existing = await readFile(filePath, 'utf-8');
  } catch {
    existing = '';
  }
  const block = renderPreferenceBlock(preferences);
  const next = applyPreferenceBlock(existing, block);
  if (next === existing) return;
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, next, 'utf-8');
}
