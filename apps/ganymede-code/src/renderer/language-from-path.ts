const EXT_LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  json: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  scss: 'css',
  less: 'css',
  html: 'html',
  htm: 'html',
  svg: 'xml',
  xml: 'xml',
  sql: 'sql',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  vue: 'html',
  svelte: 'html',
};

export function extensionOf(path: string): string {
  const base = path.split(/[/\\]/).at(-1) ?? path;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

export function languageFromPath(filePath: string): string | undefined {
  const ext = extensionOf(filePath);
  if (ext.length === 0) return undefined;
  return EXT_LANG_MAP[ext] ?? ext;
}

export function languageFromFence(info: string | undefined): string | undefined {
  if (info === undefined) return undefined;
  const token = info.trim().split(/\s+/)[0]?.toLowerCase();
  if (token === undefined || token.length === 0) return undefined;
  if (token === 'ts' || token === 'tsx') return 'typescript';
  if (token === 'js' || token === 'jsx') return 'javascript';
  if (token === 'sh' || token === 'bash' || token === 'zsh') return 'shell';
  if (token === 'yml') return 'yaml';
  return EXT_LANG_MAP[token] ?? token;
}

export function isHtmlPath(path: string): boolean {
  const ext = extensionOf(path);
  return ext === 'html' || ext === 'htm';
}
