import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { enumerateIndexableFiles } from './enumerate';

export const INDEX_WARN_FILE_THRESHOLD = 3_000;

export type IndexRiskKind = 'none' | 'home' | 'large';

export interface IndexRiskAssessment {
  readonly root: string;
  readonly kind: IndexRiskKind;
  readonly estimatedFiles?: number;
  readonly message: string;
}

const RISK_RANK: Readonly<Record<IndexRiskKind, number>> = {
  none: 0,
  large: 1,
  home: 2,
};

export async function assessIndexRoot(
  rootInput: string,
  options?: { readonly maxFileBytes?: number; readonly signal?: AbortSignal },
): Promise<IndexRiskAssessment> {
  const root = await realpath(rootInput).catch(() => resolve(rootInput));
  if (isOversizedRootPath(root)) {
    return {
      root,
      kind: 'home',
      message: formatHomeMessage(root),
    };
  }
  const maxFileBytes = options?.maxFileBytes ?? 512 * 1024;
  const { files, truncated } = await enumerateIndexableFiles(root, {
    maxFiles: INDEX_WARN_FILE_THRESHOLD,
    maxFileBytes,
    signal: options?.signal,
  });
  if (truncated || files.length >= INDEX_WARN_FILE_THRESHOLD) {
    return {
      root,
      kind: 'large',
      estimatedFiles: INDEX_WARN_FILE_THRESHOLD,
      message: formatLargeMessage(root, INDEX_WARN_FILE_THRESHOLD),
    };
  }
  return {
    root,
    kind: 'none',
    estimatedFiles: files.length,
    message: '',
  };
}

export async function assessIndexRoots(
  roots: readonly string[],
  options?: { readonly maxFileBytes?: number; readonly signal?: AbortSignal },
): Promise<IndexRiskAssessment | undefined> {
  if (roots.length === 0) return undefined;
  let highest: IndexRiskAssessment | undefined;
  for (const root of roots) {
    const assessment = await assessIndexRoot(root, options);
    if (highest === undefined || RISK_RANK[assessment.kind] > RISK_RANK[highest.kind]) {
      highest = assessment;
    }
  }
  return highest;
}

export function isOversizedRootPath(root: string, home = homedir()): boolean {
  const normalized = normalizePath(root);
  const homePath = normalizePath(home);
  if (normalized === homePath) return true;
  const blocked = new Set(
    [
      '/',
      '/Users',
      '/home',
      '/private/var',
      '/var',
      'C:\\',
      'C:/',
      'C:\\Users',
      'C:/Users',
    ].map(normalizePath),
  );
  if (blocked.has(normalized)) return true;
  // Windows drive roots like D:\
  if (/^[a-z]:[/\\]?$/i.test(normalized)) return true;
  return false;
}

function formatHomeMessage(root: string): string {
  const display = displayRoot(root);
  return `工作目录「${display}」是用户主目录或系统级根路径。在此建立索引可能扫描海量文件并占用大量磁盘与 CPU。建议改为打开具体项目子目录。`;
}

function formatLargeMessage(root: string, threshold: number): string {
  const display = displayRoot(root);
  return `工作目录「${display}」包含大量可索引文件（预估 ${String(threshold)}+）。在此建立索引可能占用大量磁盘与 CPU。建议选择更小的项目子目录，或添加 .ganymedeignore。`;
}

function displayRoot(root: string): string {
  const home = normalizePath(homedir());
  const normalized = normalizePath(root);
  if (normalized === home) return '~';
  if (normalized.startsWith(`${home}/`)) return `~${normalized.slice(home.length)}`;
  return root;
}

function normalizePath(path: string): string {
  return resolve(path).replaceAll('\\', '/').replace(/\/+$/, '') || '/';
}
