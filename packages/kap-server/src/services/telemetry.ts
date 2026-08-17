/**
 * Server telemetry bootstrap — cloud delivery is disabled.
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
