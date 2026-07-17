import { homedir } from 'node:os';
import { join } from 'pathe';

/** Product brand that owns user/project data directory names. */
export type ProductBrand = 'kimi-code' | 'ganymede';

export const KIMI_CODE_BRAND: ProductBrand = 'kimi-code';
export const GANYMEDE_BRAND: ProductBrand = 'ganymede';

export interface BrandLayout {
  readonly brand: ProductBrand;
  /** Directory name under the OS home, e.g. `.kimi-code` or `.ganymede`. */
  readonly userHomeDirName: string;
  /** Project-local brand directory name, e.g. `.kimi-code` or `.ganymede`. */
  readonly projectDirName: string;
  /** Env var that overrides the user data root. */
  readonly userHomeEnvVar: string;
}

const BRAND_LAYOUTS: Readonly<Record<ProductBrand, BrandLayout>> = {
  'kimi-code': {
    brand: 'kimi-code',
    userHomeDirName: '.kimi-code',
    projectDirName: '.kimi-code',
    userHomeEnvVar: 'KIMI_CODE_HOME',
  },
  ganymede: {
    brand: 'ganymede',
    userHomeDirName: '.ganymede',
    projectDirName: '.ganymede',
    userHomeEnvVar: 'GANYMEDE_HOME',
  },
};

export function brandLayout(brand: ProductBrand = KIMI_CODE_BRAND): BrandLayout {
  return BRAND_LAYOUTS[brand];
}

export function resolveUserHome(input: {
  readonly brand?: ProductBrand;
  readonly homeDir?: string;
}): string {
  if (input.homeDir !== undefined) return input.homeDir;
  const layout = brandLayout(input.brand ?? KIMI_CODE_BRAND);
  const fromEnv = process.env[layout.userHomeEnvVar];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  return join(homedir(), layout.userHomeDirName);
}

/** Convenience: Ganymede user data root (`GANYMEDE_HOME` or `~/.ganymede`). */
export function resolveGanymedeHome(homeDir?: string): string {
  return resolveUserHome({ brand: GANYMEDE_BRAND, homeDir });
}

export function projectBrandPath(
  projectRoot: string,
  brand: ProductBrand,
  ...segments: string[]
): string {
  return join(projectRoot, brandLayout(brand).projectDirName, ...segments);
}

/** Env map for plugin/hook subprocesses under the given brand home. */
export function brandHomeEnv(
  brand: ProductBrand,
  brandHomeDir: string,
): Record<string, string> {
  const layout = brandLayout(brand);
  return { [layout.userHomeEnvVar]: brandHomeDir };
}
