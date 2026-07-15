import { join } from 'node:path';

import { app, shell } from 'electron';

import type { AppSettings } from '../../shared/contracts';
import { parseLogLevel, type LogLevel, type Logger } from '../../shared/logging';
import { createLogger } from './logger';
import { RotatingFileSink } from './sink';

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_FILES = 5;

export interface LoggingSettings {
  readonly logLevel: LogLevel;
  readonly logMirrorConsole: boolean;
  readonly logIpcTrace: boolean;
}

let logDir: string | undefined;
let logFile: string | undefined;
let sink: RotatingFileSink | undefined;
let level: LogLevel = 'info';
let mirrorConsole = false;
let ipcTrace = false;
let envOverride: LogLevel | undefined;
let initialized = false;

function resolveLevel(settingsLevel: LogLevel): LogLevel {
  if (envOverride !== undefined) return envOverride;
  return settingsLevel;
}

function ensureSink(): RotatingFileSink | undefined {
  if (level === 'off') {
    return undefined;
  }
  if (sink === undefined && logFile !== undefined) {
    sink = new RotatingFileSink({
      path: logFile,
      maxBytes: DEFAULT_MAX_BYTES,
      files: DEFAULT_FILES,
    });
  }
  return sink;
}

export function initLogging(
  userData: string,
  settings: LoggingSettings,
): { readonly logDir: string; readonly logFile: string } {
  logDir = join(userData, 'logs');
  logFile = join(logDir, 'ganymede.log');
  const packaged = app.isPackaged;
  envOverride = process.env['GANYMEDE_LOG_LEVEL']
    ? parseLogLevel(process.env['GANYMEDE_LOG_LEVEL'], settings.logLevel)
    : undefined;
  level = resolveLevel(settings.logLevel);
  mirrorConsole = settings.logMirrorConsole;
  ipcTrace = settings.logIpcTrace;
  if (level === 'off') {
    sink = undefined;
  } else {
    sink = new RotatingFileSink({
      path: logFile,
      maxBytes: DEFAULT_MAX_BYTES,
      files: DEFAULT_FILES,
    });
  }
  initialized = true;
  const boot = createScopedLogger('app');
  boot.info('logging initialized', {
    level,
    logFile,
    mirrorConsole,
    ipcTrace,
    envOverride: envOverride ?? null,
    version: app.getVersion(),
    platform: process.platform,
    packaged,
  });
  return { logDir, logFile };
}

export function reconfigureLogging(settings: LoggingSettings): void {
  if (!initialized || logFile === undefined) return;
  const previousLevel = level;
  const previousMirror = mirrorConsole;
  const previousIpcTrace = ipcTrace;
  level = resolveLevel(settings.logLevel);
  mirrorConsole = settings.logMirrorConsole;
  ipcTrace = settings.logIpcTrace;

  if (level === 'off') {
    const current = sink;
    sink = undefined;
    void current?.close();
  } else if (sink === undefined) {
    sink = new RotatingFileSink({
      path: logFile,
      maxBytes: DEFAULT_MAX_BYTES,
      files: DEFAULT_FILES,
    });
  }

  if (
    previousLevel !== level ||
    previousMirror !== mirrorConsole ||
    previousIpcTrace !== ipcTrace
  ) {
    createScopedLogger('app').info('logging reconfigured', {
      level,
      previousLevel,
      mirrorConsole,
      ipcTrace,
      envOverride: envOverride ?? null,
    });
  }
}

export function getLogDir(): string {
  if (logDir === undefined) throw new Error('Logging is not initialized.');
  return logDir;
}

export function getLogFile(): string {
  if (logFile === undefined) throw new Error('Logging is not initialized.');
  return logFile;
}

export function getLogLevel(): LogLevel {
  return level;
}

export function isIpcTraceEnabled(): boolean {
  return ipcTrace || level === 'debug';
}

export async function revealLogs(): Promise<void> {
  await shell.openPath(getLogDir());
}

export async function closeLogging(): Promise<void> {
  const currentSink = sink;
  sink = undefined;
  await currentSink?.close();
}

export function createScopedLogger(scope: string): Logger {
  return createLogger({
    scope,
    getLevel: () => level,
    getSink: () => ensureSink(),
    getMirrorConsole: () => mirrorConsole,
  });
}

export function flushLoggingSync(): void {
  sink?.flushSync();
}

export function loggingSettingsFrom(settings: AppSettings): LoggingSettings {
  return {
    logLevel: settings.logLevel,
    logMirrorConsole: settings.logMirrorConsole,
    logIpcTrace: settings.logIpcTrace,
  };
}
