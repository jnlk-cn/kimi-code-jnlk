export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

export type LogContext = Record<string, unknown>;

export type LogPayload = unknown;

export interface Logger {
  error(message: string, payload?: LogPayload): void;
  warn(message: string, payload?: LogPayload): void;
  info(message: string, payload?: LogPayload): void;
  debug(message: string, payload?: LogPayload): void;
  createChild(ctx: LogContext): Logger;
}

export interface LogEntry {
  readonly t: string;
  readonly level: Exclude<LogLevel, 'off'>;
  readonly scope: string;
  readonly msg: string;
  readonly ctx?: LogContext;
  readonly error?: { readonly message: string; readonly stack?: string };
}

export const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  off: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export function levelEnabled(threshold: LogLevel, level: Exclude<LogLevel, 'off'>): boolean {
  return LOG_LEVEL_RANK[threshold] >= LOG_LEVEL_RANK[level];
}

export function parseLogLevel(value: string | undefined, fallback: LogLevel): LogLevel {
  if (value === undefined || value.trim().length === 0) return fallback;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'off' ||
    normalized === 'error' ||
    normalized === 'warn' ||
    normalized === 'info' ||
    normalized === 'debug'
  ) {
    return normalized;
  }
  return fallback;
}
