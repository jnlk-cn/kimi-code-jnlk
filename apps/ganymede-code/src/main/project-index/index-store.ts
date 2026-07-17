import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { cosineSimilarity } from './hybrid';
import { EMBEDDING_DIMENSIONS } from './embedder';

export interface StoredFile {
  readonly path: string;
  readonly contentHash: string;
  readonly mtimeMs: number;
  readonly size: number;
}

export interface StoredChunk {
  readonly id: string;
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly content: string;
  readonly contentHash: string;
}

export interface LexicalSearchHit {
  readonly id: string;
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly content: string;
  readonly rank: number;
}

export class ProjectIndexStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        content_hash TEXT NOT NULL,
        mtime_ms REAL NOT NULL,
        size INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        embedding BLOB
      );
      CREATE INDEX IF NOT EXISTS chunks_path_idx ON chunks(path);
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        id UNINDEXED,
        path,
        content,
        tokenize = 'unicode61'
      );
    `);
  }

  getMeta(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO meta(key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }

  listFiles(): readonly StoredFile[] {
    return this.db
      .prepare('SELECT path, content_hash AS contentHash, mtime_ms AS mtimeMs, size FROM files')
      .all() as unknown as StoredFile[];
  }

  listPaths(): readonly string[] {
    return (this.db.prepare('SELECT path FROM files ORDER BY path').all() as { path: string }[]).map(
      (row) => row.path,
    );
  }

  getFile(path: string): StoredFile | undefined {
    return this.db
      .prepare(
        'SELECT path, content_hash AS contentHash, mtime_ms AS mtimeMs, size FROM files WHERE path = ?',
      )
      .get(path) as unknown as StoredFile | undefined;
  }

  upsertFile(file: StoredFile): void {
    this.db
      .prepare(
        `INSERT INTO files(path, content_hash, mtime_ms, size) VALUES (?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           content_hash = excluded.content_hash,
           mtime_ms = excluded.mtime_ms,
           size = excluded.size`,
      )
      .run(file.path, file.contentHash, file.mtimeMs, file.size);
  }

  deleteFile(path: string): void {
    this.deleteChunksForPath(path);
    this.db.prepare('DELETE FROM files WHERE path = ?').run(path);
  }

  replaceChunksForPath(path: string, chunks: readonly StoredChunk[]): void {
    this.deleteChunksForPath(path);
    const insert = this.db.prepare(
      `INSERT INTO chunks(id, path, start_line, end_line, content, content_hash, embedding)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    );
    const insertFts = this.db.prepare(
      'INSERT INTO chunks_fts(id, path, content) VALUES (?, ?, ?)',
    );
    this.db.exec('BEGIN');
    try {
      for (const chunk of chunks) {
        insert.run(
          chunk.id,
          chunk.path,
          chunk.startLine,
          chunk.endLine,
          chunk.content,
          chunk.contentHash,
        );
        insertFts.run(chunk.id, chunk.path, chunk.content);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  deleteChunksForPath(path: string): void {
    const ids = (
      this.db.prepare('SELECT id FROM chunks WHERE path = ?').all(path) as { id: string }[]
    ).map((row) => row.id);
    if (ids.length === 0) return;
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM chunks WHERE path = ?').run(path);
      for (const id of ids) {
        this.db.prepare('DELETE FROM chunks_fts WHERE id = ?').run(id);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  countFiles(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM files').get() as { count: number };
    return row.count;
  }

  countChunks(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM chunks').get() as { count: number };
    return row.count;
  }

  countEmbeddedChunks(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS count FROM chunks WHERE embedding IS NOT NULL')
      .get() as { count: number };
    return row.count;
  }

  listChunksMissingEmbedding(limit: number): readonly StoredChunk[] {
    return this.db
      .prepare(
        `SELECT id, path, start_line AS startLine, end_line AS endLine, content, content_hash AS contentHash
         FROM chunks WHERE embedding IS NULL LIMIT ?`,
      )
      .all(limit) as unknown as StoredChunk[];
  }

  setEmbedding(id: string, embedding: Float32Array): void {
    this.db
      .prepare('UPDATE chunks SET embedding = ? WHERE id = ?')
      .run(Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength), id);
  }

  getChunk(id: string): StoredChunk | undefined {
    return this.db
      .prepare(
        `SELECT id, path, start_line AS startLine, end_line AS endLine, content, content_hash AS contentHash
         FROM chunks WHERE id = ?`,
      )
      .get(id) as unknown as StoredChunk | undefined;
  }

  searchLexical(query: string, limit: number): readonly LexicalSearchHit[] {
    const trimmed = query.trim();
    if (trimmed.length === 0) return [];
    const matchQuery = toFtsQuery(trimmed);
    if (matchQuery.length === 0) return [];
    try {
      return this.db
        .prepare(
          `SELECT c.id, c.path, c.start_line AS startLine, c.end_line AS endLine, c.content,
                  bm25(chunks_fts) AS rank
           FROM chunks_fts
           JOIN chunks c ON c.id = chunks_fts.id
           WHERE chunks_fts MATCH ?
           ORDER BY rank
           LIMIT ?`,
        )
        .all(matchQuery, limit) as unknown as LexicalSearchHit[];
    } catch {
      return [];
    }
  }

  searchSemantic(queryVector: Float32Array, limit: number): readonly LexicalSearchHit[] {
    const rows = this.db
      .prepare(
        `SELECT id, path, start_line AS startLine, end_line AS endLine, content, embedding
         FROM chunks WHERE embedding IS NOT NULL`,
      )
      .all() as unknown as Array<
      StoredChunk & { embedding: Buffer; startLine: number; endLine: number; content: string }
    >;
    const scored = rows
      .map((row) => {
        const vector = bufferToFloat32(row.embedding);
        return {
          id: row.id,
          path: row.path,
          startLine: row.startLine,
          endLine: row.endLine,
          content: row.content,
          rank: -cosineSimilarity(queryVector, vector),
        };
      })
      .toSorted((a, b) => a.rank - b.rank)
      .slice(0, limit);
    return scored;
  }
}

function bufferToFloat32(buffer: Buffer): Float32Array {
  const copy = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const view = new Float32Array(copy);
  if (view.length === EMBEDDING_DIMENSIONS) return view;
  const out = new Float32Array(EMBEDDING_DIMENSIONS);
  out.set(view.subarray(0, EMBEDDING_DIMENSIONS));
  return out;
}

function toFtsQuery(query: string): string {
  const tokens = query
    .split(/[^\p{L}\p{N}_]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .slice(0, 12);
  if (tokens.length === 0) return '';
  return tokens.map((token) => `"${token.replaceAll('"', '')}"*`).join(' AND ');
}
