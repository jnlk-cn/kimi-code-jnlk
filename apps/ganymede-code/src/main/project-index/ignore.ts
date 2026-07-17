import { basename } from 'node:path';

const IGNORED_DIR_NAMES: ReadonlySet<string> = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.parcel-cache',
  'coverage',
  '.nyc_output',
  'target',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.venv',
  'venv',
  'env',
  '.idea',
  '.vite',
  'release',
]);

const SENSITIVE_DIR_NAMES: ReadonlySet<string> = new Set([
  '.ssh',
  '.gnupg',
  '.aws',
  '.kube',
  '.docker',
]);

const SENSITIVE_FILE_NAMES: ReadonlySet<string> = new Set([
  '.env',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  'credentials.json',
  'service-account.json',
  'serviceAccount.json',
  '.netrc',
  '.htpasswd',
  '.pypirc',
  '.npmrc',
  '.envrc',
  '.yarnrc',
  '.yarnrc.yml',
]);

const SENSITIVE_FILE_SUFFIXES: readonly string[] = [
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.jks',
  '.keystore',
];

const ENV_FILE_ALLOWED_SUFFIXES: ReadonlySet<string> = new Set([
  '.example',
  '.sample',
  '.template',
]);

const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.mp4',
  '.mov',
  '.webm',
  '.mp3',
  '.wav',
  '.zip',
  '.tar',
  '.gz',
  '.bz2',
  '.7z',
  '.rar',
  '.pdf',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.dylib',
  '.so',
  '.dll',
  '.exe',
  '.bin',
  '.wasm',
  '.lock',
]);

export function isIgnoredDirName(name: string): boolean {
  return IGNORED_DIR_NAMES.has(name);
}

export function isSensitivePath(relativePath: string): boolean {
  const segments = relativePath.replaceAll('\\', '/').split('/');
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (segment !== undefined && SENSITIVE_DIR_NAMES.has(segment)) return true;
  }
  const name = basename(relativePath);
  if (SENSITIVE_FILE_NAMES.has(name)) {
    if (name.startsWith('.env')) {
      for (const suffix of ENV_FILE_ALLOWED_SUFFIXES) {
        if (name.endsWith(suffix)) return false;
      }
    }
    return true;
  }
  if (name.startsWith('.env.') && !ENV_FILE_ALLOWED_SUFFIXES.has(name.slice('.env'.length))) {
    return true;
  }
  const lower = name.toLocaleLowerCase();
  for (const suffix of SENSITIVE_FILE_SUFFIXES) {
    if (lower.endsWith(suffix)) return true;
  }
  return false;
}

export function isBinaryPath(relativePath: string): boolean {
  const lower = relativePath.toLocaleLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return false;
  return BINARY_EXTENSIONS.has(lower.slice(dot));
}

export interface IgnoreMatcher {
  ignores(relativePath: string): boolean;
}

export function createIgnoreMatcher(patterns: readonly string[]): IgnoreMatcher {
  const compiled = patterns
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map(compileIgnorePattern);
  return {
    ignores(relativePath: string): boolean {
      const path = relativePath.replaceAll('\\', '/').replace(/^\.\//, '');
      let ignored = false;
      for (const rule of compiled) {
        if (rule.matches(path)) ignored = !rule.negated;
      }
      return ignored;
    },
  };
}

interface CompiledIgnore {
  readonly negated: boolean;
  matches(path: string): boolean;
}

function compileIgnorePattern(raw: string): CompiledIgnore {
  let pattern = raw;
  let negated = false;
  if (pattern.startsWith('!')) {
    negated = true;
    pattern = pattern.slice(1);
  }
  const dirOnly = pattern.endsWith('/');
  if (dirOnly) pattern = pattern.slice(0, -1);
  const anchored = pattern.startsWith('/');
  if (anchored) pattern = pattern.slice(1);
  const regex = globToRegExp(pattern, anchored, dirOnly);
  return {
    negated,
    matches(path: string): boolean {
      return regex.test(path);
    },
  };
}

function globToRegExp(pattern: string, anchored: boolean, dirOnly: boolean): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!;
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        source += '.*';
        i += 1;
        if (pattern[i + 1] === '/') {
          source += '/?';
          i += 1;
        }
      } else {
        source += '[^/]*';
      }
    } else if (ch === '?') {
      source += '[^/]';
    } else if ('+()|^$.{}[]\\'.includes(ch)) {
      source += `\\${ch}`;
    } else {
      source += ch;
    }
  }
  if (dirOnly) {
    source = `(?:${source}|${source}/.*)`;
  } else if (!pattern.includes('/')) {
    source = `(?:.*/)?${source}`;
  } else if (!anchored) {
    source = `(?:.*/)?${source}`;
  }
  return new RegExp(`^${source}$`, 'i');
}
