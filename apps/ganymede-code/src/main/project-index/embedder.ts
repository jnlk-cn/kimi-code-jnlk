import { createHash } from 'node:crypto';

export const EMBEDDING_DIMENSIONS = 384;

export interface Embedder {
  readonly id: string;
  readonly ready: boolean;
  embed(texts: readonly string[]): Promise<readonly Float32Array[]>;
}

/** Deterministic local embedder used for tests and as offline fallback. */
export class HashEmbedder implements Embedder {
  readonly id = 'hash-v1';
  readonly ready = true;

  async embed(texts: readonly string[]): Promise<readonly Float32Array[]> {
    return texts.map((text) => hashEmbed(text));
  }
}

export function hashEmbed(text: string, dimensions = EMBEDDING_DIMENSIONS): Float32Array {
  const vector = new Float32Array(dimensions);
  const normalized = text.toLocaleLowerCase();
  const tokens = normalized.split(/[^a-z0-9_\u4e00-\u9fff]+/u).filter((token) => token.length > 0);
  for (const token of tokens) {
    const digest = createHash('sha256').update(token).digest();
    for (let i = 0; i < dimensions; i += 1) {
      const byte = digest[i % digest.length]!;
      vector[i]! += ((byte / 255) * 2 - 1) / Math.sqrt(tokens.length || 1);
    }
  }
  // Character trigrams help short queries match code identifiers.
  for (let i = 0; i < normalized.length - 2; i += 1) {
    const gram = normalized.slice(i, i + 3);
    const digest = createHash('sha256').update(gram).digest();
    const slot = digest[0]! % dimensions;
    vector[slot]! += 0.15;
  }
  normalizeInPlace(vector);
  return vector;
}

function normalizeInPlace(vector: Float32Array): void {
  let norm = 0;
  for (let i = 0; i < vector.length; i += 1) norm += vector[i]! * vector[i]!;
  if (norm === 0) return;
  const scale = 1 / Math.sqrt(norm);
  for (let i = 0; i < vector.length; i += 1) vector[i]! *= scale;
}

export class TransformersEmbedder implements Embedder {
  readonly id = 'minilm-l6-v2';
  private pipeline: unknown;
  private loading: Promise<void> | undefined;
  ready = false;

  constructor(private readonly cacheDir: string) {}

  async ensureReady(): Promise<boolean> {
    if (this.ready) return true;
    this.loading ??= this.load();
    try {
      await this.loading;
      return this.ready;
    } catch {
      this.loading = undefined;
      return false;
    }
  }

  private async load(): Promise<void> {
    const transformers = await import('@huggingface/transformers').catch(() => null);
    if (transformers === null) return;
    const { pipeline, env } = transformers as {
      pipeline: (
        task: string,
        model: string,
        options?: { readonly cache_dir?: string },
      ) => Promise<unknown>;
      env: { cacheDir?: string; allowLocalModels?: boolean };
    };
    env.cacheDir = this.cacheDir;
    env.allowLocalModels = true;
    this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      cache_dir: this.cacheDir,
    });
    this.ready = true;
  }

  async embed(texts: readonly string[]): Promise<readonly Float32Array[]> {
    if (!this.ready || this.pipeline === undefined) {
      return texts.map((text) => hashEmbed(text));
    }
    const run = this.pipeline as (
      input: string,
      options: { readonly pooling: string; readonly normalize: boolean },
    ) => Promise<{ data: Float32Array | number[] }>;
    const out: Float32Array[] = [];
    for (const text of texts) {
      const result = await run(text.slice(0, 8_000), { pooling: 'mean', normalize: true });
      const data = result.data;
      out.push(data instanceof Float32Array ? data : Float32Array.from(data));
    }
    return out;
  }
}

export async function createPreferredEmbedder(
  cacheDir: string,
  semanticEnabled: boolean,
): Promise<Embedder> {
  if (!semanticEnabled) return new HashEmbedder();
  // Vitest / CI should stay offline and deterministic.
  if (process.env['VITEST'] === 'true' || process.env['NODE_ENV'] === 'test') {
    return new HashEmbedder();
  }
  const transformers = new TransformersEmbedder(cacheDir);
  const ready = await Promise.race([
    transformers.ensureReady(),
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), 2_000);
    }),
  ]);
  return ready ? transformers : new HashEmbedder();
}
