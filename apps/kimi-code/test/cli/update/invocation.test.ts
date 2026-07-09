import { describe, expect, it } from 'vitest';

import { NATIVE_INSTALL_COMMAND_UNIX, NATIVE_INSTALL_COMMAND_WIN } from '#/constant/app';

import { buildInstallInvocation } from '#/cli/update/invocation';
import type { InstallSource } from '#/cli/update/types';

const VERSION = '0.5.0';

const AUTO_SOURCES: readonly InstallSource[] = [
  'npm-global',
  'pnpm-global',
  'yarn-global',
  'bun-global',
  'native',
];

describe('buildInstallInvocation', () => {
  it.each(AUTO_SOURCES.filter((source) => source !== 'native'))(
    'keeps display and spawn aligned for %s on darwin',
    (source) => {
      const invocation = buildInstallInvocation(source, VERSION, 'darwin');
      expect(invocation.displayCommand.length).toBeGreaterThan(0);
      expect(invocation.spawn.cmd.length).toBeGreaterThan(0);
      expect(invocation.spawn.args.length).toBeGreaterThan(0);
      expect(invocation.displayCommand).toContain(VERSION);
    },
  );

  it('uses pipefail for native unix display and spawn', () => {
    const invocation = buildInstallInvocation('native', VERSION, 'darwin');
    expect(invocation.displayCommand).toContain('pipefail');
    expect(invocation.spawn.args.join(' ')).toContain('pipefail');
    expect(invocation.spawn.args.join(' ')).toContain(NATIVE_INSTALL_COMMAND_UNIX);
  });

  it('uses powershell for native win32 display and spawn', () => {
    const invocation = buildInstallInvocation('native', VERSION, 'win32');
    expect(invocation.displayCommand).toContain('powershell.exe');
    expect(invocation.displayCommand).toContain('-ExecutionPolicy');
    expect(invocation.spawn.cmd).toBe('powershell.exe');
    expect(invocation.spawn.args).toContain('Bypass');
    expect(invocation.spawn.args.join(' ')).toContain(NATIVE_INSTALL_COMMAND_WIN);
  });

  it('returns multi-line manual guidance for unsupported', () => {
    const invocation = buildInstallInvocation('unsupported', VERSION, 'darwin');
    expect(invocation.displayCommand).toContain('Could not detect install source');
    expect(invocation.displayCommand).toContain('npm install -g');
    expect(invocation.displayCommand).toContain('pnpm add -g');
    expect(invocation.spawn.cmd).toBe('');
  });

  it('maps npm-global spawn to npm.cmd on win32', () => {
    const invocation = buildInstallInvocation('npm-global', VERSION, 'win32');
    expect(invocation.spawn.cmd).toBe('npm.cmd');
    expect(invocation.displayCommand).toBe(`npm install -g @moonshot-ai/kimi-code@${VERSION}`);
  });
});
