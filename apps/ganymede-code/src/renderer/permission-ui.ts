import type { PermissionMode } from '../shared/contracts';

export interface PermissionModeOption {
  readonly value: PermissionMode;
  readonly toolbarLabel: string;
  readonly menuLabel: string;
  readonly description: string;
}

/** Labels and descriptions aligned with Kimi Code `/permission` picker semantics. */
export const PERMISSION_MODE_OPTIONS: readonly PermissionModeOption[] = [
  {
    value: 'manual',
    toolbarLabel: '手动',
    menuLabel: '手动',
    description: '每一项操作都由你自行批准。',
  },
  {
    value: 'auto',
    toolbarLabel: 'Auto',
    menuLabel: 'Auto',
    description: '自动执行所有操作（含高风险），不再向你提问。',
  },
  {
    value: 'yolo',
    toolbarLabel: 'YOLO',
    menuLabel: 'YOLO',
    description: '由 AI 判断哪些操作需要你批准。',
  },
];

export function permissionToolbarLabel(mode: PermissionMode): string {
  return PERMISSION_MODE_OPTIONS.find((item) => item.value === mode)?.toolbarLabel ?? mode;
}

export function permissionMenuLabel(mode: PermissionMode): string {
  return PERMISSION_MODE_OPTIONS.find((item) => item.value === mode)?.menuLabel ?? mode;
}

export function permissionDescription(mode: PermissionMode): string {
  return PERMISSION_MODE_OPTIONS.find((item) => item.value === mode)?.description ?? '';
}

export type PermissionToggleSubcmd = 'on' | 'off' | '';

/**
 * Resolve the next permission mode for `/auto` or `/yolo` style toggles.
 * Returns `undefined` when the mode is already in the requested state (no-op).
 */
export function resolvePermissionToggle(
  current: PermissionMode,
  target: 'auto' | 'yolo',
  subcmd: string,
): { readonly next: PermissionMode; readonly notice: string } | { readonly already: string } {
  const normalized = subcmd.trim().toLowerCase() as PermissionToggleSubcmd | string;
  const label = target === 'auto' ? 'Auto' : 'YOLO';

  if (normalized === 'on') {
    if (current === target) return { already: `${label} 模式已开启` };
    return {
      next: target,
      notice: target === 'auto'
        ? 'Auto 模式：开启。自动执行所有操作（含高风险），不再向你提问。'
        : 'YOLO 模式：开启。AI 会自动批准安全操作，对高风险操作仍会询问。',
    };
  }

  if (normalized === 'off') {
    if (current !== target) return { already: `${label} 模式已关闭` };
    return { next: 'manual', notice: `${label} 模式：关闭` };
  }

  if (normalized.length > 0) {
    return { already: `未知参数：${subcmd}。可用 on / off，或不带参数切换。` };
  }

  // toggle
  if (current === target) {
    return { next: 'manual', notice: `${label} 模式：关闭` };
  }
  return {
    next: target,
    notice: target === 'auto'
      ? 'Auto 模式：开启。自动执行所有操作（含高风险），不再向你提问。'
      : 'YOLO 模式：开启。AI 会自动批准安全操作，对高风险操作仍会询问。',
  };
}
