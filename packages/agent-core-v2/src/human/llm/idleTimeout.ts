import type { LlmErrorMessage } from '#/llm/response';

export const LLM_STREAM_IDLE_TIMEOUT_ENV = 'KIMI_CODE_LLM_STREAM_IDLE_TIMEOUT_MS';

export const DEFAULT_LLM_STREAM_IDLE_TIMEOUT_MS = 120_000;

export function resolveLlmStreamIdleTimeoutMs(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env[LLM_STREAM_IDLE_TIMEOUT_ENV];
  if (raw === undefined || raw.trim() === '') return DEFAULT_LLM_STREAM_IDLE_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `${LLM_STREAM_IDLE_TIMEOUT_ENV} must be a non-negative integer, got ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

export function llmStreamIdleTimeoutError(timeoutMs: number): LlmErrorMessage<'timeout'> {
  return {
    kind: 'timeout',
    message:
      `The model stopped responding: no output for ${timeoutMs} ms ` +
      `(${LLM_STREAM_IDLE_TIMEOUT_ENV}). Raise the limit, or set it to 0 to disable it, ` +
      'when the provider is legitimately slow.',
  };
}

export type IdleRaceResult<T> =
  | { readonly timedOut: false; readonly value: T }
  | { readonly timedOut: true };

export interface StreamIdleWatchdog {
  readonly signal: AbortSignal;
  readonly timedOut: boolean;
  race<T>(factory: () => Promise<T>): Promise<IdleRaceResult<T>>;
  error(): LlmErrorMessage<'timeout'>;
  dispose(): void;
}

export function createStreamIdleWatchdog(
  timeoutMs: number,
  outerSignal: AbortSignal,
): StreamIdleWatchdog {
  const controller = new AbortController();
  const abortFromOuter = (): void => {
    controller.abort(outerSignal.reason);
  };
  if (outerSignal.aborted) abortFromOuter();
  else outerSignal.addEventListener('abort', abortFromOuter, { once: true });
  let timedOut = false;
  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    race<T>(factory: () => Promise<T>): Promise<IdleRaceResult<T>> {
      if (timeoutMs <= 0) return factory().then((value) => ({ timedOut: false, value }));
      return new Promise<IdleRaceResult<T>>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          timedOut = true;
          controller.abort();
          resolve({ timedOut: true });
        }, timeoutMs);
        timer.unref?.();
        factory().then(
          (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ timedOut: false, value });
          },
          (error: unknown) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
          },
        );
      });
    },
    error: () => llmStreamIdleTimeoutError(timeoutMs),
    dispose: () => {
      outerSignal.removeEventListener('abort', abortFromOuter);
    },
  };
}
