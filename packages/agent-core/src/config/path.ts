import { mkdirSync } from 'node:fs';
import { join } from 'pathe';

import {
  KIMI_CODE_BRAND,
  resolveUserHome,
  type ProductBrand,
} from './brand-paths';

export function resolveKimiHome(homeDir?: string | undefined): string {
  return resolveUserHome({ brand: KIMI_CODE_BRAND, homeDir });
}

export function resolveConfigPath(input: {
  readonly homeDir?: string | undefined;
  readonly configPath?: string | undefined;
  readonly brand?: ProductBrand;
}): string {
  return (
    input.configPath ??
    join(resolveUserHome({ brand: input.brand ?? KIMI_CODE_BRAND, homeDir: input.homeDir }), 'config.toml')
  );
}

export function ensureKimiHome(homeDir: string): void {
  mkdirSync(homeDir, { recursive: true, mode: 0o700 });
}
