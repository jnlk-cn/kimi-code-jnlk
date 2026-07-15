import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

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
        external: ['electron', 'node-pty'],
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
    plugins: [react()],
    build: {
      outDir: 'dist/renderer',
    },
    resolve: {
      alias: {
        '#': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: rendererPort,
      strictPort: false,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${webApiPort}`,
          changeOrigin: true,
        },
      },
    },
  },
});
