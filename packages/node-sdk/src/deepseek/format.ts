/** Browser-safe DeepSeek footer formatting helpers (no agent-core dependency). */

export interface FooterTelemetry {
  readonly billingEnabled: boolean;
  readonly sessionInput: number;
  readonly sessionOutput: number;
  readonly sessionCacheHit: number;
  readonly sessionCacheMiss: number;
  readonly estimatedCostCny: number;
  readonly lastTurnCachePct: number | null;
  readonly balanceCny: string | null;
  readonly balanceGrantedCny: string | null;
  readonly balanceAvailable: boolean;
  readonly balanceFetchedAtMs: number | null;
}

export function cacheHitPct(hit: number, miss: number): number | null {
  const total = hit + miss;
  if (total <= 0) return null;
  return Math.round((hit / total) * 100);
}

export function formatCny(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '¥0.00';
  if (amount >= 0.01) return `¥${amount.toFixed(2)}`;
  return `¥${amount.toFixed(4)}`;
}

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

export function beijingHour(date: Date): number {
  const shifted = new Date(date.getTime() + BEIJING_OFFSET_MS);
  return shifted.getUTCHours();
}

export function isDeepSeekPeakHour(date: Date): boolean {
  const hour = beijingHour(date);
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
}
