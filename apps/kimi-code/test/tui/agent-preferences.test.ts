import { describe, expect, it } from 'vitest';

import {
  applyPreferenceBlock,
  PREFERENCE_BLOCK_END,
  PREFERENCE_BLOCK_START,
  renderPreferenceBlock,
} from '#/tui/utils/agent-preferences';

function marked(body: string): string {
  return `${PREFERENCE_BLOCK_START}\n${body}\n${PREFERENCE_BLOCK_END}`;
}

describe('agent preference block', () => {
  it('renders nothing when both preferences are at their defaults', () => {
    expect(
      renderPreferenceBlock({ language: 'auto', terminalPreference: 'default' }),
    ).toBeUndefined();
    expect(renderPreferenceBlock({})).toBeUndefined();
  });

  it('renders language and shell hints with the verbatim-format rule', () => {
    const block = renderPreferenceBlock({ language: 'zh-CN', terminalPreference: 'powershell7' });
    expect(block).toContain('简体中文');
    expect(block).toContain('Keep code, commands, file paths');
    expect(block).toContain('PowerShell 7');
    expect(block?.startsWith(PREFERENCE_BLOCK_START)).toBe(true);
    expect(block?.endsWith(PREFERENCE_BLOCK_END)).toBe(true);
  });

  it('appends the block to an existing file without disturbing it', () => {
    const next = applyPreferenceBlock('# My rules\n\n- Keep it short.\n', marked('BLOCK'));
    expect(next).toContain('- Keep it short.');
    expect(next).toContain('BLOCK');
    expect(next.indexOf('- Keep it short.')).toBeLessThan(next.indexOf('BLOCK'));
  });

  it('rewrites the block in place so repeated writes stay idempotent', () => {
    const first = applyPreferenceBlock('# My rules\n', marked('BLOCK-ONE'));
    const second = applyPreferenceBlock(first, marked('BLOCK-ONE'));
    expect(second).toBe(first);
    const third = applyPreferenceBlock(second, marked('BLOCK-TWO'));
    expect(third).toBe(applyPreferenceBlock('# My rules\n', marked('BLOCK-TWO')));
    expect(third.includes('BLOCK-ONE')).toBe(false);
    expect(third.match(/BLOCK-TWO/g)).toHaveLength(1);
  });

  it('removes the block when the preferences go back to the defaults', () => {
    const withBlock = applyPreferenceBlock('# My rules\n', marked('BLOCK'));
    expect(applyPreferenceBlock(withBlock, undefined)).toBe('# My rules\n');
  });

  it('writes into an empty file as the only content', () => {
    expect(applyPreferenceBlock('', marked('BLOCK'))).toBe(`${marked('BLOCK')}\n`);
  });
});
