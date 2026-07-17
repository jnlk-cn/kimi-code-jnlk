import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

export interface EditorPlatformPaths {
  readonly appPath?: string;
  readonly cliPaths?: readonly string[];
}

export interface EditorPreset {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly darwin?: EditorPlatformPaths;
  readonly win32?: EditorPlatformPaths;
  readonly linux?: EditorPlatformPaths;
}

export interface InstalledEditor {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly appPath?: string;
  readonly iconDataUrl?: string;
}

export type EditorFileExists = (path: string) => Promise<boolean>;
export type EditorIconResolver = (appPath: string) => Promise<string | undefined>;

export interface EditorIconImage {
  toDataURL(): string;
  resize(size: { readonly width: number; readonly height: number }): {
    toDataURL(): string;
  };
}

export type EditorFileIconLoader = (
  path: string,
  options?: { readonly size?: 'small' | 'normal' },
) => Promise<EditorIconImage>;

const execFileAsync = promisify(execFile);
const editorIconSize = 14;

async function darwinBundleIconPath(appPath: string): Promise<string | undefined> {
  const plistPath = join(appPath, 'Contents/Info.plist');
  try {
    const { stdout } = await execFileAsync('plutil', [
      '-extract',
      'CFBundleIconFile',
      'raw',
      '-o',
      '-',
      plistPath,
    ]);
    const iconFile = stdout.toString().trim();
    if (iconFile.length === 0) return undefined;
    const fileName = iconFile.endsWith('.icns') ? iconFile : `${iconFile}.icns`;
    return join(appPath, 'Contents/Resources', fileName);
  } catch {
    return undefined;
  }
}

export async function resolveEditorAppIcon(
  appPath: string,
  options: {
    readonly platform?: NodeJS.Platform;
    readonly getFileIcon: EditorFileIconLoader;
    readonly fileExists?: EditorFileExists;
    readonly resolveDarwinBundleIconPath?: (appPath: string) => Promise<string | undefined>;
  },
): Promise<string | undefined> {
  const platform = options.platform ?? process.platform;
  const fileExists = options.fileExists ?? defaultFileExists;
  try {
    if (platform === 'darwin' && appPath.endsWith('.app')) {
      const resolveBundleIconPath = options.resolveDarwinBundleIconPath ?? darwinBundleIconPath;
      const iconPath = await resolveBundleIconPath(appPath);
      if (iconPath !== undefined && (await fileExists(iconPath))) {
        const icon = await options.getFileIcon(iconPath, { size: 'normal' });
        return icon.resize({ width: editorIconSize, height: editorIconSize }).toDataURL();
      }
    }
    const icon = await options.getFileIcon(appPath, { size: 'normal' });
    return icon.resize({ width: editorIconSize, height: editorIconSize }).toDataURL();
  } catch {
    return undefined;
  }
}

function localAppData(): string {
  return process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local');
}

function programFiles(): string {
  return process.env['ProgramFiles'] ?? 'C:\\Program Files';
}

function programFilesX86(): string {
  return process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
}

function jetbrainsPreset(options: {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly appName: string;
  readonly darwinBinary?: string;
  readonly winExe?: string;
}): EditorPreset {
  const darwinBinary = options.darwinBinary ?? options.command;
  const winExe = options.winExe ?? `${options.command}64.exe`;
  return {
    id: options.id,
    label: options.label,
    command: options.command,
    darwin: {
      appPath: `/Applications/${options.appName}.app`,
      cliPaths: [
        `/Applications/${options.appName}.app/Contents/MacOS/${darwinBinary}`,
        `/usr/local/bin/${options.command}`,
      ],
    },
    win32: {
      appPath: join(localAppData(), 'Programs', options.appName, 'bin', winExe),
      cliPaths: [
        join(localAppData(), 'Programs', options.appName, 'bin', winExe),
        join(programFiles(), 'JetBrains', options.appName, 'bin', winExe),
      ],
    },
    linux: {
      cliPaths: [`/usr/bin/${options.command}`, `/usr/local/bin/${options.command}`],
    },
  };
}

export const EDITOR_PRESETS: readonly EditorPreset[] = [
  {
    id: 'cursor',
    label: 'Cursor',
    command: 'cursor',
    darwin: {
      appPath: '/Applications/Cursor.app',
      cliPaths: ['/Applications/Cursor.app/Contents/Resources/app/bin/cursor'],
    },
    win32: {
      appPath: join(localAppData(), 'Programs', 'cursor', 'Cursor.exe'),
      cliPaths: [
        join(localAppData(), 'Programs', 'cursor', 'resources', 'app', 'bin', 'cursor.cmd'),
        join(localAppData(), 'Programs', 'cursor', 'Cursor.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/cursor', '/usr/local/bin/cursor'],
    },
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    command: 'windsurf',
    darwin: {
      appPath: '/Applications/Windsurf.app',
      cliPaths: [
        '/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf',
      ],
    },
    win32: {
      appPath: join(localAppData(), 'Programs', 'Windsurf', 'Windsurf.exe'),
      cliPaths: [
        join(localAppData(), 'Programs', 'Windsurf', 'bin', 'windsurf.cmd'),
        join(localAppData(), 'Programs', 'Windsurf', 'Windsurf.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/windsurf', '/usr/local/bin/windsurf'],
    },
  },
  {
    id: 'zed',
    label: 'Zed',
    command: 'zed',
    darwin: {
      appPath: '/Applications/Zed.app',
      cliPaths: [
        '/Applications/Zed.app/Contents/MacOS/cli',
        '/usr/local/bin/zed',
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/zed', '/usr/local/bin/zed'],
    },
  },
  {
    id: 'trae',
    label: 'Trae',
    command: 'trae',
    darwin: {
      appPath: '/Applications/Trae.app',
      cliPaths: [
        '/Applications/Trae.app/Contents/Resources/app/bin/trae',
        '/usr/local/bin/trae',
      ],
    },
    win32: {
      appPath: join(localAppData(), 'Programs', 'Trae', 'Trae.exe'),
      cliPaths: [
        join(localAppData(), 'Programs', 'Trae', 'bin', 'trae.cmd'),
        join(localAppData(), 'Programs', 'Trae', 'Trae.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/trae', '/usr/local/bin/trae'],
    },
  },
  {
    id: 'antigravity',
    label: 'Antigravity',
    command: 'agy',
    darwin: {
      appPath: '/Applications/Antigravity.app',
      cliPaths: [
        '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
        '/usr/local/bin/agy',
      ],
    },
    win32: {
      appPath: join(localAppData(), 'Programs', 'Antigravity', 'Antigravity.exe'),
      cliPaths: [
        join(localAppData(), 'Programs', 'Antigravity', 'Antigravity.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/agy', '/usr/local/bin/agy'],
    },
  },
  {
    id: 'void',
    label: 'Void',
    command: 'void',
    darwin: {
      appPath: '/Applications/Void.app',
      cliPaths: [
        '/Applications/Void.app/Contents/Resources/app/bin/void',
        '/usr/local/bin/void',
      ],
    },
    win32: {
      appPath: join(localAppData(), 'Programs', 'Void', 'Void.exe'),
      cliPaths: [
        join(localAppData(), 'Programs', 'Void', 'bin', 'void.cmd'),
        join(localAppData(), 'Programs', 'Void', 'Void.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/void', '/usr/local/bin/void'],
    },
  },
  {
    id: 'vscode',
    label: 'VS Code',
    command: 'code',
    darwin: {
      appPath: '/Applications/Visual Studio Code.app',
      cliPaths: [
        '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      ],
    },
    win32: {
      appPath: join(localAppData(), 'Programs', 'Microsoft VS Code', 'Code.exe'),
      cliPaths: [
        join(localAppData(), 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
        join(programFiles(), 'Microsoft VS Code', 'bin', 'code.cmd'),
        join(localAppData(), 'Programs', 'Microsoft VS Code', 'Code.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/code', '/usr/local/bin/code', '/snap/bin/code'],
    },
  },
  {
    id: 'vscode-insiders',
    label: 'VS Code Insiders',
    command: 'code-insiders',
    darwin: {
      appPath: '/Applications/Visual Studio Code - Insiders.app',
      cliPaths: [
        '/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code',
      ],
    },
    win32: {
      appPath: join(localAppData(), 'Programs', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
      cliPaths: [
        join(localAppData(), 'Programs', 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd'),
        join(localAppData(), 'Programs', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/code-insiders', '/usr/local/bin/code-insiders'],
    },
  },
  {
    id: 'vscodium',
    label: 'VSCodium',
    command: 'codium',
    darwin: {
      appPath: '/Applications/VSCodium.app',
      cliPaths: [
        '/Applications/VSCodium.app/Contents/Resources/app/bin/codium',
        '/usr/local/bin/codium',
      ],
    },
    win32: {
      appPath: join(localAppData(), 'Programs', 'VSCodium', 'VSCodium.exe'),
      cliPaths: [
        join(localAppData(), 'Programs', 'VSCodium', 'bin', 'codium.cmd'),
        join(localAppData(), 'Programs', 'VSCodium', 'VSCodium.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/codium', '/usr/local/bin/codium', '/snap/bin/codium'],
    },
  },
  jetbrainsPreset({
    id: 'intellij',
    label: 'IntelliJ IDEA',
    command: 'idea',
    appName: 'IntelliJ IDEA',
  }),
  jetbrainsPreset({
    id: 'pycharm',
    label: 'PyCharm',
    command: 'pycharm',
    appName: 'PyCharm',
  }),
  jetbrainsPreset({
    id: 'webstorm',
    label: 'WebStorm',
    command: 'webstorm',
    appName: 'WebStorm',
  }),
  jetbrainsPreset({
    id: 'goland',
    label: 'GoLand',
    command: 'goland',
    appName: 'GoLand',
  }),
  jetbrainsPreset({
    id: 'clion',
    label: 'CLion',
    command: 'clion',
    appName: 'CLion',
  }),
  jetbrainsPreset({
    id: 'rubymine',
    label: 'RubyMine',
    command: 'rubymine',
    appName: 'RubyMine',
  }),
  jetbrainsPreset({
    id: 'phpstorm',
    label: 'PhpStorm',
    command: 'phpstorm',
    appName: 'PhpStorm',
  }),
  jetbrainsPreset({
    id: 'datagrip',
    label: 'DataGrip',
    command: 'datagrip',
    appName: 'DataGrip',
  }),
  jetbrainsPreset({
    id: 'rider',
    label: 'Rider',
    command: 'rider',
    appName: 'Rider',
  }),
  jetbrainsPreset({
    id: 'rustrover',
    label: 'RustRover',
    command: 'rustrover',
    appName: 'RustRover',
  }),
  jetbrainsPreset({
    id: 'dataspell',
    label: 'DataSpell',
    command: 'dataspell',
    appName: 'DataSpell',
  }),
  jetbrainsPreset({
    id: 'fleet',
    label: 'Fleet',
    command: 'fleet',
    appName: 'Fleet',
    darwinBinary: 'Fleet',
    winExe: 'fleet64.exe',
  }),
  {
    id: 'android-studio',
    label: 'Android Studio',
    command: 'studio',
    darwin: {
      appPath: '/Applications/Android Studio.app',
      cliPaths: [
        '/Applications/Android Studio.app/Contents/MacOS/studio',
        '/usr/local/bin/studio',
      ],
    },
    win32: {
      appPath: join(localAppData(), 'Programs', 'Android Studio', 'bin', 'studio64.exe'),
      cliPaths: [
        join(localAppData(), 'Programs', 'Android Studio', 'bin', 'studio64.exe'),
        join(programFiles(), 'Android', 'Android Studio', 'bin', 'studio64.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/studio', '/usr/local/bin/studio', '/opt/android-studio/bin/studio'],
    },
  },
  {
    id: 'xcode',
    label: 'Xcode',
    command: 'xcode',
    darwin: {
      appPath: '/Applications/Xcode.app',
    },
  },
  {
    id: 'visual-studio',
    label: 'Visual Studio',
    command: 'devenv',
    win32: {
      appPath: join(
        programFiles(),
        'Microsoft Visual Studio',
        '2022',
        'Community',
        'Common7',
        'IDE',
        'devenv.exe',
      ),
      cliPaths: [
        join(programFiles(), 'Microsoft Visual Studio', '2022', 'Community', 'Common7', 'IDE', 'devenv.exe'),
        join(programFiles(), 'Microsoft Visual Studio', '2022', 'Professional', 'Common7', 'IDE', 'devenv.exe'),
        join(programFiles(), 'Microsoft Visual Studio', '2022', 'Enterprise', 'Common7', 'IDE', 'devenv.exe'),
        join(programFilesX86(), 'Microsoft Visual Studio', '2019', 'Community', 'Common7', 'IDE', 'devenv.exe'),
      ],
    },
  },
  {
    id: 'sublime',
    label: 'Sublime Text',
    command: 'subl',
    darwin: {
      appPath: '/Applications/Sublime Text.app',
      cliPaths: [
        '/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl',
      ],
    },
    win32: {
      appPath: join(programFiles(), 'Sublime Text', 'sublime_text.exe'),
      cliPaths: [
        join(programFiles(), 'Sublime Text', 'subl.exe'),
        join(programFiles(), 'Sublime Text', 'sublime_text.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/subl', '/usr/local/bin/subl'],
    },
  },
  {
    id: 'neovim',
    label: 'Neovim',
    command: 'nvim',
    darwin: {
      cliPaths: ['/opt/homebrew/bin/nvim', '/usr/local/bin/nvim'],
    },
    win32: {
      cliPaths: [
        join(programFiles(), 'Neovim', 'bin', 'nvim.exe'),
        join(localAppData(), 'Programs', 'Neovim', 'bin', 'nvim.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/nvim', '/usr/local/bin/nvim'],
    },
  },
  {
    id: 'vim',
    label: 'Vim',
    command: 'vim',
    darwin: {
      cliPaths: ['/opt/homebrew/bin/vim', '/usr/bin/vim', '/usr/local/bin/vim'],
    },
    win32: {
      cliPaths: [
        join(programFiles(), 'Vim', 'vim.exe'),
        join(programFiles(), 'Vim', 'vim90', 'vim.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/vim', '/usr/local/bin/vim'],
    },
  },
  {
    id: 'emacs',
    label: 'Emacs',
    command: 'emacs',
    darwin: {
      appPath: '/Applications/Emacs.app',
      cliPaths: [
        '/Applications/Emacs.app/Contents/MacOS/Emacs',
        '/opt/homebrew/bin/emacs',
        '/usr/local/bin/emacs',
      ],
    },
    win32: {
      appPath: join(programFiles(), 'Emacs', 'bin', 'runemacs.exe'),
      cliPaths: [
        join(programFiles(), 'Emacs', 'bin', 'runemacs.exe'),
        join(programFiles(), 'Emacs', 'bin', 'emacs.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/emacs', '/usr/local/bin/emacs'],
    },
  },
  {
    id: 'helix',
    label: 'Helix',
    command: 'hx',
    darwin: {
      cliPaths: ['/opt/homebrew/bin/hx', '/usr/local/bin/hx'],
    },
    win32: {
      cliPaths: [
        join(localAppData(), 'Programs', 'helix', 'hx.exe'),
        join(programFiles(), 'Helix', 'hx.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/hx', '/usr/local/bin/hx'],
    },
  },
  {
    id: 'lapce',
    label: 'Lapce',
    command: 'lapce',
    darwin: {
      appPath: '/Applications/Lapce.app',
      cliPaths: [
        '/Applications/Lapce.app/Contents/MacOS/lapce',
        '/usr/local/bin/lapce',
      ],
    },
    win32: {
      appPath: join(localAppData(), 'Programs', 'Lapce', 'lapce.exe'),
      cliPaths: [
        join(localAppData(), 'Programs', 'Lapce', 'lapce.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/lapce', '/usr/local/bin/lapce'],
    },
  },
  {
    id: 'nova',
    label: 'Nova',
    command: 'nova',
    darwin: {
      appPath: '/Applications/Nova.app',
      cliPaths: [
        '/Applications/Nova.app/Contents/SharedSupport/nova',
        '/usr/local/bin/nova',
      ],
    },
  },
  {
    id: 'eclipse',
    label: 'Eclipse',
    command: 'eclipse',
    darwin: {
      appPath: '/Applications/Eclipse.app',
      cliPaths: [
        '/Applications/Eclipse.app/Contents/MacOS/eclipse',
        '/usr/local/bin/eclipse',
      ],
    },
    win32: {
      appPath: join(programFiles(), 'Eclipse', 'eclipse.exe'),
      cliPaths: [
        join(programFiles(), 'Eclipse', 'eclipse.exe'),
        join(localAppData(), 'Programs', 'Eclipse', 'eclipse.exe'),
      ],
    },
    linux: {
      cliPaths: ['/usr/bin/eclipse', '/usr/local/bin/eclipse'],
    },
  },
];

export function resolveEditorCommand(
  configured?: string | null,
  override?: string | null,
): string | undefined {
  const candidates = [override, configured, process.env['VISUAL'], process.env['EDITOR']];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return undefined;
}

export function quoteShellArg(value: string): string {
  if (value.length === 0) return "''";
  if (!/[\s'"\\$`!]/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function defaultFileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function defaultExecutableExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

function pathSeparator(platform: NodeJS.Platform): string {
  return platform === 'win32' ? ';' : ':';
}

export async function findCommandOnPath(
  command: string,
  options: {
    readonly pathEnv?: string;
    readonly platform?: NodeJS.Platform;
    readonly fileExists?: EditorFileExists;
  } = {},
): Promise<string | undefined> {
  const binary = command.split(/\s+/)[0];
  if (binary === undefined || binary.length === 0) return undefined;
  const fileExists = options.fileExists ?? defaultExecutableExists;
  const platform = options.platform ?? process.platform;

  if (binary.includes('/') || binary.includes('\\')) {
    return (await fileExists(binary)) ? binary : undefined;
  }

  const pathEnv = options.pathEnv ?? process.env['PATH'] ?? '';
  const extensions =
    platform === 'win32' ? ['', '.cmd', '.bat', '.exe', '.COM'] : [''];
  for (const dir of pathEnv.split(pathSeparator(platform))) {
    if (dir.length === 0) continue;
    for (const extension of extensions) {
      const candidate = join(dir, `${binary}${extension}`);
      if (await fileExists(candidate)) return candidate;
    }
  }
  return undefined;
}

function platformPaths(
  preset: EditorPreset,
  platform: NodeJS.Platform,
): EditorPlatformPaths | undefined {
  if (platform === 'darwin') return preset.darwin;
  if (platform === 'win32') return preset.win32;
  if (platform === 'linux') return preset.linux;
  return undefined;
}

export async function resolveInstalledEditor(
  preset: EditorPreset,
  options: {
    readonly pathEnv?: string;
    readonly platform?: NodeJS.Platform;
    readonly fileExists?: EditorFileExists;
  } = {},
): Promise<InstalledEditor | undefined> {
  const fileExists = options.fileExists ?? defaultExecutableExists;
  const platform = options.platform ?? process.platform;
  const paths = platformPaths(preset, platform);

  const onPath = await findCommandOnPath(preset.command, {
    pathEnv: options.pathEnv,
    platform,
    fileExists,
  });
  if (onPath !== undefined) {
    const appPath =
      paths?.appPath !== undefined && (await (options.fileExists ?? defaultFileExists)(paths.appPath))
        ? paths.appPath
        : undefined;
    return {
      id: preset.id,
      label: preset.label,
      command: preset.command,
      appPath,
    };
  }

  for (const cliPath of paths?.cliPaths ?? []) {
    if (await fileExists(cliPath)) {
      const appPath =
        paths?.appPath !== undefined && (await (options.fileExists ?? defaultFileExists)(paths.appPath))
          ? paths.appPath
          : undefined;
      return {
        id: preset.id,
        label: preset.label,
        command: cliPath,
        appPath,
      };
    }
  }

  // App bundle present but no CLI: open via `open -a` / start on Windows.
  if (paths?.appPath !== undefined && (await (options.fileExists ?? defaultFileExists)(paths.appPath))) {
    if (platform === 'darwin') {
      return {
        id: preset.id,
        label: preset.label,
        command: `open -a ${quoteShellArg(paths.appPath)}`,
        appPath: paths.appPath,
      };
    }
    if (platform === 'win32') {
      return {
        id: preset.id,
        label: preset.label,
        command: quoteShellArg(paths.appPath),
        appPath: paths.appPath,
      };
    }
  }

  return undefined;
}

export async function listAvailableEditors(
  options: {
    readonly pathEnv?: string;
    readonly platform?: NodeJS.Platform;
    readonly fileExists?: EditorFileExists;
    readonly resolveIcon?: EditorIconResolver;
    readonly presets?: readonly EditorPreset[];
  } = {},
): Promise<readonly InstalledEditor[]> {
  const available: InstalledEditor[] = [];
  for (const preset of options.presets ?? EDITOR_PRESETS) {
    const installed = await resolveInstalledEditor(preset, options);
    if (installed === undefined) continue;
    let iconDataUrl: string | undefined;
    if (installed.appPath !== undefined && options.resolveIcon !== undefined) {
      iconDataUrl = await options.resolveIcon(installed.appPath);
    }
    available.push({
      id: installed.id,
      label: installed.label,
      command: installed.command,
      appPath: installed.appPath,
      iconDataUrl,
    });
  }
  return available;
}

export async function openInEditor(
  path: string,
  command: string,
): Promise<void> {
  const shellCmd = `${command} ${quoteShellArg(path)}`;
  await spawnDetachedShell(shellCmd);
}

export function fileManagerLabel(platform: NodeJS.Platform = process.platform): string {
  if (platform === 'darwin') return 'Finder';
  if (platform === 'win32') return '资源管理器';
  return '文件管理器';
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildTerminalLaunchCommand(
  path: string,
  options: {
    readonly platform?: NodeJS.Platform;
    readonly windowsTerminalPath?: string;
    readonly linuxTerminalPath?: string;
  } = {},
): string | readonly string[] {
  const platform = options.platform ?? process.platform;
  const quoted = quoteShellArg(path);

  if (platform === 'darwin') {
    const escaped = escapeAppleScriptString(path);
    return [
      'osascript',
      '-e',
      'tell application "Terminal" to activate',
      '-e',
      `tell application "Terminal" to do script "cd " & quoted form of "${escaped}"`,
    ];
  }

  if (platform === 'win32') {
    if (options.windowsTerminalPath !== undefined) {
      return `${options.windowsTerminalPath} -d ${quoted}`;
    }
    const winQuoted = `"${path.replace(/"/g, '""')}"`;
    return `start cmd.exe /K "cd /d ${winQuoted}"`;
  }

  if (options.linuxTerminalPath !== undefined) {
    const terminal = options.linuxTerminalPath;
    const base = terminal.split(/[/\\]/).pop() ?? terminal;
    if (base === 'gnome-terminal' || base === 'kgx') {
      return `${terminal} --working-directory=${quoted}`;
    }
    if (base === 'konsole') {
      return `${terminal} --workdir ${quoted}`;
    }
    if (base === 'xfce4-terminal') {
      return `${terminal} --working-directory=${quoted}`;
    }
    return `${terminal} -e bash -lc "cd ${quoted} && exec \\$SHELL"`;
  }

  return `xterm -e bash -lc "cd ${quoted} && exec \\$SHELL"`;
}

const LINUX_TERMINAL_CANDIDATES = [
  'gnome-terminal',
  'kgx',
  'konsole',
  'xfce4-terminal',
  'xterm',
] as const;

async function resolveLinuxTerminal(
  fileExists: EditorFileExists,
  pathEnv?: string,
): Promise<string | undefined> {
  for (const candidate of LINUX_TERMINAL_CANDIDATES) {
    const resolved = await findCommandOnPath(candidate, {
      pathEnv,
      platform: 'linux',
      fileExists,
    });
    if (resolved !== undefined) return resolved;
  }
  return undefined;
}

async function spawnDetachedShell(command: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', reject);
    child.unref();
    resolve();
  });
}

async function spawnDetached(
  command: string,
  args: readonly string[],
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args], {
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', reject);
    child.unref();
    resolve();
  });
}

export async function openInTerminal(
  path: string,
  options: {
    readonly platform?: NodeJS.Platform;
    readonly pathEnv?: string;
    readonly fileExists?: EditorFileExists;
  } = {},
): Promise<void> {
  const platform = options.platform ?? process.platform;
  const fileExists = options.fileExists ?? defaultExecutableExists;

  if (platform === 'linux') {
    const linuxTerminalPath = await resolveLinuxTerminal(fileExists, options.pathEnv);
    const launch = buildTerminalLaunchCommand(path, {
      platform,
      linuxTerminalPath,
    });
    await spawnDetachedShell(typeof launch === 'string' ? launch : launch.join(' '));
    return;
  }

  if (platform === 'win32') {
    const windowsTerminalPath = await findCommandOnPath('wt', {
      pathEnv: options.pathEnv,
      platform,
      fileExists,
    });
    const launch = buildTerminalLaunchCommand(path, {
      platform,
      windowsTerminalPath,
    });
    await spawnDetachedShell(typeof launch === 'string' ? launch : launch.join(' '));
    return;
  }

  const launch = buildTerminalLaunchCommand(path, { platform });
  if (typeof launch !== 'string') {
    const [command, ...args] = launch;
    if (command === undefined) throw new Error('Failed to build terminal launch command.');
    await spawnDetached(command, args);
    return;
  }
  await spawnDetachedShell(launch);
}
