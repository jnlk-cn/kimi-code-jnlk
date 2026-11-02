import { afterEach, describe, expect, it } from 'vitest';

import { generate, type LlmAttemptEvent } from '#/llm/generate';
import {
  LLM_STREAM_IDLE_TIMEOUT_ENV,
  createStreamIdleWatchdog,
  resolveLlmStreamIdleTimeoutMs,
} from '#/llm/idleTimeout';
import type { Message, StreamedMessagePart } from '#/llm/message';
import type { LlmRequest } from '#/llm/request';
import { isAbortError } from '#/llm/protocol/errors';

const messages: readonly Message[] = [
  { role: 'user', content: [{ type: 'text', text: 'hi' }] },
];

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function chunkStream(
  chunk: StreamedMessagePart,
  options: { readonly hangAfterChunk: boolean; readonly signal: AbortSignal },
): AsyncIterable<StreamedMessagePart> {
  return {
    [Symbol.asyncIterator]() {
      let sent = false;
      return {
        next: (): Promise<IteratorResult<StreamedMessagePart>> => {
          if (!sent) {
            sent = true;
            return Promise.resolve({ done: false, value: chunk });
          }
          if (!options.hangAfterChunk) return Promise.resolve({ done: true, value: undefined });
          return new Promise<IteratorResult<StreamedMessagePart>>((_resolve, reject) => {
            if (options.signal.aborted) {
              reject(abortError());
              return;
            }
            options.signal.addEventListener('abort', () => reject(abortError()), { once: true });
          });
        },
        return: (): Promise<IteratorResult<StreamedMessagePart>> =>
          Promise.resolve({ done: true, value: undefined }),
      };
    },
  };
}

function requestOf(
  sendStream: (request: LlmRequest, signal: AbortSignal) => Promise<AsyncIterable<StreamedMessagePart>>,
): LlmRequest {
  return {
    protocol: {
      base: {
        media: { kinds: {} },
        encode: () => ({}),
        client: () => ({}),
        send: async (_client, _request, signal) => ({ body: chunkStream({ type: 'text', text: 'hi' }, { hangAfterChunk: false, signal }) }),
        sendStream: async (_client, request, signal) => ({ body: await sendStream(request, signal) }),
        decoder: (_module, sink) => ({
          push: (chunk) => sink.onDelta(chunk),
          end: () => {},
        }),
        replay: (response) => response as Iterable<StreamedMessagePart>,
        decodeError: (error) =>
          isAbortError(error)
            ? { kind: 'abort', message: 'The operation was aborted.' }
            : { kind: 'unknown', message: error instanceof Error ? error.message : String(error) },
      },
    },
    model: { spec: { provider: 'test', name: 'test-model' } },
    content: { messages },
  };
}

async function run(
  request: LlmRequest,
  signal: AbortSignal,
): Promise<readonly LlmAttemptEvent[]> {
  const events: LlmAttemptEvent[] = [];
  await generate(request, { signal, onEvent: (event) => events.push(event) });
  return events;
}

describe('llm stream idle timeout', () => {
  const saved = process.env[LLM_STREAM_IDLE_TIMEOUT_ENV];
  afterEach(() => {
    if (saved === undefined) delete process.env[LLM_STREAM_IDLE_TIMEOUT_ENV];
    else process.env[LLM_STREAM_IDLE_TIMEOUT_ENV] = saved;
  });

  it('resolves the configured idle timeout', () => {
    expect(resolveLlmStreamIdleTimeoutMs({})).toBe(120_000);
    expect(resolveLlmStreamIdleTimeoutMs({ [LLM_STREAM_IDLE_TIMEOUT_ENV]: '0' })).toBe(0);
    expect(resolveLlmStreamIdleTimeoutMs({ [LLM_STREAM_IDLE_TIMEOUT_ENV]: '45000' })).toBe(45_000);
    expect(() => resolveLlmStreamIdleTimeoutMs({ [LLM_STREAM_IDLE_TIMEOUT_ENV]: 'soon' })).toThrow(
      LLM_STREAM_IDLE_TIMEOUT_ENV,
    );
    expect(() => resolveLlmStreamIdleTimeoutMs({ [LLM_STREAM_IDLE_TIMEOUT_ENV]: '-1' })).toThrow(
      LLM_STREAM_IDLE_TIMEOUT_ENV,
    );
  });

  it('fails the attempt with a timeout when the stream goes idle', async () => {
    process.env[LLM_STREAM_IDLE_TIMEOUT_ENV] = '40';
    const controller = new AbortController();
    const events = await run(
      requestOf(async (_request, signal) => chunkStream({ type: 'text', text: 'hi' }, { hangAfterChunk: true, signal })),
      controller.signal,
    );

    expect(events.at(-1)).toMatchObject({
      type: 'attempt.failed',
      error: { kind: 'timeout', message: expect.stringContaining(LLM_STREAM_IDLE_TIMEOUT_ENV) },
    });
    expect(controller.signal.aborted).toBe(false);
  });

  it('does not time out a stream that ends normally', async () => {
    process.env[LLM_STREAM_IDLE_TIMEOUT_ENV] = '5';
    const events = await run(
      requestOf(async (_request, signal) =>
        chunkStream({ type: 'text', text: 'hi' }, { hangAfterChunk: false, signal }),
      ),
      new AbortController().signal,
    );

    expect(events.some((event) => event.type === 'attempt.failed')).toBe(false);
  });

  it('disables the watchdog when the limit is zero', async () => {
    process.env[LLM_STREAM_IDLE_TIMEOUT_ENV] = '0';
    const controller = new AbortController();
    const events = await run(
      requestOf(async (_request, signal) =>
        chunkStream({ type: 'text', text: 'hi' }, { hangAfterChunk: false, signal }),
      ),
      controller.signal,
    );

    expect(events.some((event) => event.type === 'attempt.failed')).toBe(false);
  });

  it('keeps caller aborts classified as aborts', async () => {
    process.env[LLM_STREAM_IDLE_TIMEOUT_ENV] = '5000';
    const controller = new AbortController();
    const hanging = run(
      requestOf(async (_request, signal) =>
        chunkStream({ type: 'text', text: 'hi' }, { hangAfterChunk: true, signal }),
      ),
      controller.signal,
    );
    setTimeout(() => controller.abort(), 20);
    const events = await hanging;

    expect(events.at(-1)).toMatchObject({
      type: 'attempt.failed',
      error: { kind: 'abort' },
    });
  });

  it('reports an invalid env value through the attempt failure', async () => {
    process.env[LLM_STREAM_IDLE_TIMEOUT_ENV] = 'soon';
    const events = await run(
      requestOf(async (_request, signal) =>
        chunkStream({ type: 'text', text: 'hi' }, { hangAfterChunk: false, signal }),
      ),
      new AbortController().signal,
    );

    expect(events.at(-1)).toMatchObject({
      type: 'attempt.failed',
      error: { message: expect.stringContaining(LLM_STREAM_IDLE_TIMEOUT_ENV) },
    });
  });

  it('propagates outer aborts through the watchdog signal', () => {
    const controller = new AbortController();
    const watchdog = createStreamIdleWatchdog(60_000, controller.signal);
    controller.abort();
    expect(watchdog.signal.aborted).toBe(true);
    watchdog.dispose();
  });
});
