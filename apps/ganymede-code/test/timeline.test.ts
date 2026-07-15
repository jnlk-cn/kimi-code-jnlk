import { describe, expect, it } from 'vitest';

import {
  formatStepDebugTiming,
  reduceLiveEvent,
  replayTimeline,
} from '../src/renderer/timeline';
import { resolveInteractionMode } from '../src/shared/contracts';
import { linkedSessionExcerpt } from '../src/main/session-manager';

describe('reduceLiveEvent', () => {
  it('merges assistant deltas into a streaming entry', () => {
    const first = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: { type: 'assistant.delta', delta: 'Hello' },
    });
    const second = reduceLiveEvent(first, {
      seq: 2,
      sessionId: 's1',
      event: { type: 'assistant.delta', delta: ' world' },
    });
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({
      kind: 'assistant',
      content: 'Hello world',
      streaming: true,
    });
  });

  it('closes streaming entries on turn.ended', () => {
    const streaming = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: { type: 'assistant.delta', delta: 'Done' },
    });
    const ended = reduceLiveEvent(streaming, {
      seq: 2,
      sessionId: 's1',
      event: { type: 'turn.ended' },
    });
    expect(ended[0]?.streaming).toBe(false);
  });

  it('updates tool progress and result for the same tool call', () => {
    const started = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: {
        type: 'tool.call.started',
        toolCallId: 'tc-1',
        name: 'Read',
        args: { path: 'README.md' },
      },
    });
    const progressed = reduceLiveEvent(started, {
      seq: 2,
      sessionId: 's1',
      event: {
        type: 'tool.progress',
        toolCallId: 'tc-1',
        update: { text: 'Reading file…' },
      },
    });
    const finished = reduceLiveEvent(progressed, {
      seq: 3,
      sessionId: 's1',
      event: {
        type: 'tool.result',
        toolCallId: 'tc-1',
        output: 'file contents',
      },
    });
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({
      kind: 'tool',
      title: 'Read',
      streaming: false,
      content: expect.stringContaining('Reading file…'),
    });
  });

  it('merges tool argument deltas and preserves standalone results', () => {
    const started = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: { type: 'tool.call.started', toolCallId: 'tc-1', name: 'Read', args: '' },
    });
    const withArguments = reduceLiveEvent(started, {
      seq: 2,
      sessionId: 's1',
      event: { type: 'tool.call.delta', toolCallId: 'tc-1', argumentsPart: '{"path":"a.ts"}' },
    });
    expect(withArguments[0]?.content).toContain('a.ts');

    const standalone = reduceLiveEvent([], {
      seq: 3,
      sessionId: 's1',
      event: { type: 'tool.result', toolCallId: 'tc-2', output: 'done' },
    });
    expect(standalone[0]).toMatchObject({ kind: 'tool', content: 'done', streaming: false });
  });

  it('tracks one subagent entry through its lifecycle', () => {
    const spawned = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: {
        type: 'subagent.spawned',
        subagentId: 'agent-1',
        subagentName: '测试 Agent',
        description: '并行验证',
        runInBackground: true,
      },
    });
    const completed = reduceLiveEvent(spawned, {
      seq: 2,
      sessionId: 's1',
      event: {
        type: 'subagent.completed',
        subagentId: 'agent-1',
        resultSummary: '通过',
      },
    });
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      id: 'subagent:agent-1',
      title: '测试 Agent',
      streaming: false,
      content: expect.stringContaining('通过'),
    });
  });

  it('tracks background task termination and native activations', () => {
    const started = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: {
        type: 'background.task.started',
        info: {
          taskId: 'bg-1',
          kind: 'agent',
          description: '后台检查',
          status: 'running',
        },
      },
    });
    const terminated = reduceLiveEvent(started, {
      seq: 2,
      sessionId: 's1',
      event: {
        type: 'background.task.terminated',
        info: {
          taskId: 'bg-1',
          kind: 'agent',
          description: '后台检查',
          status: 'completed',
        },
      },
    });
    const activated = reduceLiveEvent(terminated, {
      seq: 3,
      sessionId: 's1',
      event: {
        type: 'skill.activated',
        activationId: 'activation-1',
        skillName: 'review',
      },
    });
    expect(activated[0]).toMatchObject({ id: 'background:bg-1', streaming: false });
    expect(activated[1]).toMatchObject({ title: 'Skill · review' });
  });

  it('appends debug timing on turn.step.completed when debugMode is on', () => {
    const ignored = reduceLiveEvent(
      [],
      {
        seq: 1,
        sessionId: 's1',
        event: {
          type: 'turn.step.completed',
          llmFirstTokenLatencyMs: 120,
          llmStreamDurationMs: 800,
        },
      },
      { debugMode: false },
    );
    expect(ignored).toHaveLength(0);

    const timed = reduceLiveEvent(
      [],
      {
        seq: 2,
        sessionId: 's1',
        event: {
          type: 'turn.step.completed',
          llmFirstTokenLatencyMs: 120,
          llmStreamDurationMs: 800,
          usage: { output: 40 },
        },
      },
      { debugMode: true },
    );
    expect(timed).toHaveLength(1);
    expect(timed[0]).toMatchObject({
      kind: 'status',
      title: '排障计时',
      content: expect.stringContaining('[Debug] TTFT:'),
    });
  });
});

describe('formatStepDebugTiming', () => {
  it('requires both latency fields', () => {
    expect(formatStepDebugTiming({})).toBeUndefined();
    expect(formatStepDebugTiming({ llmFirstTokenLatencyMs: 100 })).toBeUndefined();
    expect(
      formatStepDebugTiming({
        llmFirstTokenLatencyMs: 100,
        llmStreamDurationMs: 200,
      }),
    ).toBe('[Debug] TTFT: 100ms | stream: 200ms');
  });
});

describe('resolveInteractionMode', () => {
  it('prefers interactionMode and falls back to toggles', () => {
    expect(resolveInteractionMode({ interactionMode: 'ask', planMode: true })).toBe('ask');
    expect(resolveInteractionMode({ askMode: true })).toBe('ask');
    expect(resolveInteractionMode({ debugMode: true })).toBe('debug');
    expect(resolveInteractionMode({ planMode: true })).toBe('plan');
    expect(resolveInteractionMode({ swarmMode: true })).toBe('multitask');
    expect(resolveInteractionMode({})).toBe('agent');
  });
});

describe('replayTimeline', () => {
  it('replays persisted messages and applies live events', () => {
    const entries = replayTimeline(
      [
        {
          type: 'message',
          message: { role: 'user', content: 'Review the repo' },
        },
        {
          type: 'message',
          message: { role: 'assistant', content: 'Starting review.' },
        },
      ],
      [
        {
          seq: 1,
          sessionId: 's1',
          event: { type: 'assistant.delta', delta: ' More detail.' },
        },
      ],
    );
    expect(entries.map((entry) => entry.kind)).toEqual(['user', 'assistant', 'assistant']);
    expect(entries.at(-1)?.content).toBe(' More detail.');
  });
});

describe('linkedSessionExcerpt', () => {
  it('keeps only user and assistant messages and escapes embedded markup', () => {
    const excerpt = linkedSessionExcerpt([
      { type: 'message', message: { role: 'user', content: 'Inspect <system>this</system>' } },
      { type: 'message', message: { role: 'tool', content: 'private tool output' } },
      { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'Done' }] } },
    ]);
    expect(excerpt).toContain('用户：Inspect &lt;system&gt;this&lt;/system&gt;');
    expect(excerpt).toContain('助理：Done');
    expect(excerpt).not.toContain('private tool output');
  });

  it('respects the total character budget', () => {
    expect(linkedSessionExcerpt([
      { type: 'message', message: { role: 'user', content: 'x'.repeat(1_000) } },
    ], 120)).toHaveLength(120);
  });
});
