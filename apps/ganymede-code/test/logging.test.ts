import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { levelEnabled, parseLogLevel } from '../src/shared/logging';
import { createLogger } from '../src/main/logging/logger';
import { RotatingFileSink } from '../src/main/logging/sink';

describe('parseLogLevel', () => {
  it('parses known levels case-insensitively', () => {
    expect(parseLogLevel('DEBUG', 'info')).toBe('debug');
    expect(parseLogLevel('warn', 'info')).toBe('warn');
    expect(parseLogLevel('off', 'info')).toBe('off');
  });

  it('falls back for empty or unknown values', () => {
    expect(parseLogLevel(undefined, 'info')).toBe('info');
    expect(parseLogLevel('', 'error')).toBe('error');
    expect(parseLogLevel('verbose', 'info')).toBe('info');
  });
});

describe('levelEnabled', () => {
  it('filters levels against the threshold', () => {
    expect(levelEnabled('info', 'error')).toBe(true);
    expect(levelEnabled('info', 'info')).toBe(true);
    expect(levelEnabled('info', 'debug')).toBe(false);
    expect(levelEnabled('off', 'error')).toBe(false);
  });
});

describe('RotatingFileSink', () => {
  let directory = '';

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ganymede-log-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('writes JSON lines to disk', async () => {
    const path = join(directory, 'ganymede.log');
    const sink = new RotatingFileSink({ path, maxBytes: 1024 * 1024, files: 3 });
    const logger = createLogger({
      scope: 'test',
      getLevel: () => 'info',
      getSink: () => sink,
      getMirrorConsole: () => false,
    });
    logger.info('hello', { ok: true });
    await sink.flush();
    const body = await readFile(path, 'utf8');
    const entry = JSON.parse(body.trim()) as {
      scope: string;
      msg: string;
      ctx?: { ok?: boolean };
    };
    expect(entry.scope).toBe('test');
    expect(entry.msg).toBe('hello');
    expect(entry.ctx?.ok).toBe(true);
    await sink.close();
  });

  it('rotates when the file exceeds maxBytes', async () => {
    const path = join(directory, 'ganymede.log');
    await writeFile(path, 'x'.repeat(80), 'utf8');
    const sink = new RotatingFileSink({ path, maxBytes: 100, files: 3 });
    sink.enqueue(`${JSON.stringify({ msg: 'overflow-line-that-forces-rotation' })}\n`);
    await sink.flush();
    const rotated = await readFile(`${path}.1`, 'utf8');
    expect(rotated.length).toBeGreaterThan(0);
    const current = await readFile(path, 'utf8');
    expect(current).toContain('overflow-line-that-forces-rotation');
    await sink.close();
  });

  it('respects level filtering and reconfigure-style getters', async () => {
    const path = join(directory, 'ganymede.log');
    const sink = new RotatingFileSink({ path, maxBytes: 1024 * 1024, files: 2 });
    let level: 'off' | 'error' | 'warn' | 'info' | 'debug' = 'error';
    const logger = createLogger({
      scope: 'test',
      getLevel: () => level,
      getSink: () => (level === 'off' ? undefined : sink),
      getMirrorConsole: () => false,
    });
    logger.info('hidden');
    logger.error('visible');
    level = 'off';
    logger.error('also-hidden');
    level = 'info';
    logger.info('after-reconfigure');
    await sink.flush();
    const body = await readFile(path, 'utf8');
    expect(body).toContain('visible');
    expect(body).toContain('after-reconfigure');
    expect(body).not.toContain('hidden');
    expect(body).not.toContain('also-hidden');
    await sink.close();
  });
});
