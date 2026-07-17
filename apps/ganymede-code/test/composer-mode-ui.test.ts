import { describe, expect, it } from 'vitest';

import {
  composerFooterHint,
  composerModeHint,
  composerPlaceholder,
  interactionModeClassName,
  interactionModeMenuDescription,
  INTERACTION_MODE_MENU_ORDER,
  INTERACTION_MODE_SHIFT_TAB_CYCLE,
  modeSwitchShortcutLabel,
  nextShiftTabInteractionMode,
} from '../src/renderer/composer-mode-ui';

describe('INTERACTION_MODE_SHIFT_TAB_CYCLE', () => {
  it('excludes engineering from the Cursor-style core cycle', () => {
    expect(INTERACTION_MODE_SHIFT_TAB_CYCLE).toEqual([
      'agent',
      'plan',
      'debug',
      'multitask',
      'ask',
    ]);
    expect(INTERACTION_MODE_SHIFT_TAB_CYCLE).not.toContain('engineering');
  });
});

describe('INTERACTION_MODE_MENU_ORDER', () => {
  it('lists core modes first and engineering last', () => {
    expect(INTERACTION_MODE_MENU_ORDER).toEqual([
      'agent',
      'plan',
      'debug',
      'multitask',
      'ask',
      'engineering',
    ]);
  });
});

describe('composerPlaceholder', () => {
  it('uses a task-oriented agent placeholder when idle', () => {
    expect(
      composerPlaceholder('agent', { running: false, steerShortcut: '⌘↵' }),
    ).toBe('描述要构建、修复或探索的任务…');
  });

  it('uses a plan-specific placeholder when idle', () => {
    expect(
      composerPlaceholder('plan', { running: false, steerShortcut: '⌘↵' }),
    ).toContain('实现计划');
  });

  it('uses the queue/steer placeholder while running', () => {
    expect(
      composerPlaceholder('agent', { running: true, steerShortcut: '⌘↵' }),
    ).toBe('输入后续指示以排队，⌘↵ 立即注入当前运行…');
  });
});

describe('composerFooterHint', () => {
  it('includes Shift+Tab and mode menu shortcut when idle', () => {
    expect(
      composerFooterHint({
        target: 'local',
        running: false,
        steerShortcut: '⌘↵',
        platform: 'darwin',
      }),
    ).toBe('本地工作区 · Enter 发送 · Shift+Enter 换行 · Shift+Tab 切换模式 · ⌘. 打开模式菜单');
  });

  it('includes steer shortcut when running', () => {
    expect(
      composerFooterHint({
        target: 'local',
        running: true,
        steerShortcut: 'Ctrl+Enter',
        platform: 'linux',
      }),
    ).toBe('本地工作区 · Enter 排队 · Ctrl+Enter 立即注入 · Shift+Enter 换行');
  });
});

describe('interactionModeClassName', () => {
  it('returns the mode-* class for each interaction mode', () => {
    expect(interactionModeClassName('ask')).toBe('mode-ask');
    expect(interactionModeClassName('plan')).toBe('mode-plan');
    expect(interactionModeClassName('engineering')).toBe('mode-engineering');
  });
});

describe('modeSwitchShortcutLabel', () => {
  it('uses the platform modifier glyph', () => {
    expect(modeSwitchShortcutLabel('darwin')).toBe('⌘.');
    expect(modeSwitchShortcutLabel('win32')).toBe('Ctrl+.');
  });
});

describe('interactionModeMenuDescription', () => {
  it('marks engineering as menu/slash only', () => {
    expect(
      interactionModeMenuDescription('engineering', '系统化工作流', false),
    ).toContain('不参与 Shift+Tab');
  });

  it('appends Shift+Tab for core modes', () => {
    expect(
      interactionModeMenuDescription('agent', '执行完整的软件开发任务', false),
    ).toBe('执行完整的软件开发任务 · Shift+Tab');
  });
});

describe('composerModeHint', () => {
  it('returns plan hint when idle without pending approval', () => {
    expect(
      composerModeHint('plan', { running: false, planApprovalPending: false }),
    ).toContain('开始构建');
  });

  it('hides plan hint while approval is pending or task is running', () => {
    expect(
      composerModeHint('plan', { running: false, planApprovalPending: true }),
    ).toBeUndefined();
    expect(
      composerModeHint('plan', { running: true, planApprovalPending: false }),
    ).toBeUndefined();
  });

  it('returns engineering, ask, and debug hints when idle', () => {
    expect(
      composerModeHint('engineering', { running: false, planApprovalPending: false }),
    ).toContain('Tokens');
    expect(
      composerModeHint('ask', { running: false, planApprovalPending: false }),
    ).toContain('不会修改项目文件');
    expect(
      composerModeHint('debug', { running: false, planApprovalPending: false }),
    ).toContain('手动验证');
  });

  it('returns undefined for modes without a dock hint', () => {
    expect(
      composerModeHint('agent', { running: false, planApprovalPending: false }),
    ).toBeUndefined();
  });
});

describe('nextShiftTabInteractionMode re-export path', () => {
  it('cycles from ask back to agent', () => {
    expect(nextShiftTabInteractionMode('ask')).toBe('agent');
  });
});
