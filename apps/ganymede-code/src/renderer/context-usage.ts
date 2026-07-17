export function safeContextRatio(contextTokens: number, maxContextTokens: number): number {
  if (!Number.isFinite(contextTokens) || !Number.isFinite(maxContextTokens) || maxContextTokens <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(contextTokens / maxContextTokens, 1));
}

export function formatContextPercent(ratio: number): string {
  const safe = Number.isFinite(ratio) ? Math.max(0, Math.min(ratio, 1)) : 0;
  return `${Math.round(safe * 100)}%`;
}

export function estimateTokensFromText(text: string): number {
  let asciiCount = 0;
  let nonAsciiCount = 0;
  for (const char of text) {
    if ((char.codePointAt(0) ?? 0) <= 127) {
      asciiCount += 1;
    } else {
      nonAsciiCount += 1;
    }
  }
  return Math.ceil(asciiCount / 4 + nonAsciiCount);
}

export function estimateTokensFromCharCount(chars: number): number {
  if (!Number.isFinite(chars) || chars <= 0) return 0;
  return Math.ceil(chars / 4);
}

export function formatTokenCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) {
    const thousands = count / 1_000;
    return thousands >= 100 ? `${Math.round(thousands)}K` : `${thousands.toFixed(1)}K`;
  }
  return String(Math.round(count));
}

export type ContextUsageSeverity = 'ok' | 'warn' | 'danger';

export function contextUsageSeverity(ratio: number): ContextUsageSeverity {
  if (ratio >= 0.85) return 'danger';
  if (ratio >= 0.5) return 'warn';
  return 'ok';
}

export type ContextUsageCategoryId =
  | 'systemPrompt'
  | 'toolDefinitions'
  | 'rules'
  | 'skills'
  | 'subagentDefinitions'
  | 'conversation';

export const CONTEXT_USAGE_CATEGORY_ORDER: readonly ContextUsageCategoryId[] = [
  'systemPrompt',
  'toolDefinitions',
  'rules',
  'skills',
  'subagentDefinitions',
  'conversation',
] as const;

export const CONTEXT_USAGE_CATEGORY_LABELS: Record<ContextUsageCategoryId, string> = {
  systemPrompt: '系统提示词',
  toolDefinitions: '工具定义',
  rules: '规则',
  skills: '技能',
  subagentDefinitions: '子代理定义',
  conversation: '会话',
};

export function sumContextUsageCategories(
  categories: Partial<Record<ContextUsageCategoryId, number>> | undefined,
): number {
  if (categories === undefined) return 0;
  return CONTEXT_USAGE_CATEGORY_ORDER.reduce((sum, id) => {
    const value = categories[id];
    if (value === undefined || !Number.isFinite(value) || value <= 0) return sum;
    return sum + value;
  }, 0);
}

/**
 * Prefer the larger of model-reported fill and estimated category sum so the
 * ring/summary reflect fixed overhead before the first step.end usage arrives.
 */
export function resolveContextUsageDisplay(input: {
  readonly contextTokens: number;
  readonly maxContextTokens: number;
  readonly categories?: Partial<Record<ContextUsageCategoryId, number>>;
}): { readonly displayTokens: number; readonly ratio: number } {
  const contextTokens = Number.isFinite(input.contextTokens) ? Math.max(0, input.contextTokens) : 0;
  const categorySum = sumContextUsageCategories(input.categories);
  const displayTokens = Math.max(contextTokens, categorySum);
  return {
    displayTokens,
    ratio: safeContextRatio(displayTokens, input.maxContextTokens),
  };
}
