/** Relative workspace directory for KimiCodeBoost design specs. */
export const WORKSPACE_SPEC_DIR_SEGMENTS = ['docs', 'kimicodeboost', 'specs'] as const;

export const WORKSPACE_SPEC_DIR = WORKSPACE_SPEC_DIR_SEGMENTS.join('/');

export const WORKSPACE_SPEC_SESSION_ID = 'workspace';

export const WORKSPACE_SPEC_SESSION_TITLE = '设计规格';

export type PlanDocumentKind = 'spec' | 'implementation';

/** Normalize separators and strip a leading `./`. */
export function normalizePathSeparators(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

/**
 * True when `path` is a workspace design-spec markdown file under
 * `docs/kimicodeboost/specs/*.md` (relative or absolute under `workDir`).
 */
export function isWorkspaceSpecPath(path: string, workDir?: string): boolean {
  const normalized = normalizePathSeparators(path.trim());
  if (normalized.length === 0 || !normalized.toLowerCase().endsWith('.md')) {
    return false;
  }

  const prefix = `${WORKSPACE_SPEC_DIR}/`;
  if (normalized === WORKSPACE_SPEC_DIR || normalized.startsWith(prefix)) {
    // Must be a direct child of the specs dir (no nested folders).
    const relative = normalized === WORKSPACE_SPEC_DIR
      ? ''
      : normalized.slice(prefix.length);
    return relative.length > 0 && !relative.includes('/');
  }

  if (workDir !== undefined && workDir.length > 0) {
    const root = normalizePathSeparators(workDir).replace(/\/+$/, '');
    if (normalized.startsWith(`${root}/`)) {
      return isWorkspaceSpecPath(normalized.slice(root.length + 1));
    }
  }

  return false;
}

/** Resolve a workspace-relative path to an absolute path under `workDir`. */
export function resolveWorkspaceAbsolutePath(workDir: string, relativeOrAbsolute: string): string {
  const trimmed = relativeOrAbsolute.trim();
  const normalizedWorkDir = normalizePathSeparators(workDir).replace(/\/+$/, '');
  const normalized = normalizePathSeparators(trimmed);
  if (
    normalized.startsWith(`${normalizedWorkDir}/`)
    || normalized === normalizedWorkDir
  ) {
    return trimmed.replaceAll('\\', '/');
  }
  if (trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    return trimmed.replaceAll('\\', '/');
  }
  const relative = normalizePathSeparators(trimmed).replace(/^\.\//, '');
  return `${normalizedWorkDir}/${relative}`;
}
