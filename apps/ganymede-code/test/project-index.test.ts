import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  assessIndexRoot,
  INDEX_WARN_FILE_THRESHOLD,
  isOversizedRootPath,
} from '../src/main/project-index/assess';
import { chunkFile } from '../src/main/project-index/chunk';
import { HashEmbedder } from '../src/main/project-index/embedder';
import { enumerateIndexableFiles } from '../src/main/project-index/enumerate';
import { cosineSimilarity, reciprocalRankFusion } from '../src/main/project-index/hybrid';
import { createIgnoreMatcher, isSensitivePath } from '../src/main/project-index/ignore';
import { ProjectIndexStore } from '../src/main/project-index/index-store';
import { ProjectIndexService } from '../src/main/project-index/project-index-service';
import { AppStore } from '../src/main/store';

describe('project index helpers', () => {
  it('chunks code by function and class boundaries', () => {
    const content = [
      'export function alpha() {',
      '  return 1;',
      '}',
      '',
      'export class Beta {',
      '  run() { return 2; }',
      '}',
    ].join('\n');
    const chunks = chunkFile('src/demo.ts', content);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.content).toContain('function alpha');
    expect(chunks.some((chunk) => chunk.content.includes('class Beta'))).toBe(true);
  });

  it('respects ignore and sensitive path rules', () => {
    expect(isSensitivePath('.env')).toBe(true);
    expect(isSensitivePath('.env.example')).toBe(false);
    expect(isSensitivePath('src/ok.ts')).toBe(false);
    const matcher = createIgnoreMatcher(['dist/', '!dist/keep.txt', '*.log']);
    expect(matcher.ignores('dist/a.js')).toBe(true);
    expect(matcher.ignores('dist/keep.txt')).toBe(false);
    expect(matcher.ignores('notes.log')).toBe(true);
  });

  it('merges lexical and semantic ranks with RRF', () => {
    const fused = reciprocalRankFusion([
      [
        { id: 'a', score: 1, source: 'lexical' },
        { id: 'b', score: 0.5, source: 'lexical' },
      ],
      [
        { id: 'b', score: 1, source: 'semantic' },
        { id: 'c', score: 0.5, source: 'semantic' },
      ],
    ]);
    expect(fused[0]?.id).toBe('b');
    expect(fused.find((hit) => hit.id === 'b')?.sources).toEqual(
      expect.arrayContaining(['lexical', 'semantic']),
    );
  });

  it('produces normalized hash embeddings', async () => {
    const embedder = new HashEmbedder();
    const [vector] = await embedder.embed(['authentication middleware session']);
    expect(vector).toBeDefined();
    expect(vector!.length).toBe(384);
    const self = cosineSimilarity(vector!, vector!);
    expect(self).toBeGreaterThan(0.99);
  });

  it('flags home and system roots as oversized', () => {
    expect(isOversizedRootPath(homedir())).toBe(true);
    expect(isOversizedRootPath('/')).toBe(true);
    expect(isOversizedRootPath('/Users')).toBe(true);
    expect(isOversizedRootPath('/home')).toBe(true);
  });
});

describe('project index assess', () => {
  let directory = '';

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ganymede-assess-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('returns none for a small project', async () => {
    await writeFile(join(directory, 'a.ts'), 'export const a = 1;\n', 'utf8');
    const assessment = await assessIndexRoot(directory);
    expect(assessment.kind).toBe('none');
    expect(assessment.estimatedFiles).toBe(1);
  });

  it('returns home for the user home directory', async () => {
    const assessment = await assessIndexRoot(homedir());
    expect(assessment.kind).toBe('home');
  });

  it('returns large when file count reaches the warn threshold', async () => {
    const project = join(directory, 'large');
    await mkdir(project, { recursive: true });
    const count = INDEX_WARN_FILE_THRESHOLD;
    await Promise.all(
      Array.from({ length: count }, (_, index) =>
        writeFile(join(project, `f${String(index)}.ts`), `export const n = ${String(index)};\n`, 'utf8'),
      ),
    );
    const assessment = await assessIndexRoot(project);
    expect(assessment.kind).toBe('large');
    expect(assessment.estimatedFiles).toBe(INDEX_WARN_FILE_THRESHOLD);
  }, 60_000);
});

describe('project index store and service', () => {
  let directory = '';
  let store: AppStore | undefined;
  let service: ProjectIndexService | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ganymede-index-'));
    store = new AppStore(join(directory, 'app.sqlite'), join(directory, 'worktrees'));
    store.setSettings({ indexEnabled: true, indexSemanticEnabled: true });
    service = new ProjectIndexService(store, directory);
  });

  afterEach(async () => {
    await service?.close();
    store?.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('indexes a fixture project and finds lexical matches', async () => {
    const project = join(directory, 'project');
    await mkdir(join(project, 'src'), { recursive: true });
    await writeFile(
      join(project, 'src', 'auth.ts'),
      [
        'export function loginUser(token: string) {',
        '  return verifySession(token);',
        '}',
        '',
        'function verifySession(token: string) {',
        '  return token.length > 0;',
        '}',
      ].join('\n'),
      'utf8',
    );
    await writeFile(join(project, '.ganymedeignore'), 'secret/\n', 'utf8');
    await mkdir(join(project, 'secret'), { recursive: true });
    await writeFile(join(project, 'secret', 'key.txt'), 'top-secret', 'utf8');

    const { files } = await enumerateIndexableFiles(project, {
      maxFiles: 100,
      maxFileBytes: 512 * 1024,
    });
    expect(files.some((file) => file.path === 'src/auth.ts')).toBe(true);
    expect(files.some((file) => file.path.startsWith('secret/'))).toBe(false);

    await service!.activateProject(project);

    const status = service!.status(project);
    expect(status.fileCount).toBeGreaterThan(0);
    expect(status.chunkCount).toBeGreaterThan(0);

    const hits = await service!.search({
      workDir: project,
      query: 'loginUser session',
      mode: 'hybrid',
      limit: 5,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.path).toContain('auth.ts');

    const paths = await service!.searchPaths(project, 'auth');
    expect(paths?.some((item) => item.path.includes('auth.ts'))).toBe(true);
  }, 15_000);

  it('blocks oversized roots until force activate', async () => {
    const homeAssessment = await service!.assessProject(homedir());
    expect(homeAssessment?.kind).toBe('home');
    await service!.activateProject(homedir());
    expect(service!.status(homedir()).state).toBe('blocked');
    await service!.deactivateProject(homedir());

    const project = join(directory, 'force-large');
    await mkdir(project, { recursive: true });
    await Promise.all(
      Array.from({ length: INDEX_WARN_FILE_THRESHOLD }, (_, index) =>
        writeFile(join(project, `f${String(index)}.ts`), `export const n = ${String(index)};\n`, 'utf8'),
      ),
    );
    await service!.activateProject(project);
    expect(service!.status(project).state).toBe('blocked');

    await service!.activateProject(project, [], { force: true });
    const status = service!.status(project);
    expect(status.state).not.toBe('blocked');
    expect(status.fileCount).toBeGreaterThan(0);
  }, 120_000);

  it('cancels an in-progress index without recording an error', async () => {
    const project = join(directory, 'cancel-project');
    await mkdir(project, { recursive: true });
    await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        writeFile(
          join(project, `file-${String(index)}.ts`),
          `export function f${String(index)}() { return ${String(index)}; }\n`.repeat(20),
          'utf8',
        ),
      ),
    );

    const activate = service!.activateProject(project, [], { force: true });
    await service!.cancelIndex(project);
    await activate;
    const status = service!.status(project);
    expect(status.state).not.toBe('indexing');
    expect(status.error).toBeUndefined();
  }, 15_000);

  it('does not activate when index is disabled, and close clears runtimes', async () => {
    const project = join(directory, 'disabled');
    await mkdir(project, { recursive: true });
    await writeFile(join(project, 'a.ts'), 'export const a = 1;\n', 'utf8');

    store!.setSettings({ indexEnabled: false });
    await service!.activateProject(project);
    expect(service!.status(project).state).toBe('disabled');

    store!.setSettings({ indexEnabled: true });
    await service!.activateProject(project, [], { force: true });
    expect(service!.status(project).fileCount).toBeGreaterThan(0);

    await service!.close();
    expect(service!.status(project).state).toBe('idle');
  }, 15_000);

  it('skips opted-out roots', async () => {
    const project = join(directory, 'opt-out');
    await mkdir(project, { recursive: true });
    await writeFile(join(project, 'a.ts'), 'export const a = 1;\n', 'utf8');
    store!.setSettings({ indexOptOutRoots: [project] });
    await service!.activateProject(project, [], { force: true });
    expect(service!.status(project).state).toBe('idle');
    expect(service!.status(project).fileCount).toBe(0);
  });

  it('stores and retrieves embeddings in sqlite', async () => {
    const db = new ProjectIndexStore(join(directory, 'index.db'));
    db.replaceChunksForPath('a.ts', [
      {
        id: 'chunk-1',
        path: 'a.ts',
        startLine: 1,
        endLine: 3,
        content: 'export function greet() { return "hi"; }',
        contentHash: 'abc',
      },
    ]);
    const embedder = new HashEmbedder();
    const [vector] = await embedder.embed(['export function greet']);
    db.setEmbedding('chunk-1', vector!);
    expect(db.countEmbeddedChunks()).toBe(1);
    const hits = db.searchSemantic(vector!, 3);
    expect(hits[0]?.id).toBe('chunk-1');
    db.close();
  });
});
