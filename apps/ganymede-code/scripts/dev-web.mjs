#!/usr/bin/env node
// Starts Ganymede Code in web-dev mode: headless Electron main + Vite renderer.
// The renderer is opened in a browser (e.g. Cursor Simple Browser) instead of
// an Electron window. IPC is bridged over HTTP/SSE on 127.0.0.1.

import { spawn } from 'node:child_process';
import net from 'node:net';

const DEFAULT_API_PORT = 5174;
const DEFAULT_RENDERER_PORT = 5173;
const MAX_PROBE = 50;

async function isFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.once('error', () => {
      resolve(false);
    });
    srv.once('listening', () => {
      srv.close(() => {
        resolve(true);
      });
    });
    srv.listen({ port, host: '127.0.0.1', exclusive: true });
  });
}

async function pickPort(startPort, exclude = new Set()) {
  for (let port = startPort; port < startPort + MAX_PROBE; port += 1) {
    if (exclude.has(port)) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await isFree(port)) return port;
  }
  throw new Error(
    `no free port in [${startPort}, ${startPort + MAX_PROBE}); something is hogging the range`,
  );
}

const requestedApi = Number(process.env.GANYMEDE_WEB_PORT) || DEFAULT_API_PORT;
const apiPort = await pickPort(requestedApi);
if (apiPort !== requestedApi) {
  process.stdout.write(
    `[ganymede] api port ${requestedApi} busy, using ${apiPort} instead\n`,
  );
}

const requestedRenderer = Number(process.env.GANYMEDE_RENDERER_PORT) || DEFAULT_RENDERER_PORT;
const rendererPort = await pickPort(requestedRenderer, new Set([apiPort]));
if (rendererPort !== requestedRenderer) {
  process.stdout.write(
    `[ganymede] renderer port ${requestedRenderer} busy, using ${rendererPort} instead\n`,
  );
}

process.stdout.write(
  `[ganymede] starting web-dev — open http://localhost:${rendererPort}  (API on ${apiPort})\n`,
);

const env = {
  ...process.env,
  GANYMEDE_WEB_DEV: '1',
  GANYMEDE_WEB_PORT: String(apiPort),
  GANYMEDE_RENDERER_PORT: String(rendererPort),
};

const child = spawn('pnpm', ['exec', 'electron-vite', 'dev'], {
  stdio: 'inherit',
  env,
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal !== null) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
