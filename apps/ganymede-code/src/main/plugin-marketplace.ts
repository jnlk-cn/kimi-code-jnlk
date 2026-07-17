import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  PluginMarketplaceEntryView,
  PluginMarketplaceTier,
  PluginMarketplaceUpdateStatus,
  PluginMarketplaceView,
  PluginView,
} from '../shared/contracts';

const DEFAULT_MARKETPLACE_URL = 'https://code.kimi.com/kimi-code/plugins/marketplace.json';
const MARKETPLACE_URL_ENV = 'KIMI_CODE_PLUGIN_MARKETPLACE_URL';

interface MarketplaceLocation {
  readonly raw: string;
  readonly kind: 'remote' | 'local';
  readonly resolved: string;
}

interface RawMarketplaceEntry {
  readonly id: string;
  readonly displayName: string;
  readonly source: string;
  readonly tier?: PluginMarketplaceTier;
  readonly version?: string;
  readonly description?: string;
  readonly homepage?: string;
  readonly keywords?: readonly string[];
}

export function computeUpdateStatus(
  latest: string | undefined,
  local: string | undefined,
  installed: boolean,
): PluginMarketplaceUpdateStatus {
  if (!installed) return { kind: 'not-installed' };
  if (latest !== undefined && local !== undefined && isNewerSemver(latest, local)) {
    return { kind: 'update', local, latest };
  }
  return { kind: 'up-to-date', version: local };
}

/** True when `latest` is a valid semver strictly greater than `local`. */
export function isNewerSemver(latest: string, local: string): boolean {
  const left = parseSemver(latest);
  const right = parseSemver(local);
  if (left === undefined || right === undefined) return false;
  for (let index = 0; index < 3; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

function parseSemver(value: string): readonly [number, number, number] | undefined {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (match === null) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export async function loadPluginMarketplaceView(options: {
  readonly workDir: string;
  readonly installed: readonly PluginView[];
  readonly source?: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<PluginMarketplaceView> {
  const configuredSource = options.source ?? process.env[MARKETPLACE_URL_ENV];
  const location = resolveMarketplaceLocation(
    configuredSource ?? DEFAULT_MARKETPLACE_URL,
    options.workDir,
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  let raw: string;
  try {
    raw = await readMarketplaceText(location, fetchImpl);
  } catch (error) {
    const fallback =
      configuredSource === undefined ? await getBundledMarketplaceLocation() : undefined;
    if (fallback === undefined) throw error;
    raw = await readMarketplaceText(fallback, fetchImpl);
    return toView(parseMarketplace(raw, fallback), options.installed);
  }
  return toView(parseMarketplace(raw, location), options.installed);
}

function toView(
  marketplace: { readonly source: string; readonly version?: string; readonly plugins: readonly RawMarketplaceEntry[] },
  installed: readonly PluginView[],
): PluginMarketplaceView {
  const byId = new Map(installed.map((plugin) => [plugin.id, plugin]));
  return {
    source: marketplace.source,
    version: marketplace.version,
    plugins: marketplace.plugins.map((entry): PluginMarketplaceEntryView => {
      const local = byId.get(entry.id);
      const installedFlag = local !== undefined;
      return {
        ...entry,
        installed: installedFlag,
        updateStatus: computeUpdateStatus(entry.version, local?.version, installedFlag),
      };
    }),
  };
}

function parseMarketplace(
  raw: string,
  location: MarketplaceLocation,
): { readonly source: string; readonly version?: string; readonly plugins: readonly RawMarketplaceEntry[] } {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const rawPlugins = parsed['plugins'];
  if (!Array.isArray(rawPlugins)) {
    throw new TypeError('Plugin marketplace must contain a "plugins" array.');
  }
  return {
    source: location.resolved,
    version: typeof parsed['version'] === 'string' ? parsed['version'] : undefined,
    plugins: rawPlugins.map((entry, index) => parseEntry(entry, index, location)),
  };
}

function parseEntry(
  value: unknown,
  index: number,
  location: MarketplaceLocation,
): RawMarketplaceEntry {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`Plugin marketplace entry ${String(index + 1)} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  const id = requiredString(record, 'id', index);
  const source =
    stringField(record, 'source') ??
    stringField(record, 'url') ??
    stringField(record, 'downloadUrl');
  if (source === undefined) {
    throw new Error(`Plugin marketplace entry ${id} must define "source".`);
  }
  const tierRaw = stringField(record, 'tier');
  const tier =
    tierRaw === 'official' || tierRaw === 'curated' ? tierRaw : undefined;
  return {
    id,
    displayName: stringField(record, 'displayName') ?? stringField(record, 'name') ?? id,
    source: resolveEntrySource(source, location),
    tier,
    version: stringField(record, 'version'),
    description: stringField(record, 'description') ?? stringField(record, 'shortDescription'),
    homepage: stringField(record, 'homepage') ?? stringField(record, 'websiteURL'),
    keywords: Array.isArray(record['keywords'])
      ? record['keywords'].filter((item): item is string => typeof item === 'string')
      : undefined,
  };
}

function resolveMarketplaceLocation(source: string, workDir: string): MarketplaceLocation {
  const trimmed = source.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { raw: trimmed, kind: 'remote', resolved: trimmed };
  }
  if (trimmed.startsWith('file://')) {
    return { raw: trimmed, kind: 'local', resolved: fileURLToPath(trimmed) };
  }
  const resolved = isAbsolute(trimmed) ? trimmed : resolve(workDir, trimmed);
  return { raw: trimmed, kind: 'local', resolved };
}

async function getBundledMarketplaceLocation(): Promise<MarketplaceLocation | undefined> {
  const candidates = [
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../../plugins/marketplace.json'),
    resolve(process.cwd(), 'plugins/marketplace.json'),
  ];
  for (const marketplacePath of candidates) {
    const info = await stat(marketplacePath).catch(() => undefined);
    if (info?.isFile() === true) {
      return { raw: marketplacePath, kind: 'local', resolved: marketplacePath };
    }
  }
  return undefined;
}

async function readMarketplaceText(
  location: MarketplaceLocation,
  fetchImpl: typeof fetch,
): Promise<string> {
  if (location.kind === 'local') {
    return readFile(location.resolved, 'utf8');
  }
  const response = await fetchImpl(location.resolved);
  if (!response.ok) {
    throw new Error(`Plugin marketplace returned HTTP ${String(response.status)}`);
  }
  return response.text();
}

function resolveEntrySource(source: string, location: MarketplaceLocation): string {
  if (
    source.startsWith('http://') ||
    source.startsWith('https://') ||
    source.startsWith('file://') ||
    isAbsolute(source)
  ) {
    return source;
  }
  if (location.kind === 'local') {
    return join(dirname(location.resolved), source);
  }
  try {
    return new URL(source, location.resolved).href;
  } catch {
    return source;
  }
}

function requiredString(record: Record<string, unknown>, key: string, index: number): string {
  const value = stringField(record, key);
  if (value === undefined) {
    throw new Error(`Plugin marketplace entry ${String(index + 1)} must define "${key}".`);
  }
  return value;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
