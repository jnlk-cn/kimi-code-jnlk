import { describe, expect, it } from 'vitest';

import {
  buildPullRequestFixPrompt,
  describeAuthStatus,
  gitErrorMessage,
  isAuthenticated,
  pullRequestErrorMessage,
} from '../src/renderer/presentation';
import {
  contextUsageSeverity,
  formatContextPercent,
  formatTokenCount,
  resolveContextUsageDisplay,
  safeContextRatio,
  sumContextUsageCategories,
} from '../src/renderer/context-usage';
import {
  billingSnapshotToTelemetry,
  buildTelemetrySegments,
  joinTelemetrySegments,
} from '../src/renderer/footer-telemetry';
import {
  formatFooterContextStatus,
  formatFooterGitBadge,
  shortenFooterWorkDir,
} from '../src/renderer/footer-status';
import {
  composerTriggerAt,
  fuzzyTextMatch,
  removeComposerTrigger,
  resolveSlashSubmitText,
} from '../src/renderer/composer-support';
import type { SessionSnapshot } from '../src/shared/contracts';
import {
  attachmentKindForFile,
  canAttachFile,
  fileToAttachment,
  filesFromDataTransfer,
  imageFilesFromClipboard,
  mergeAttachments,
} from '../src/renderer/composer-attachments';
import {
  permissionDescription,
  permissionToolbarLabel,
  resolvePermissionToggle,
} from '../src/renderer/permission-ui';
import {
  handleAlignedSlashCommand,
  parseSlashInput,
  type SlashCommandHost,
} from '../src/renderer/slash-commands';
import { EDITOR_PRESETS } from '../src/main/editor-launcher';
import { filterPathSuggestions } from '../src/main/workspace-service';
import { EDITOR_BUILTIN_ICON_IDS } from '../src/renderer/components/editor-icons';
import { indexBadgeLabel, indexStatusTitle } from '../src/renderer/project-index-status';

function fileWith(
  name: string,
  type: string,
  options: { readonly path?: string; readonly size?: number } = {},
): File {
  const file = new File([new Uint8Array([1, 2, 3])], name, { type });
  if (options.path !== undefined) {
    Object.defineProperty(file, 'path', { value: options.path });
  }
  return file;
}

describe('authentication presentation', () => {
  it('uses readable login states instead of serializing the transport object', () => {
    const signedOut = {
      providers: [{ providerName: 'managed:kimi-code', hasToken: false }],
    };
    const signedIn = {
      providers: [{ providerName: 'managed:kimi-code', hasToken: true }],
    };

    expect(isAuthenticated(signedOut)).toBe(false);
    expect(describeAuthStatus(signedOut)).toBe('未登录 Kimi 模型账号');
    expect(isAuthenticated(signedIn)).toBe(true);
    expect(describeAuthStatus(signedIn)).toBe('已登录 Kimi 模型账号');
  });
});

describe('context usage formatting', () => {
  it('clamps ratios and formats percent and token counts', () => {
    expect(safeContextRatio(56_700, 200_000)).toBeCloseTo(0.2835, 4);
    expect(safeContextRatio(10, 0)).toBe(0);
    expect(safeContextRatio(Number.NaN, 100)).toBe(0);
    expect(formatContextPercent(0.2835)).toBe('28%');
    expect(formatContextPercent(1.5)).toBe('100%');
    expect(formatTokenCount(478)).toBe('478');
    expect(formatTokenCount(8300)).toBe('8.3K');
    expect(formatTokenCount(56_700)).toBe('56.7K');
    expect(formatTokenCount(200_000)).toBe('200K');
  });

  it('maps fill ratios to severity', () => {
    expect(contextUsageSeverity(0.2)).toBe('ok');
    expect(contextUsageSeverity(0.5)).toBe('warn');
    expect(contextUsageSeverity(0.85)).toBe('danger');
  });

  it('sums category estimates and ignores empty or invalid values', () => {
    expect(sumContextUsageCategories(undefined)).toBe(0);
    expect(sumContextUsageCategories({})).toBe(0);
    expect(
      sumContextUsageCategories({
        systemPrompt: 4_900,
        toolDefinitions: 16_700,
        rules: 0,
        skills: 232,
        subagentDefinitions: 391,
        conversation: Number.NaN,
      }),
    ).toBe(22_223);
  });

  it('resolves display tokens from model fill or category estimates', () => {
    const beforeFirstStep = resolveContextUsageDisplay({
      contextTokens: 0,
      maxContextTokens: 1_000_000,
      categories: {
        systemPrompt: 4_900,
        toolDefinitions: 16_700,
        skills: 232,
        subagentDefinitions: 391,
      },
    });
    expect(beforeFirstStep.displayTokens).toBe(22_223);
    expect(beforeFirstStep.ratio).toBeCloseTo(0.022223, 5);

    const afterStep = resolveContextUsageDisplay({
      contextTokens: 50_000,
      maxContextTokens: 1_000_000,
      categories: {
        systemPrompt: 5_000,
        toolDefinitions: 10_000,
        conversation: 35_000,
      },
    });
    expect(afterStep.displayTokens).toBe(50_000);
    expect(afterStep.ratio).toBeCloseTo(0.05, 5);

    const noWindow = resolveContextUsageDisplay({
      contextTokens: 22_223,
      maxContextTokens: 0,
      categories: { systemPrompt: 22_223 },
    });
    expect(noWindow.displayTokens).toBe(22_223);
    expect(noWindow.ratio).toBe(0);
  });
});

describe('pullRequestErrorMessage', () => {
  it('does not expose the failed command or remote endpoint', () => {
    const message = pullRequestErrorMessage(
      new Error(
        `Error invoking remote method 'git:pull-requests': Command failed: gh pr list Post "https://api.github.com/graphql": EOF`,
      ),
    );

    expect(message).toBe('无法加载拉取请求。请检查网络连接和 GitHub CLI 登录状态后重试。');
    expect(message).not.toContain('gh pr list');
    expect(message).not.toContain('api.github.com');
  });

  it('gives actionable messages for missing and unauthenticated GitHub CLI', () => {
    expect(pullRequestErrorMessage(new Error('spawn gh ENOENT'))).toContain('未找到 GitHub CLI');
    expect(pullRequestErrorMessage(new Error('HTTP 401 authentication failed'))).toContain(
      'gh auth login',
    );
  });
});

describe('buildPullRequestFixPrompt', () => {
  it('includes title, reviews, comments, and files for the agent', () => {
    const prompt = buildPullRequestFixPrompt({
      number: 12,
      title: 'Fix flaky test',
      state: 'OPEN',
      url: 'https://github.com/example/repo/pull/12',
      headRefName: 'fix/flaky',
      baseRefName: 'main',
      author: 'alice',
      reviewDecision: 'CHANGES_REQUESTED',
      checks: '1 failing',
      body: 'Stabilize CI.',
      reviews: [{ author: 'bob', state: 'CHANGES_REQUESTED', body: 'Please retry on failure.' }],
      comments: [{ author: 'carol', body: 'Also update the timeout.' }],
      files: [{ path: 'test/flaky.test.ts', additions: 3, deletions: 1 }],
    });
    expect(prompt).toContain('#12');
    expect(prompt).toContain('Fix flaky test');
    expect(prompt).toContain('Please retry on failure.');
    expect(prompt).toContain('Also update the timeout.');
    expect(prompt).toContain('test/flaky.test.ts');
  });
});

describe('gitErrorMessage', () => {
  it('maps not-a-repo errors without exposing git flags', () => {
    const message = gitErrorMessage(
      new Error(
        'Command failed: git status --porcelain=v1 --branch -z\nfatal: not a git repository (or any of the parent directories): .git',
      ),
    );
    expect(message).toBe('当前目录不是 Git 仓库。');
    expect(message).not.toContain('porcelain');
    expect(message).not.toContain('fatal:');
  });

  it('maps missing git executable errors', () => {
    expect(gitErrorMessage(new Error('spawn git ENOENT'))).toBe('未找到 Git。请安装 Git 后重试。');
  });

  it('falls back to a generic git failure message', () => {
    expect(gitErrorMessage(new Error('permission denied'))).toBe('Git 操作失败，请稍后重试。');
  });
});

describe('composer suggestions', () => {
  it('detects all supported trigger tokens at the caret', () => {
    expect(composerTriggerAt('Review @src/App', 15)).toMatchObject({
      trigger: '@',
      query: 'src/App',
      start: 7,
    });
    expect(composerTriggerAt('/pla', 4)).toMatchObject({ trigger: '/', query: 'pla' });
    expect(composerTriggerAt('Use $writer', 11)).toMatchObject({ trigger: '$', query: 'writer' });
    expect(composerTriggerAt('See #task', 9)).toMatchObject({ trigger: '#', query: 'task' });
  });

  it('removes a selected trigger without damaging surrounding text', () => {
    const context = composerTriggerAt('Review @src now', 11)!;
    expect(removeComposerTrigger('Review @src now', context)).toBe('Review  now');
  });

  it('supports fuzzy matching and ranks workspace paths', () => {
    expect(fuzzyTextMatch('计划模式', '计划')).toBe(true);
    expect(fuzzyTextMatch('multitask', 'mltsk')).toBe(true);
    const results = filterPathSuggestions([
      { root: '/tmp/example', path: 'src/components/App.tsx', name: 'App.tsx', kind: 'file' },
      { root: '/tmp/example', path: 'src/app', name: 'app', kind: 'directory' },
    ], 'app');
    expect(results.map((item) => item.path)).toEqual(['src/app', 'src/components/App.tsx']);
  });

  it('resolves slash submit text for Enter-to-execute', () => {
    const partial = composerTriggerAt('/pla', 4)!;
    expect(resolveSlashSubmitText('/pla', partial, 'plan')).toBe('/plan');

    // Args already typed: keep the full line even if a command is selected.
    expect(
      resolveSlashSubmitText(
        '/compact keep memories',
        { trigger: '/', query: 'compact keep memories', start: 0, end: 22 },
        'compact',
      ),
    ).toBe('/compact keep memories');

    const exact = composerTriggerAt('/status', 7)!;
    expect(resolveSlashSubmitText('/status', exact)).toBe('/status');
  });
});

describe('composer attachments', () => {
  it('infers attachment kind from MIME type', () => {
    expect(attachmentKindForFile(fileWith('a.png', 'image/png'))).toBe('image');
    expect(attachmentKindForFile(fileWith('a.mp4', 'video/mp4'))).toBe('video');
    expect(attachmentKindForFile(fileWith('a.pdf', 'application/pdf'))).toBe('file');
  });

  it('accepts absolute paths and media without paths', () => {
    expect(canAttachFile(fileWith('doc.pdf', 'application/pdf', { path: '/tmp/doc.pdf' }))).toBe(true);
    expect(canAttachFile(fileWith('shot.png', 'image/png'))).toBe(true);
    expect(canAttachFile(fileWith('doc.pdf', 'application/pdf'))).toBe(false);
  });

  it('reads image data URLs and preserves Electron paths', async () => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      error: DOMException | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsDataURL(file: Blob): void {
        void file;
        this.result = 'data:image/png;base64,AQID';
        queueMicrotask(() => this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>));
      }
    }
    const previous = globalThis.FileReader;
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
    try {
      const attachment = await fileToAttachment(
        fileWith('shot.png', 'image/png', { path: '/tmp/shot.png' }),
      );
      expect(attachment).toMatchObject({
        kind: 'image',
        name: 'shot.png',
        path: '/tmp/shot.png',
      });
      expect(attachment.dataUrl?.startsWith('data:image/png')).toBe(true);
    } finally {
      globalThis.FileReader = previous;
    }
  });

  it('collects files from dataTransfer and clipboard image items', () => {
    const pdf = fileWith('a.pdf', 'application/pdf', { path: '/tmp/a.pdf' });
    const png = fileWith('b.png', 'image/png');
    const dataTransfer = {
      files: [pdf, png] as unknown as FileList,
      items: [
        { type: 'text/plain', getAsFile: () => null },
        { type: 'image/png', getAsFile: () => png },
      ],
    } as unknown as DataTransfer;
    expect(filesFromDataTransfer(dataTransfer).map((file) => file.name)).toEqual(['a.pdf', 'b.png']);
    expect(imageFilesFromClipboard(dataTransfer).map((file) => file.name)).toEqual(['b.png']);
  });

  it('merges attachments without duplicating paths', () => {
    const current = [{ kind: 'file' as const, name: 'a.pdf', path: '/tmp/a.pdf' }];
    const next = [
      { kind: 'file' as const, name: 'a.pdf', path: '/tmp/a.pdf' },
      { kind: 'image' as const, name: 'b.png', path: '/tmp/b.png' },
    ];
    expect(mergeAttachments(current, next)).toEqual([
      current[0],
      next[1],
    ]);
  });
});

describe('permission mode UI', () => {
  it('uses Kimi-aligned short labels and descriptions', () => {
    expect(permissionToolbarLabel('manual')).toBe('手动');
    expect(permissionToolbarLabel('auto')).toBe('Auto');
    expect(permissionToolbarLabel('yolo')).toBe('YOLO');
    expect(permissionDescription('auto')).toContain('自动执行所有操作');
    expect(permissionDescription('yolo')).toContain('AI');
  });

  it('resolves /auto and /yolo on/off/toggle semantics', () => {
    expect(resolvePermissionToggle('manual', 'auto', '')).toEqual({
      next: 'auto',
      notice: expect.stringContaining('Auto'),
    });
    expect(resolvePermissionToggle('auto', 'auto', '')).toEqual({
      next: 'manual',
      notice: 'Auto 模式：关闭',
    });
    expect(resolvePermissionToggle('auto', 'auto', 'on')).toEqual({
      already: 'Auto 模式已开启',
    });
    expect(resolvePermissionToggle('manual', 'yolo', 'on')).toMatchObject({ next: 'yolo' });
    expect(resolvePermissionToggle('yolo', 'yolo', 'off')).toMatchObject({ next: 'manual' });
  });
});

function createSlashHost(overrides: Partial<SlashCommandHost> = {}): SlashCommandHost {
  return {
    session: undefined,
    draftPermission: 'manual',
    draftInteractionMode: 'agent',
    showError: () => undefined,
    showNotice: () => undefined,
    applyPermissionMode: async () => undefined,
    applyInteractionMode: async () => true,
    openComposerMenu: () => undefined,
    handleSwarmCommand: async () => undefined,
    compactSession: async () => undefined,
    initSession: async () => undefined,
    getSessionUsage: async () => ({}),
    clearSessionPlan: async () => undefined,
    appendStatus: () => undefined,
    ...overrides,
  };
}

function sessionSnapshot(overrides: {
  readonly running?: boolean;
  readonly model?: string;
} = {}): SessionSnapshot {
  return {
    id: 'session-1',
    workDir: '/tmp/example',
    title: 'Example',
    status: {
      running: overrides.running ?? false,
      model: overrides.model ?? 'kimi-k2',
      permission: 'manual',
      interactionMode: 'agent',
      planMode: false,
      swarmMode: false,
      askMode: false,
      debugMode: false,
      engineeringMode: false,
      contextTokens: 0,
      maxContextTokens: 128_000,
    },
    replay: [],
    liveEvents: [],
    additionalDirs: [],
  };
}

describe('aligned slash commands', () => {
  it('parses slash input', () => {
    expect(parseSlashInput('/auto on')).toEqual({ name: 'auto', args: 'on' });
    expect(parseSlashInput('hello')).toBeNull();
  });

  it('toggles auto permission via /auto', async () => {
    const applied: string[] = [];
    const notices: string[] = [];
    const host = createSlashHost({
      showNotice: (message) => notices.push(message),
      applyPermissionMode: async (mode) => {
        applied.push(mode);
      },
    });
    expect(await handleAlignedSlashCommand(host, '/auto')).toBe(true);
    expect(applied).toEqual(['auto']);
    expect(notices[0]).toContain('Auto');
  });

  it('opens the permission menu for /permission', async () => {
    const opened: string[] = [];
    const host = createSlashHost({
      openComposerMenu: (kind) => opened.push(kind),
    });
    expect(await handleAlignedSlashCommand(host, '/permission')).toBe(true);
    expect(opened).toEqual(['permission']);
  });

  it('runs /init when idle with a configured model', async () => {
    const inits: string[] = [];
    const notices: string[] = [];
    const host = createSlashHost({
      session: sessionSnapshot(),
      showNotice: (message) => notices.push(message),
      initSession: async (sessionId) => {
        inits.push(sessionId);
      },
    });
    expect(await handleAlignedSlashCommand(host, '/init')).toBe(true);
    expect(inits).toEqual(['session-1']);
    expect(notices[0]).toContain('AGENTS.md');
  });

  it('blocks /init while a turn is running', async () => {
    const inits: string[] = [];
    const errors: string[] = [];
    const host = createSlashHost({
      session: sessionSnapshot({ running: true }),
      showError: (message) => errors.push(message),
      initSession: async (sessionId) => {
        inits.push(sessionId);
      },
    });
    expect(await handleAlignedSlashCommand(host, '/init')).toBe(true);
    expect(inits).toEqual([]);
    expect(errors[0]).toContain('/init');
  });
});

describe('footer status helpers', () => {
  it('shortens workdirs like the CLI footer', () => {
    expect(shortenFooterWorkDir('/Users/alice/DevProjects/testdp')).toBe('~/DevProjects/testdp');
    expect(shortenFooterWorkDir('/Users/alice/a/b/c/d/e')).toBe('…/c/d/e');
  });

  it('formats git badges like the CLI footer', () => {
    expect(
      formatFooterGitBadge({
        branch: 'main',
        ahead: 0,
        behind: 0,
        files: [],
        clean: true,
      }),
    ).toBe('main');
    expect(
      formatFooterGitBadge({
        branch: 'No',
        ahead: 0,
        behind: 0,
        files: [{ path: 'a.ts', index: 'M', worktree: ' ' }],
        clean: false,
      }),
    ).toBe('No [1]');
  });

  it('formats context usage like the CLI footer', () => {
    expect(formatFooterContextStatus(12_500, 128_000)).toBe('context: 9.8% (12.5k/128.0k)');
  });
});

describe('footer telemetry helpers', () => {
  it('builds and truncates telemetry segments with kimi-code priority', () => {
    const segments = buildTelemetrySegments(
      billingSnapshotToTelemetry({
        enabled: true,
        balanceCny: '12.38',
        grantedCny: null,
        toppedUpCny: null,
        balanceAvailable: true,
        balanceFetchedAtMs: Date.now(),
        sessionInput: 42_000,
        sessionOutput: 8_000,
        sessionCacheHit: 26_000,
        sessionCacheMiss: 16_000,
        sessionCacheHitPct: 62,
        estimatedCostCny: 0.18,
        isPeakNow: false,
        modelId: 'deepseek-chat',
        rates: null,
        peakRates: null,
        pricingSource: 'embedded',
      }),
      Date.UTC(2026, 6, 8, 14, 0, 0),
    );
    const full = joinTelemetrySegments(segments, 200).map((segment) => segment.text).join(' · ');
    expect(full).toContain('缓存');
    expect(full).toContain('约');
    expect(full).toContain('余额');

    const narrow = joinTelemetrySegments(segments, 24).map((segment) => segment.text).join(' · ');
    expect(narrow).toContain('缓存');
    expect(narrow).not.toContain('会话');
  });
});

describe('project index status presentation', () => {
  it('labels idle, disabled, and ready states for the topbar badge', () => {
    expect(indexBadgeLabel(undefined)).toBe('索引…');
    expect(indexBadgeLabel({ workDir: '/tmp', state: 'idle', progress: 0, fileCount: 0, chunkCount: 0, embeddedCount: 0, semanticReady: false, embedderId: 'none' })).toBe('未索引');
    expect(indexBadgeLabel({ workDir: '/tmp', state: 'disabled', progress: 0, fileCount: 0, chunkCount: 0, embeddedCount: 0, semanticReady: false, embedderId: 'none' })).toBe('索引关闭');
    expect(indexBadgeLabel({ workDir: '/tmp', state: 'ready', progress: 1, fileCount: 11, chunkCount: 44, embeddedCount: 40, semanticReady: true, embedderId: 'hash' })).toBe('已索引');
  });

  it('describes idle and disabled states in tooltips', () => {
    expect(indexStatusTitle(undefined)).toContain('读取索引状态');
    expect(indexStatusTitle({ workDir: '/tmp', state: 'idle', progress: 0, fileCount: 0, chunkCount: 0, embeddedCount: 0, semanticReady: false, embedderId: 'none' })).toContain('尚未建立');
    expect(indexStatusTitle({ workDir: '/tmp', state: 'disabled', progress: 0, fileCount: 0, chunkCount: 0, embeddedCount: 0, semanticReady: false, embedderId: 'none' })).toContain('关闭');
    expect(indexStatusTitle({ workDir: '/tmp', state: 'ready', progress: 1, fileCount: 11, chunkCount: 44, embeddedCount: 40, semanticReady: true, embedderId: 'hash' })).toBe('索引 11 个文件 · 44 块');
  });
});

describe('editor builtin icons', () => {
  it('covers every EDITOR_PRESETS id with a builtin brand icon', () => {
    expect(new Set(EDITOR_BUILTIN_ICON_IDS)).toEqual(
      new Set(EDITOR_PRESETS.map((preset) => preset.id)),
    );
  });
});
