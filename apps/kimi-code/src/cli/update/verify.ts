import { execFile } from 'node:child_process';
import { spawn } from 'node:child_process';

import { NPM_PACKAGE_NAME } from '#/constant/app';

import type { InstallSource } from './types';

const VERIFY_TIMEOUT_MS = 15_000;

function withCmdSuffix(base: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? `${base}.cmd` : base;
}

function bunCommand(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'bun.exe' : 'bun';
}

function execFileText(command: string, args: readonly string[]): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile(command, [...args], { encoding: 'utf-8', timeout: VERIFY_TIMEOUT_MS }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolveOutput(stdout);
    });
  });
}

function spawnText(cmd: string, args: readonly string[], shell: boolean | undefined): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const child = spawn(cmd, [...args], { shell });
    const chunks: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${cmd} timed out after ${VERIFY_TIMEOUT_MS}ms`));
    }, VERIFY_TIMEOUT_MS);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolveOutput(Buffer.concat(chunks).toString('utf-8'));
        return;
      }
      reject(new Error(`${cmd} exited with code ${String(code)}`));
    });
  });
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

function versionsMatch(installed: string, expected: string): boolean {
  return normalizeVersion(installed) === normalizeVersion(expected);
}

function parseNpmListVersion(stdout: string): string | null {
  try {
    const parsed = JSON.parse(stdout) as {
      dependencies?: Record<string, { version?: string }>;
    };
    const entry = parsed.dependencies?.[NPM_PACKAGE_NAME];
    return entry?.version ?? null;
  } catch {
    return null;
  }
}

function parsePnpmListVersion(stdout: string): string | null {
  try {
    const parsed = JSON.parse(stdout) as Array<{ name?: string; version?: string }>;
    const entry = parsed.find((item) => item.name === NPM_PACKAGE_NAME);
    return entry?.version ?? null;
  } catch {
    return null;
  }
}

function parseYarnListVersion(stdout: string): string | null {
  const lines = stdout.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(NPM_PACKAGE_NAME)) continue;
    const match = /@([\d.]+(?:-[\w.]+)?)/.exec(trimmed);
    if (match?.[1] !== undefined) return match[1];
  }
  return null;
}

function parsePlainVersionOutput(stdout: string): string | null {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return null;
  const firstLine = trimmed.split('\n')[0]?.trim() ?? '';
  return firstLine.length > 0 ? firstLine : null;
}

export interface VerifyInstalledVersionDeps {
  readonly execFileText: (command: string, args: readonly string[]) => Promise<string>;
  readonly spawnText: (cmd: string, args: readonly string[], shell: boolean | undefined) => Promise<string>;
  readonly execPath: string;
  readonly platform: NodeJS.Platform;
}

async function readGlobalPackageVersion(
  source: InstallSource,
  deps: VerifyInstalledVersionDeps,
): Promise<string | null> {
  const platform = deps.platform;
  switch (source) {
    case 'npm-global': {
      const stdout = await deps.execFileText(withCmdSuffix('npm', platform), [
        'list',
        '-g',
        NPM_PACKAGE_NAME,
        '--depth=0',
        '--json',
      ]);
      return parseNpmListVersion(stdout);
    }
    case 'pnpm-global': {
      const stdout = await deps.execFileText(withCmdSuffix('pnpm', platform), [
        'list',
        '-g',
        NPM_PACKAGE_NAME,
        '--json',
      ]);
      return parsePnpmListVersion(stdout);
    }
    case 'yarn-global': {
      const stdout = await deps.execFileText(withCmdSuffix('yarn', platform), [
        'global',
        'list',
        '--pattern',
        NPM_PACKAGE_NAME,
      ]);
      return parseYarnListVersion(stdout);
    }
    case 'bun-global': {
      const stdout = await deps.execFileText(bunCommand(platform), [
        'pm',
        'ls',
        '-g',
        NPM_PACKAGE_NAME,
      ]);
      return parsePlainVersionOutput(stdout);
    }
    case 'native': {
      const stdout = await deps.spawnText(
        deps.execPath,
        ['--version'],
        platform === 'win32' ? false : undefined,
      );
      return parsePlainVersionOutput(stdout);
    }
    case 'homebrew':
    case 'unsupported':
      return null;
  }
}

export async function verifyInstalledVersion(
  source: InstallSource,
  expectedVersion: string,
  overrides: Partial<VerifyInstalledVersionDeps> = {},
): Promise<boolean> {
  const deps: VerifyInstalledVersionDeps = {
    execFileText: overrides.execFileText ?? execFileText,
    spawnText: overrides.spawnText ?? spawnText,
    execPath: overrides.execPath ?? process.execPath,
    platform: overrides.platform ?? process.platform,
  };

  if (source === 'homebrew' || source === 'unsupported') {
    return true;
  }

  try {
    const installed = await readGlobalPackageVersion(source, deps);
    if (installed === null) return false;
    return versionsMatch(installed, expectedVersion);
  } catch {
    return false;
  }
}
