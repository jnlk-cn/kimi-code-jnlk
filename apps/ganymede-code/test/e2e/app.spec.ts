import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

function launchDesktop() {
  const userDataDir = test.info().outputPath('user-data');
  return electron.launch({
    args: [
      join(process.cwd(), 'dist/main/index.js'),
      `--user-data-dir=${userDataDir}`,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      GANYMEDE_HOME: test.info().outputPath('ganymede-home'),
    },
  });
}

test('boots the desktop shell and shows the Ganymede brand', async () => {
  const app = await launchDesktop();
  try {
    const window = await app.firstWindow();
    await expect(window).toHaveTitle('Ganymede Code', { timeout: 30_000 });
    await window.waitForFunction(
      () =>
        document.querySelector('.splash-title, .brand-lockup, .home h1') !== null,
      undefined,
      { timeout: 60_000 },
    );
    const brand = window.locator('.brand-lockup');
    await expect(brand.locator('.brand-name')).toHaveText('伽利略 Code');
    await expect(brand.locator('.brand-subtitle')).toHaveText('GANYMEDE');
    await expect(brand.locator('.ganymede-mark')).toBeVisible();
    await expect(window.getByRole('button', { name: '搜索任务与命令' })).toBeVisible();
    await expect(window.getByRole('button', { name: '快速聊天' })).toHaveCount(0);
    if (await window.locator('.workspace-rail').count() === 0) {
      await window.getByRole('button', { name: '切换右侧栏' }).click();
    }
    await expect(window.locator('.workspace-rail')).toBeVisible();
    await expect(window.locator('.workspace-tool-dock')).toBeVisible();
    await expect(window.locator('.workspace-tool-dock button')).toHaveCount(14);
    const toolDock = window.locator('.workspace-tool-dock');
    await expect(toolDock.getByRole('button', { name: '终端', exact: true })).toBeVisible();
    await expect(toolDock.getByRole('button', { name: '浏览器', exact: true })).toBeVisible();
    await expect(toolDock.getByRole('button', { name: '文件', exact: true })).toBeVisible();
    await expect(toolDock.getByRole('button', { name: '任务摘要', exact: true })).toBeVisible();
    await expect(toolDock.getByRole('button', { name: '审查改动', exact: true })).toBeVisible();
    await expect(toolDock.getByRole('button', { name: 'Agent 集群', exact: true })).toBeVisible();
    await expect(window.locator('.workspace-bottom-bar')).toBeVisible();
    await expect(window.locator('.topbar-actions').getByRole('button', { name: '浏览器', exact: true })).toHaveCount(0);

    await toolDock.getByRole('button', { name: '浏览器', exact: true }).click();
    await expect(toolDock.getByRole('button', { name: '浏览器', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(window.getByRole('textbox', { name: '浏览器地址' })).toBeVisible();
    await expect(window.locator('.workspace-rail .side-panel.browser')).toBeVisible();

    await window.getByRole('button', { name: '关闭浏览器面板' }).click();
    await expect(window.getByRole('textbox', { name: '浏览器地址' })).toHaveCount(0);
    await expect(window.locator('.workspace-tool-dock')).toBeVisible();
    await expect(toolDock.getByRole('button', { name: '浏览器', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await toolDock.getByRole('button', { name: '浏览器', exact: true }).click();

    await window.getByRole('button', { name: '切换右侧栏' }).click();
    await expect(window.getByRole('textbox', { name: '浏览器地址' })).toHaveCount(0);
    await expect(window.locator('.workspace-rail')).toHaveCount(0);

    await window.getByRole('button', { name: '切换右侧栏' }).click();
    await expect(window.locator('.workspace-rail')).toBeVisible();
    await expect(window.getByRole('textbox', { name: '浏览器地址' })).toBeVisible();
    await expect(toolDock.getByRole('button', { name: '浏览器', exact: true })).toHaveAttribute('aria-pressed', 'true');

    const railContent = window.locator('.workspace-rail-content');
    const widthBeforeResize = (await railContent.boundingBox())?.width ?? 0;
    const resizeHandle = await window.locator('.workspace-rail-resize-handle').boundingBox();
    if (resizeHandle !== null) {
      const storedWidthBefore = await window.evaluate(() =>
        window.localStorage.getItem('ganymede.browserPanelWidth'));
      await window.mouse.move(resizeHandle.x + resizeHandle.width / 2, resizeHandle.y + 120);
      await window.mouse.down();
      await window.mouse.move(resizeHandle.x - 36, resizeHandle.y + 120, { steps: 5 });
      await expect.poll(async () => (await railContent.boundingBox())?.width ?? 0)
        .toBeGreaterThan(widthBeforeResize + 20);
      expect(await window.evaluate(() =>
        window.localStorage.getItem('ganymede.browserPanelWidth'))).toBe(storedWidthBefore);
      await window.mouse.up();
      await expect.poll(async () => (await railContent.boundingBox())?.width ?? 0).toBeGreaterThan(widthBeforeResize + 20);
      expect(await window.evaluate(() =>
        window.localStorage.getItem('ganymede.browserPanelWidth'))).not.toBe(storedWidthBefore);
    }

    await window.emulateMedia({ reducedMotion: 'reduce' });
    const reducedMotionStyle = await railContent.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationDuration: Number.parseFloat(style.animationDuration) || 0,
        animationIterationCount: style.animationIterationCount,
        transitionDuration: Number.parseFloat(style.transitionDuration) || 0,
      };
    });
    expect(reducedMotionStyle.animationDuration).toBeLessThanOrEqual(0.001);
    expect(reducedMotionStyle.transitionDuration).toBeLessThanOrEqual(0.001);
    expect(reducedMotionStyle.animationIterationCount).toBe('1');
    await window.emulateMedia({ reducedMotion: 'no-preference' });

    // Embedded side panels must fill the rail content body (no legacy fixed-width gap).
    await expect.poll(async () => {
      return window.evaluate(() => {
        const body = document.querySelector('.workspace-rail-content__body');
        const panel = document.querySelector(
          '.workspace-rail-content__body > .side-panel.embedded',
        );
        if (!(body instanceof HTMLElement) || !(panel instanceof HTMLElement)) return null;
        return Math.abs(body.offsetWidth - panel.offsetWidth);
      });
    }).toBeLessThanOrEqual(2);

    await toolDock.getByRole('button', { name: '任务摘要', exact: true }).click();
    await expect(window.locator('.workspace-rail .side-panel.summary.embedded')).toBeVisible();
    await expect.poll(async () => {
      return window.evaluate(() => {
        const body = document.querySelector('.workspace-rail-content__body');
        const panel = document.querySelector(
          '.workspace-rail-content__body > .side-panel.summary.embedded',
        );
        if (!(body instanceof HTMLElement) || !(panel instanceof HTMLElement)) return null;
        return Math.abs(body.offsetWidth - panel.offsetWidth);
      });
    }).toBeLessThanOrEqual(2);

    for (const label of ['收件箱', '已安排', '本地站点', '记忆', '拉取请求', 'Git同步', '技能与插件']) {
      await expect(toolDock.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible();
    }
    await expect(window.getByText('更多功能', { exact: true })).toHaveCount(0);
    for (const heading of ['自动化任务', '功能加强', 'Git 管理']) {
      await expect(window.getByText(heading, { exact: true })).toHaveCount(0);
    }

    const projectMenuButton = window.getByRole('button', { name: /管理项目/ }).first();
    if (await projectMenuButton.count() > 0) {
      await projectMenuButton.click();
      for (const label of ['新建任务', '新建 Worktree 任务', '在终端中打开', '在 Finder 中显示', '添加工作目录', '从侧栏移除']) {
        await expect(window.getByRole('menuitem', { name: new RegExp(label, 'u') })).toBeVisible();
      }
      await window.keyboard.press('Escape');
    }

    const taskMenuButton = window.getByRole('button', { name: /管理任务/ }).first();
    if (await taskMenuButton.count() > 0) {
      await taskMenuButton.click();
      for (const label of ['打开任务', '重命名', '创建副本', '归档任务']) {
        await expect(window.getByRole('menuitem', { name: new RegExp(label, 'u') })).toBeVisible();
      }
      await expect(window.getByRole('menuitem', { name: /(置顶任务|取消置顶)/ })).toBeVisible();
      await window.keyboard.press('Escape');
    }

    await window.getByRole('button', { name: '切换右侧栏' }).click();
    await expect(window.locator('.workspace-rail')).toHaveCount(0);
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+p' : 'Control+p');
    await expect(window.locator('.workspace-rail')).toBeVisible();
    await expect(window.locator('.workspace-rail-content__header strong')).toHaveText('文件');

  } finally {
    await app.close();
  }
});

test('opens the composer context menu and switches modes through its submenu', async () => {
  const app = await launchDesktop();
  try {
    const window = await app.firstWindow();
    const projectPicker = window.locator('.composer-project');
    await expect(projectPicker).toBeVisible({ timeout: 60_000 });
    await projectPicker.click();
    const projectSearch = window.getByPlaceholder('搜索项目…');
    await expect(projectSearch).toBeFocused();
    await projectSearch.fill('no-matching-project');
    await expect(window.getByText('从电脑选择或新建目录…')).toBeVisible();
    await expect(window.getByText('添加辅助目录…')).toBeVisible();
    await projectSearch.press('Escape');

    const openProject = window.getByRole('button', { name: '打开项目', exact: true });
    await expect(openProject).toBeVisible();
    await openProject.click();
    await expect(window.getByPlaceholder('搜索项目…')).toBeFocused();
    await expect(window.getByText('从电脑选择或新建目录…')).toBeVisible();
    await window.getByPlaceholder('搜索项目…').press('Escape');

    const modeButton = window.getByRole('button', { name: '切换工作模式' });
    await expect(modeButton).toContainText('助理');
    await expect(window.getByPlaceholder('描述要构建、修复或探索的任务…')).toBeVisible();
    await expect(window.locator('.composer-hint')).toContainText('Shift+Tab 切换模式');
    await expect(window.locator('.composer-hint')).toContainText('打开模式菜单');
    await expect(window.locator('.composer-hint')).toContainText('Shift+Enter 换行');

    const addContext = window.getByRole('button', { name: '添加上下文与切换模式' });
    await expect(addContext).toBeVisible();
    await addContext.click();
    await expect(window.getByRole('menuitem', { name: /插入 @ 提及/ })).toBeVisible();
    const modeMenu = window.getByRole('menuitem', { name: /工作模式/ });
    await modeMenu.hover();
    await expect(window.getByRole('menuitemradio', { name: /工程/ })).toBeVisible();
    await window.getByRole('menuitemradio', { name: /聊天/ }).click();
    await expect(window.locator('.composer-mode-status')).toContainText('聊天');
    await expect(window.locator('.composer-mode-status.mode-ask')).toBeVisible();
    await expect(window.getByPlaceholder(/围绕当前项目提问/)).toBeVisible();
    await expect(window.locator('.composer-mode-hint.mode-ask')).toBeVisible();
    await expect(window.locator('.composer-mode-hint')).toContainText('不会修改项目文件');

    const composer = window.locator('.composer textarea');
    await composer.click();
    await composer.press(process.platform === 'darwin' ? 'Meta+.' : 'Control+.');
    await expect(window.getByRole('menuitemradio', { name: /助理/ })).toBeVisible();
    await window.keyboard.press('Escape');

    await composer.fill('/mode engineering');
    await composer.press('Enter');
    await expect(window.locator('.composer-mode-status')).toContainText('工程');
    await composer.click();
    await composer.press('Shift+Tab');
    await expect(window.locator('.composer-mode-status')).toContainText('助理');
    await expect(window.getByPlaceholder('描述要构建、修复或探索的任务…')).toBeVisible();

    await composer.click();
    await composer.press('Shift+Tab');
    await expect(window.locator('.composer-mode-status')).toContainText('计划');
    await expect(window.locator('.composer-mode-status.mode-plan')).toBeVisible();
    await expect(window.getByPlaceholder(/撰写可审阅的实现计划/)).toBeVisible();
    await expect(window.locator('.composer-mode-hint')).toBeVisible();
    await expect(window.locator('.composer-mode-hint')).toContainText('开始构建');

    await modeButton.click();
    await window.getByRole('menuitemradio', { name: /工程/ }).click();
    await expect(window.locator('.composer-mode-status')).toContainText('工程');
    await expect(window.locator('.composer-mode-hint.mode-engineering')).toBeVisible();
    await expect(window.locator('.composer-mode-hint')).toContainText('Tokens');

    await composer.fill('/mode plan');
    await composer.press('Enter');
    await expect(window.locator('.composer-mode-status')).toContainText('计划');

    const permissionButton = window.getByRole('button', { name: '切换权限模式' });
    await expect(permissionButton).toContainText('手动');
    await permissionButton.click();
    await window.getByRole('menuitemradio', { name: /Auto/ }).click();
    await expect(permissionButton).toContainText('Auto');

    await composer.fill('/yolo on');
    await composer.press('Enter');
    await expect(permissionButton).toContainText('YOLO');

    await addContext.click();
    await expect(window.getByRole('menuitem', { name: /添加附件/ })).toBeVisible();
    await expect(window.getByRole('menuitem', { name: /插入 \$ 技能/ })).toBeVisible();
    await window.keyboard.press('Escape');

    await window.locator('.composer').evaluate((element) => {
      const dataTransfer = new DataTransfer();
      const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'drop-test.png', {
        type: 'image/png',
      });
      Object.defineProperty(file, 'path', { value: '/tmp/ganymede-drop-test.png' });
      dataTransfer.items.add(file);
      element.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );
    });
    await expect(window.locator('.attachment-chip', { hasText: 'drop-test.png' })).toBeVisible();
  } finally {
    await app.close();
  }
});

test('opens a filtered command with Enter and presents a readable account status', async () => {
  const app = await launchDesktop();
  try {
    const window = await app.firstWindow();
    await window.waitForFunction(
      () => document.querySelector('.home, .page-frame') !== null,
      undefined,
      { timeout: 60_000 },
    );

    await window.keyboard.press('Meta+k');
    const commandInput = window.getByPlaceholder('搜索任务或命令…');
    await commandInput.fill('设置');
    await commandInput.press('Enter');

    await expect(window.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
    const account = window.locator('.settings-section').filter({ hasText: 'Kimi 模型账号' });
    await expect(account.getByText(/^(已登录|未登录) Kimi 模型账号$/)).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await app.close();
  }
});

test('command palette lists matching tasks when sessions exist', async () => {
  const app = await launchDesktop();
  try {
    const window = await app.firstWindow();
    await window.waitForFunction(
      () => document.querySelector('.home, .page-frame') !== null,
      undefined,
      { timeout: 60_000 },
    );

    await window.getByRole('button', { name: '搜索任务与命令' }).click();
    const commandInput = window.getByPlaceholder('搜索任务或命令…');
    await expect(commandInput).toBeFocused();

    const taskRows = window.locator('.task-entry');
    const taskCount = await taskRows.count();
    if (taskCount === 0) {
      await commandInput.fill('设置');
      await expect(window.getByText('设置', { exact: true }).first()).toBeVisible();
      await expect(window.locator('.command-group-label', { hasText: '任务' })).toHaveCount(0);
      return;
    }

    const taskTitle = (await taskRows.first().locator('strong').textContent())?.trim() ?? '';
    expect(taskTitle.length).toBeGreaterThan(0);
    const query = taskTitle.slice(0, Math.min(4, taskTitle.length));
    await commandInput.fill(query);
    await expect(window.locator('.command-group-label', { hasText: '任务' })).toBeVisible();
    await expect(window.locator('.command-results button').filter({ hasText: taskTitle }).first()).toBeVisible();
    await commandInput.press('Enter');
    await expect(window.locator('.command-backdrop')).toHaveCount(0);
    await expect(window.locator('.task-row[aria-current="page"]')).toBeVisible({ timeout: 30_000 });

    const timeline = window.locator('.timeline');
    if (await timeline.count() > 0) {
      const initialEntryCount = await timeline.locator('.timeline-entry').count();
      expect(initialEntryCount).toBeLessThanOrEqual(80);
      expect(await timeline.evaluate((element) => element.querySelectorAll('*').length))
        .toBeLessThanOrEqual(1_500);

      const completedTool = timeline
        .locator('.tool-block:not(.agent-swarm-progress):not([open])')
        .first();
      if (await completedTool.count() > 0) {
        await expect(completedTool.locator('.tool-block-body')).toHaveCount(0);
        await completedTool.locator('summary').click();
        await expect(completedTool.locator('.tool-block-body')).toBeVisible();
        await completedTool.locator('summary').click();
        await expect(completedTool.locator('.tool-block-body')).toHaveCount(0);
      }

      const historyLoader = timeline.getByRole('button', { name: '加载更早记录' });
      if (await historyLoader.count() > 0) {
        const before = await timeline.locator('.timeline-entry').count();
        await historyLoader.click();
        await expect.poll(() => timeline.locator('.timeline-entry').count()).toBeGreaterThan(before);
      }

      const turnMarker = window.locator('.timeline-turn-rail-item').first();
      if (await turnMarker.count() > 0) {
        await turnMarker.click();
        await expect(window.locator('.user-message[id^="turn-"]').first()).toBeAttached();
      }
    }
  } finally {
    await app.close();
  }
});

test('opens the browser workspace with navigation, zoom, bookmarks, annotation, and devtools controls', async () => {
  const app = await launchDesktop();
  try {
    const window = await app.firstWindow();
    await window.waitForFunction(
      () => document.querySelector('.home, .page-frame') !== null,
      undefined,
      { timeout: 60_000 },
    );
    if (await window.locator('.workspace-tool-dock').count() === 0) {
      await window.getByRole('button', { name: '切换右侧栏' }).click();
    }
    await window.locator('.workspace-tool-dock').getByRole('button', { name: '浏览器', exact: true }).click();

    await expect(window.getByRole('textbox', { name: '浏览器地址' })).toBeVisible();
    await expect(window.getByRole('button', { name: '收藏当前页面' })).toBeVisible();
    await expect(window.getByRole('button', { name: '标注页面元素' })).toBeVisible();
    await expect(window.getByRole('button', { name: '开发者工具' })).toBeVisible();
    await expect(window.getByRole('button', { name: '浏览器菜单' })).toBeVisible();
    await window.getByRole('button', { name: '浏览器菜单' }).click();
    await expect(window.getByRole('menuitemradio', { name: '适合宽度' })).toBeVisible();
    await expect(window.getByText('点击星标收藏当前页面')).toBeVisible();

    await window.getByRole('button', { name: '关闭浏览器面板' }).click();
    await expect(window.getByRole('textbox', { name: '浏览器地址' })).toHaveCount(0);

    const terminalTool = window.locator('.workspace-tool-dock').getByRole('button', { name: '终端', exact: true });
    await terminalTool.click();
    await expect(window.locator('.workspace-rail .side-panel.terminal')).toBeVisible();
    await expect(window.locator('.workspace-body .side-panel.terminal')).toHaveCount(0);
    await terminalTool.click();
    await expect(window.locator('.side-panel.terminal')).toHaveCount(0);
    await expect(window.locator('.workspace-bottom-bar')).toBeVisible();
  } finally {
    await app.close();
  }
});
