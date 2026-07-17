import { describe, expect, it } from 'vitest';

import { languageFromFence } from '../src/renderer/language-from-path';
import { extractMermaidFence } from '../src/renderer/plan-document';

describe('mermaid fence detection', () => {
  it('recognizes mermaid language tokens from markdown fences', () => {
    expect(languageFromFence('mermaid')).toBe('mermaid');
    expect(languageFromFence('MERMAID')).toBe('mermaid');
  });

  it('extracts mermaid source for MarkdownMessage routing', () => {
    const markdown = [
      '## Architecture',
      '',
      '```mermaid',
      'sequenceDiagram',
      '  Agent->>PlansPanel: openPlanInPanel',
      '```',
      '',
      'More text',
    ].join('\n');
    expect(extractMermaidFence(markdown)).toBe(
      'sequenceDiagram\n  Agent->>PlansPanel: openPlanInPanel',
    );
  });
});
