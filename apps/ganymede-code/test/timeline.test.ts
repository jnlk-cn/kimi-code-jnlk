import { describe, expect, it } from 'vitest';

import {
  formatStepDebugTiming,
  isFrameBatchedTimelineEvent,
  reduceLiveEvent,
  replayTimeline,
} from '../src/renderer/timeline';
import {
  initialTimelineWindowStart,
  isTimelineNearBottom,
  previousTimelineWindowStart,
  resolveVisibleTurnId,
  scrollTimelineToBottom,
  scrollTimelineToElement,
  stagedTimelineWindowStart,
  shouldTimelineAutoScroll,
  timelineWindowStartForIndex,
  timelineDistanceFromBottom,
} from '../src/renderer/timeline-scroll';
import { createFrameCommitScheduler } from '../src/renderer/timeline-frame-scheduler';
import { patchStatusFromEvent } from '../src/renderer/session-event-state';
import { computeToolChangeStats } from '../src/renderer/tool-change-stats';
import { resolveInteractionMode, type SessionStatusView } from '../src/shared/contracts';
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

  it('keeps ExitPlanMode title and plan args through the tool lifecycle', () => {
    const started = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: {
        type: 'tool.call.started',
        toolCallId: 'exit-1',
        name: 'ExitPlanMode',
        args: { plan: '# Build it' },
      },
    });
    expect(started[0]).toMatchObject({
      title: 'ExitPlanMode',
      toolArgs: { plan: '# Build it' },
      streaming: true,
    });
    const finished = reduceLiveEvent(started, {
      seq: 2,
      sessionId: 's1',
      event: {
        type: 'tool.result',
        toolCallId: 'exit-1',
        output: 'Exited plan mode.\n\n## Approved Plan:\n# Build it',
      },
    });
    expect(finished[0]).toMatchObject({
      title: 'ExitPlanMode',
      toolArgs: { plan: '# Build it' },
      streaming: false,
      content: expect.stringContaining('## Approved Plan:'),
    });
  });

  it('preserves tool args for write and edit change stats', () => {
    const write = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: {
        type: 'tool.call.started',
        toolCallId: 'tc-write',
        name: 'Write',
        args: { path: 'a.ts', content: 'line1\nline2\n' },
      },
    });
    expect(computeToolChangeStats(write[0]?.title, write[0]?.toolArgs)).toEqual({
      additions: 2,
      deletions: 0,
    });

    const edit = reduceLiveEvent([], {
      seq: 2,
      sessionId: 's1',
      event: {
        type: 'tool.call.started',
        toolCallId: 'tc-edit',
        name: 'Edit',
        args: { path: 'a.ts', old_string: 'alpha\nbeta', new_string: 'alpha\ngamma' },
      },
    });
    expect(computeToolChangeStats(edit[0]?.title, edit[0]?.toolArgs)).toEqual({
      additions: 1,
      deletions: 1,
    });

    const finished = reduceLiveEvent(edit, {
      seq: 3,
      sessionId: 's1',
      event: {
        type: 'tool.result',
        toolCallId: 'tc-edit',
        output: 'Updated a.ts',
      },
    });
    expect(finished[0]?.toolArgs).toMatchObject({
      old_string: 'alpha\nbeta',
      new_string: 'alpha\ngamma',
    });
  });

  it('parses streamed tool args from deltas', () => {
    const started = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: { type: 'tool.call.started', toolCallId: 'tc-1', name: 'Write', args: '' },
    });
    const withArguments = reduceLiveEvent(started, {
      seq: 2,
      sessionId: 's1',
      event: {
        type: 'tool.call.delta',
        toolCallId: 'tc-1',
        argumentsPart: '{"path":"a.ts","content":"one\\ntwo"}',
      },
    });
    expect(withArguments[0]?.toolArgs).toMatchObject({ path: 'a.ts', content: 'one\ntwo' });
    expect(computeToolChangeStats(withArguments[0]?.title, withArguments[0]?.toolArgs)).toEqual({
      additions: 2,
      deletions: 0,
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
    expect(withArguments[0]?.toolArgs).toMatchObject({ path: 'a.ts' });

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

  it('hides engineering-bootstrap skill.activated events', () => {
    const entries = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: {
        type: 'skill.activated',
        activationId: 'activation-bootstrap',
        skillName: 'using-kimicodeboost',
        trigger: 'engineering-bootstrap',
      },
    });
    expect(entries).toHaveLength(0);
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

  it('does not reopen a finalized tool when live tool.call.started is replayed', () => {
    const finalized = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: {
        type: 'tool.call.started',
        toolCallId: 'tc-browser',
        name: 'GanymedeBrowser',
        args: { action: 'inspect' },
      },
    });
    const completed = reduceLiveEvent(finalized, {
      seq: 2,
      sessionId: 's1',
      event: {
        type: 'tool.result',
        toolCallId: 'tc-browser',
        output: '{"url":"http://localhost:3000"}',
      },
    });
    const replayed = reduceLiveEvent(completed, {
      seq: 3,
      sessionId: 's1',
      event: {
        type: 'tool.call.started',
        toolCallId: 'tc-browser',
        name: 'GanymedeBrowser',
        args: { action: 'inspect' },
      },
    });
    expect(replayed).toHaveLength(1);
    expect(replayed[0]).toMatchObject({
      title: 'GanymedeBrowser',
      streaming: false,
    });
  });

  it('finalizes every duplicate tool entry for the same tool call id', () => {
    const duplicate = [
      {
        id: 'tool:tc-dup',
        kind: 'tool' as const,
        title: 'GanymedeBrowser',
        content: '{"action":"inspect"}',
        toolCallId: 'tc-dup',
        streaming: false,
      },
      {
        id: 'tool:tc-dup:ghost',
        kind: 'tool' as const,
        title: 'GanymedeBrowser',
        content: '{"action":"inspect"}',
        toolCallId: 'tc-dup',
        streaming: true,
      },
    ];
    const finished = reduceLiveEvent(duplicate, {
      seq: 1,
      sessionId: 's1',
      event: {
        type: 'tool.result',
        toolCallId: 'tc-dup',
        output: '{"url":"http://localhost:3000"}',
      },
    });
    expect(finished).toHaveLength(2);
    expect(finished.every((entry) => entry.streaming === false)).toBe(true);
  });
});

describe('timeline frame scheduling', () => {
  it('commits only the latest streamed state once per frame', () => {
    let frameCallback: FrameRequestCallback | undefined;
    let requestCount = 0;
    const cancelled: number[] = [];
    const commits: number[] = [];
    const scheduler = createFrameCommitScheduler<number>((value) => commits.push(value), {
      request(callback) {
        requestCount += 1;
        frameCallback = callback;
        return requestCount;
      },
      cancel(handle) {
        cancelled.push(handle);
      },
    });

    scheduler.schedule(1);
    scheduler.schedule(2);
    scheduler.schedule(3);
    expect(requestCount).toBe(1);
    expect(commits).toEqual([]);

    frameCallback?.(16);
    expect(commits).toEqual([3]);
    expect(scheduler.pending()).toBe(false);

    scheduler.schedule(4);
    scheduler.commitNow(5);
    expect(commits).toEqual([3, 5]);
    expect(cancelled).toContain(2);

    scheduler.schedule(6);
    scheduler.flush();
    expect(commits).toEqual([3, 5, 6]);
    expect(scheduler.pending()).toBe(false);
  });

  it('flushes all pending delta content before a semantic end event', () => {
    let frameCallback: FrameRequestCallback | undefined;
    let rendered: ReturnType<typeof reduceLiveEvent> = [];
    let canonical = rendered;
    const scheduler = createFrameCommitScheduler<typeof canonical>((value) => {
      rendered = value;
    }, {
      request(callback) {
        frameCallback = callback;
        return 1;
      },
      cancel() {
        frameCallback = undefined;
      },
    });

    for (const [index, delta] of ['A', 'B', 'C'].entries()) {
      canonical = reduceLiveEvent(canonical, {
        seq: index + 1,
        sessionId: 's1',
        event: { type: 'assistant.delta', delta },
      });
      scheduler.schedule(canonical);
    }
    canonical = reduceLiveEvent(canonical, {
      seq: 4,
      sessionId: 's1',
      event: { type: 'turn.ended' },
    });
    scheduler.commitNow(canonical);

    expect(frameCallback).toBeUndefined();
    expect(rendered[0]).toMatchObject({ content: 'ABC', streaming: false });
  });

  it('cancels a pending session frame without committing stale content', () => {
    const cancelled: number[] = [];
    const commits: string[] = [];
    const scheduler = createFrameCommitScheduler<string>((value) => commits.push(value), {
      request() {
        return 9;
      },
      cancel(handle) {
        cancelled.push(handle);
      },
    });

    scheduler.schedule('old session');
    scheduler.cancel();

    expect(scheduler.pending()).toBe(false);
    expect(cancelled).toEqual([9]);
    expect(commits).toEqual([]);
  });

  it('preserves 500 ordered deltas while limiting React commits to frames', () => {
    let frameCallback: FrameRequestCallback | undefined;
    let requestCount = 0;
    let rendered = reduceLiveEvent([], {
      seq: 0,
      sessionId: 's1',
      event: { type: 'turn.started' },
    });
    let canonical = rendered;
    const scheduler = createFrameCommitScheduler<typeof canonical>((value) => {
      rendered = value;
    }, {
      request(callback) {
        requestCount += 1;
        frameCallback = callback;
        return requestCount;
      },
      cancel() {},
    });

    for (let index = 0; index < 500; index += 1) {
      const envelope = {
        seq: index + 1,
        sessionId: 's1',
        event: { type: 'assistant.delta', delta: String(index % 10) },
      } as const;
      canonical = reduceLiveEvent(canonical, envelope);
      expect(isFrameBatchedTimelineEvent(envelope.event)).toBe(true);
      scheduler.schedule(canonical);
    }

    expect(requestCount).toBe(1);
    expect(rendered).toHaveLength(0);
    frameCallback?.(16);
    expect(rendered[0]?.content).toBe(
      Array.from({ length: 500 }, (_, index) => String(index % 10)).join(''),
    );
  });
});

describe('timeline render window', () => {
  it('starts at the newest batch and expands in stable batches', () => {
    expect(initialTimelineWindowStart(20)).toBe(0);
    expect(initialTimelineWindowStart(205)).toBe(125);
    expect(stagedTimelineWindowStart(205)).toBe(197);
    expect(stagedTimelineWindowStart(12)).toBe(4);
    expect(previousTimelineWindowStart(125)).toBe(45);
    expect(previousTimelineWindowStart(45)).toBe(0);
    expect(timelineWindowStartForIndex(90, 125)).toBe(80);
    expect(timelineWindowStartForIndex(180, 125)).toBe(125);
  });
});

describe('patchStatusFromEvent', () => {
  const status: SessionStatusView = {
    running: true,
    permission: 'manual',
    interactionMode: 'agent',
    planMode: false,
    swarmMode: false,
    askMode: false,
    debugMode: false,
    engineeringMode: false,
    contextTokens: 100,
    maxContextTokens: 1_000,
  };

  it('preserves object identity for events with no status change', () => {
    expect(patchStatusFromEvent(status, { type: 'assistant.delta', delta: 'x' })).toBe(status);
    expect(patchStatusFromEvent(status, { type: 'turn.started' })).toBe(status);
    expect(patchStatusFromEvent(status, {
      type: 'agent.status.updated',
      permission: 'manual',
      contextTokens: 100,
      maxContextTokens: 1_000,
    })).toBe(status);
  });

  it('returns a new status only for an actual patch', () => {
    const ended = patchStatusFromEvent(status, { type: 'turn.ended' });
    expect(ended).not.toBe(status);
    expect(ended.running).toBe(false);
  });
});

describe('timeline no-op identity', () => {
  it('returns the original timeline for events that do not change transcript state', () => {
    const current = [{ id: 'assistant:1', kind: 'assistant' as const, content: 'done' }];
    expect(reduceLiveEvent(current, {
      seq: 2,
      sessionId: 's1',
      event: { type: 'agent.status.updated', permission: 'manual' },
    })).toBe(current);
    expect(reduceLiveEvent(current, {
      seq: 3,
      sessionId: 's1',
      event: { type: 'turn.ended' },
    })).toBe(current);
    expect(reduceLiveEvent(current, {
      seq: 4,
      sessionId: 's1',
      event: { type: 'tool.call.delta', toolCallId: 'missing', argumentsPart: '{}' },
    })).toBe(current);
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
    expect(resolveInteractionMode({ engineeringMode: true })).toBe('engineering');
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

  it('skips injection origin user messages such as swarm reminders', () => {
    const entries = replayTimeline(
      [
        {
          type: 'message',
          message: {
            role: 'user',
            content: '<system-reminder>\n## Swarm Mode\n</system-reminder>',
            origin: { kind: 'injection', variant: 'swarm_mode' },
          },
        },
        {
          type: 'message',
          message: { role: 'user', content: 'Split the work', origin: { kind: 'user' } },
        },
      ],
      [],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'user', content: 'Split the work' });
  });

  it('skips engineering-bootstrap skill activations but keeps user-slash ones', () => {
    const entries = replayTimeline(
      [
        {
          type: 'message',
          message: {
            role: 'user',
            content: 'Engineering mode preloaded this skill.',
            origin: {
              kind: 'skill_activation',
              skillName: 'using-kimicodeboost',
              trigger: 'engineering-bootstrap',
            },
          },
        },
        {
          type: 'message',
          message: {
            role: 'user',
            content: 'User activated the skill "brainstorming".',
            origin: {
              kind: 'skill_activation',
              skillName: 'brainstorming',
              trigger: 'user-slash',
            },
          },
        },
      ],
      [],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'user',
      content: 'User activated the skill "brainstorming".',
    });
  });

  it('merges tool results into the matching tool call and summarizes AgentSwarm', () => {
    const entries = replayTimeline(
      [
        {
          type: 'message',
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                id: 'call_swarm',
                function: {
                  name: 'AgentSwarm',
                  arguments: JSON.stringify({
                    description: 'parallel checks',
                    items: ['a', 'b'],
                    prompt_template: 'do {{item}}',
                  }),
                },
              },
            ],
          },
        },
        {
          type: 'message',
          message: {
            role: 'tool',
            toolCallId: 'call_swarm',
            content:
              '<agent_swarm_result>\n<subagent index="1" outcome="completed">ok</subagent>\n<subagent index="2" outcome="failed">boom</subagent>\n</agent_swarm_result>',
          },
        },
      ],
      [],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'tool',
      title: 'AgentSwarm',
      content: '1 完成 · 1 失败',
      error: false,
    });
    expect(entries[0]?.content).not.toContain('<agent_swarm_result>');
  });

  it('does not leave ghost running tools when replay and live events overlap', () => {
    const entries = replayTimeline(
      [
        {
          type: 'message',
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                id: 'tc-browser',
                function: {
                  name: 'GanymedeBrowser',
                  arguments: JSON.stringify({ action: 'inspect' }),
                },
              },
            ],
          },
        },
        {
          type: 'message',
          message: {
            role: 'tool',
            toolCallId: 'tc-browser',
            content: '{"url":"http://localhost:3000"}',
          },
        },
      ],
      [
        {
          seq: 1,
          sessionId: 's1',
          event: {
            type: 'tool.call.started',
            toolCallId: 'tc-browser',
            name: 'GanymedeBrowser',
            args: { action: 'inspect' },
          },
        },
        {
          seq: 2,
          sessionId: 's1',
          event: {
            type: 'tool.result',
            toolCallId: 'tc-browser',
            output: '{"url":"http://localhost:3000"}',
          },
        },
        {
          seq: 3,
          sessionId: 's1',
          event: { type: 'turn.ended', turnId: 1 },
        },
      ],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'tool',
      title: 'GanymedeBrowser',
      streaming: false,
    });
  });
});

describe('reduceLiveEvent AgentSwarm', () => {
  it('suppresses foreground swarm subagents from the timeline', () => {
    const started = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: {
        type: 'tool.call.started',
        toolCallId: 'call_swarm',
        name: 'AgentSwarm',
        args: { description: 'work', items: ['a', 'b'] },
      },
    });
    const spawned = reduceLiveEvent(started, {
      seq: 2,
      sessionId: 's1',
      event: {
        type: 'subagent.spawned',
        subagentId: 'agent-1',
        subagentName: 'coder',
        parentToolCallId: 'call_swarm',
        runInBackground: false,
        swarmIndex: 1,
      },
    });
    expect(spawned).toHaveLength(1);
    expect(spawned.every((entry) => entry.kind !== 'subagent')).toBe(true);
  });

  it('does not append child-agent assistant deltas into the main transcript', () => {
    const main = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: { type: 'assistant.delta', agentId: 'main', delta: '编排中' },
    });
    const polluted = reduceLiveEvent(main, {
      seq: 2,
      sessionId: 's1',
      event: {
        type: 'assistant.delta',
        agentId: 'child-1',
        delta: '帮我写个有按钮和数字，按一次就+2的htm',
      },
    });
    expect(polluted).toHaveLength(1);
    expect(polluted[0]?.content).toBe('编排中');
    expect(polluted[0]?.content).not.toContain('+2');
  });

  it('keeps Agent tool entry without a separate foreground subagent row', () => {
    const started = reduceLiveEvent([], {
      seq: 1,
      sessionId: 's1',
      event: {
        type: 'tool.call.started',
        toolCallId: 'call_agent',
        name: 'Agent',
        args: { description: 'build page' },
      },
    });
    const spawned = reduceLiveEvent(started, {
      seq: 2,
      sessionId: 's1',
      event: {
        type: 'subagent.spawned',
        subagentId: 'child-1',
        subagentName: 'builder',
        parentToolCallId: 'call_agent',
        runInBackground: false,
      },
    });
    const withChildDelta = reduceLiveEvent(spawned, {
      seq: 3,
      sessionId: 's1',
      event: {
        type: 'assistant.delta',
        agentId: 'child-1',
        delta: 'draft',
      },
    });
    expect(withChildDelta).toHaveLength(1);
    expect(withChildDelta[0]).toMatchObject({ kind: 'tool', title: 'Agent' });
    expect(withChildDelta.every((entry) => entry.kind !== 'subagent')).toBe(true);
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

describe('timeline scroll helpers', () => {
  it('detects when the viewport is near the bottom', () => {
    const nearBottom = {
      scrollTop: 880,
      scrollHeight: 1000,
      clientHeight: 100,
    };
    const farFromBottom = {
      scrollTop: 100,
      scrollHeight: 1000,
      clientHeight: 100,
    };

    expect(isTimelineNearBottom(nearBottom)).toBe(true);
    expect(isTimelineNearBottom(farFromBottom)).toBe(false);
  });

  it('skips redundant scroll-to-bottom when already at the bottom', () => {
    let scrollTop = 900;
    const scrollable = {
      get scrollTop() {
        return scrollTop;
      },
      set scrollTop(value: number) {
        scrollTop = value;
      },
      scrollHeight: 1000,
      clientHeight: 100,
    };
    expect(timelineDistanceFromBottom(scrollable)).toBe(0);
    scrollTimelineToBottom(scrollable as unknown as HTMLElement);
    expect(scrollable.scrollTop).toBe(900);

    scrollTop = 100;
    scrollTimelineToBottom(scrollable as unknown as HTMLElement);
    expect(scrollable.scrollTop).toBe(1000);
  });

  it('auto-scrolls only when pinned or the user just sent a message', () => {
    expect(shouldTimelineAutoScroll({
      pinnedToBottom: true,
      previousLength: 2,
      currentLength: 2,
      lastEntryKind: 'assistant',
    })).toBe(true);

    expect(shouldTimelineAutoScroll({
      pinnedToBottom: false,
      previousLength: 2,
      currentLength: 2,
      lastEntryKind: 'assistant',
    })).toBe(false);

    expect(shouldTimelineAutoScroll({
      pinnedToBottom: false,
      previousLength: 2,
      currentLength: 3,
      lastEntryKind: 'user',
    })).toBe(true);
  });

  it('scrolls a target into the timeline container without using document scroll', () => {
    let scrollTop = 40;
    const container = {
      scrollTop,
      getBoundingClientRect: () => ({ top: 100, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }),
      scrollTo(options: ScrollToOptions) {
        scrollTop = Number(options.top ?? 0);
        this.scrollTop = scrollTop;
      },
    };
    Object.defineProperty(container, 'scrollTop', {
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
      configurable: true,
    });
    const target = {
      getBoundingClientRect: () => ({ top: 260, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }),
    };

    scrollTimelineToElement(
      container as unknown as HTMLElement,
      target as unknown as HTMLElement,
      { behavior: 'smooth', offset: 12 },
    );
    // scrollTop(40) + (target.top 260 - container.top 100) - offset 12 = 188
    expect(scrollTop).toBe(188);
  });

  it('resolves the visible turn from the probe line', () => {
    const container = {
      getBoundingClientRect: () => ({
        top: 100,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    } as unknown as HTMLElement;
    const anchors = new Map<string, HTMLElement>([
      [
        'turn-a',
        {
          getBoundingClientRect: () => ({
            top: 120,
            left: 0,
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }),
        } as unknown as HTMLElement,
      ],
      [
        'turn-b',
        {
          getBoundingClientRect: () => ({
            top: 200,
            left: 0,
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }),
        } as unknown as HTMLElement,
      ],
      [
        'turn-c',
        {
          getBoundingClientRect: () => ({
            top: 320,
            left: 0,
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }),
        } as unknown as HTMLElement,
      ],
    ]);
    const lookup = (id: string) => anchors.get(id) ?? null;
    const turnAnchorId = (id: string) => `turn-${id}`;

    expect(resolveVisibleTurnId(container, [], turnAnchorId, 80, lookup)).toBeUndefined();
    expect(resolveVisibleTurnId(container, ['a'], turnAnchorId, 80, lookup)).toBe('a');
    // probe at 100 + 80 = 180 → only turn-a (120) has crossed
    expect(resolveVisibleTurnId(container, ['a', 'b', 'c'], turnAnchorId, 80, lookup)).toBe('a');

    // Move turn-b above the probe
    anchors.set(
      'turn-b',
      {
        getBoundingClientRect: () => ({
          top: 160,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      } as unknown as HTMLElement,
    );
    expect(resolveVisibleTurnId(container, ['a', 'b', 'c'], turnAnchorId, 80, lookup)).toBe('b');

    // All anchors below probe → fallback to first
    for (const id of ['turn-a', 'turn-b', 'turn-c']) {
      anchors.set(
        id,
        {
          getBoundingClientRect: () => ({
            top: 300,
            left: 0,
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }),
        } as unknown as HTMLElement,
      );
    }
    expect(resolveVisibleTurnId(container, ['a', 'b', 'c'], turnAnchorId, 80, lookup)).toBe('a');
  });
});

describe('estimateReplayIndexContextChars', () => {
  it('sums ganymede_codebase_context blocks from user replay messages', async () => {
    const { estimateReplayIndexContextChars } = await import('../src/renderer/index-replay-context');
    const block = '<ganymede_codebase_context>\nfoo\n</ganymede_codebase_context>';
    const replay = [
      {
        type: 'message',
        message: { role: 'user', content: `hello\n\n${block}` },
      },
      {
        type: 'message',
        message: { role: 'assistant', content: 'ok' },
      },
    ];
    expect(estimateReplayIndexContextChars(replay)).toBe(block.length);
  });
});
