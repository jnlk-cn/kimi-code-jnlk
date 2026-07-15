import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test('boots the desktop shell and shows the Ganymede brand', async () => {
  const app = await electron.launch({
    args: [join(process.cwd(), 'dist/main/index.js')],
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });
  try {
    const window = await app.firstWindow();
    await expect(window).toHaveTitle('Ganymede Code', { timeout: 30_000 });
    await window.waitForFunction(
      () =>
        document.querySelector('.splash-title, .brand-name, .home h1') !== null,
      undefined,
      { timeout: 60_000 },
    );
    const brand = window.locator('.brand-lockup');
    await expect(brand.locator('.brand-name')).toHaveText('伽利略 Code');
    await expect(brand.locator('.brand-subtitle')).toHaveText('GANYMEDE');
    await expect(brand.locator('.ganymede-mark')).toBeVisible();
    await expect(window.getByRole('button', { name: '搜索与命令' })).toBeVisible();
    await expect(window.getByRole('button', { name: '快速聊天' })).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('opens the composer context menu and switches modes through its submenu', async () => {
  const app = await electron.launch({
    args: [join(process.cwd(), 'dist/main/index.js')],
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });
  try {
    const window = await app.firstWindow();
    const projectPicker = window.locator('.composer-project');
    await expect(projectPicker).toBeVisible({ timeout: 60_000 });
    await projectPicker.click();
    const projectSearch = window.getByPlaceholder('搜索最近项目…');
    await expect(projectSearch).toBeFocused();
    await projectSearch.fill('no-matching-project');
    await expect(window.getByRole('menuitem', { name: '打开其他项目…' })).toBeVisible();
    await projectSearch.press('Escape');

    const addContext = window.getByRole('button', { name: '添加上下文与切换模式' });
    await expect(addContext).toBeVisible();
    await addContext.click();
    await expect(window.getByRole('menuitem', { name: /插入 @ 提及/ })).toBeVisible();
    const modeMenu = window.getByRole('menuitem', { name: /工作模式/ });
    await modeMenu.hover();
    await window.getByRole('menuitemradio', { name: /聊天/ }).click();
    await expect(window.locator('.composer-mode-status')).toContainText('聊天');

    const composer = window.getByPlaceholder(/向 Ganymede 提问/);
    await composer.fill('/pla');
    await expect(window.getByRole('option', { name: /\/plan/ })).toBeVisible();
    await composer.press('Enter');
    await composer.press('Enter');
    await expect(window.locator('.composer-mode-status')).toContainText('计划');
  } finally {
    await app.close();
  }
});

test('opens a filtered command with Enter and presents a readable account status', async () => {
  const app = await electron.launch({
    args: [join(process.cwd(), 'dist/main/index.js')],
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });
  try {
    const window = await app.firstWindow();
    await window.waitForFunction(
      () => document.querySelector('.home, .page-frame') !== null,
      undefined,
      { timeout: 60_000 },
    );

    await window.keyboard.press('Meta+k');
    const commandInput = window.getByPlaceholder('输入命令或搜索…');
    await commandInput.fill('设置');
    await commandInput.press('Enter');

    await expect(window.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
    const account = window.locator('.settings-section').filter({ hasText: 'Kimi 模型账号' });
    await expect(account.locator('p')).toHaveText(/^(已登录|未登录) Kimi 模型账号$/, {
      timeout: 30_000,
    });
  } finally {
    await app.close();
  }
});

test('opens the browser workspace with navigation, zoom, bookmarks, annotation, and devtools controls', async () => {
  const app = await electron.launch({
    args: [join(process.cwd(), 'dist/main/index.js')],
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });
  try {
    const window = await app.firstWindow();
    await window.getByRole('button', { name: '浏览器', exact: true }).click();

    await expect(window.getByRole('textbox', { name: '浏览器地址' })).toBeVisible();
    await expect(window.getByRole('button', { name: '适合面板宽度' })).toBeVisible();
    await expect(window.getByRole('button', { name: '收藏当前页面' })).toBeVisible();
    await expect(window.getByRole('button', { name: '标注页面元素' })).toBeVisible();
    await expect(window.getByRole('button', { name: '开发人员工具' })).toBeVisible();
    await expect(window.getByText('点击星标收藏当前页面')).toBeVisible();

    await window.getByRole('button', { name: '关闭浏览器面板' }).click();
    await expect(window.getByRole('textbox', { name: '浏览器地址' })).toHaveCount(0);
  } finally {
    await app.close();
  }
});
