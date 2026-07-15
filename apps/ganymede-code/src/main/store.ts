import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

import type {
  AppSettings,
  Automation,
  InboxItem,
  MemoryRecord,
  ProjectSummary,
  SiteRecord,
} from '../shared/contracts';

type SqlRow = Record<string, unknown>;

const json = {
  parse<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'string') return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  },
  stringify(value: unknown): string {
    return JSON.stringify(value);
  },
};

export class AppStore {
  private readonly db: DatabaseSync;
  private readonly defaultSettings: AppSettings;

  constructor(path: string, worktreeRoot: string, options?: { readonly packaged?: boolean }) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    const packaged = options?.packaged === true;
    this.defaultSettings = {
      locale: 'zh-CN',
      theme: 'dark',
      accent: '#7c8cff',
      uiFont: 'Inter, SF Pro Text, PingFang SC, sans-serif',
      codeFont: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "JetBrains Mono", monospace',
      terminalFontSize: 13,
      notifications: true,
      followUp: 'steer',
      worktreeRoot,
      worktreeRetention: 15,
      memoryEnabled: true,
      browserAllowlist: ['localhost', '127.0.0.1'],
      browserBlocklist: [],
      computerAllowlist: [],
      sshProfiles: [],
      logLevel: packaged ? 'info' : 'debug',
      logMirrorConsole: !packaged,
      logIpcTrace: false,
    };
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS projects (
        work_dir TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        branch TEXT,
        remote TEXT,
        pinned INTEGER NOT NULL DEFAULT 0,
        additional_dirs TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS hidden_projects (
        work_dir TEXT PRIMARY KEY,
        hidden_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS task_meta (
        session_id TEXT PRIMARY KEY,
        pinned INTEGER NOT NULL DEFAULT 0,
        unread INTEGER NOT NULL DEFAULT 0,
        target TEXT NOT NULL DEFAULT 'local'
      );
      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        project_path TEXT NOT NULL,
        session_id TEXT,
        schedule TEXT NOT NULL,
        next_run_at INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        mode TEXT NOT NULL,
        target TEXT NOT NULL,
        model TEXT,
        created_at INTEGER NOT NULL,
        last_run_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS inbox (
        id TEXT PRIMARY KEY,
        automation_id TEXT,
        session_id TEXT,
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        status TEXT NOT NULL,
        unread INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        project_path TEXT,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        id UNINDEXED,
        content,
        tags,
        tokenize = 'unicode61'
      );
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        path TEXT NOT NULL,
        url TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  getSettings(): AppSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as SqlRow[];
    const stored: Partial<Record<keyof AppSettings, unknown>> = {};
    for (const row of rows) {
      const key = String(row['key']) as keyof AppSettings;
      stored[key] = json.parse(row['value'], row['value']);
    }
    return { ...this.defaultSettings, ...stored } as AppSettings;
  }

  setSettings(patch: Partial<AppSettings>): AppSettings {
    const statement = this.db.prepare(`
      INSERT INTO settings(key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    this.db.exec('BEGIN');
    try {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) statement.run(key, json.stringify(value));
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.getSettings();
  }

  upsertProject(project: ProjectSummary): void {
    this.db.prepare(`
      INSERT INTO projects(
        work_dir, name, branch, remote, pinned, additional_dirs, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(work_dir) DO UPDATE SET
        name = excluded.name,
        branch = excluded.branch,
        remote = excluded.remote,
        additional_dirs = excluded.additional_dirs,
        updated_at = excluded.updated_at
    `).run(
      project.workDir,
      project.name,
      project.branch ?? null,
      project.remote ?? null,
      project.pinned ? 1 : 0,
      json.stringify(project.additionalDirs),
      project.updatedAt,
    );
  }

  listProjects(): readonly ProjectSummary[] {
    const rows = this.db.prepare(
      'SELECT * FROM projects ORDER BY pinned DESC, updated_at DESC',
    ).all() as SqlRow[];
    return rows.map((row) => ({
      workDir: String(row['work_dir']),
      name: String(row['name']),
      branch: nullableString(row['branch']),
      remote: nullableString(row['remote']),
      updatedAt: Number(row['updated_at']),
      sessionCount: 0,
      pinned: Number(row['pinned']) === 1,
      additionalDirs: json.parse<readonly string[]>(row['additional_dirs'], []),
    }));
  }

  removeProject(workDir: string): void {
    this.db.prepare('DELETE FROM projects WHERE work_dir = ?').run(workDir);
    this.db.prepare(`
      INSERT INTO hidden_projects(work_dir, hidden_at) VALUES (?, ?)
      ON CONFLICT(work_dir) DO UPDATE SET hidden_at = excluded.hidden_at
    `).run(workDir, Date.now());
  }

  unhideProject(workDir: string): void {
    this.db.prepare('DELETE FROM hidden_projects WHERE work_dir = ?').run(workDir);
  }

  isProjectHidden(workDir: string): boolean {
    return this.db.prepare('SELECT 1 FROM hidden_projects WHERE work_dir = ?').get(workDir) !== undefined;
  }

  setProjectPinned(workDir: string, pinned: boolean): void {
    this.db.prepare('UPDATE projects SET pinned = ? WHERE work_dir = ?').run(
      pinned ? 1 : 0,
      workDir,
    );
  }

  setTaskMeta(
    sessionId: string,
    patch: { readonly pinned?: boolean; readonly unread?: boolean; readonly target?: string },
  ): void {
    const current = this.taskMeta(sessionId);
    this.db.prepare(`
      INSERT INTO task_meta(session_id, pinned, unread, target) VALUES (?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        pinned = excluded.pinned,
        unread = excluded.unread,
        target = excluded.target
    `).run(
      sessionId,
      patch.pinned ?? current.pinned ? 1 : 0,
      patch.unread ?? current.unread ? 1 : 0,
      patch.target ?? current.target,
    );
  }

  taskMeta(sessionId: string): { pinned: boolean; unread: boolean; target: string } {
    const row = this.db.prepare(
      'SELECT pinned, unread, target FROM task_meta WHERE session_id = ?',
    ).get(sessionId) as SqlRow | undefined;
    return {
      pinned: Number(row?.['pinned']) === 1,
      unread: Number(row?.['unread']) === 1,
      target: typeof row?.['target'] === 'string' ? row['target'] : 'local',
    };
  }

  listAutomations(): readonly Automation[] {
    const rows = this.db.prepare(
      'SELECT * FROM automations ORDER BY enabled DESC, next_run_at ASC',
    ).all() as SqlRow[];
    return rows.map(automationFromRow);
  }

  getAutomation(id: string): Automation | undefined {
    const row = this.db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as
      | SqlRow
      | undefined;
    return row === undefined ? undefined : automationFromRow(row);
  }

  saveAutomation(
    input: Omit<Automation, 'id' | 'createdAt'> & { readonly id?: string },
  ): Automation {
    const id = input.id ?? randomUUID();
    const current = this.getAutomation(id);
    const createdAt = current?.createdAt ?? Date.now();
    this.db.prepare(`
      INSERT INTO automations(
        id, name, prompt, project_path, session_id, schedule, next_run_at,
        enabled, mode, target, model, created_at, last_run_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        prompt = excluded.prompt,
        project_path = excluded.project_path,
        session_id = excluded.session_id,
        schedule = excluded.schedule,
        next_run_at = excluded.next_run_at,
        enabled = excluded.enabled,
        mode = excluded.mode,
        target = excluded.target,
        model = excluded.model,
        last_run_at = excluded.last_run_at
    `).run(
      id,
      input.name,
      input.prompt,
      input.projectPath,
      input.sessionId ?? null,
      input.schedule,
      input.nextRunAt,
      input.enabled ? 1 : 0,
      input.mode,
      input.target,
      input.model ?? null,
      createdAt,
      input.lastRunAt ?? null,
    );
    return this.getAutomation(id) as Automation;
  }

  deleteAutomation(id: string): void {
    this.db.prepare('DELETE FROM automations WHERE id = ?').run(id);
  }

  addInbox(
    input: Omit<InboxItem, 'id' | 'createdAt' | 'unread'> & { readonly id?: string },
  ): InboxItem {
    const item: InboxItem = {
      ...input,
      id: input.id ?? randomUUID(),
      unread: true,
      createdAt: Date.now(),
    };
    this.db.prepare(`
      INSERT INTO inbox(
        id, automation_id, session_id, title, detail, status, unread, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      item.id,
      item.automationId ?? null,
      item.sessionId ?? null,
      item.title,
      item.detail,
      item.status,
      item.createdAt,
    );
    return item;
  }

  listInbox(): readonly InboxItem[] {
    const rows = this.db.prepare('SELECT * FROM inbox ORDER BY created_at DESC').all() as SqlRow[];
    return rows.map((row) => ({
      id: String(row['id']),
      automationId: nullableString(row['automation_id']),
      sessionId: nullableString(row['session_id']),
      title: String(row['title']),
      detail: String(row['detail']),
      status: String(row['status']) as InboxItem['status'],
      unread: Number(row['unread']) === 1,
      createdAt: Number(row['created_at']),
    }));
  }

  markInboxRead(id: string): void {
    this.db.prepare('UPDATE inbox SET unread = 0 WHERE id = ?').run(id);
  }

  saveMemory(
    input: Pick<MemoryRecord, 'content' | 'projectPath' | 'tags'> & { readonly id?: string },
  ): MemoryRecord {
    const id = input.id ?? randomUUID();
    const existing = this.db.prepare(
      'SELECT created_at FROM memories WHERE id = ?',
    ).get(id) as SqlRow | undefined;
    const now = Date.now();
    const createdAt = Number(existing?.['created_at'] ?? now);
    this.db.prepare(`
      INSERT INTO memories(id, project_path, content, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_path = excluded.project_path,
        content = excluded.content,
        tags = excluded.tags,
        updated_at = excluded.updated_at
    `).run(
      id,
      input.projectPath ?? null,
      input.content,
      json.stringify(input.tags),
      createdAt,
      now,
    );
    this.db.prepare('DELETE FROM memories_fts WHERE id = ?').run(id);
    this.db.prepare(
      'INSERT INTO memories_fts(id, content, tags) VALUES (?, ?, ?)',
    ).run(id, input.content, input.tags.join(' '));
    return { ...input, id, createdAt, updatedAt: now };
  }

  searchMemories(query: string, projectPath?: string): readonly MemoryRecord[] {
    let rows: SqlRow[];
    if (query.trim().length === 0) {
      rows = this.db.prepare(`
        SELECT * FROM memories
        WHERE (? IS NULL OR project_path = ?)
        ORDER BY updated_at DESC LIMIT 100
      `).all(projectPath ?? null, projectPath ?? null) as SqlRow[];
    } else {
      rows = this.db.prepare(`
        SELECT m.* FROM memories_fts f
        JOIN memories m ON m.id = f.id
        WHERE memories_fts MATCH ?
          AND (? IS NULL OR m.project_path = ?)
        ORDER BY rank LIMIT 100
      `).all(query, projectPath ?? null, projectPath ?? null) as SqlRow[];
    }
    return rows.map(memoryFromRow);
  }

  deleteMemory(id: string): void {
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM memories_fts WHERE id = ?').run(id);
      this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  listSites(): readonly SiteRecord[] {
    const rows = this.db.prepare('SELECT * FROM sites ORDER BY updated_at DESC').all() as SqlRow[];
    return rows.map(siteFromRow);
  }

  getSite(id: string): SiteRecord | undefined {
    const row = this.db.prepare('SELECT * FROM sites WHERE id = ?').get(id) as
      | SqlRow
      | undefined;
    return row === undefined ? undefined : siteFromRow(row);
  }

  saveSite(
    input: Omit<SiteRecord, 'id' | 'createdAt' | 'updatedAt'> & { readonly id?: string },
  ): SiteRecord {
    const id = input.id ?? randomUUID();
    const existing = this.getSite(id);
    const now = Date.now();
    const createdAt = existing?.createdAt ?? now;
    this.db.prepare(`
      INSERT INTO sites(id, title, path, url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        path = excluded.path,
        url = excluded.url,
        updated_at = excluded.updated_at
    `).run(id, input.title, input.path, input.url ?? null, createdAt, now);
    return this.getSite(id) as SiteRecord;
  }
}

function nullableString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function automationFromRow(row: SqlRow): Automation {
  return {
    id: String(row['id']),
    name: String(row['name']),
    prompt: String(row['prompt']),
    projectPath: String(row['project_path']),
    sessionId: nullableString(row['session_id']),
    schedule: String(row['schedule']),
    nextRunAt: Number(row['next_run_at']),
    enabled: Number(row['enabled']) === 1,
    mode: String(row['mode']) as Automation['mode'],
    target: String(row['target']) as Automation['target'],
    model: nullableString(row['model']),
    createdAt: Number(row['created_at']),
    lastRunAt:
      row['last_run_at'] === null || row['last_run_at'] === undefined
        ? undefined
        : Number(row['last_run_at']),
  };
}

function memoryFromRow(row: SqlRow): MemoryRecord {
  return {
    id: String(row['id']),
    projectPath: nullableString(row['project_path']),
    content: String(row['content']),
    tags: json.parse<readonly string[]>(row['tags'], []),
    createdAt: Number(row['created_at']),
    updatedAt: Number(row['updated_at']),
  };
}

function siteFromRow(row: SqlRow): SiteRecord {
  return {
    id: String(row['id']),
    title: String(row['title']),
    path: String(row['path']),
    url: nullableString(row['url']),
    createdAt: Number(row['created_at']),
    updatedAt: Number(row['updated_at']),
  };
}
