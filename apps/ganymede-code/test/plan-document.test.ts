import { describe, expect, it } from 'vitest';

import {
  extractMermaidFence,
  parsePlanDocument,
  planTodoProgressSummary,
} from '../src/renderer/plan-document';

describe('parsePlanDocument', () => {
  it('parses Cursor-style frontmatter with todos', () => {
    const doc = parsePlanDocument(`---
name: Plans Panel UX
overview: Ship the plans panel
todos:
  - id: wire
    content: Wire SidePanel
    status: completed
  - id: mermaid
    content: Render mermaid
    status: pending
isProject: false
---

# Body

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`
`);
    expect(doc.hasFrontmatter).toBe(true);
    expect(doc.meta).toEqual({
      name: 'Plans Panel UX',
      overview: 'Ship the plans panel',
    });
    expect(doc.todos).toEqual([
      { id: 'wire', content: 'Wire SidePanel', status: 'completed' },
      { id: 'mermaid', content: 'Render mermaid', status: 'pending' },
    ]);
    expect(doc.body).toContain('# Body');
    expect(doc.body).toContain('```mermaid');
  });

  it('falls back to full content when frontmatter is missing', () => {
    const doc = parsePlanDocument('# Plain plan\n\nDo the work');
    expect(doc).toEqual({
      meta: {},
      todos: [],
      body: '# Plain plan\n\nDo the work',
      hasFrontmatter: false,
    });
  });

  it('drops invalid todos and maps done to completed', () => {
    const doc = parsePlanDocument(`---
todos:
  - id: ok
    content: Valid
    status: done
  - id: missing-content
    status: pending
  - content: No id
    status: pending
  - id: bad-status
    content: Bad
    status: unknown
---

Body
`);
    expect(doc.todos).toEqual([{ id: 'ok', content: 'Valid', status: 'completed' }]);
    expect(doc.body.trim()).toBe('Body');
  });

  it('treats malformed YAML frontmatter as plain markdown', () => {
    const raw = `---
name: [unterminated
---

# Still shown
`;
    const doc = parsePlanDocument(raw);
    expect(doc.hasFrontmatter).toBe(false);
    expect(doc.body).toBe(raw);
  });
});

describe('planTodoProgressSummary', () => {
  it('counts completed and cancelled toward done', () => {
    expect(
      planTodoProgressSummary([
        { id: 'a', content: 'A', status: 'completed' },
        { id: 'b', content: 'B', status: 'cancelled' },
        { id: 'c', content: 'C', status: 'pending' },
      ]),
    ).toBe('2/3 已完成');
  });
});

describe('extractMermaidFence', () => {
  it('extracts the first mermaid fence body', () => {
    expect(
      extractMermaidFence('# Plan\n\n```mermaid\nflowchart TD\n  A --> B\n```\n'),
    ).toBe('flowchart TD\n  A --> B');
  });
});
