/**
 * `kap-server` domain — server telemetry bootstrap.
 *
 * Cloud delivery is disabled. The host-facing initialize/shutdown pair stays
 * so callers keep the same lifecycle without posting events off-box.
 */

import type { Scope } from '@moonshot-ai/agent-core-v2';

export interface ServerTelemetry {}

export async function initializeServerTelemetry(
  _core: Scope,
  _homeDir: string,
): Promise<ServerTelemetry> {
  return {};
}

export async function shutdownServerTelemetry(
  _telemetry: ServerTelemetry,
  _deadlineMs?: number,
): Promise<void> {}
