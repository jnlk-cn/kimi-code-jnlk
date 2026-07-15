import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app } from 'electron';

const mainDir = dirname(fileURLToPath(import.meta.url));

export function appRoot(): string {
  if (app.isPackaged) return app.getAppPath();
  return join(mainDir, '../..');
}

export function resourceRoot(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'resources');
  return join(appRoot(), 'resources');
}

export function rendererRoot(): string {
  return join(mainDir, '../renderer');
}
