import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

import { watch, type FSWatcher } from 'chokidar';

import type {
  IndexActivateOptions,
  IndexRiskAssessment,
  IndexSearchHit,
  IndexSearchMode,
  IndexSearchRequest,
  IndexStatus,
  PathSuggestion,
} from '../../shared/contracts';
import type { AppStore } from '../store';
import { createScopedLogger } from '../logging';
import { filterPathSuggestions } from '../path-suggestions';
import { assessIndexRoot, assessIndexRoots } from './assess';
import { chunkFile } from './chunk';
import { createPreferredEmbedder, type Embedder } from './embedder';
import { enumerateIndexableFiles } from './enumerate';
import { reciprocalRankFusion, type RankedHit } from './hybrid';
import { ProjectIndexStore } from './index-store';

const log = createScopedLogger('project-index');
const DEFAULT_MAX_FILES = 50_000;
const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
const EMBED_BATCH = 16;
const RECONCILE_MS = 5 * 60_000;
const WATCH_DEBOUNCE_MS = 400;

interface RootRuntime {
  readonly root: string;
  readonly store: ProjectIndexStore;
  watcher?: FSWatcher;
  abort?: AbortController;
  indexing: boolean;
  indexedFiles: number;
  totalFiles: number;
  truncated: boolean;
  lastError?: string;
  lastSyncedAt?: number;
  pendingPaths: Set<string>;
  debounceTimer?: ReturnType<typeof setTimeout>;
  reconcileTimer?: ReturnType<typeof setInterval>;
  embedder: Embedder;
}

export class ProjectIndexService {
  private readonly roots = new Map<string, RootRuntime>();
  private readonly blockedRoots = new Map<string, IndexRiskAssessment>();
  private readonly indexRoot: string;
  private readonly modelsDir: string;

  constructor(
    private readonly store: AppStore,
    userData: string,
  ) {
    this.indexRoot = join(userData, 'index');
    this.modelsDir = join(userData, 'models');
  }

  async assessProject(
    workDir: string,
    additionalDirs: readonly string[] = [],
  ): Promise<IndexRiskAssessment | undefined> {
    const settings = this.store.getSettings();
    if (settings.indexEnabled === false) return undefined;
    const roots = await uniqueRoots([workDir, ...additionalDirs]);
    const optedOut = new Set(
      (settings.indexOptOutRoots ?? []).map((root) => normalizeRootKey(root)),
    );
    const candidates = roots.filter((root) => !optedOut.has(normalizeRootKey(root)));
    if (candidates.length === 0) return undefined;
    return assessIndexRoots(candidates, {
      maxFileBytes: settings.indexMaxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
    });
  }

  async activateProject(
    workDir: string,
    additionalDirs: readonly string[] = [],
    options: IndexActivateOptions = {},
  ): Promise<void> {
    const settings = this.store.getSettings();
    if (settings.indexEnabled === false) return;
    const roots = await uniqueRoots([workDir, ...additionalDirs]);
    const optedOut = new Set(
      (settings.indexOptOutRoots ?? []).map((root) => normalizeRootKey(root)),
    );
    const force = options.force === true;
    for (const root of roots) {
      if (optedOut.has(normalizeRootKey(root))) {
        this.blockedRoots.delete(root);
        continue;
      }
      if (!force) {
        const assessment = await assessIndexRoot(root, {
          maxFileBytes: settings.indexMaxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
        });
        if (assessment.kind !== 'none') {
          this.blockedRoots.set(root, assessment);
          await this.stopRoot(root);
          continue;
        }
      }
      this.blockedRoots.delete(root);
      await this.ensureRoot(root);
    }
  }

  async deactivateProject(workDir: string): Promise<void> {
    const root = await safeRoot(workDir).catch(() => workDir);
    this.blockedRoots.delete(root);
    const runtime = this.roots.get(root) ?? this.resolveRuntime(workDir);
    if (runtime === undefined) return;
    await this.stopRoot(runtime.root);
  }

  async cancelIndex(workDir: string): Promise<IndexStatus> {
    const runtime = this.resolveRuntime(workDir);
    if (runtime === undefined) return this.status(workDir);
    runtime.abort?.abort();
    return this.status(runtime.root);
  }

  async close(): Promise<void> {
    this.blockedRoots.clear();
    await Promise.all([...this.roots.keys()].map((root) => this.stopRoot(root)));
  }

  status(workDir: string): IndexStatus {
    const resolved = resolveRootKey(workDir);
    const blocked = this.blockedRoots.get(resolved) ?? this.blockedRoots.get(workDir);
    if (blocked !== undefined) {
      return {
        workDir: blocked.root,
        state: 'blocked',
        progress: 0,
        fileCount: 0,
        chunkCount: 0,
        embeddedCount: 0,
        semanticReady: false,
        embedderId: 'none',
        risk: blocked.kind,
        error: blocked.message,
      };
    }
    const runtime = this.resolveRuntime(workDir);
    if (runtime === undefined) {
      return {
        workDir,
        state: this.store.getSettings().indexEnabled === false ? 'disabled' : 'idle',
        progress: 0,
        fileCount: 0,
        chunkCount: 0,
        embeddedCount: 0,
        semanticReady: false,
        embedderId: 'none',
      };
    }
    const fileCount = runtime.store.countFiles();
    const chunkCount = runtime.store.countChunks();
    const embeddedCount = runtime.store.countEmbeddedChunks();
    const progress =
      runtime.totalFiles === 0
        ? runtime.indexing
          ? 0
          : 1
        : Math.min(1, runtime.indexedFiles / runtime.totalFiles);
    const state = runtime.indexing
      ? 'indexing'
      : runtime.lastError !== undefined
        ? 'error'
        : progress >= 1
          ? 'ready'
          : 'idle';
    return {
      workDir: runtime.root,
      state,
      progress,
      fileCount,
      chunkCount,
      embeddedCount,
      semanticReady: embeddedCount > 0 && embeddedCount / Math.max(1, chunkCount) >= 0.8,
      embedderId: runtime.embedder.id,
      lastSyncedAt: runtime.lastSyncedAt,
      error: runtime.lastError,
      truncated: runtime.truncated || undefined,
    };
  }

  async rebuild(workDir: string): Promise<IndexStatus> {
    const root = await safeRoot(workDir);
    this.blockedRoots.delete(root);
    await this.stopRoot(root);
    const dbPath = this.dbPath(root);
    await import('node:fs/promises').then(({ rm }) =>
      rm(dbPath, { force: true }).catch(() => undefined),
    );
    await this.ensureRoot(root);
    return this.status(root);
  }

  async search(request: IndexSearchRequest): Promise<readonly IndexSearchHit[]> {
    const roots = await uniqueRoots([request.workDir, ...(request.additionalDirs ?? [])]);
    const mode = request.mode ?? 'hybrid';
    const limit = Math.min(50, Math.max(1, request.limit ?? 12));
    const hits: IndexSearchHit[] = [];
    for (const root of roots) {
      if (this.blockedRoots.has(root)) continue;
      const runtime = this.roots.get(root);
      if (runtime === undefined) continue;
      hits.push(...(await this.searchRoot(runtime, request.query, mode, limit)));
    }
    return hits
      .toSorted((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((hit) => ({ ...hit, snippet: truncateSnippet(hit.snippet) }));
  }

  async searchPaths(root: string, query: string): Promise<readonly PathSuggestion[] | undefined> {
    const runtime = this.roots.get(await safeRoot(root).catch(() => root));
    if (runtime === undefined || runtime.store.countFiles() === 0) return undefined;
    const paths = runtime.store.listPaths();
    const suggestions: PathSuggestion[] = [];
    const directories = new Set<string>();
    for (const path of paths) {
      suggestions.push({
        root: runtime.root,
        path,
        name: basename(path),
        kind: 'file',
      });
      const parts = path.split('/');
      let prefix = '';
      for (let i = 0; i < parts.length - 1; i += 1) {
        prefix = prefix.length === 0 ? parts[i]! : `${prefix}/${parts[i]!}`;
        if (directories.has(prefix)) continue;
        directories.add(prefix);
        suggestions.push({
          root: runtime.root,
          path: prefix,
          name: parts[i]!,
          kind: 'directory',
        });
      }
    }
    return filterPathSuggestions(suggestions, query);
  }

  private resolveRuntime(workDir: string): RootRuntime | undefined {
    const direct = this.roots.get(workDir);
    if (direct !== undefined) return direct;
    try {
      const resolved = realpathSync(workDir);
      const byReal = this.roots.get(resolved);
      if (byReal !== undefined) return byReal;
    } catch {
      // ignore missing path
    }
    for (const runtime of this.roots.values()) {
      if (runtime.root === workDir) return runtime;
    }
    return undefined;
  }

  private dbPath(root: string): string {
    const hash = createHash('sha256').update(root).digest('hex').slice(0, 16);
    return join(this.indexRoot, hash, 'index.db');
  }

  private async ensureRoot(rootInput: string): Promise<RootRuntime> {
    const root = await safeRoot(rootInput);
    const existing = this.roots.get(root);
    if (existing !== undefined) return existing;
    const settings = this.store.getSettings();
    const embedder = await createPreferredEmbedder(
      this.modelsDir,
      settings.indexSemanticEnabled !== false,
    );
    const runtime: RootRuntime = {
      root,
      store: new ProjectIndexStore(this.dbPath(root)),
      indexing: false,
      indexedFiles: 0,
      totalFiles: 0,
      truncated: false,
      pendingPaths: new Set(),
      embedder,
    };
    this.roots.set(root, runtime);
    if (process.env['VITEST'] !== 'true') {
      this.startWatcher(runtime);
      runtime.reconcileTimer = setInterval(() => {
        void this.scanRoot(runtime, false);
      }, RECONCILE_MS);
      void this.scanRoot(runtime, false);
    } else {
      await this.scanRoot(runtime, false);
    }
    return runtime;
  }

  private async stopRoot(root: string): Promise<void> {
    const runtime = this.roots.get(root);
    if (runtime === undefined) return;
    runtime.abort?.abort();
    if (runtime.debounceTimer !== undefined) clearTimeout(runtime.debounceTimer);
    if (runtime.reconcileTimer !== undefined) clearInterval(runtime.reconcileTimer);
    await runtime.watcher?.close().catch(() => undefined);
    runtime.store.close();
    this.roots.delete(root);
  }

  private startWatcher(runtime: RootRuntime): void {
    const watcher = watch(runtime.root, {
      ignored: (path) => {
        const relativePath = relative(runtime.root, path).replaceAll('\\', '/');
        if (relativePath.length === 0 || relativePath === '.') return false;
        const name = basename(path);
        return (
          name === 'node_modules' ||
          name === '.git' ||
          name === 'dist' ||
          name === 'build' ||
          name === '.turbo' ||
          name === 'coverage'
        );
      },
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
      depth: 20,
    });
    const enqueue = (absolute: string): void => {
      const relativePath = relative(runtime.root, absolute).replaceAll('\\', '/');
      if (relativePath.length === 0 || relativePath.startsWith('..')) return;
      runtime.pendingPaths.add(relativePath);
      if (runtime.debounceTimer !== undefined) clearTimeout(runtime.debounceTimer);
      runtime.debounceTimer = setTimeout(() => {
        const paths = [...runtime.pendingPaths];
        runtime.pendingPaths.clear();
        void this.indexPaths(runtime, paths);
      }, WATCH_DEBOUNCE_MS);
    };
    watcher.on('add', enqueue);
    watcher.on('change', enqueue);
    watcher.on('unlink', (absolute) => {
      const relativePath = relative(runtime.root, absolute).replaceAll('\\', '/');
      runtime.store.deleteFile(relativePath);
    });
    runtime.watcher = watcher;
  }

  private async scanRoot(runtime: RootRuntime, force: boolean): Promise<void> {
    if (runtime.indexing) return;
    const settings = this.store.getSettings();
    if (settings.indexEnabled === false) return;
    runtime.indexing = true;
    runtime.lastError = undefined;
    runtime.abort = new AbortController();
    const signal = runtime.abort.signal;
    try {
      const { files, truncated } = await enumerateIndexableFiles(runtime.root, {
        maxFiles: DEFAULT_MAX_FILES,
        maxFileBytes: settings.indexMaxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
        signal,
      });
      runtime.truncated = truncated || files.length >= DEFAULT_MAX_FILES;
      runtime.totalFiles = files.length;
      runtime.indexedFiles = 0;
      const existing = new Map(runtime.store.listFiles().map((file) => [file.path, file]));
      const seen = new Set<string>();
      for (const file of files) {
        throwIfAborted(signal);
        seen.add(file.path);
        const previous = existing.get(file.path);
        if (
          !force &&
          previous !== undefined &&
          previous.mtimeMs === file.mtimeMs &&
          previous.size === file.size
        ) {
          runtime.indexedFiles += 1;
          continue;
        }
        await this.indexPaths(runtime, [file.path]);
        runtime.indexedFiles += 1;
      }
      throwIfAborted(signal);
      for (const path of existing.keys()) {
        if (!seen.has(path)) runtime.store.deleteFile(path);
      }
      await this.embedPending(runtime, signal);
      runtime.lastSyncedAt = Date.now();
      runtime.store.setMeta('lastSyncedAt', String(runtime.lastSyncedAt));
    } catch (error) {
      if (!isAbortError(error) && signal.aborted !== true) {
        runtime.lastError = error instanceof Error ? error.message : String(error);
        log.warn('index scan failed', error);
      }
    } finally {
      runtime.indexing = false;
      runtime.abort = undefined;
    }
  }

  private async indexPaths(runtime: RootRuntime, paths: readonly string[]): Promise<void> {
    const settings = this.store.getSettings();
    const maxBytes = settings.indexMaxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    for (const path of paths) {
      const absolute = join(runtime.root, path);
      const content = await readFile(absolute, 'utf8').catch(() => undefined);
      if (content === undefined) {
        runtime.store.deleteFile(path);
        continue;
      }
      if (Buffer.byteLength(content, 'utf8') > maxBytes) continue;
      const contentHash = createHash('sha256').update(content).digest('hex');
      const previous = runtime.store.getFile(path);
      if (previous?.contentHash === contentHash) continue;
      const chunks = chunkFile(path, content).map((chunk) => ({
        id: chunkId(path, chunk.startLine, chunk.endLine, contentHash),
        path: chunk.path,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        contentHash: createHash('sha256').update(chunk.content).digest('hex'),
      }));
      runtime.store.replaceChunksForPath(path, chunks);
      runtime.store.upsertFile({
        path,
        contentHash,
        mtimeMs: Date.now(),
        size: Buffer.byteLength(content, 'utf8'),
      });
    }
    await this.embedPending(runtime, runtime.abort?.signal);
  }

  private async embedPending(runtime: RootRuntime, signal?: AbortSignal): Promise<void> {
    if (this.store.getSettings().indexSemanticEnabled === false) return;
    for (;;) {
      throwIfAborted(signal);
      const batch = runtime.store.listChunksMissingEmbedding(EMBED_BATCH);
      if (batch.length === 0) break;
      const vectors = await runtime.embedder.embed(batch.map((chunk) => chunk.content));
      batch.forEach((chunk, index) => {
        const vector = vectors[index];
        if (vector !== undefined) runtime.store.setEmbedding(chunk.id, vector);
      });
    }
  }

  private async searchRoot(
    runtime: RootRuntime,
    query: string,
    mode: IndexSearchMode,
    limit: number,
  ): Promise<readonly IndexSearchHit[]> {
    const lexical =
      mode === 'semantic'
        ? []
        : runtime.store.searchLexical(query, limit).map(
            (hit, index): RankedHit => ({
              id: hit.id,
              score: -hit.rank,
              source: 'lexical',
            }),
          );
    let semantic: RankedHit[] = [];
    if (mode !== 'lexical') {
      const [queryVector] = await runtime.embedder.embed([query]);
      if (queryVector !== undefined) {
        semantic = runtime.store.searchSemantic(queryVector, limit).map((hit) => ({
          id: hit.id,
          score: -hit.rank,
          source: 'semantic' as const,
        }));
      }
    }
    const fused =
      mode === 'hybrid'
        ? reciprocalRankFusion([lexical, semantic])
        : mode === 'lexical'
          ? lexical.map((hit) => ({ id: hit.id, score: hit.score, sources: ['lexical' as const] }))
          : semantic.map((hit) => ({
              id: hit.id,
              score: hit.score,
              sources: ['semantic' as const],
            }));
    const hits: IndexSearchHit[] = [];
    for (const item of fused.slice(0, limit)) {
      const chunk = runtime.store.getChunk(item.id);
      if (chunk === undefined) continue;
      hits.push({
        root: runtime.root,
        path: chunk.path,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        snippet: chunk.content,
        score: item.score,
        source: item.sources.length > 1 ? 'hybrid' : item.sources[0] ?? 'lexical',
      });
    }
    return hits;
  }
}

function chunkId(path: string, startLine: number, endLine: number, fileHash: string): string {
  return createHash('sha256')
    .update(`${path}:${String(startLine)}:${String(endLine)}:${fileHash}`)
    .digest('hex')
    .slice(0, 24);
}

function truncateSnippet(snippet: string, max = 1_200): string {
  if (snippet.length <= max) return snippet;
  return `${snippet.slice(0, max)}\n…`;
}

async function safeRoot(root: string): Promise<string> {
  return realpath(root);
}

function resolveRootKey(root: string): string {
  try {
    return realpathSync(root);
  } catch {
    return root;
  }
}

function normalizeRootKey(root: string): string {
  return resolveRootKey(root).replaceAll('\\', '/');
}

async function uniqueRoots(roots: readonly string[]): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    const resolved = await safeRoot(root).catch(() => root);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new Error('Index enumeration aborted.');
}

function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    if (error.message.includes('aborted')) return true;
  }
  return false;
}
