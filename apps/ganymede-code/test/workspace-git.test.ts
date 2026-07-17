import { mkdir, mkdtemp, rm, access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppStore } from '../src/main/store';
import { WorkspaceService } from '../src/main/workspace-service';

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
  return stdout.trim();
}

describe('WorkspaceService git', () => {
  let directory = '';
  let store: AppStore | undefined;
  let workspace: WorkspaceService | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ganymede-git-'));
    store = new AppStore(join(directory, 'test.sqlite'), join(directory, 'worktrees'));
    workspace = new WorkspaceService(
      store,
      {
        listSessions: async () => [],
      } as never,
      join(directory, 'worktrees'),
    );
  });

  afterEach(async () => {
    await workspace?.close();
    store?.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('initializes a plain directory and reports isGitRepository', async () => {
    const projectDir = join(directory, 'plain');
    await mkdir(projectDir);
    const current = workspace!;

    const before = await current.inspectProject(projectDir);
    expect(before.isGitRepository).toBe(false);

    const after = await current.gitInit(projectDir);
    expect(after.isGitRepository).toBe(true);
    await access(join(projectDir, '.git'));

    const again = await current.gitInit(projectDir);
    expect(again.isGitRepository).toBe(true);
    const { stdout } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: projectDir,
      encoding: 'utf8',
    });
    expect(stdout.trim()).toBe('true');
  });

  it('returns a non-empty diff for untracked files', async () => {
    const projectDir = join(directory, 'untracked');
    await mkdir(projectDir);
    const current = workspace!;
    await current.gitInit(projectDir);
    await writeFile(join(projectDir, 'hello.txt'), 'hello world\n');

    const status = await current.gitStatus(projectDir);
    expect(status.files.some((file) => file.path === 'hello.txt' && file.index === '?')).toBe(true);

    const diff = await current.gitDiff(projectDir, false, 'hello.txt');
    expect(diff.text).toContain('+hello world');
    expect(diff.file).toBe('hello.txt');
  });

  it('shows staged diff after gitStage', async () => {
    const projectDir = join(directory, 'staged');
    await mkdir(projectDir);
    const current = workspace!;
    await current.gitInit(projectDir);
    await writeFile(join(projectDir, 'readme.md'), '# title\n');
    await current.gitStage(projectDir, ['readme.md']);

    const status = await current.gitStatus(projectDir);
    expect(status.files.some((file) => file.path === 'readme.md' && file.index === 'A')).toBe(true);

    const diff = await current.gitDiff(projectDir, true, 'readme.md');
    expect(diff.text).toContain('+# title');
    expect(diff.staged).toBe(true);
  });

  it('creates and switches local branches', async () => {
    const projectDir = join(directory, 'branches');
    await mkdir(projectDir);
    const current = workspace!;
    await current.gitInit(projectDir);
    await writeFile(join(projectDir, 'seed.txt'), 'seed\n');
    await git(projectDir, ['add', 'seed.txt']);
    await git(projectDir, ['commit', '-m', 'seed']);

    const initial = await current.gitStatus(projectDir);
    const defaultBranch = initial.branch;

    await current.gitCreateBranch(projectDir, 'feature-x');
    let status = await current.gitStatus(projectDir);
    expect(status.branch).toBe('feature-x');

    const branches = await current.gitBranches(projectDir);
    expect(branches).toContain('feature-x');
    expect(branches).toContain(defaultBranch);

    await current.gitCheckout(projectDir, defaultBranch);
    status = await current.gitStatus(projectDir);
    expect(status.branch).toBe(defaultBranch);
  });

  it('fetches from a bare remote', async () => {
    const projectDir = join(directory, 'fetch-src');
    const bareDir = join(directory, 'fetch-bare.git');
    await mkdir(projectDir);
    const current = workspace!;
    await current.gitInit(projectDir);
    await writeFile(join(projectDir, 'seed.txt'), 'seed\n');
    await git(projectDir, ['add', 'seed.txt']);
    await git(projectDir, ['commit', '-m', 'seed']);
    await git(directory, ['clone', '--bare', projectDir, bareDir]);
    await git(projectDir, ['remote', 'add', 'origin', bareDir]);

    const output = await current.gitFetch(projectDir);
    expect(typeof output).toBe('string');
  });

  it('omits lineStats for a clean repository', async () => {
    const projectDir = join(directory, 'clean-stats');
    await mkdir(projectDir);
    const current = workspace!;
    await current.gitInit(projectDir);
    await writeFile(join(projectDir, 'seed.txt'), 'seed\n');
    await git(projectDir, ['add', 'seed.txt']);
    await git(projectDir, ['commit', '-m', 'seed']);

    const status = await current.gitStatus(projectDir);
    expect(status.clean).toBe(true);
    expect(status.lineStats).toBeUndefined();
  });

  it('reports lineStats for untracked files', async () => {
    const projectDir = join(directory, 'untracked-stats');
    await mkdir(projectDir);
    const current = workspace!;
    await current.gitInit(projectDir);
    await writeFile(join(projectDir, 'new.txt'), 'one\ntwo\nthree\n');

    const status = await current.gitStatus(projectDir);
    expect(status.lineStats).toEqual({
      total: { additions: 3, deletions: 0 },
      staged: { additions: 0, deletions: 0 },
      unstaged: { additions: 3, deletions: 0 },
    });
  });

  it('splits staged and unstaged lineStats for tracked edits', async () => {
    const projectDir = join(directory, 'split-stats');
    await mkdir(projectDir);
    const current = workspace!;
    await current.gitInit(projectDir);
    await writeFile(join(projectDir, 'notes.txt'), 'alpha\nbeta\n');
    await git(projectDir, ['add', 'notes.txt']);
    await git(projectDir, ['commit', '-m', 'seed']);

    await writeFile(join(projectDir, 'notes.txt'), 'alpha\nbeta\ngamma\n');
    await current.gitStage(projectDir, ['notes.txt']);
    await writeFile(join(projectDir, 'notes.txt'), 'alpha\nbeta\ngamma\ndelta\n');

    const status = await current.gitStatus(projectDir);
    expect(status.lineStats?.staged).toEqual({ additions: 1, deletions: 0 });
    expect(status.lineStats?.unstaged).toEqual({ additions: 1, deletions: 0 });
    expect(status.lineStats?.total).toEqual({ additions: 2, deletions: 0 });
  });

  it('reports ahead and behind against an upstream branch', async () => {
    const projectDir = join(directory, 'ahead-behind');
    const bareDir = join(directory, 'ahead-behind.git');
    await mkdir(projectDir);
    const current = workspace!;
    await current.gitInit(projectDir);
    await writeFile(join(projectDir, 'seed.txt'), 'seed\n');
    await git(projectDir, ['add', 'seed.txt']);
    await git(projectDir, ['commit', '-m', 'seed']);
    await git(directory, ['clone', '--bare', projectDir, bareDir]);
    await git(projectDir, ['remote', 'add', 'origin', bareDir]);
    await git(projectDir, ['fetch', 'origin']);
    const branch = (await current.gitStatus(projectDir)).branch;
    await git(projectDir, ['branch', '--set-upstream-to', `origin/${branch}`]);

    await writeFile(join(projectDir, 'seed.txt'), 'seed\nlocal\n');
    await git(projectDir, ['add', 'seed.txt']);
    await git(projectDir, ['commit', '-m', 'local ahead']);

    const cloneDir = join(directory, 'ahead-behind-clone');
    await git(directory, ['clone', bareDir, cloneDir]);
    await writeFile(join(cloneDir, 'seed.txt'), 'seed\nremote\n');
    await git(cloneDir, ['add', 'seed.txt']);
    await git(cloneDir, ['commit', '-m', 'remote ahead']);
    await git(cloneDir, ['push', 'origin', 'HEAD']);

    await current.gitFetch(projectDir);
    const status = await current.gitStatus(projectDir);
    expect(status.upstream).toBe(`origin/${branch}`);
    expect(status.ahead).toBe(1);
    expect(status.behind).toBe(1);
  });
});
