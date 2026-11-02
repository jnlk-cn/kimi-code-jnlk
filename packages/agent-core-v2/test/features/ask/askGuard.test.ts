import { afterEach, describe, expect, it } from 'vitest';

import { DisposableStore } from '#/_base/di/lifecycle';
import { createServices, type TestInstantiationService } from '#/_base/di/test';
import { IAgentContextMemoryService } from '#/agent/contextMemory/contextMemory';
import { IAgentStateService } from '#/agent/state/agentState';
import { AgentStateService } from '#/agent/state/agentStateService';
import { IAgentToolApprovalService } from '#/agent/toolApproval/toolApproval';
import { IAgentToolExecutorService } from '#/agent/toolExecutor/toolExecutor';
import { ITelemetryService } from '#/app/telemetry/telemetry';
import { IAgentAskModeService } from '#/features/ask/ask';
import { askKey } from '#/features/ask/askOps';
import { AgentAskModeService } from '#/features/ask/askService';
import { IAgentReminderService } from '#/features/reminder/reminderService';
import type { ContextInjectionProvider } from '#/features/reminder/types';
import { MAIN_AGENT_ID } from '#/session/agentLifecycle/agentLifecycle';
import type { ToolCall } from '#human/llm/message';

import type { BeforeExecuteDecision, ResolvedToolExecutionHookContext } from '#/agent/toolExecutor/toolHooks';
import { recordingTelemetry } from '../../app/telemetry/stubs';
import { stubToolExecutorEvents, type ToolExecutorEventStubs } from '../../agent/toolExecutor/stubs';
import { createReminderStub } from '../reminder/stubs';
import { registerTestAgentWireServices } from '../../wire/stubs';

const READ_ONLY_TOOLS = [
  'Read',
  'ReadMediaFile',
  'Glob',
  'Grep',
  'WebSearch',
  'FetchURL',
  'NotifyUser',
  'AskUserQuestion',
  'TodoList',
  'TaskList',
  'TaskOutput',
  'WaitFor',
  'GetGoal',
] as const;

const BLOCKED_TOOLS = [
  'Write',
  'Edit',
  'Bash',
  'Agent',
  'TaskStop',
  'CronCreate',
  'CronDelete',
  'ExitPlanMode',
  'mcp__github__create_issue',
] as const;

function hookContext(toolName: string): ResolvedToolExecutionHookContext {
  const call: ToolCall = {
    type: 'function',
    id: `call_${toolName.toLowerCase()}`,
    name: toolName,
    arguments: '{}',
  };
  return {
    turnId: 0,
    signal: new AbortController().signal,
    toolCall: call,
    toolCalls: [call],
    args: {},
    execution: {
      approvalRule: toolName,
      execute: async () => ({ output: '' }),
    },
  };
}

interface AskHarness {
  readonly disposables: DisposableStore;
  readonly ix: TestInstantiationService;
  readonly events: ToolExecutorEventStubs;
  readonly reminders: Map<string, ContextInjectionProvider>;
}

function buildHarness(agentId: string = MAIN_AGENT_ID): AskHarness {
  const disposables = new DisposableStore();
  const events = stubToolExecutorEvents();
  const reminders = new Map<string, ContextInjectionProvider>();
  let ix: TestInstantiationService | undefined;
  ix = createServices(disposables, {
    additionalServices: (reg) => {
      registerTestAgentWireServices(reg, 'wire/ask', agentId);
      reg.definePartialInstance(IAgentContextMemoryService, {});
      reg.defineInstance(
        IAgentReminderService,
        createReminderStub({
          register: (variant, provider) => {
            reminders.set(variant, provider as ContextInjectionProvider);
            return { dispose: () => {} };
          },
        }),
      );
      reg.defineInstance(IAgentToolExecutorService, events.executor);
      reg.defineInstance(IAgentToolApprovalService, {
        _serviceBrand: undefined,
        resolvePermissionResolution: async () => undefined,
        requestToolApproval: async () => undefined,
        formatDenyMessage: (message: string) => `DENIED: ${message}`,
        formatApprovalRejectionMessage: () => 'rejected',
      });
      reg.defineInstance(ITelemetryService, recordingTelemetry([]));
      reg.defineInstance(IAgentStateService, new AgentStateService());
      reg.define(IAgentAskModeService, AgentAskModeService);
    },
  });
  return { disposables, ix, events, reminders };
}

describe('AgentAskModeService', () => {
  let harness: AskHarness;

  afterEach(() => harness?.disposables.dispose());

  function ask(): IAgentAskModeService {
    return harness.ix.get(IAgentAskModeService);
  }

  function run(toolName: string): Promise<BeforeExecuteDecision | undefined> {
    return harness.events.fireBeforeExecute(hookContext(toolName));
  }

  it('does not guard tool calls while inactive', async () => {
    harness = buildHarness();
    await expect(run('Write')).resolves.toBeUndefined();
    await expect(run('Bash')).resolves.toBeUndefined();
  });

  it('allows read-only tools while active', async () => {
    harness = buildHarness();
    await ask().enter();
    for (const name of READ_ONLY_TOOLS) {
      await expect(run(name)).resolves.toBeUndefined();
    }
  });

  it('denies every mutating tool while active', async () => {
    harness = buildHarness();
    await ask().enter();
    for (const name of BLOCKED_TOOLS) {
      const decision = await run(name);
      expect(decision?.veto).toEqual({
        output: expect.stringContaining(`Ask mode is read-only, so ${name} is not available.`),
        isError: true,
      });
    }
  });

  it('tracks its state and telemetry mode across enter and exit', async () => {
    harness = buildHarness();
    const telemetry = harness.ix.get(ITelemetryService);
    const states = harness.ix.get(IAgentStateService);

    expect(ask().isActive()).toBe(false);
    await ask().enter();
    expect(ask().isActive()).toBe(true);
    expect(states.get(askKey)).toEqual({ active: true });
    expect(telemetry.getContext().mode).toBe('ask');

    ask().exit();
    expect(ask().isActive()).toBe(false);
    expect(telemetry.getContext().mode).toBe('agent');
  });

  it('treats repeated enter and exit calls as no-ops', async () => {
    harness = buildHarness();
    await ask().enter();
    await expect(ask().enter()).resolves.toBeUndefined();
    ask().exit();
    expect(() => ask().exit()).not.toThrow();
    expect(ask().isActive()).toBe(false);
  });

  it('rejects entry from a subagent scope', async () => {
    harness = buildHarness('subagent-1');
    await expect(ask().enter()).rejects.toMatchObject({
      code: 'session.agent_mode_invalid',
    });
  });

  it('injects the ask reminder only while active', async () => {
    harness = buildHarness();
    void ask();
    const provider = harness.reminders.get('ask_mode');
    expect(provider).toBeDefined();
    const context = {
      injectedPositions: [],
      lastInjectedAt: null,
      isNewTurn: true,
    };

    expect(await provider!(context)).toBeUndefined();
    await ask().enter();
    expect(await provider!(context)).toContain('Ask mode is active');
    ask().exit();
    expect(await provider!(context)).toContain('Ask mode is no longer active');
  });
});
