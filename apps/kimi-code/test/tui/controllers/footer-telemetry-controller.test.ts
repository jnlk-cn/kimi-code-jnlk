import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentStatusUpdatedEvent, FooterTelemetry, TurnStepCompletedEvent } from '@moonshot-ai/kimi-code-sdk';

import type { FooterComponent } from '#/tui/components/chrome/footer';
import { FooterTelemetryController } from '#/tui/controllers/footer-telemetry-controller';
import type { AppState } from '#/tui/types';

const balanceMocks = vi.hoisted(() => ({ loadDeepSeekBalance: vi.fn() }));

vi.mock('#/utils/usage/deepseek-balance', () => ({
  loadDeepSeekBalance: balanceMocks.loadDeepSeekBalance,
}));

const DEEPSEEK_STATE = {
  model: 'deepseek-chat',
  availableModels: { 'deepseek-chat': { provider: 'deepseek', model: 'deepseek-chat' } },
  availableProviders: { deepseek: { type: 'openai', baseUrl: 'https://api.deepseek.com' } },
} as unknown as AppState;

const OTHER_STATE = {
  model: 'kimi-k2',
  availableModels: { 'kimi-k2': { provider: 'moonshot', model: 'kimi-k2' } },
  availableProviders: { moonshot: { type: 'openai', baseUrl: 'https://api.moonshot.cn' } },
} as unknown as AppState;

interface FakeFooter {
  readonly setTelemetry: ReturnType<typeof vi.fn>;
  latest(): FooterTelemetry;
}

function fakeFooter(): FakeFooter {
  let current: FooterTelemetry | undefined;
  const setTelemetry = vi.fn((telemetry: FooterTelemetry) => {
    current = telemetry;
  });
  return {
    setTelemetry,
    latest(): FooterTelemetry {
      if (current === undefined) throw new Error('footer never received telemetry');
      return current;
    },
  };
}

function stepEvent(usage: NonNullable<TurnStepCompletedEvent['usage']>): TurnStepCompletedEvent {
  return { usage } as TurnStepCompletedEvent;
}

function statusEvent(
  total: NonNullable<NonNullable<AgentStatusUpdatedEvent['usage']>['total']>,
): AgentStatusUpdatedEvent {
  return { usage: { total } } as AgentStatusUpdatedEvent;
}

describe('FooterTelemetryController', () => {
  beforeEach(() => {
    balanceMocks.loadDeepSeekBalance.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('accumulates step usage, cache hits, and the estimated DeepSeek cost', () => {
    const footer = fakeFooter();
    const controller = new FooterTelemetryController(
      () => footer as unknown as FooterComponent,
      () => DEEPSEEK_STATE,
      () => {},
    );

    controller.onStepCompleted(
      stepEvent({ inputCacheRead: 800, inputOther: 200, inputCacheCreation: 0, output: 100 }),
    );

    const telemetry = footer.latest();
    expect(telemetry.billingEnabled).toBe(true);
    expect(telemetry.sessionInput).toBe(1_000);
    expect(telemetry.sessionOutput).toBe(100);
    expect(telemetry.sessionCacheHit).toBe(800);
    expect(telemetry.sessionCacheMiss).toBe(200);
    expect(telemetry.estimatedCostCny).toBeGreaterThan(0);

    controller.dispose();
  });

  it('keeps cost out of models that do not run on DeepSeek', () => {
    const footer = fakeFooter();
    const controller = new FooterTelemetryController(
      () => footer as unknown as FooterComponent,
      () => OTHER_STATE,
      () => {},
    );

    controller.onStepCompleted(stepEvent({ inputCacheRead: 0, inputOther: 500, inputCacheCreation: 0, output: 50 }));

    const telemetry = footer.latest();
    expect(telemetry.billingEnabled).toBe(false);
    expect(telemetry.sessionCacheHit).toBe(0);
    expect(telemetry.estimatedCostCny).toBe(0);
    expect(telemetry.sessionInput).toBe(500);
    expect(telemetry.sessionOutput).toBe(50);

    controller.dispose();
  });

  it('reconciles the session totals from a status update before any step lands', () => {
    const footer = fakeFooter();
    const controller = new FooterTelemetryController(
      () => footer as unknown as FooterComponent,
      () => DEEPSEEK_STATE,
      () => {},
    );

    controller.onStatusUpdate(
      statusEvent({ inputCacheRead: 400, inputOther: 600, inputCacheCreation: 0, output: 250 }),
    );

    const telemetry = footer.latest();
    expect(telemetry.sessionInput).toBe(1_000);
    expect(telemetry.sessionOutput).toBe(250);
    expect(telemetry.sessionCacheHit).toBe(400);
    expect(telemetry.estimatedCostCny).toBeGreaterThan(0);

    controller.dispose();
  });

  it('polls the balance on the provider cadence and stops after dispose', async () => {
    vi.useFakeTimers();
    balanceMocks.loadDeepSeekBalance.mockResolvedValue({
      balance: { totalCny: '12.34', grantedCny: '1', toppedUpCny: '11.34', available: true },
    });
    const footer = fakeFooter();
    const controller = new FooterTelemetryController(
      () => footer as unknown as FooterComponent,
      () => DEEPSEEK_STATE,
      () => {},
    );

    controller.syncProviderContext();
    await vi.advanceTimersByTimeAsync(0);
    expect(balanceMocks.loadDeepSeekBalance).toHaveBeenCalledTimes(1);
    expect(footer.latest().balanceCny).toBe('12.34');

    await vi.advanceTimersByTimeAsync(300_000);
    expect(balanceMocks.loadDeepSeekBalance).toHaveBeenCalledTimes(2);

    controller.dispose();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(balanceMocks.loadDeepSeekBalance).toHaveBeenCalledTimes(2);
  });
});
