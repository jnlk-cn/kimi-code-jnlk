import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

import { createWebApiGatePlugin } from './scripts/vite-web-api-gate.mjs';

const sdkDist = fileURLToPath(
  new URL('../../packages/node-sdk/dist/index.mjs', import.meta.url),
);
const webApiPort = process.env['GANYMEDE_WEB_PORT'] ?? '5174';
const rendererPort = Number(process.env['GANYMEDE_RENDERER_PORT'] ?? '5173') || 5173;

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@moonshot-ai/kimi-code-sdk': sdkDist,
      },
    },
    build: {
      outDir: 'dist/main',
      externalizeDeps: {
        exclude: ['@moonshot-ai/kimi-code-sdk', 'rrule'],
      },
      rollupOptions: {
        external: ['electron', 'node-pty', '@huggingface/transformers', 'chokidar'],
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.js',
        },
        external: ['electron'],
      },
    },
  },
  renderer: {
    base: './',
    plugins: [react(), createWebApiGatePlugin(webApiPort)],
    build: {
      outDir: 'dist/renderer',
    },
    server: {
      port: rendererPort,
      strictPort: false,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${webApiPort}`,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              if (
                res !== undefined &&
                'writeHead' in res &&
                typeof res.writeHead === 'function' &&
                !res.headersSent
              ) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Web bridge not ready' }));
              }
            });
          },
        },
      },
    },
  },
});
