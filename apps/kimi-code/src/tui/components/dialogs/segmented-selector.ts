import {
  Container,
  Key,
  matchesKey,
  truncateToWidth,
  wrapTextWithAnsi,
  type Focusable,
} from '@moonshot-ai/pi-tui';

import { t } from '#/tui/i18n';
import { currentTheme } from '#/tui/theme';

export interface SegmentedSelectorOptions<T extends string = string> {
  readonly title: string;
  /** Selectable values, rendered left to right in this order. */
  readonly values: readonly T[];
  /** Currently active value (highlighted). */
  readonly currentValue: T;
  /** Segment text for a value; defaults to the value with a capital first letter. */
  readonly label?: (value: T) => string;
  readonly onSelect: (value: T) => void;
  /** When provided, Alt+S applies the choice to the current session only. */
  readonly onSessionOnlySelect?: (value: T) => void;
  readonly onCancel: () => void;
  /** When set, rendered as warning-colored lines directly below the key-hint
   * line; wraps instead of truncating when it exceeds the width. */
  readonly warning?: string;
  readonly descriptions?: Readonly<Record<string, string>>;
}

function defaultLabel(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Horizontal segmented picker shared by `/effort` and `/context`: one row of
 * segments with the active one wrapped in `[ ]` (the same shape as the
 * thinking control under `/model`). ←/→ step the active segment, Enter
 * commits, and Alt+S (when provided) applies session-only.
 */
export class SegmentedSelectorComponent<T extends string = string>
  extends Container
  implements Focusable
{
  focused = false;
  private readonly opts: SegmentedSelectorOptions<T>;
  private activeIndex: number;

  constructor(opts: SegmentedSelectorOptions<T>) {
    super();
    this.opts = opts;
    const idx = opts.values.indexOf(opts.currentValue);
    this.activeIndex = Math.max(idx, 0);
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.opts.onCancel();
      return;
    }
    if (matchesKey(data, Key.left)) {
      this.activeIndex = Math.max(0, this.activeIndex - 1);
      return;
    }
    if (matchesKey(data, Key.right)) {
      this.activeIndex = Math.min(this.opts.values.length - 1, this.activeIndex + 1);
      return;
    }
    if (matchesKey(data, Key.alt('s')) && this.opts.onSessionOnlySelect !== undefined) {
      this.opts.onSessionOnlySelect(this.opts.values[this.activeIndex]!);
      return;
    }
    if (matchesKey(data, Key.enter)) {
      this.opts.onSelect(this.opts.values[this.activeIndex]!);
      return;
    }
  }

  override render(width: number): string[] {
    const hintParts = [t('←→ switch'), t('Enter select')];
    if (this.opts.onSessionOnlySelect !== undefined) hintParts.push(t('Alt+S session-only'));
    hintParts.push(t('Esc cancel'));

    const lines: string[] = [
      currentTheme.fg('primary', '─'.repeat(width)),
      currentTheme.boldFg('primary', ` ${this.opts.title}`),
      currentTheme.fg('textMuted', ` ${hintParts.join(' · ')}`),
    ];
    if (this.opts.warning !== undefined) {
      for (const line of wrapTextWithAnsi(this.opts.warning, Math.max(1, width - 1))) {
        lines.push(currentTheme.fg('warning', ` ${line}`));
      }
    }
    lines.push('');

    const label = this.opts.label ?? defaultLabel;
    const segments = this.opts.values.map((value, index) => {
      const text = label(value);
      return index === this.activeIndex
        ? currentTheme.boldFg('primary', `[ ${text} ]`)
        : currentTheme.fg('text', `  ${text}  `);
    });
    lines.push(`  ${segments.join('  ')}`);
    const active = this.opts.values[this.activeIndex];
    const description = active === undefined ? undefined : this.opts.descriptions?.[active];
    if (description !== undefined) lines.push(currentTheme.fg('textMuted', ` ${description}`));

    lines.push('');
    lines.push(currentTheme.fg('primary', '─'.repeat(width)));
    return lines.map((line) => truncateToWidth(line, width));
  }
}
