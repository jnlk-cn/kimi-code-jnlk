import { describe, expect, it } from 'vitest';

import {
  describeAuthStatus,
  isAuthenticated,
  pullRequestErrorMessage,
} from '../src/renderer/presentation';
import {
  composerTriggerAt,
  fuzzyTextMatch,
  removeComposerTrigger,
} from '../src/renderer/composer-support';
import { filterPathSuggestions } from '../src/main/workspace-service';

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
});
