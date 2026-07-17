import { describe, expect, it } from 'vitest';

import {
  EDITOR_PRESETS,
  listAvailableEditors,
  quoteShellArg,
  resolveEditorAppIcon,
  resolveEditorCommand,
  resolveInstalledEditor,
} from '../src/main/editor-launcher';

describe('editor-launcher', () => {
  it('resolves command priority', () => {
    expect(resolveEditorCommand(undefined, 'cursor')).toBe('cursor');
    expect(resolveEditorCommand('code', undefined)).toBe('code');
    expect(resolveEditorCommand('  zed  ', '')).toBe('zed');
  });

  it('quotes shell args with spaces', () => {
    expect(quoteShellArg('/tmp/my project')).toBe("'/tmp/my project'");
    expect(quoteShellArg('plain')).toBe('plain');
  });

  it('exposes common presets', () => {
    expect(EDITOR_PRESETS.map((item) => item.id)).toEqual([
      'cursor',
      'windsurf',
      'zed',
      'trae',
      'antigravity',
      'void',
      'vscode',
      'vscode-insiders',
      'vscodium',
      'intellij',
      'pycharm',
      'webstorm',
      'goland',
      'clion',
      'rubymine',
      'phpstorm',
      'datagrip',
      'rider',
      'rustrover',
      'dataspell',
      'fleet',
      'android-studio',
      'xcode',
      'visual-studio',
      'sublime',
      'neovim',
      'vim',
      'emacs',
      'helix',
      'lapce',
      'nova',
      'eclipse',
    ]);
  });

  it('resolves editor from PATH', async () => {
    const installed = await resolveInstalledEditor(EDITOR_PRESETS[0]!, {
      platform: 'darwin',
      pathEnv: '/fake/bin',
      fileExists: async (path) => path === '/fake/bin/cursor',
    });
    expect(installed).toEqual({
      id: 'cursor',
      label: 'Cursor',
      command: 'cursor',
      appPath: undefined,
    });
  });

  it('falls back to macOS CLI path when not on PATH', async () => {
    const cliPath = '/Applications/Cursor.app/Contents/Resources/app/bin/cursor';
    const appPath = '/Applications/Cursor.app';
    const installed = await resolveInstalledEditor(EDITOR_PRESETS[0]!, {
      platform: 'darwin',
      pathEnv: '',
      fileExists: async (path) => path === cliPath || path === appPath,
    });
    expect(installed).toEqual({
      id: 'cursor',
      label: 'Cursor',
      command: cliPath,
      appPath,
    });
  });

  it('falls back to open -a when only the app bundle exists', async () => {
    const appPath = '/Applications/Cursor.app';
    const installed = await resolveInstalledEditor(EDITOR_PRESETS[0]!, {
      platform: 'darwin',
      pathEnv: '',
      fileExists: async (path) => path === appPath,
    });
    expect(installed).toEqual({
      id: 'cursor',
      label: 'Cursor',
      command: `open -a ${appPath}`,
      appPath,
    });
  });

  it('filters unavailable editors', async () => {
    const available = await listAvailableEditors({
      platform: 'darwin',
      pathEnv: '',
      fileExists: async () => false,
      presets: EDITOR_PRESETS.slice(0, 3),
    });
    expect(available).toEqual([]);
  });

  it('attaches native icon data URLs when a resolver is provided', async () => {
    const vscode = EDITOR_PRESETS.find((item) => item.id === 'vscode');
    expect(vscode).toBeDefined();
    const appPath = '/Applications/Visual Studio Code.app';
    const cliPath = '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code';
    const available = await listAvailableEditors({
      platform: 'darwin',
      pathEnv: '',
      fileExists: async (path) => path === appPath || path === cliPath,
      presets: [vscode!],
      resolveIcon: async (path) => (path === appPath ? 'data:image/png;base64,abc' : undefined),
    });
    expect(available).toEqual([
      {
        id: 'vscode',
        label: 'VS Code',
        command: cliPath,
        appPath,
        iconDataUrl: 'data:image/png;base64,abc',
      },
    ]);
  });

  it('resolves JetBrains GoLand from PATH', async () => {
    const goland = EDITOR_PRESETS.find((item) => item.id === 'goland');
    expect(goland).toBeDefined();
    const installed = await resolveInstalledEditor(goland!, {
      platform: 'darwin',
      pathEnv: '/fake/bin',
      fileExists: async (path) => path === '/fake/bin/goland',
    });
    expect(installed).toEqual({
      id: 'goland',
      label: 'GoLand',
      command: 'goland',
      appPath: undefined,
    });
  });

  it('resolves JetBrains CLion from macOS CLI path', async () => {
    const clion = EDITOR_PRESETS.find((item) => item.id === 'clion');
    expect(clion).toBeDefined();
    const cliPath = '/Applications/CLion.app/Contents/MacOS/clion';
    const appPath = '/Applications/CLion.app';
    const installed = await resolveInstalledEditor(clion!, {
      platform: 'darwin',
      pathEnv: '',
      fileExists: async (path) => path === cliPath || path === appPath,
    });
    expect(installed).toEqual({
      id: 'clion',
      label: 'CLion',
      command: cliPath,
      appPath,
    });
  });

  it('resolves Xcode via open -a when only the app bundle exists', async () => {
    const xcode = EDITOR_PRESETS.find((item) => item.id === 'xcode');
    expect(xcode).toBeDefined();
    const appPath = '/Applications/Xcode.app';
    const installed = await resolveInstalledEditor(xcode!, {
      platform: 'darwin',
      pathEnv: '',
      fileExists: async (path) => path === appPath,
    });
    expect(installed).toEqual({
      id: 'xcode',
      label: 'Xcode',
      command: `open -a ${appPath}`,
      appPath,
    });
  });

  it('reads macOS bundle icns instead of the generic .app file icon', async () => {
    const appPath = '/Applications/Cursor.app';
    const iconPath = '/Applications/Cursor.app/Contents/Resources/Cursor.icns';
    const icon = await resolveEditorAppIcon(appPath, {
      platform: 'darwin',
      fileExists: async (path) => path === iconPath,
      resolveDarwinBundleIconPath: async () => iconPath,
      getFileIcon: async (path) => ({
        toDataURL: () => `data:image/png;base64,${path}`,
        resize: () => ({
          toDataURL: () => `data:image/png;base64,${path}:14`,
        }),
      }),
    });
    expect(icon).toBe(`data:image/png;base64,${iconPath}:14`);
  });

  it('falls back to app path icons on non-macOS platforms', async () => {
    const appPath = 'C:\\Users\\example\\AppData\\Local\\Programs\\cursor\\Cursor.exe';
    const icon = await resolveEditorAppIcon(appPath, {
      platform: 'win32',
      getFileIcon: async (path) => ({
        toDataURL: () => `data:image/png;base64,${path}`,
        resize: () => ({
          toDataURL: () => `data:image/png;base64,${path}:14`,
        }),
      }),
    });
    expect(icon).toBe(`data:image/png;base64,${appPath}:14`);
  });
});
