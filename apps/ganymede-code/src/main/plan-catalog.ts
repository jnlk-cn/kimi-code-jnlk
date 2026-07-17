import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';

import type { ProjectPlanSummary } from '../shared/contracts';
import {
  WORKSPACE_SPEC_DIR_SEGMENTS,
  WORKSPACE_SPEC_SESSION_ID,
  WORKSPACE_SPEC_SESSION_TITLE,
} from '../shared/plan-paths';

export type { ProjectPlanSummary };

export interface PlanSessionRef {
  readonly id: string;
  readonly title?: string;
  readonly sessionDir: string;
}

const MAX_PLAN_BYTES = 2 * 1024 * 1024;

function plansDirForSession(sessionDir: string): string {
  return join(sessionDir, 'agents', 'main', 'plans');
}

function workspaceSpecsDir(workDir: string): string {
  return join(workDir, ...WORKSPACE_SPEC_DIR_SEGMENTS);
}

function titleFromFrontmatter(content: string): string | undefined {
  if (!content.startsWith('---')) return undefined;
  const end = content.indexOf('\n---', 3);
  if (end < 0) return undefined;
  const yaml = content.slice(3, end).replace(/^\r?\n/, '');
  for (const line of yaml.split(/\r?\n/)) {
    const match = /^name:\s*(.+)$/.exec(line.trim());
    if (match?.[1] === undefined) continue;
    const value = match[1].trim().replace(/^['"]|['"]$/g, '');
    if (value.length > 0) return value;
  }
  return undefined;
}

function titleFromMarkdown(content: string, fallback: string): string {
  const fromMeta = titleFromFrontmatter(content);
  if (fromMeta !== undefined) return fromMeta;
  const lines = content.split(/\r?\n/);
  let inFrontmatter = lines[0]?.trim() === '---';
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() ?? '';
    if (inFrontmatter) {
      if (index > 0 && trimmed === '---') inFrontmatter = false;
      continue;
    }
    if (trimmed.length === 0) continue;
    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (heading?.[1] !== undefined) return heading[1].trim();
    return trimmed.slice(0, 80);
  }
  return fallback;
}

function isInsideDirectory(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith('..'));
}

async function listSessionPlans(
  sessions: readonly PlanSessionRef[],
): Promise<ProjectPlanSummary[]> {
  const plans: ProjectPlanSummary[] = [];
  for (const session of sessions) {
    const plansDir = plansDirForSession(session.sessionDir);
    let entries: string[];
    try {
      entries = await readdir(plansDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const path = join(plansDir, entry);
      try {
        const info = await stat(path);
        if (!info.isFile()) continue;
        const head = await readFile(path, { encoding: 'utf8' }).catch(() => '');
        const fileName = basename(path);
        const id = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
        plans.push({
          id,
          path,
          fileName,
          sessionId: session.id,
          sessionTitle: session.title?.trim() || session.id,
          updatedAt: info.mtimeMs,
          title: titleFromMarkdown(head, id),
          kind: 'implementation',
        });
      } catch {
        // Skip unreadable plan files.
      }
    }
  }
  return plans;
}

async function listWorkspaceSpecs(workDir: string): Promise<ProjectPlanSummary[]> {
  const specsDir = workspaceSpecsDir(workDir);
  let entries: string[];
  try {
    entries = await readdir(specsDir);
  } catch {
    return [];
  }
  const plans: ProjectPlanSummary[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const path = join(specsDir, entry);
    try {
      const info = await stat(path);
      if (!info.isFile()) continue;
      const head = await readFile(path, { encoding: 'utf8' }).catch(() => '');
      const fileName = basename(path);
      const id = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
      plans.push({
        id,
        path,
        fileName,
        sessionId: WORKSPACE_SPEC_SESSION_ID,
        sessionTitle: WORKSPACE_SPEC_SESSION_TITLE,
        updatedAt: info.mtimeMs,
        title: titleFromMarkdown(head, id),
        kind: 'spec',
      });
    } catch {
      // Skip unreadable spec files.
    }
  }
  return plans;
}

export async function listProjectPlans(
  sessions: readonly PlanSessionRef[],
  workDir?: string,
): Promise<readonly ProjectPlanSummary[]> {
  const sessionPlans = await listSessionPlans(sessions);
  const specs =
    workDir !== undefined && workDir.trim().length > 0
      ? await listWorkspaceSpecs(workDir)
      : [];
  return [...sessionPlans, ...specs].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function readPlanFile(
  absolutePath: string,
  sessions: readonly PlanSessionRef[],
  workDir?: string,
): Promise<string> {
  if (absolutePath.trim().length === 0) {
    throw new Error('Plan path is required.');
  }
  let resolved: string;
  try {
    resolved = await realpath(absolutePath);
  } catch {
    throw new Error('Plan file not found.');
  }
  const info = await stat(resolved);
  if (!info.isFile()) throw new Error('Path is not a file.');
  if (info.size > MAX_PLAN_BYTES) throw new Error('Plan file is too large to preview.');

  let allowed = false;
  for (const session of sessions) {
    const plansDir = plansDirForSession(session.sessionDir);
    let plansRoot: string;
    try {
      plansRoot = await realpath(plansDir);
    } catch {
      continue;
    }
    if (isInsideDirectory(resolved, plansRoot)) {
      allowed = true;
      break;
    }
  }
  if (
    !allowed
    && workDir !== undefined
    && workDir.trim().length > 0
  ) {
    const specsDir = workspaceSpecsDir(workDir);
    try {
      const specsRoot = await realpath(specsDir);
      if (isInsideDirectory(resolved, specsRoot)) {
        allowed = true;
      }
    } catch {
      // Specs directory may not exist yet.
    }
  }
  if (!allowed) {
    throw new Error('Plan file is outside known session plan directories.');
  }
  return readFile(resolved, 'utf8');
}

export function extractPlanTitle(content: string, fallback: string): string {
  return titleFromMarkdown(content, fallback);
}
