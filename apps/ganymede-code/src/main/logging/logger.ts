import {
  type LogContext,
  type LogEntry,
  type LogLevel,
  type LogPayload,
  type Logger,
  levelEnabled,
} from '../../shared/logging';
import type { RotatingFileSink } from './sink';

function extractError(payload: LogPayload | undefined): LogEntry['error'] | undefined {
  if (payload === undefined) return undefined;
  if (payload instanceof Error) {
    return { message: payload.message, stack: payload.stack };
  }
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const nested = (payload as { error?: unknown }).error;
    if (nested instanceof Error) {
      return { message: nested.message, stack: nested.stack };
    }
  }
  return undefined;
}

function extractContext(payload: LogPayload | undefined): LogContext | undefined {
  if (payload === undefined) return undefined;
  if (payload instanceof Error) return undefined;
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    if ('error' in record && record['error'] instanceof Error) {
      const { error: _error, ...rest } = record;
      return Object.keys(rest).length > 0 ? rest : undefined;
    }
    return record;
  }
  return { reason: String(payload) };
}

function formatEntry(
  scope: string,
  level: Exclude<LogLevel, 'off'>,
  message: string,
  boundCtx: LogContext | undefined,
  payload: LogPayload | undefined,
): LogEntry {
  const payloadCtx = extractContext(payload);
  const ctx =
    boundCtx === undefined && payloadCtx === undefined
      ? undefined
      : { ...payloadCtx, ...boundCtx };
  return {
    t: new Date().toISOString(),
    level,
    scope,
    msg: message,
    ctx,
    error: extractError(payload),
  };
}

export interface LoggerOptions {
  readonly scope: string;
  readonly getLevel: () => LogLevel;
  readonly getSink: () => RotatingFileSink | undefined;
  readonly getMirrorConsole: () => boolean;
  readonly boundCtx?: LogContext;
}

class LoggerImpl implements Logger {
  constructor(private readonly options: LoggerOptions) {}

  error(message: string, payload?: LogPayload): void {
    this.emit('error', message, payload);
  }

  warn(message: string, payload?: LogPayload): void {
    this.emit('warn', message, payload);
  }

  info(message: string, payload?: LogPayload): void {
    this.emit('info', message, payload);
  }

  debug(message: string, payload?: LogPayload): void {
    this.emit('debug', message, payload);
  }

  createChild(ctx: LogContext): Logger {
    return new LoggerImpl({
      ...this.options,
      boundCtx: { ...this.options.boundCtx, ...ctx },
    });
  }

  private emit(level: Exclude<LogLevel, 'off'>, message: string, payload?: LogPayload): void {
    if (!levelEnabled(this.options.getLevel(), level)) return;
    const entry = formatEntry(
      this.options.scope,
      level,
      message,
      this.options.boundCtx,
      payload,
    );
    const line = `${JSON.stringify(entry)}\n`;
    this.options.getSink()?.enqueue(line);
    if (this.options.getMirrorConsole()) this.mirror(level, entry);
  }

  private mirror(level: Exclude<LogLevel, 'off'>, entry: LogEntry): void {
    const prefix = `[${entry.scope}] ${entry.msg}`;
    const details = entry.ctx === undefined ? '' : ` ${JSON.stringify(entry.ctx)}`;
    const stack = entry.error?.stack ?? '';
    if (level === 'error') {
      console.error(prefix + details, stack.length > 0 ? `\n${stack}` : '');
      return;
    }
    if (level === 'warn') {
      console.warn(prefix + details);
      return;
    }
    if (level === 'info') {
      console.info(prefix + details);
      return;
    }
    console.debug(prefix + details);
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new LoggerImpl(options);
}
