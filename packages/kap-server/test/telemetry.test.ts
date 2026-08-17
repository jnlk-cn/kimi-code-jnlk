/**
 * Kap server telemetry composition tests — cloud delivery is disabled.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  bootstrap,
  ITelemetryService,
  logSeed,
  resolveConfigPath,
  resolveLoggingConfig,
  type Scope,
} from '@moonshot-ai/agent-core-v2';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initializeServerTelemetry, shutdownServerTelemetry } from '../src/services/telemetry';

describe('server telemetry', () => {
  let home: string | undefined;
  let core: Scope | undefined;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'kimi-server-telemetry-'));
  });

  afterEach(async () => {
    core?.dispose();
    core = undefined;
    if (home !== undefined) {
      await rm(home, { recursive: true, force: true });
      home = undefined;
    }
  });

  async function bootCore(toml?: string): Promise<Scope> {
    if (toml !== undefined) {
      await writeFile(join(home as string, 'config.toml'), toml, 'utf-8');
    }
    const resolvedEnv = { ...process.env };
    const { app } = bootstrap(
      {
        homeDir: home as string,
        configPath: resolveConfigPath({ homeDir: home as string }),
        env: resolvedEnv,
        clientIdentity: {
          productName: 'test-product',
          version: '0.0.0-test',
          platform: 'test_platform',
        },
      },
      [...logSeed(resolveLoggingConfig({ homeDir: home as string, env: resolvedEnv }))],
    );
    core = app;
    return app;
  }

  it('never attaches a cloud appender', async () => {
    const app = await bootCore();
    const telemetry = await initializeServerTelemetry(app, home as string);
    expect(telemetry).toEqual({});
    await shutdownServerTelemetry(telemetry);
  });

  it('ignores telemetry = true in config', async () => {
    const app = await bootCore('telemetry = true\n');
    const telemetry = await initializeServerTelemetry(app, home as string);
    expect(telemetry).toEqual({});
    app.accessor.get(ITelemetryService).track('server_probe');
    await shutdownServerTelemetry(telemetry);
  });
});
