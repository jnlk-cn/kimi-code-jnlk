import { execFile } from 'node:child_process';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

import {
  createIgnoreMatcher,
  isBinaryPath,
  isIgnoredDirName,
  isSensitivePath,
  type IgnoreMatcher,
} from './ignore';

const execFileAsync = promisify(execFile);

export interface EnumeratedFile {
  readonly path: string;
  readonly size: number;
  readonly mtimeMs: number;
}

export interface EnumerateOptions {
  readonly maxFiles: number;
  readonly maxFileBytes: number;
  readonly signal?: AbortSignal;
}

export interface EnumerateResult {
  readonly files: readonly EnumeratedFile[];
  readonly truncated: boolean;
}

export async function enumerateIndexableFiles(
  rootInput: string,
  options: EnumerateOptions,
): Promise<EnumerateResult> {
  const root = resolve(rootInput);
  const extraIgnore = await loadExtraIgnore(root);
  const usedGit = await isInsideGitWorkTree(root);
  const { files, truncated } = usedGit
    ? await enumerateWithGit(root, options, extraIgnore)
    : await enumerateWithWalk(root, options, extraIgnore);
  return {
    files: files.toSorted((a, b) => a.path.localeCompare(b.path)),
    truncated,
  };
}

async function loadExtraIgnore(root: string): Promise<IgnoreMatcher> {
  const patterns: string[] = [];
  for (const name of ['.ganymedeignore', '.cursorignore']) {
    const text = await readFile(join(root, name), 'utf8').catch(() => '');
    if (text.length > 0) patterns.push(...text.split('\n'));
  }
  return createIgnoreMatcher(patterns);
}

async function isInsideGitWorkTree(root: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], {
      encoding: 'utf8',
    });
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

async function enumerateWithGit(
  root: string,
  options: EnumerateOptions,
  extraIgnore: IgnoreMatcher,
): Promise<{ files: EnumeratedFile[]; truncated: boolean }> {
  const { stdout } = await execFileAsync(
    'git',
    ['-C', root, 'ls-files', '-co', '--exclude-standard', '-z'],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, signal: options.signal },
  );
  const relativePaths = splitNull(stdout);
  const files: EnumeratedFile[] = [];
  let truncated = false;
  for (const relativePath of relativePaths) {
    throwIfAborted(options.signal);
    if (files.length >= options.maxFiles) {
      truncated = true;
      break;
    }
    if (!shouldIndexPath(relativePath, extraIgnore)) continue;
    const file = await statIndexable(root, relativePath, options.maxFileBytes);
    if (file !== undefined) files.push(file);
  }
  if (!truncated && files.length >= options.maxFiles) truncated = true;
  return { files, truncated };
}

async function enumerateWithWalk(
  root: string,
  options: EnumerateOptions,
  extraIgnore: IgnoreMatcher,
): Promise<{ files: EnumeratedFile[]; truncated: boolean }> {
  const files: EnumeratedFile[] = [];
  let truncated = false;
  async function walk(dir: string): Promise<void> {
    throwIfAborted(options.signal);
    if (files.length >= options.maxFiles) {
      truncated = true;
      return;
    }
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (files.length >= options.maxFiles) {
        truncated = true;
        return;
      }
      throwIfAborted(options.signal);
      if (entry.isSymbolicLink()) continue;
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isIgnoredDirName(entry.name)) continue;
        const relativePath = toPosix(relative(root, absolute));
        if (extraIgnore.ignores(relativePath) || extraIgnore.ignores(`${relativePath}/`)) continue;
        await walk(absolute);
        if (truncated) return;
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = toPosix(relative(root, absolute));
      if (!shouldIndexPath(relativePath, extraIgnore)) continue;
      const file = await statIndexable(root, relativePath, options.maxFileBytes);
      if (file !== undefined) files.push(file);
    }
  }
  await walk(root);
  return { files, truncated };
}

function shouldIndexPath(relativePath: string, extraIgnore: IgnoreMatcher): boolean {
  if (relativePath.length === 0) return false;
  if (isSensitivePath(relativePath)) return false;
  if (isBinaryPath(relativePath)) return false;
  if (extraIgnore.ignores(relativePath)) return false;
  const segments = relativePath.split('/');
  for (const segment of segments.slice(0, -1)) {
    if (isIgnoredDirName(segment)) return false;
  }
  return true;
}

async function statIndexable(
  root: string,
  relativePath: string,
  maxFileBytes: number,
): Promise<EnumeratedFile | undefined> {
  const absolute = resolve(root, relativePath);
  const stat = await lstat(absolute).catch(() => null);
  if (stat === null || stat.isSymbolicLink() || !stat.isFile()) return undefined;
  if (stat.size > maxFileBytes) return undefined;
  return {
    path: toPosix(relativePath),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  };
}

function splitNull(buffer: Buffer): string[] {
  const text = buffer.toString('utf8');
  return text.split('\0').filter((item) => item.length > 0);
}

function toPosix(path: string): string {
  return path.replaceAll('\\', '/');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new Error('Index enumeration aborted.');
}
