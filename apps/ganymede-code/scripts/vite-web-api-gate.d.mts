import type { ServerResponse } from 'node:http';

import type { Plugin } from 'vite';

export interface WebApiGateResponse {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

export function isPortOpen(port: number, timeoutMs?: number): Promise<boolean>;

export function gateResponse(method: string, pathname: string): WebApiGateResponse | null;

export function writeJson(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void;

export function createWebApiGatePlugin(apiPort: number | string): Plugin;
