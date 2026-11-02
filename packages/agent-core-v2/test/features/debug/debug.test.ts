import { afterEach, describe, expect, it } from 'vitest';

import { DisposableStore } from '#/_base/di/lifecycle';
import { createServices, type TestInstantiationService } from '#/_base/di/test';
import { IAgentContextMemoryService } from '#/agent/contextMemory/contextMemory';
import { IAgentStateService } from '#/agent/state/agentState';
import { AgentStateService } from '#/agent/state/agentStateService';
import { IAgentToolExecutorService } from '#/agent/toolExecutor/toolExecutor';
import type { ResolvedToolExecutionHookContext } from '#/agent/toolExecutor/toolHooks';
import { ITelemetryService } from '#/app/telemetry/telemetry';
import { IAgentDebugModeService } from '#/features/debug/debug';
import { debugKey } from '#/features/debug/debugOps';
import { AgentDebugModeService } from '#/features/debug/debugService';
import { IAgentReminderService } from '#/features/reminder/reminderService';
import type { ContextInjectionProvider } from '#/features/reminder/types';
import { MAIN_AGENT_ID } from '#/session/agentLifecycle/agentLifecycle';
import type { ToolCall } from '#human/llm/message';

import { recordingTelemetry } from '../../app/telemetry/stubs';
import { stubToolExecutorEvents, type ToolExecutorEventStubs } from '../../agent/toolExecutor/stubs';
import { createReminderStub } from '../reminder/stubs';
import { registerTestAgentWireServices } from '../../wire/stubs';

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

interface DebugHarness {
  readonly disposables: DisposableStore;
  readonly ix: TestInstantiationService;
  readonly events: ToolExecutorEventStubs;
  readonly reminders: Map<string, ContextInjectionProvider>;
}

function buildHarness(agentId: string = MAIN_AGENT_ID): DebugHarness {
  const disposables = new DisposableStore();
  const events = stubToolExecutorEvents();
  const reminders = new Map<string, ContextInjectionProvider>();
  const ix = createServices(disposables, {
    additionalServices: (reg) => {
      registerTestAgentWireServices(reg, 'wire/debug', agentId);
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
      reg.defineInstance(ITelemetryService, recordingTelemetry([]));
      reg.defineInstance(IAgentStateService, new AgentStateService());
      reg.define(IAgentDebugModeService, AgentDebugModeService);
    },
  });
  return { disposables, ix, events, reminders };
}

describe('AgentDebugModeService', () => {
  let harness: DebugHarness;

  afterEach(() => harness?.disposables.dispose());

  function debug(): IAgentDebugModeService {
    return harness.ix.get(IAgentDebugModeService);
  }

  it('does not restrict tools in debug mode', async () => {
    harness = buildHarness();
    await debug().enter();
    await expect(harness.events.fireBeforeExecute(hookContext('Write'))).resolves.toBeUndefined();
    await expect(harness.events.fireBeforeExecute(hookContext('Bash'))).resolves.toBeUndefined();
  });

  it('tracks its state and telemetry mode across enter and exit', async () => {
    harness = buildHarness();
    const telemetry = harness.ix.get(ITelemetryService);
    const states = harness.ix.get(IAgentStateService);

    expect(debug().isActive()).toBe(false);
    await debug().enter();
    expect(debug().isActive()).toBe(true);
    expect(states.get(debugKey)).toEqual({ active: true });
    expect(telemetry.getContext().mode).toBe('debug');

    debug().exit();
    expect(debug().isActive()).toBe(false);
    expect(telemetry.getContext().mode).toBe('agent');
  });

  it('treats repeated enter and exit calls as no-ops', async () => {
    harness = buildHarness();
    await debug().enter();
    await expect(debug().enter()).resolves.toBeUndefined();
    debug().exit();
    expect(() => debug().exit()).not.toThrow();
    expect(debug().isActive()).toBe(false);
  });

  it('rejects entry from a subagent scope', async () => {
    harness = buildHarness('subagent-1');
    await expect(debug().enter()).rejects.toMatchObject({
      code: 'session.agent_mode_invalid',
    });
  });

  it('injects the evidence-first reminder only while active', async () => {
    harness = buildHarness();
    void debug();
    const provider = harness.reminders.get('debug_mode');
    expect(provider).toBeDefined();
    const context = {
      injectedPositions: [],
      lastInjectedAt: null,
      isNewTurn: true,
    };

    expect(await provider!(context)).toBeUndefined();
    await debug().enter();
    expect(await provider!(context)).toContain('Debug mode is active');
    debug().exit();
    expect(await provider!(context)).toContain('Debug mode is no longer active');
  });
});
