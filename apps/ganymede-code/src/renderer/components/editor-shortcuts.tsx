import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Code2, FolderOpen, Terminal } from 'lucide-react';

import type { EditorPresetView } from '../../shared/contracts';
import {
  AppMenuPopover,
  anchorFromElement,
  type AppMenuItem,
  type MenuAnchor,
} from '../app-menu';
import { EditorBuiltinIcon } from './editor-icons';

function EditorIcon(props: { readonly preset: EditorPresetView }): ReactNode {
  return EditorBuiltinIcon({ id: props.preset.id, size: 14 }) ?? <Code2 size={14} />;
}

export function resolveDefaultEditor(
  available: readonly EditorPresetView[],
  editorCommand?: string,
): EditorPresetView | undefined {
  const preferred = editorCommand?.trim().toLowerCase();
  if (preferred !== undefined && preferred.length > 0) {
    const matched = available.find((item) => {
      const command = item.command.toLowerCase();
      return preferred === command
        || preferred.startsWith(`${command} `)
        || preferred === item.id
        || preferred.startsWith(`${item.id} `);
    });
    if (matched !== undefined) return matched;
  }
  return available[0];
}

function isPreferredEditor(item: EditorPresetView, editorCommand?: string): boolean {
  const preferred = editorCommand?.trim().toLowerCase();
  if (preferred === undefined || preferred.length === 0) return false;
  const command = item.command.toLowerCase();
  return preferred === command
    || preferred.startsWith(`${command} `)
    || preferred === item.id
    || preferred.startsWith(`${item.id} `);
}

function editorScopeLabel(scope: 'project' | 'file'): string {
  return scope === 'file' ? '文件' : '项目';
}

export function fileManagerShortcutLabel(platform?: NodeJS.Platform): string {
  if (platform === 'darwin') return 'Finder';
  if (platform === 'win32') return '资源管理器';
  return '文件管理器';
}

function fileManagerActionLabel(scope: 'project' | 'file', platform?: NodeJS.Platform): string {
  const manager = fileManagerShortcutLabel(platform);
  return scope === 'file' ? `在 ${manager} 中显示` : `在 ${manager} 中打开`;
}

function terminalActionLabel(scope: 'project' | 'file'): string {
  return scope === 'file' ? '在终端中打开项目' : '在终端中打开';
}

export function EditorShortcuts(props: {
  readonly workDir?: string;
  readonly editorCommand?: string;
  readonly available: readonly EditorPresetView[];
  readonly onOpen: (command: string) => void;
  readonly onPrefer: (command: string) => void;
  readonly onOpenSystem?: () => void;
  readonly onOpenFinder?: () => void;
  readonly onOpenTerminal?: () => void;
  readonly platform?: NodeJS.Platform;
  readonly scope?: 'project' | 'file';
}): ReactNode {
  const scope = props.scope ?? 'project';
  const scopeLabel = editorScopeLabel(scope);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor>();
  const selected = useMemo(
    () => resolveDefaultEditor(props.available, props.editorCommand),
    [props.available, props.editorCommand],
  );
  const menuItems = useMemo((): readonly AppMenuItem[] => {
    const items: AppMenuItem[] = props.available.map((item) => ({
      id: item.id,
      label: item.label,
      icon: <EditorIcon preset={item} />,
      checked: isPreferredEditor(item, props.editorCommand)
        || (
          selected?.id === item.id
          && (props.editorCommand === undefined || props.editorCommand.trim().length === 0)
        ),
      onSelect: () => {
        props.onPrefer(item.command);
        props.onOpen(item.command);
      },
    }));

    const externalItems: AppMenuItem[] = [];
    if (props.onOpenFinder !== undefined) {
      externalItems.push({
        id: 'finder',
        label: fileManagerActionLabel(scope, props.platform),
        icon: <FolderOpen size={14} />,
        onSelect: () => props.onOpenFinder?.(),
      });
    }
    if (props.onOpenTerminal !== undefined) {
      externalItems.push({
        id: 'terminal',
        label: terminalActionLabel(scope),
        icon: <Terminal size={14} />,
        onSelect: () => props.onOpenTerminal?.(),
      });
    }
    if (props.onOpenSystem !== undefined) {
      externalItems.push({
        id: 'system-default',
        label: '用系统默认打开',
        icon: <FolderOpen size={14} />,
        onSelect: () => props.onOpenSystem?.(),
      });
    }

    if (externalItems.length > 0) {
      if (items.length > 0) items.push({ id: 'sep-external', separator: true });
      items.push(...externalItems);
    }
    return items;
  }, [
    props.available,
    props.editorCommand,
    props.onOpen,
    props.onOpenFinder,
    props.onOpenSystem,
    props.onOpenTerminal,
    props.onPrefer,
    props.platform,
    scope,
    selected?.id,
  ]);

  if (props.workDir === undefined) return null;

  const hasEditors = props.available.length > 0;
  const hasExternalActions =
    props.onOpenSystem !== undefined
    || props.onOpenFinder !== undefined
    || props.onOpenTerminal !== undefined;
  const mainDisabled = !hasEditors && !hasExternalActions;

  return (
    <div className="editor-shortcuts" role="group" aria-label={`在外部编辑器打开${scopeLabel}`}>
      <div className={`editor-shortcut-group${selected !== undefined ? ' has-editor' : ''}`}>
        <button
          type="button"
          className={`editor-shortcut-main${selected !== undefined ? ' active' : ''}`}
          disabled={mainDisabled}
          title={
            selected !== undefined
              ? `在 ${selected.label} 中打开${scopeLabel}`
              : props.onOpenSystem !== undefined
                ? `用系统默认方式打开${scopeLabel}`
                : '未检测到可用编辑器'
          }
          aria-label={
            selected !== undefined
              ? `在 ${selected.label} 中打开${scopeLabel}`
              : props.onOpenSystem !== undefined
                ? `用系统默认方式打开${scopeLabel}`
                : '未检测到可用编辑器'
          }
          onClick={() => {
            if (selected !== undefined) {
              props.onOpen(selected.command);
              return;
            }
            if (props.onOpenFinder !== undefined) {
              props.onOpenFinder();
              return;
            }
            if (props.onOpenSystem !== undefined) {
              props.onOpenSystem();
              return;
            }
            props.onOpenTerminal?.();
          }}
        >
          {selected !== undefined ? (
            <>
              <EditorIcon preset={selected} />
              <span>{selected.label}</span>
            </>
          ) : (
            <>
              <FolderOpen size={14} />
              <span>打开</span>
            </>
          )}
        </button>
        <button
          type="button"
          className="editor-shortcut-toggle"
          title="选择打开方式"
          aria-label="选择打开方式"
          aria-expanded={menuAnchor !== undefined}
          aria-haspopup="menu"
          disabled={menuItems.length === 0}
          onClick={(event) => {
            setMenuAnchor(anchorFromElement(event.currentTarget));
          }}
        >
          <ChevronDown size={12} />
        </button>
      </div>
      {menuAnchor !== undefined ? (
        <AppMenuPopover
          anchor={menuAnchor}
          ariaLabel="选择打开方式"
          items={menuItems}
          onClose={() => setMenuAnchor(undefined)}
          placement="bottom-start"
        />
      ) : null}
    </div>
  );
}
