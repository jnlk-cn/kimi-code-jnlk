import { describe, expect, it } from 'vitest';

import {
  buildSubagentDescriptionText,
  computeContextUsageBreakdown,
} from '../../src/agent/context-usage';
import { estimateTokens } from '../../src/utils/tokens';

describe('computeContextUsageBreakdown', () => {
  it('splits fixed overhead and puts the remainder in conversation', () => {
    const agentsMd = 'Project rules go here.';
    const skillListing = '- demo-skill: does things';
    const baseline = 'You are a helpful coding agent.';
    const cwdListing = 'src/\npackage.json';

    const result = computeContextUsageBreakdown({
      contextTokens: 50_000,
      maxContextTokens: 200_000,
      systemPromptBaseline: baseline,
      cwdListing,
      additionalDirsInfo: '',
      agentsMd,
      skillListing,
      includeSkills: true,
      subagents: {
        explore: {
          name: 'explore',
          description: 'Explore the codebase',
          systemPrompt: () => '',
          tools: ['Read', 'Grep'],
        },
      },
      tools: [
        {
          name: 'Read',
          description: 'Read a file',
          parameters: { type: 'object', properties: {} },
        },
      ],
    });

    const expectedSystem =
      estimateTokens(baseline) + estimateTokens(cwdListing);
    const expectedRules = estimateTokens(agentsMd);
    const expectedSkills = estimateTokens(skillListing);
    const expectedSubagents = estimateTokens(
      buildSubagentDescriptionText({
        explore: {
          name: 'explore',
          description: 'Explore the codebase',
          systemPrompt: () => '',
          tools: ['Read', 'Grep'],
        },
      }),
    );

    expect(result.categories.systemPrompt).toBe(expectedSystem);
    expect(result.categories.rules).toBe(expectedRules);
    expect(result.categories.skills).toBe(expectedSkills);
    expect(result.categories.subagentDefinitions).toBe(expectedSubagents);
    expect(result.categories.conversation).toBeGreaterThan(0);

    const sum =
      result.categories.systemPrompt +
      result.categories.toolDefinitions +
      result.categories.rules +
      result.categories.skills +
      result.categories.subagentDefinitions +
      result.categories.conversation;
    expect(sum).toBe(result.contextTokens);
    expect(result.categories.conversation).toBeGreaterThanOrEqual(0);
  });

  it('omits skill listing when Skill tool is not included', () => {
    const result = computeContextUsageBreakdown({
      contextTokens: 100,
      maxContextTokens: 1000,
      systemPromptBaseline: 'base',
      cwdListing: '',
      additionalDirsInfo: '',
      agentsMd: '',
      skillListing: '- huge skill listing that would inflate skills',
      includeSkills: false,
      subagents: undefined,
      tools: [],
    });
    expect(result.categories.skills).toBe(0);
  });

  it('keeps conversation non-negative when fixed overhead exceeds contextTokens', () => {
    const result = computeContextUsageBreakdown({
      contextTokens: 1,
      maxContextTokens: 1000,
      systemPromptBaseline: 'a'.repeat(400),
      cwdListing: '',
      additionalDirsInfo: '',
      agentsMd: 'b'.repeat(400),
      skillListing: '',
      includeSkills: false,
      subagents: undefined,
      tools: [],
    });
    expect(result.categories.conversation).toBe(0);
    expect(result.categories.systemPrompt).toBeGreaterThan(1);
  });
});
