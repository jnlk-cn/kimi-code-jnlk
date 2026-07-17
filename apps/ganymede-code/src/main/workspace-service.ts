import { createServer, type Server } from 'node:http';
import { createReadStream } from 'node:fs';
import {
  cp,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { networkInterfaces, tmpdir } from 'node:os';

import { dialog, shell } from 'electron';

import type {
  FileContent,
  FileEntry,
  GitDiff,
  GitFileStatus,
  GitLineStats,
  GitStatus,
  GitStatusLineStats,
  PathSuggestion,
  ProjectSummary,
  PromptAttachment,
  PullRequestDetail,
  PullRequestSummary,
  SiteRecord,
  WorktreeSummary,
} from '../shared/contracts';
import type { AppStore } from './store';
import type { SessionManager } from './session-manager';
import { createScopedLogger } from './logging';
import {
  listAvailableEditors,
  openInEditor as launchEditor,
  openInTerminal as launchTerminal,
  resolveEditorCommand,
} from './editor-launcher';
import { filterPathSuggestions } from './path-suggestions';
import type { ProjectIndexService } from './project-index/project-index-service';

export { filterPathSuggestions } from './path-suggestions';

const execFileAsync = promisify(execFile);
const log = createScopedLogger('workspace');
const ignoredDirectories = new Set([
  '.git',
  '.idea',
  '.next',
  '.turbo',
  '.vite',
  'coverage',
  'dist',
  'node_modules',
  'release',
  'target',
]);

export class WorkspaceService {
  private readonly siteServers = new Map<string, Server>();
  private readonly pathSearchCache = new Map<
    string,
    { readonly createdAt: number; readonly suggestions: readonly PathSuggestion[] }
  >();

  private projectIndex: ProjectIndexService | undefined;

  constructor(
    private readonly store: AppStore,
    private readonly sessions: SessionManager,
    private readonly worktreeRoot: string,
  ) {}

  setProjectIndex(projectIndex: ProjectIndexService): void {
    this.projectIndex = projectIndex;
  }

  async close(): Promise<void> {
    await Promise.all(
      [...this.siteServers.values()].map(
        (server) =>
          new Promise<void>((resolveClose) => {
            server.close(() => resolveClose());
          }),
      ),
    );
    this.siteServers.clear();
  }

  async listProjects(): Promise<readonly ProjectSummary[]> {
    const stored = new Map(this.store.listProjects().map((project) => [project.workDir, project]));
    const tasks = await this.sessions.listSessions();
    for (const task of tasks) {
      if (this.store.isProjectHidden(task.workDir)) continue;
      const current = stored.get(task.workDir);
      if (current === undefined) {
        const inspected = await this.inspectProject(task.workDir).catch(() => ({
          workDir: task.workDir,
          name: basename(task.workDir),
          updatedAt: task.updatedAt,
          sessionCount: 0,
          pinned: false,
          additionalDirs: [],
          isGitRepository: false,
        }));
        stored.set(task.workDir, inspected);
      }
      const project = stored.get(task.workDir);
      if (project !== undefined) {
        stored.set(task.workDir, {
          ...project,
          lastPrompt:
            task.updatedAt >= project.updatedAt ? task.lastPrompt ?? task.title : project.lastPrompt,
          updatedAt: Math.max(project.updatedAt, task.updatedAt),
          sessionCount: project.sessionCount + 1,
        });
      }
    }
    const projects = [...stored.values()].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
    );
    for (const project of projects) this.store.upsertProject(project);
    return Promise.all(
      projects.map(async (project) => ({
        ...project,
        isGitRepository: await isInsideGitWorkTree(project.workDir),
      })),
    );
  }

  async openProject(): Promise<ProjectSummary | undefined> {
    const result = await dialog.showOpenDialog({
      title: '选择或新建工作目录',
      properties: ['openDirectory', 'createDirectory'],
    });
    const path = result.filePaths[0];
    if (result.canceled || path === undefined) return undefined;
    const project = await this.inspectProject(path);
    this.store.unhideProject(project.workDir);
    this.store.upsertProject(project);
    return project;
  }

  async inspectProject(workDir: string): Promise<ProjectSummary> {
    const absolute = await realpath(workDir);
    const info = await stat(absolute);
    if (!info.isDirectory()) throw new Error('Project path is not a directory.');
    const isGitRepository = await isInsideGitWorkTree(absolute);
    const [branch, remote] = isGitRepository
      ? await Promise.all([
          gitText(absolute, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => undefined),
          gitText(absolute, ['remote', 'get-url', 'origin']).catch(() => undefined),
        ])
      : [undefined, undefined];
    const existing = this.store.listProjects().find((project) => project.workDir === absolute);
    return {
      workDir: absolute,
      name: basename(absolute),
      branch,
      remote,
      updatedAt: Date.now(),
      sessionCount: existing?.sessionCount ?? 0,
      pinned: existing?.pinned ?? false,
      additionalDirs: existing?.additionalDirs ?? [],
      isGitRepository,
    };
  }

  async gitInit(workDir: string): Promise<ProjectSummary> {
    const absolute = await realpath(workDir);
    if (!(await isInsideGitWorkTree(absolute))) {
      await git(absolute, ['init']);
    }
    const existing = this.store.listProjects().find((project) => project.workDir === absolute);
    const inspected = await this.inspectProject(absolute);
    const next = {
      ...inspected,
      pinned: existing?.pinned ?? false,
      additionalDirs: existing?.additionalDirs ?? [],
      sessionCount: existing?.sessionCount ?? 0,
    };
    this.store.upsertProject(next);
    return next;
  }

  removeProject(workDir: string): void {
    this.store.removeProject(workDir);
  }

  async listHiddenProjects(): Promise<readonly ProjectSummary[]> {
    const hidden = this.store.listHiddenProjects();
    if (hidden.length === 0) return [];
    const tasks = await this.sessions.listSessions(undefined, true);
    const projects = await Promise.all(
      hidden.map(async ({ workDir, hiddenAt }) => {
        const projectTasks = [...tasks.filter((task) => task.workDir === workDir)]
          .sort((left, right) => right.updatedAt - left.updatedAt);
        const latestTask = projectTasks[0];
        const updatedAt = Math.max(hiddenAt, latestTask?.updatedAt ?? 0);
        const inspected = await this.inspectProject(workDir).catch(() => ({
          workDir,
          name: basename(workDir),
          updatedAt,
          sessionCount: projectTasks.length,
          pinned: false,
          additionalDirs: [] as const,
          isGitRepository: false,
        }));
        return {
          ...inspected,
          updatedAt,
          sessionCount: projectTasks.length,
          pinned: false,
          lastPrompt: latestTask?.lastPrompt ?? latestTask?.title,
        };
      }),
    );
    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async restoreProject(workDir: string): Promise<ProjectSummary> {
    this.store.unhideProject(workDir);
    const project = await this.inspectProject(workDir);
    this.store.upsertProject(project);
    return project;
  }

  async setProjectPinned(workDir: string, pinned: boolean): Promise<ProjectSummary> {
    const project = await this.inspectProject(workDir);
    const next = { ...project, pinned };
    this.store.unhideProject(next.workDir);
    this.store.upsertProject(next);
    this.store.setProjectPinned(next.workDir, pinned);
    return next;
  }

  async pickAdditionalDirectory(workDir: string): Promise<string | undefined> {
    const result = await dialog.showOpenDialog({
      defaultPath: workDir,
      title: '添加工作目录',
      properties: ['openDirectory'],
    });
    return result.canceled ? undefined : result.filePaths[0];
  }

  async pickAttachments(): Promise<readonly PromptAttachment[]> {
    const result = await dialog.showOpenDialog({
      title: '添加附件',
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled) return [];
    return result.filePaths.map((path) => ({
      kind: attachmentKind(path),
      name: basename(path),
      path,
    }));
  }

  async searchWorkspacePaths(root: string, query: string): Promise<readonly PathSuggestion[]> {
    const safeRoot = await realpath(root);
    const indexed = await this.projectIndex?.searchPaths(safeRoot, query);
    if (indexed !== undefined && indexed.length > 0) return indexed;
    const cached = this.pathSearchCache.get(safeRoot);
    const suggestions =
      cached !== undefined && Date.now() - cached.createdAt < 15_000
        ? cached.suggestions
        : await collectPathSuggestions(safeRoot);
    if (cached === undefined || cached.suggestions !== suggestions) {
      this.pathSearchCache.set(safeRoot, { createdAt: Date.now(), suggestions });
    }
    return filterPathSuggestions(suggestions, query);
  }

  async gitStatus(workDir: string): Promise<GitStatus> {
    const output = await gitText(workDir, ['status', '--porcelain=v1', '--branch', '-z']);
    const records = output.split('\0').filter(Boolean);
    const head = records.shift() ?? '';
    const branchMatch = /^## ([^. ]+)(?:\.\.\.([^ ]+))?(?: \[(.*)\])?/.exec(head);
    let ahead = 0;
    let behind = 0;
    const tracking = branchMatch?.[3] ?? '';
    const aheadMatch = /ahead (\d+)/.exec(tracking);
    const behindMatch = /behind (\d+)/.exec(tracking);
    if (aheadMatch?.[1] !== undefined) ahead = Number(aheadMatch[1]);
    if (behindMatch?.[1] !== undefined) behind = Number(behindMatch[1]);
    const files: GitFileStatus[] = records.map((record) => {
      const index = record[0] ?? ' ';
      const worktree = record[1] ?? ' ';
      const rawPath = record.slice(3);
      const rename = rawPath.split(' -> ');
      return {
        path: rename.at(-1) ?? rawPath,
        originalPath: rename.length > 1 ? rename[0] : undefined,
        index,
        worktree,
      };
    });
    const lineStats = files.length > 0 ? await collectGitLineStats(workDir, files) : undefined;
    return {
      branch: branchMatch?.[1] ?? 'detached',
      upstream: branchMatch?.[2],
      ahead,
      behind,
      files,
      clean: files.length === 0,
      lineStats,
    };
  }

  async gitDiff(workDir: string, staged = false, file?: string): Promise<GitDiff> {
    const baseArgs = ['diff', '--no-ext-diff', '--no-color', '--unified=3'] as const;
    let text: string;
    if (file !== undefined) {
      const status = await this.gitStatus(workDir);
      const entry = status.files.find((item) => item.path === file);
      const untracked = entry !== undefined && entry.index === '?' && entry.worktree === '?';
      if (untracked) {
        text = await gitDiffText(workDir, [...baseArgs, '--no-index', '--', '/dev/null', file]);
      } else if (staged) {
        text = await gitDiffText(workDir, [...baseArgs, '--cached', '--', file]);
      } else if (!(await hasHead(workDir))) {
        text = await gitDiffText(workDir, [...baseArgs, '--no-index', '--', '/dev/null', file]);
      } else {
        text = await gitDiffText(workDir, [...baseArgs, '--', file]);
      }
    } else {
      const args = staged ? [...baseArgs, '--cached'] : [...baseArgs];
      text = await gitDiffText(workDir, args);
    }
    const truncated = text.length > DIFF_MAX_BYTES;
    return {
      text: truncated ? text.slice(0, DIFF_MAX_BYTES) : text,
      staged,
      file,
      truncated: truncated ? true : undefined,
    };
  }

  async gitStage(workDir: string, paths: readonly string[]): Promise<void> {
    await git(workDir, ['add', '--', ...(paths.length > 0 ? paths : ['.'])]);
  }

  async gitUnstage(workDir: string, paths: readonly string[]): Promise<void> {
    await git(workDir, ['restore', '--staged', '--', ...paths]);
  }

  async gitRevert(workDir: string, paths: readonly string[]): Promise<void> {
    await git(workDir, ['restore', '--worktree', '--', ...paths]);
  }

  async gitCommit(workDir: string, message: string): Promise<string> {
    if (message.trim().length === 0) throw new Error('Commit message is required.');
    return gitText(workDir, ['commit', '-m', message]);
  }

  async gitPush(workDir: string): Promise<string> {
    return gitText(workDir, ['push']);
  }

  async gitFetch(workDir: string): Promise<string> {
    return gitText(workDir, ['fetch']);
  }

  async gitPull(workDir: string): Promise<string> {
    return gitText(workDir, ['pull']);
  }

  async gitCheckout(workDir: string, branch: string): Promise<void> {
    const name = branch.trim();
    if (name.length === 0) throw new Error('Branch name is required.');
    await git(workDir, ['switch', name]);
  }

  async gitCreateBranch(workDir: string, name: string): Promise<void> {
    const branch = name.trim();
    if (branch.length === 0) throw new Error('Branch name is required.');
    await git(workDir, ['switch', '-c', branch]);
  }

  async gitBranches(workDir: string): Promise<readonly string[]> {
    const output = await gitText(workDir, [
      'for-each-ref',
      '--format=%(refname:short)',
      'refs/heads',
    ]);
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
  }

  async pullRequests(
    workDir: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'open',
  ): Promise<readonly PullRequestSummary[]> {
    const { stdout } = await execFileAsync(
      'gh',
      [
        'pr',
        'list',
        '--state',
        state,
        '--json',
        'number,title,state,url,headRefName,baseRefName,author,reviewDecision,statusCheckRollup',
        '--limit',
        '100',
      ],
      { cwd: workDir, timeout: 15_000, maxBuffer: 8 * 1024 * 1024 },
    );
    const rows = JSON.parse(stdout) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      number: Number(row['number']),
      title: String(row['title']),
      state: String(row['state']),
      url: String(row['url']),
      headRefName: String(row['headRefName']),
      baseRefName: String(row['baseRefName']),
      author: String((row['author'] as { login?: unknown } | undefined)?.login ?? 'unknown'),
      reviewDecision:
        typeof row['reviewDecision'] === 'string' ? row['reviewDecision'] : undefined,
      checks: summarizeChecks(row['statusCheckRollup']),
    }));
  }

  async pullRequestDetail(workDir: string, number: number): Promise<PullRequestDetail> {
    const { stdout } = await execFileAsync(
      'gh',
      [
        'pr',
        'view',
        String(number),
        '--json',
        'number,title,state,url,headRefName,baseRefName,author,reviewDecision,statusCheckRollup,body,comments,reviews,files',
      ],
      { cwd: workDir, timeout: 20_000, maxBuffer: 16 * 1024 * 1024 },
    );
    const row = JSON.parse(stdout) as Record<string, unknown>;
    const summary = pullRequestFromRow(row);
    return {
      ...summary,
      body: String(row['body'] ?? ''),
      comments: arrayRecords(row['comments']).map((comment) => ({
        author: String(asObject(comment['author'])['login'] ?? 'unknown'),
        body: String(comment['body'] ?? ''),
        url: optionalText(comment['url']),
      })),
      reviews: arrayRecords(row['reviews']).map((review) => ({
        author: String(asObject(review['author'])['login'] ?? 'unknown'),
        state: String(review['state'] ?? ''),
        body: optionalText(review['body']),
      })),
      files: arrayRecords(row['files']).map((file) => ({
        path: String(file['path'] ?? ''),
        additions: Number(file['additions'] ?? 0),
        deletions: Number(file['deletions'] ?? 0),
      })),
    };
  }

  async createPullRequest(workDir: string, title: string, body: string): Promise<string> {
    const { stdout } = await execFileAsync(
      'gh',
      ['pr', 'create', '--title', title, '--body', body],
      { cwd: workDir, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout.trim();
  }

  async worktrees(workDir: string): Promise<readonly WorktreeSummary[]> {
    const output = await gitText(workDir, ['worktree', 'list', '--porcelain', '-z']);
    return parseWorktrees(output);
  }

  async createWorktree(
    workDir: string,
    branch?: string,
    includeChanges = false,
  ): Promise<WorktreeSummary> {
    await mkdir(this.worktreeRoot, { recursive: true });
    const slug = `${basename(workDir).replaceAll(/[^a-zA-Z0-9_-]/g, '-')}-${Date.now().toString(36)}`;
    const target = join(this.worktreeRoot, slug);
    await git(workDir, ['worktree', 'add', '--detach', target, branch ?? 'HEAD']);
    try {
      if (includeChanges) {
        const patch = await gitBuffer(workDir, ['diff', '--binary', 'HEAD']);
        if (patch.length > 0) await spawnWithInput('git', ['apply', '--whitespace=nowarn', '-'], target, patch);
        await copyUntrackedAndIncluded(workDir, target);
      }
      const created = (await this.worktrees(workDir)).find((entry) => entry.path === target) ?? {
        path: target,
        head: await gitText(target, ['rev-parse', 'HEAD']),
        detached: true,
        bare: false,
      };
      await this.cleanupManagedWorktrees(workDir);
      log.info('worktree created', { workDir, target, branch: branch ?? 'HEAD', includeChanges });
      return created;
    } catch (error) {
      log.warn('worktree create failed', { workDir, target, error });
      await git(workDir, ['worktree', 'remove', '--force', target]).catch(() => {});
      throw error;
    }
  }

  async removeWorktree(workDir: string, path: string): Promise<void> {
    const safeRoot = resolve(this.worktreeRoot);
    const safePath = resolve(path);
    if (safePath !== safeRoot && !safePath.startsWith(`${safeRoot}/`)) {
      throw new Error('Only Ganymede-managed worktrees can be removed here.');
    }
    await git(workDir, ['worktree', 'remove', path]);
    log.info('worktree removed', { workDir, path });
  }

  private async cleanupManagedWorktrees(workDir: string): Promise<void> {
    const keep = this.store.getSettings().worktreeRetention;
    const safeRoot = resolve(this.worktreeRoot);
    const managed = (await this.worktrees(workDir))
      .filter((entry) => {
        const path = resolve(entry.path);
        return path !== safeRoot && path.startsWith(`${safeRoot}/`);
      })
      .map(async (entry) => ({
        entry,
        modifiedAt: (await stat(entry.path).catch(() => undefined))?.mtimeMs ?? 0,
      }));
    const ordered = (await Promise.all(managed)).sort((a, b) => b.modifiedAt - a.modifiedAt);
    for (const { entry } of ordered.slice(keep)) {
      const status = await this.gitStatus(entry.path).catch(() => undefined);
      if (status?.clean !== true) continue;
      await git(workDir, ['worktree', 'remove', entry.path]).catch(() => {});
    }
  }

  async handoffWorktree(source: string, target: string): Promise<void> {
    const targetStatus = await this.gitStatus(target);
    if (!targetStatus.clean) throw new Error('Target checkout has uncommitted changes.');
    const base = await gitText(source, ['merge-base', 'HEAD', 'HEAD@{upstream}']).catch(() =>
      gitText(source, ['rev-parse', 'HEAD']),
    );
    const patch = await gitBuffer(source, ['diff', '--binary', base]);
    if (patch.length === 0) return;
    await spawnWithInput('git', ['apply', '--3way', '-'], target, patch);
  }

  async listFiles(root: string): Promise<readonly FileEntry[]> {
    const safeRoot = await realpath(root);
    return listDirectory(safeRoot, safeRoot, 0);
  }

  async readWorkspaceFile(root: string, path: string): Promise<FileContent> {
    const safe = await safeWorkspacePath(root, path);
    const info = await stat(safe);
    if (!info.isFile()) throw new Error('Path is not a file.');
    if (info.size > 16 * 1024 * 1024) throw new Error('File is too large to preview.');
    const bytes = await readFile(safe);
    const mime = mimeFor(safe);
    let kind: FileContent['kind'] =
      mime.startsWith('image/')
        ? 'image'
        : mime === 'application/pdf'
          ? 'pdf'
          : looksBinary(bytes)
            ? 'binary'
            : 'text';
    let dataUrl =
      kind === 'image' || kind === 'pdf'
        ? `data:${mime};base64,${bytes.toString('base64')}`
        : undefined;
    if (kind === 'binary' && isOfficePreview(safe)) {
      const preview = await quickLookDataUrl(safe).catch(() => undefined);
      if (preview !== undefined) {
        kind = 'image';
        dataUrl = preview;
      }
    }
    return {
      path: safe,
      name: basename(safe),
      kind,
      content: kind === 'text' ? bytes.toString('utf8') : undefined,
      dataUrl,
      mime,
      modifiedAt: info.mtimeMs,
    };
  }

  async writeWorkspaceFile(root: string, path: string, content: string): Promise<void> {
    const safe = await safeWorkspacePath(root, path, true);
    await mkdir(dirname(safe), { recursive: true });
    await writeFile(safe, content, 'utf8');
  }

  async revealFile(path: string): Promise<void> {
    shell.showItemInFolder(path);
  }

  async openFileExternal(path: string): Promise<void> {
    const error = await shell.openPath(path);
    if (error.length > 0) throw new Error(error);
  }

  async previewWorkspaceFile(workDir: string, relativePath: string): Promise<string> {
    const root = await realpath(workDir);
    const safe = await safeWorkspacePath(root, relativePath);
    const info = await stat(safe);
    if (!info.isFile()) throw new Error('Preview target must be a file.');
    const serverKey = `preview:${root}`;
    let server = this.siteServers.get(serverKey);
    if (server === undefined) {
      server = createServer((request, response) => {
        const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
        void serveStatic(root, requestPath, response);
      });
      await new Promise<void>((resolveListen, reject) => {
        server!.once('error', reject);
        server!.listen(0, '127.0.0.1', () => resolveListen());
      });
      this.siteServers.set(serverKey, server);
    }
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Failed to bind workspace preview server.');
    }
    const relativeUrl = relative(root, safe).split(/[/\\]/).map(encodeURIComponent).join('/');
    return `http://127.0.0.1:${String(address.port)}/${relativeUrl}`;
  }

  async openInEditor(path: string, command?: string): Promise<void> {
    const resolved = resolveEditorCommand(this.store.getSettings().editorCommand, command);
    if (resolved === undefined) {
      await this.openFileExternal(path);
      return;
    }
    await launchEditor(path, resolved);
  }

  async openInTerminal(path: string): Promise<void> {
    await launchTerminal(path);
  }

  async listAvailableEditors(): Promise<
    readonly {
      readonly id: string;
      readonly label: string;
      readonly command: string;
      readonly iconDataUrl?: string;
    }[]
  > {
    return listAvailableEditors();
  }

  listSites(): readonly SiteRecord[] {
    return this.store.listSites();
  }

  saveSite(
    input: Omit<SiteRecord, 'id' | 'createdAt' | 'updatedAt'> & { readonly id?: string },
  ): SiteRecord {
    return this.store.saveSite(input);
  }

  async serveSite(id: string, lan = false): Promise<SiteRecord> {
    const site = this.store.getSite(id);
    if (site === undefined) throw new Error('Site does not exist.');
    const root = await realpath(site.path);
    const serverKey = `${id}:${lan ? 'lan' : 'local'}`;
    const current = this.siteServers.get(serverKey);
    if (current !== undefined && site.url !== undefined) return site;
    const server = createServer((request, response) => {
      const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
      void serveStatic(root, requestPath, response);
    });
    await new Promise<void>((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(0, lan ? '0.0.0.0' : '127.0.0.1', () => resolveListen());
    });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Failed to bind site server.');
    this.siteServers.set(serverKey, server);
    const host = lan ? firstLanAddress() ?? '127.0.0.1' : '127.0.0.1';
    return this.store.saveSite({
      id,
      title: site.title,
      path: site.path,
      url: `http://${host}:${String(address.port)}`,
    });
  }

  async stopSite(id: string): Promise<SiteRecord> {
    const site = this.store.getSite(id);
    if (site === undefined) throw new Error('Site does not exist.');
    await this.closeSiteServers(id);
    return this.store.saveSite({
      id,
      title: site.title,
      path: site.path,
      url: undefined,
    });
  }

  async deleteSite(id: string): Promise<void> {
    await this.closeSiteServers(id);
    this.store.deleteSite(id);
  }

  async pickSiteDirectory(): Promise<string | undefined> {
    const result = await dialog.showOpenDialog({
      title: '选择站点目录',
      properties: ['openDirectory'],
    });
    const path = result.filePaths[0];
    if (result.canceled || path === undefined) return undefined;
    return path;
  }

  private async closeSiteServers(id: string): Promise<void> {
    const keys = [...this.siteServers.keys()].filter(
      (key) => key === id || key.startsWith(`${id}:`),
    );
    await Promise.all(
      keys.map(
        (key) =>
          new Promise<void>((resolveClose) => {
            const server = this.siteServers.get(key);
            this.siteServers.delete(key);
            if (server === undefined) {
              resolveClose();
              return;
            }
            server.close(() => resolveClose());
          }),
      ),
    );
  }
}

async function isInsideGitWorkTree(cwd: string): Promise<boolean> {
  try {
    const out = await gitText(cwd, ['rev-parse', '--is-inside-work-tree']);
    return out === 'true';
  } catch {
    return false;
  }
}

const DIFF_MAX_BYTES = 1_048_576;
const EMPTY_LINE_STATS: GitLineStats = { additions: 0, deletions: 0 };

async function hasHead(cwd: string): Promise<boolean> {
  try {
    await git(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

function parseGitNumstat(stdout: string): GitLineStats {
  let additions = 0;
  let deletions = 0;
  for (const line of stdout.split('\n')) {
    if (line.length === 0) continue;
    const [addedText, deletedText] = line.split('\t');
    additions += parseGitNumstatCount(addedText);
    deletions += parseGitNumstatCount(deletedText);
  }
  return { additions, deletions };
}

function parseGitNumstatCount(value: string | undefined): number {
  if (value === undefined || value === '-') return 0;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function addGitLineStats(left: GitLineStats, right: GitLineStats): GitLineStats {
  return {
    additions: left.additions + right.additions,
    deletions: left.deletions + right.deletions,
  };
}

async function gitNumstat(cwd: string, args: readonly string[]): Promise<GitLineStats> {
  try {
    const text = await gitDiffText(cwd, ['diff', '--no-color', '--numstat', ...args]);
    return parseGitNumstat(text);
  } catch {
    return EMPTY_LINE_STATS;
  }
}

async function countUntrackedLines(workDir: string, files: readonly GitFileStatus[]): Promise<number> {
  let additions = 0;
  for (const file of files) {
    if (file.index !== '?' || file.worktree !== '?') continue;
    additions += await countTextFileLines(join(workDir, file.path));
  }
  return additions;
}

async function countTextFileLines(absolutePath: string): Promise<number> {
  try {
    const content = await readFile(absolutePath, 'utf8');
    if (content.includes('\0')) return 0;
    if (content.length === 0) return 0;
    const normalized = content.endsWith('\n') ? content.slice(0, -1) : content;
    if (normalized.length === 0) return 0;
    return normalized.split('\n').length;
  } catch {
    return 0;
  }
}

async function collectGitLineStats(
  workDir: string,
  files: readonly GitFileStatus[],
): Promise<GitStatusLineStats> {
  const untrackedAdditions = await countUntrackedLines(workDir, files);
  const untracked: GitLineStats = { additions: untrackedAdditions, deletions: 0 };
  const headReady = await hasHead(workDir);
  const [staged, unstagedTracked] = await Promise.all([
    gitNumstat(workDir, ['--cached', '--']),
    gitNumstat(workDir, ['--']),
  ]);
  const unstaged = addGitLineStats(unstagedTracked, untracked);
  const totalTracked = headReady
    ? await gitNumstat(workDir, ['HEAD', '--'])
    : addGitLineStats(staged, unstagedTracked);
  return {
    total: addGitLineStats(totalTracked, untracked),
    staged,
    unstaged,
  };
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  try {
    await execFileAsync('git', args, { cwd, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    log.warn('git command failed', { cwd, args, error });
    throw error;
  }
}

async function gitText(cwd: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    timeout: 30_000,
    maxBuffer: 32 * 1024 * 1024,
    encoding: 'utf8',
  });
  return stdout.trim();
}

/** Like gitText, but treats exit code 1 as success (files differ / --no-index). */
async function gitDiffText(cwd: string, args: readonly string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout: 30_000,
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'utf8',
    });
    return stdout;
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {
      status?: number | null;
      code?: number | string | null;
      stdout?: string | Buffer;
    };
    const exitCode = typeof err.status === 'number' ? err.status : err.code;
    if (exitCode === 1) {
      if (typeof err.stdout === 'string') return err.stdout;
      if (Buffer.isBuffer(err.stdout)) return err.stdout.toString('utf8');
      return '';
    }
    log.warn('git diff failed', { cwd, args, error });
    throw error;
  }
}

async function gitBuffer(cwd: string, args: readonly string[]): Promise<Buffer> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    timeout: 30_000,
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'buffer',
  });
  return stdout;
}

async function spawnWithInput(
  command: string,
  args: readonly string[],
  cwd: string,
  input: Buffer,
): Promise<void> {
  await new Promise<void>((resolveProcess, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const stderr: Buffer[] = [];
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolveProcess();
      } else {
        reject(new Error(Buffer.concat(stderr).toString('utf8') || `${command} failed.`));
      }
    });
    child.stdin.end(input);
  });
}

function parseWorktrees(output: string): readonly WorktreeSummary[] {
  const records = output.split('\0\0').filter(Boolean);
  return records.map((record) => {
    const fields = record.split('\0');
    const first = fields[0]?.replace(/^worktree /, '') ?? '';
    const values = new Map<string, string>();
    for (const field of fields.slice(1)) {
      const [key, ...rest] = field.split(' ');
      if (key !== undefined) values.set(key, rest.join(' '));
    }
    return {
      path: first,
      head: values.get('HEAD') ?? '',
      branch: values.get('branch')?.replace('refs/heads/', ''),
      bare: values.has('bare'),
      detached: values.has('detached'),
      locked: values.get('locked'),
    };
  });
}

async function listDirectory(
  root: string,
  current: string,
  depth: number,
): Promise<readonly FileEntry[]> {
  if (depth > 3) return [];
  const entries = await readdir(current, { withFileTypes: true });
  const visible = entries
    .filter((entry) => !ignoredDirectories.has(entry.name))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  const result: FileEntry[] = [];
  for (const entry of visible.slice(0, 400)) {
    const path = join(current, entry.name);
    const info = await lstat(path).catch(() => undefined);
    if (info === undefined) continue;
    const kind = entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file';
    result.push({
      name: entry.name,
      path: relative(root, path),
      kind,
      size: info.size,
      modifiedAt: info.mtimeMs,
      children: kind === 'directory' ? await listDirectory(root, path, depth + 1) : undefined,
    });
  }
  return result;
}

async function collectPathSuggestions(root: string): Promise<readonly PathSuggestion[]> {
  const suggestions: PathSuggestion[] = [];
  const directories = [root];
  while (directories.length > 0 && suggestions.length < 50_000) {
    const current = directories.shift();
    if (current === undefined) break;
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (ignoredDirectories.has(entry.name)) continue;
      if (!entry.isDirectory() && !entry.isFile()) continue;
      const absolute = join(current, entry.name);
      const path = relative(root, absolute).replaceAll('\\', '/');
      const kind = entry.isDirectory() ? 'directory' : 'file';
      suggestions.push({ root, path, name: entry.name, kind });
      if (kind === 'directory') directories.push(absolute);
      if (suggestions.length >= 50_000) break;
    }
  }
  return suggestions;
}

function attachmentKind(path: string): PromptAttachment['kind'] {
  const extension = extname(path).toLocaleLowerCase();
  if (new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.avif']).has(extension)) {
    return 'image';
  }
  if (new Set(['.mp4', '.mov', '.m4v', '.webm']).has(extension)) return 'video';
  return 'file';
}

async function copyUntrackedAndIncluded(sourceRoot: string, targetRoot: string): Promise<void> {
  const untracked = await gitText(sourceRoot, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
  ]).catch(() => '');
  const includeText = await readFile(join(sourceRoot, '.worktreeinclude'), 'utf8').catch(() => '');
  const includePatterns = includeText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  const ignored =
    includePatterns.length === 0
      ? ''
      : await gitText(sourceRoot, [
          'ls-files',
          '--others',
          '--ignored',
          '--exclude-standard',
          '-z',
        ]).catch(() => '');
  const paths = new Set(untracked.split('\0').filter(Boolean));
  for (const path of ignored.split('\0').filter(Boolean)) {
    if (includePatterns.some((pattern) => globMatch(pattern, path))) paths.add(path);
  }
  for (const path of paths) {
    const source = join(sourceRoot, path);
    const info = await lstat(source).catch(() => undefined);
    if (info === undefined || info.isSymbolicLink()) continue;
    const target = join(targetRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: info.isDirectory(), force: false, errorOnExist: true });
  }
}

function globMatch(pattern: string, path: string): boolean {
  const normalized = pattern.replace(/^\/+/, '');
  const expression = normalized
    .replaceAll(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('**', '\u0000')
    .replaceAll('*', '[^/]*')
    .replaceAll('?', '[^/]')
    .replaceAll('\u0000', '.*');
  return new RegExp(`^${expression}${normalized.endsWith('/') ? '.*' : ''}$`).test(path);
}

async function safeWorkspacePath(root: string, path: string, allowMissing = false): Promise<string> {
  const safeRoot = await realpath(root);
  const candidate = resolve(safeRoot, isAbsolute(path) ? relative(safeRoot, path) : path);
  if (candidate !== safeRoot && !candidate.startsWith(`${safeRoot}/`)) {
    throw new Error('Path is outside the selected workspace.');
  }
  if (allowMissing) {
    const parent = await realpath(dirname(candidate));
    if (parent !== safeRoot && !parent.startsWith(`${safeRoot}/`)) {
      throw new Error('Path parent is outside the selected workspace.');
    }
    return candidate;
  }
  const resolved = await realpath(candidate);
  if (resolved !== safeRoot && !resolved.startsWith(`${safeRoot}/`)) {
    throw new Error('Resolved path is outside the selected workspace.');
  }
  return resolved;
}

function looksBinary(bytes: Buffer): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 8_192));
  return sample.includes(0);
}

function mimeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    case '.html':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.js':
    case '.mjs':
      return 'text/javascript';
    case '.json':
      return 'application/json';
    default:
      return 'text/plain';
  }
}

function isOfficePreview(path: string): boolean {
  return new Set([
    '.doc',
    '.docx',
    '.key',
    '.numbers',
    '.pages',
    '.ppt',
    '.pptx',
    '.xls',
    '.xlsx',
  ]).has(extname(path).toLowerCase());
}

async function quickLookDataUrl(path: string): Promise<string | undefined> {
  if (process.platform !== 'darwin') return undefined;
  const outputDir = await mkdtemp(join(tmpdir(), 'ganymede-preview-'));
  try {
    await execFileAsync('qlmanage', ['-t', '-s', '1400', '-o', outputDir, path], {
      timeout: 20_000,
    });
    const files = await readdir(outputDir);
    const preview = files.find((file) => file.endsWith('.png'));
    if (preview === undefined) return undefined;
    const bytes = await readFile(join(outputDir, preview));
    return `data:image/png;base64,${bytes.toString('base64')}`;
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
}

function summarizeChecks(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  let passed = 0;
  let failed = 0;
  let pending = 0;
  for (const raw of value) {
    const check = raw as Record<string, unknown>;
    const state = String(check['conclusion'] ?? check['state'] ?? '').toLowerCase();
    if (state === 'success') passed += 1;
    else if (state === 'failure' || state === 'error') failed += 1;
    else pending += 1;
  }
  return `${String(passed)} passed · ${String(failed)} failed · ${String(pending)} pending`;
}

function pullRequestFromRow(row: Record<string, unknown>): PullRequestSummary {
  return {
    number: Number(row['number']),
    title: String(row['title']),
    state: String(row['state']),
    url: String(row['url']),
    headRefName: String(row['headRefName']),
    baseRefName: String(row['baseRefName']),
    author: String(asObject(row['author'])['login'] ?? 'unknown'),
    reviewDecision: optionalText(row['reviewDecision']),
    checks: summarizeChecks(row['statusCheckRollup']),
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function arrayRecords(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asObject) : [];
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function firstLanAddress(): string | undefined {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return undefined;
}

async function serveStatic(
  root: string,
  requestPath: string,
  response: import('node:http').ServerResponse,
): Promise<void> {
  try {
    const requested = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    let path = await safeWorkspacePath(root, requested);
    const info = await stat(path);
    if (info.isDirectory()) path = join(path, 'index.html');
    response.setHeader('Content-Type', mimeFor(path));
    createReadStream(path).pipe(response);
  } catch {
    response.statusCode = 404;
    response.end('Not found');
  }
}
