import { describe, expect, it, vi } from 'vitest';

import { verifyInstalledVersion } from '#/cli/update/verify';

describe('verifyInstalledVersion', () => {
  it('returns true when the global npm version matches', async () => {
    const execFileText = vi.fn().mockResolvedValue(
      JSON.stringify({
        dependencies: {
          '@moonshot-ai/kimi-code': { version: '0.5.0' },
        },
      }),
    );

    await expect(
      verifyInstalledVersion('npm-global', '0.5.0', {
        execFileText,
        spawnText: vi.fn(),
        execPath: '/usr/bin/kimi',
        platform: 'darwin',
      }),
    ).resolves.toBe(true);
  });

  it('returns false when the global npm version does not match', async () => {
    const execFileText = vi.fn().mockResolvedValue(
      JSON.stringify({
        dependencies: {
          '@moonshot-ai/kimi-code': { version: '0.4.0' },
        },
      }),
    );

    await expect(
      verifyInstalledVersion('npm-global', '0.5.0', {
        execFileText,
        spawnText: vi.fn(),
        execPath: '/usr/bin/kimi',
        platform: 'darwin',
      }),
    ).resolves.toBe(false);
  });

  it('compares native --version output from execPath', async () => {
    const spawnText = vi.fn().mockResolvedValue('0.5.0\n');

    await expect(
      verifyInstalledVersion('native', 'v0.5.0', {
        execFileText: vi.fn(),
        spawnText,
        execPath: 'C:\\kimi\\kimi.exe',
        platform: 'win32',
      }),
    ).resolves.toBe(true);

    expect(spawnText).toHaveBeenCalledWith('C:\\kimi\\kimi.exe', ['--version'], false);
  });

  it('skips verification for unsupported sources', async () => {
    await expect(
      verifyInstalledVersion('unsupported', '0.5.0', {
        execFileText: vi.fn(),
        spawnText: vi.fn(),
        execPath: '/usr/bin/kimi',
        platform: 'darwin',
      }),
    ).resolves.toBe(true);
  });
});
