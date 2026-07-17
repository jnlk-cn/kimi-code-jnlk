// Vite middleware that answers /api requests while Electron's WebDevBridge
// (default :5174) is not yet listening, so the proxy never logs ECONNREFUSED.

import net from 'node:net';

const PROBE_TIMEOUT_MS = 200;

/**
 * @param {number} port
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export function isPortOpen(port, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/**
 * @param {string} method
 * @param {string} pathname
 * @returns {{ status: number; body: Record<string, unknown> } | null}
 */
export function gateResponse(method, pathname) {
  if (!pathname.startsWith('/api')) return null;
  if (method === 'GET' && pathname === '/api/health') {
    return { status: 200, body: { ok: true, ready: false } };
  }
  return { status: 503, body: { error: 'Web bridge not ready' } };
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {Record<string, unknown>} body
 */
export function writeJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * @param {number | string} apiPort
 * @returns {import('vite').Plugin}
 */
export function createWebApiGatePlugin(apiPort) {
  const port = Number(apiPort) || 5174;
  return {
    name: 'ganymede-web-api-gate',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/';
        const pathname = url.split('?', 1)[0] ?? '/';
        if (!pathname.startsWith('/api')) {
          next();
          return;
        }
        void isPortOpen(port).then((open) => {
          if (open) {
            next();
            return;
          }
          const gated = gateResponse(req.method ?? 'GET', pathname);
          if (gated === null) {
            next();
            return;
          }
          writeJson(res, gated.status, gated.body);
        });
      });
    },
  };
}
