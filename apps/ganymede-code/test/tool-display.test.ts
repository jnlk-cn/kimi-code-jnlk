import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  agentSwarmPartialItemsFromArguments,
  agentSwarmResultSummaryFromOutput,
  formatAgentSwarmError,
  formatAgentSwarmSummaryLabel,
} from '../src/renderer/agent-swarm';
import { SwarmEventController } from '../src/renderer/agent-swarm/swarm-event-controller';
import { ChildAgentEventRouter } from '../src/renderer/child-agent-event-router';
import {
  buildToolDiffLines,
  computeToolChangeStats,
} from '../src/renderer/tool-change-stats';
import {
  fileTypeBadge,
  parseToolDisplay,
  parseToolDisplayFromEntry,
  stripToolResultSuffix,
  toolDisplayTitle,
} from '../src/renderer/tool-display';
import { CodeSurface } from '../src/renderer/components/code-surface';
import { MarkdownMessage } from '../src/renderer/components/markdown-message';
import { StreamingAssistantMessage } from '../src/renderer/components/streaming-assistant-message';
import { ToolBlockView } from '../src/renderer/components/tool-block-view';

describe('parseToolDisplay', () => {
  it('extracts Write path and content', () => {
    const display = parseToolDisplay(
      JSON.stringify({
        path: 'counter.html',
        content: '<html></html>',
      }),
    );
    expect(display.mode).toBe('write');
    expect(display.path).toBe('counter.html');
    expect(display.code).toBe('<html></html>');
    expect(display.language).toBe('html');
    expect(display.previewable).toBe(true);
    expect(toolDisplayTitle(display)).toBe('写入 counter.html');
  });

  it('extracts Edit payloads', () => {
    const display = parseToolDisplay(
      JSON.stringify({
        path: 'src/app.ts',
        old_string: 'a',
        new_string: 'b',
      }),
    );
    expect(display.mode).toBe('edit');
    expect(display.code).toBe('b');
    expect(display.previewable).toBe(false);
  });

  it('pretty-prints other JSON', () => {
    const display = parseToolDisplay('{"ok":true}');
    expect(display.mode).toBe('json');
    expect(display.language).toBe('json');
    expect(display.code).toContain('"ok": true');
  });

  it('keeps streaming content raw', () => {
    const display = parseToolDisplay('{"path":', true);
    expect(display.mode).toBe('raw');
    expect(display.previewable).toBe(false);
  });

  it('strips trailing Wrote bytes result lines before parsing', () => {
    const args = JSON.stringify({ path: 'a.ts', content: 'hello' }, null, 2);
    const display = parseToolDisplay(`${args}\nWrote 5 bytes to a.ts`);
    expect(display.mode).toBe('write');
    expect(display.path).toBe('a.ts');
    expect(display.code).toBe('hello');
  });
});

describe('parseToolDisplayFromEntry', () => {
  it('prefers toolArgs when content is only a Write result line', () => {
    const display = parseToolDisplayFromEntry({
      content: 'Wrote 2503 bytes to /Users/example/counter.html',
      toolArgs: {
        path: 'counter.html',
        content: '<html><body>hi</body></html>',
      },
    });
    expect(display.mode).toBe('write');
    expect(display.path).toBe('counter.html');
    expect(display.code).toBe('<html><body>hi</body></html>');
    expect(display.language).toBe('html');
  });

  it('falls back to stripped content when toolArgs are missing', () => {
    const args = JSON.stringify({ path: 'b.ts', content: 'one\ntwo' });
    const display = parseToolDisplayFromEntry({
      content: `${args}\nWrote 7 bytes to b.ts`,
    });
    expect(display.mode).toBe('write');
    expect(display.code).toBe('one\ntwo');
  });
});

describe('stripToolResultSuffix', () => {
  it('removes Wrote / Replaced result lines', () => {
    expect(stripToolResultSuffix('{"a":1}\nWrote 3 bytes to x.ts')).toBe('{"a":1}');
    expect(stripToolResultSuffix('{"a":1}\nReplaced 1 occurrence in x.ts')).toBe('{"a":1}');
  });
});

describe('fileTypeBadge', () => {
  it('uppercases short extensions', () => {
    expect(fileTypeBadge('workspace-service.ts')).toBe('TS');
    expect(fileTypeBadge('counter.html')).toBe('HTML');
    expect(fileTypeBadge('README')).toBeUndefined();
  });
});

describe('heavy tool and markdown surfaces', () => {
  it('renders completed tools as a summary without mounting their code surface', () => {
    const html = renderToStaticMarkup(createElement(ToolBlockView, {
      entry: {
        id: 'tool:write-1',
        kind: 'tool',
        title: 'Write',
        content: 'Wrote 14 bytes to src/a.ts',
        toolCallId: 'write-1',
        toolArgs: { path: 'src/a.ts', content: 'const secret = 1;' },
        streaming: false,
      },
    }));

    expect(html).toContain('<summary>');
    expect(html).not.toContain('code-surface');
    expect(html).not.toContain('const secret');
  });

  it('uses a lightweight pre placeholder before a read-only editor nears the viewport', () => {
    const html = renderToStaticMarkup(createElement(CodeSurface, {
      value: 'const deferred = true;',
      language: 'typescript',
      readOnly: true,
      deferUntilVisible: true,
    }));

    expect(html).toContain('code-surface--placeholder');
    expect(html).toContain('<pre');
    expect(html).not.toContain('cm-editor');
  });

  it('fades a bounded streaming tail without rendering a cursor', () => {
    const html = renderToStaticMarkup(createElement(StreamingAssistantMessage, {
      content: 'A'.repeat(80),
      streaming: true,
    }));

    expect(html).not.toContain('stream-cursor');
    expect(html).toContain('stream-reveal-run');
    expect(html.match(/stream-reveal-glyph/g)).toHaveLength(32);
  });

  it('renders GFM tables, task lists, and Mermaid fences on the Markdown surface', () => {
    const html = renderToStaticMarkup(createElement(MarkdownMessage, {
      content: [
        '## Results',
        '',
        '| Name | Status |',
        '| --- | --- |',
        '| Renderer | Smooth |',
        '',
        '- [x] Table styling',
        '',
        '```mermaid',
        'flowchart LR',
        '  Input --> Output',
        '```',
      ].join('\n'),
    }));

    expect(html).toContain('class="markdown-body"');
    expect(html).toContain('class="markdown-table-wrap"');
    expect(html).toContain('class="task-list-item"');
    expect(html).toContain('class="markdown-mermaid"');
    expect(html).toContain('图表将在进入视口时渲染');
  });
});

describe('buildToolDiffLines', () => {
  it('maps Write content to add lines and matches stats', () => {
    const args = { path: 'a.ts', content: 'line1\nline2\n' };
    expect(buildToolDiffLines('Write', args)).toEqual([
      { kind: 'add', text: 'line1' },
      { kind: 'add', text: 'line2' },
    ]);
    expect(computeToolChangeStats('Write', args)).toEqual({ additions: 2, deletions: 0 });
  });

  it('maps Edit old/new to add and delete lines', () => {
    const args = { path: 'a.ts', old_string: 'alpha\nbeta', new_string: 'alpha\ngamma' };
    expect(buildToolDiffLines('Edit', args)).toEqual([
      { kind: 'delete', text: 'beta' },
      { kind: 'add', text: 'gamma' },
    ]);
    expect(computeToolChangeStats('Edit', args)).toEqual({ additions: 1, deletions: 1 });
  });
});

describe('agentSwarm parsing', () => {
  it('summarizes XML agent swarm results', () => {
    const summary = agentSwarmResultSummaryFromOutput(`
<agent_swarm_result>
<subagent index="1" outcome="completed">done</subagent>
<subagent index="2" outcome="failed">err</subagent>
<subagent index="3" outcome="aborted">stop</subagent>
</agent_swarm_result>`);
    expect(summary).toMatchObject({ completed: 1, failed: 1, aborted: 1, parsed: true });
    expect(formatAgentSwarmSummaryLabel(summary)).toBe('1 完成 · 1 失败 · 1 中止');
  });

  it('parses partial items from streaming arguments', () => {
    expect(agentSwarmPartialItemsFromArguments('{"items":["alpha","be')).toEqual([
      'alpha',
      'be',
    ]);
  });

  it('formats common AgentSwarm errors in Chinese', () => {
    expect(formatAgentSwarmError('AgentSwarm must be the only tool call in a model response.')).toContain(
      '单独调用',
    );
    expect(formatAgentSwarmError('AgentSwarm requires at least 2 items unless resume_agent_ids is provided.')).toContain(
      '至少需要 2',
    );
  });
});

describe('SwarmEventController', () => {
  it('tracks foreground subagents under the parent AgentSwarm tool call', () => {
    const controller = new SwarmEventController();
    expect(
      controller.handleEvent({
        type: 'tool.call.started',
        toolCallId: 'call_swarm',
        name: 'AgentSwarm',
        args: {
          description: 'parallel',
          items: ['one', 'two'],
          prompt_template: 'do {{item}}',
        },
      }),
    ).toBe(true);
    expect(
      controller.handleEvent({
        type: 'subagent.spawned',
        subagentId: 'a1',
        subagentName: 'coder',
        parentToolCallId: 'call_swarm',
        runInBackground: false,
        swarmIndex: 1,
        description: 'one',
      }),
    ).toBe(true);
    expect(
      controller.handleEvent({
        type: 'subagent.started',
        subagentId: 'a1',
      }),
    ).toBe(true);
    expect(
      controller.handleEvent({
        type: 'tool.result',
        toolCallId: 'call_swarm',
        output:
          '<agent_swarm_result><subagent index="1" outcome="completed">ok</subagent><subagent index="2" outcome="completed">ok</subagent></agent_swarm_result>',
      }),
    ).toBe(true);
    const swarm = controller.getSwarm('call_swarm');
    expect(swarm?.ended).toBe(true);
    expect(swarm?.summaryLabel).toBe('2 完成');
    expect(swarm?.members[0]?.phase).toBe('completed');
  });

  it('ignores background subagents for swarm progress', () => {
    const controller = new SwarmEventController();
    controller.handleEvent({
      type: 'tool.call.started',
      toolCallId: 'call_swarm',
      name: 'AgentSwarm',
      args: { description: 'x', items: ['a', 'b'], prompt_template: '{{item}}' },
    });
    expect(
      controller.handleEvent({
        type: 'subagent.spawned',
        subagentId: 'bg-1',
        parentToolCallId: 'other',
        runInBackground: true,
      }),
    ).toBe(false);
  });

  it('appends model deltas into swarm member latestModelText', () => {
    const controller = new SwarmEventController();
    controller.handleEvent({
      type: 'tool.call.started',
      toolCallId: 'call_swarm',
      name: 'AgentSwarm',
      args: { description: 'parallel', items: ['one', 'two'] },
    });
    controller.handleEvent({
      type: 'subagent.spawned',
      subagentId: 'a1',
      subagentName: 'coder',
      parentToolCallId: 'call_swarm',
      runInBackground: false,
      swarmIndex: 1,
    });
    controller.handleEvent({ type: 'subagent.started', subagentId: 'a1' });
    expect(controller.appendModelDelta({ agentId: 'a1', delta: 'hello ' })).toBe(true);
    expect(controller.appendModelDelta({ agentId: 'a1', delta: 'world' })).toBe(true);
    expect(controller.getSwarm('call_swarm')?.members[0]?.latestModelText).toBe('hello world');
  });
});

describe('ChildAgentEventRouter', () => {
  it('routes child assistant deltas into AgentSwarm progress', () => {
    const router = new ChildAgentEventRouter();
    expect(
      router.routeEvent({
        type: 'tool.call.started',
        toolCallId: 'call_swarm',
        name: 'AgentSwarm',
        args: { description: 'work', items: ['alpha', 'beta'] },
      }),
    ).toBe(true);
    expect(
      router.routeEvent({
        type: 'subagent.spawned',
        subagentId: 'a1',
        subagentName: 'coder',
        parentToolCallId: 'call_swarm',
        runInBackground: false,
        swarmIndex: 1,
      }),
    ).toBe(true);
    expect(
      router.routeEvent({
        type: 'assistant.delta',
        agentId: 'a1',
        delta: 'writing counter',
      }),
    ).toBe(true);
    expect(
      router.getSwarmController().getSwarm('call_swarm')?.members[0]?.latestModelText,
    ).toBe('writing counter');
  });

  it('routes foreground Agent tool subagents into AgentSubagentController', () => {
    const router = new ChildAgentEventRouter();
    router.routeEvent({
      type: 'tool.call.started',
      toolCallId: 'call_agent',
      name: 'Agent',
      args: { description: 'build page' },
    });
    expect(
      router.routeEvent({
        type: 'subagent.spawned',
        subagentId: 'child-1',
        subagentName: 'builder',
        description: 'build page',
        parentToolCallId: 'call_agent',
        runInBackground: false,
      }),
    ).toBe(true);
    expect(
      router.routeEvent({
        type: 'assistant.delta',
        agentId: 'child-1',
        delta: 'draft html',
      }),
    ).toBe(true);
    expect(
      router.routeEvent({
        type: 'tool.call.started',
        agentId: 'child-1',
        toolCallId: 'write-1',
        name: 'Write',
      }),
    ).toBe(true);
    const view = router.getAgentController().get('call_agent');
    expect(view?.phase).toBe('running');
    expect(view?.latestActivity).toBe('Using Write');
    expect(view?.toolCount).toBe(1);
  });

  it('swallows unknown child agent streams without swarm update', () => {
    const router = new ChildAgentEventRouter();
    expect(
      router.routeEvent({
        type: 'assistant.delta',
        agentId: 'orphan',
        delta: 'should not leak',
      }),
    ).toBe(true);
    expect(router.getSwarmController().getState().swarms.size).toBe(0);
  });
});
