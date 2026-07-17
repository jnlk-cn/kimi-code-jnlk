export interface RankedHit {
  readonly id: string;
  readonly score: number;
  readonly source: 'lexical' | 'semantic';
}

export interface HybridHit {
  readonly id: string;
  readonly score: number;
  readonly sources: readonly ('lexical' | 'semantic')[];
}

/** Reciprocal Rank Fusion over ranked result lists. */
export function reciprocalRankFusion(
  lists: readonly (readonly RankedHit[])[],
  k = 60,
): readonly HybridHit[] {
  const scores = new Map<string, { score: number; sources: Set<'lexical' | 'semantic'> }>();
  for (const list of lists) {
    list.forEach((hit, index) => {
      const current = scores.get(hit.id) ?? { score: 0, sources: new Set() };
      current.score += 1 / (k + index + 1);
      current.sources.add(hit.source);
      scores.set(hit.id, current);
    });
  }
  return [...scores.entries()]
    .map(([id, value]) => ({
      id,
      score: value.score,
      sources: [...value.sources],
    }))
    .toSorted((a, b) => b.score - a.score);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
