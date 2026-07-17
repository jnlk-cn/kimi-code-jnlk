import type { Tool } from '@moonshot-ai/kosong';

import type { ResolvedAgentProfile } from '../profile';
import { estimateTokens, estimateTokensForTools } from '../utils/tokens';

export interface ContextUsageCategories {
  readonly systemPrompt: number;
  readonly toolDefinitions: number;
  readonly rules: number;
  readonly skills: number;
  readonly subagentDefinitions: number;
  readonly conversation: number;
}

export interface ContextUsageBreakdown {
  readonly contextTokens: number;
  readonly maxContextTokens: number;
  readonly categories: ContextUsageCategories;
}

export interface ContextUsageToolEstimate {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly deferred?: boolean;
}

export interface ContextUsageBreakdownInput {
  readonly contextTokens: number;
  readonly maxContextTokens: number;
  readonly systemPromptBaseline: string;
  readonly cwdListing: string;
  readonly additionalDirsInfo: string;
  readonly agentsMd: string;
  readonly skillListing: string;
  readonly includeSkills: boolean;
  readonly subagents: ResolvedAgentProfile['subagents'];
  readonly tools: readonly ContextUsageToolEstimate[];
}

/**
 * Heuristic breakdown of live context-window fill into Cursor-style categories.
 * Category totals are estimates; `contextTokens` is the authoritative fill
 * (provider step.end usage). Conversation absorbs any remainder so the bar
 * always sums to `contextTokens`.
 */
export function computeContextUsageBreakdown(
  input: ContextUsageBreakdownInput,
): ContextUsageBreakdown {
  const rules = estimateTokens(input.agentsMd);
  const skills = input.includeSkills ? estimateTokens(input.skillListing) : 0;
  const subagentText = buildSubagentDescriptionText(input.subagents);
  const subagentDefinitions = estimateTokens(subagentText);

  const systemPrompt =
    estimateTokens(input.systemPromptBaseline) +
    estimateTokens(input.cwdListing) +
    estimateTokens(input.additionalDirsInfo);

  const wireTools = input.tools.filter((tool) => tool.deferred !== true) as readonly Tool[];
  const rawToolTokens = estimateTokensForTools(wireTools);
  // Agent tool description embeds the same subagent type lines; keep them in
  // the subagent bucket only.
  const toolDefinitions = Math.max(0, rawToolTokens - subagentDefinitions);

  const fixed = systemPrompt + toolDefinitions + rules + skills + subagentDefinitions;
  const conversation = Math.max(0, input.contextTokens - fixed);

  return {
    contextTokens: input.contextTokens,
    maxContextTokens: input.maxContextTokens,
    categories: {
      systemPrompt,
      toolDefinitions,
      rules,
      skills,
      subagentDefinitions,
      conversation,
    },
  };
}

/** Mirrors AgentTool's subagent type listing (agent.ts buildSubagentDescriptions). */
export function buildSubagentDescriptionText(
  subagents: ResolvedAgentProfile['subagents'],
): string {
  if (subagents === undefined) return '';
  return Object.entries(subagents)
    .map(([name, subagent]) => {
      const details = [subagent.description, subagent.whenToUse].filter(
        (part): part is string => part !== undefined && part.length > 0,
      );
      const header = details.length === 0 ? `- ${name}` : `- ${name}: ${details.join(' ')}`;
      if (subagent.tools.length === 0) return header;
      return `${header}\n  Tools: ${subagent.tools.join(', ')}`;
    })
    .join('\n');
}
