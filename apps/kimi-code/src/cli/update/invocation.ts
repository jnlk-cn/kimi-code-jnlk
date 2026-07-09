import {
  NATIVE_INSTALL_COMMAND_UNIX,
  NATIVE_INSTALL_COMMAND_WIN,
} from '#/constant/app';

import { NPM_PACKAGE_NAME, type InstallSource } from './types';

export interface SpawnCommand {
  readonly cmd: string;
  readonly args: readonly string[];
}

export interface InstallInvocation {
  readonly displayCommand: string;
  readonly spawn: SpawnCommand;
}

function withCmdSuffix(base: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? `${base}.cmd` : base;
}

function bunCommand(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'bun.exe' : 'bun';
}

function nativeUnixScript(): string {
  return `set -o pipefail; ${NATIVE_INSTALL_COMMAND_UNIX}`;
}

function nativeWin32Script(): string {
  return `$ErrorActionPreference='Stop'; ${NATIVE_INSTALL_COMMAND_WIN}`;
}

export function unsupportedManualCommands(version: string): string {
  const pkg = `${NPM_PACKAGE_NAME}@${version}`;
  return [
    'Could not detect install source; update with the package manager you used originally:',
    `  npm install -g ${pkg}`,
    `  pnpm add -g ${pkg}`,
    `  yarn global add ${pkg}`,
    `  bun add -g ${pkg}`,
  ].join('\n');
}

export function buildInstallInvocation(
  source: InstallSource,
  version: string,
  platform: NodeJS.Platform,
): InstallInvocation {
  switch (source) {
    case 'npm-global': {
      const displayCommand = `npm install -g ${NPM_PACKAGE_NAME}@${version}`;
      return {
        displayCommand,
        spawn: {
          cmd: withCmdSuffix('npm', platform),
          args: ['install', '-g', `${NPM_PACKAGE_NAME}@${version}`],
        },
      };
    }
    case 'pnpm-global': {
      const displayCommand = `pnpm add -g ${NPM_PACKAGE_NAME}@${version}`;
      return {
        displayCommand,
        spawn: {
          cmd: withCmdSuffix('pnpm', platform),
          args: ['add', '-g', `${NPM_PACKAGE_NAME}@${version}`],
        },
      };
    }
    case 'yarn-global': {
      const displayCommand = `yarn global add ${NPM_PACKAGE_NAME}@${version}`;
      return {
        displayCommand,
        spawn: {
          cmd: withCmdSuffix('yarn', platform),
          args: ['global', 'add', `${NPM_PACKAGE_NAME}@${version}`],
        },
      };
    }
    case 'bun-global': {
      const displayCommand = `bun add -g ${NPM_PACKAGE_NAME}@${version}`;
      return {
        displayCommand,
        spawn: {
          cmd: bunCommand(platform),
          args: ['add', '-g', `${NPM_PACKAGE_NAME}@${version}`],
        },
      };
    }
    case 'homebrew': {
      const displayCommand = 'brew upgrade kimi-code';
      return {
        displayCommand,
        spawn: { cmd: 'brew', args: ['upgrade', 'kimi-code'] },
      };
    }
    case 'native': {
      if (platform === 'win32') {
        const script = nativeWin32Script();
        const displayCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${script}"`;
        return {
          displayCommand,
          spawn: {
            cmd: 'powershell.exe',
            args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
          },
        };
      }
      const script = nativeUnixScript();
      const displayCommand = `bash -c '${script}'`;
      return {
        displayCommand,
        spawn: { cmd: 'bash', args: ['-c', script] },
      };
    }
    case 'unsupported':
      return {
        displayCommand: unsupportedManualCommands(version),
        spawn: { cmd: '', args: [] },
      };
  }
}

export function usesShellForSpawn(source: InstallSource, platform: NodeJS.Platform): boolean {
  if (platform !== 'win32') return false;
  return source !== 'native';
}
