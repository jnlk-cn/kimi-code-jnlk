import { describe, expect, it, vi } from 'vitest';

import { SegmentedSelectorComponent } from '#/tui/components/dialogs/segmented-selector';
import { formatTokenCount } from '#/utils/usage/usage-format';

const ANSI = /\u001B\[[0-9;]*m/g;
const strip = (s: string): string => s.replaceAll(ANSI, '');
const ESC = String.fromCodePoint(27);
const LEFT = `${ESC}[D`;
const RIGHT = `${ESC}[C`;

function text(component: SegmentedSelectorComponent, width = 120): string {
  return component.render(width).map(strip).join('\n');
}

function effortPicker(
  overrides: Partial<ConstructorParameters<typeof SegmentedSelectorComponent>[0]> = {},
): SegmentedSelectorComponent {
  return new SegmentedSelectorComponent({
    title: 'Select thinking effort',
    values: ['off', 'low', 'high', 'max'],
    currentValue: 'high',
    onSelect: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  });
}

describe('SegmentedSelectorComponent', () => {
  it('renders values as horizontal segments with the active one bracketed', () => {
    const out = text(effortPicker());
    // All values are rendered on a single row.
    expect(out).toContain('Off');
    expect(out).toContain('Low');
    expect(out).toContain('High');
    expect(out).toContain('Max');
    // The active level is wrapped in brackets; the rest are not.
    expect(out).toContain('[ High ]');
    expect(out).not.toContain('[ Off ]');
    expect(out).not.toContain('[ Max ]');
  });

  it('invokes onSelect with the chosen value on Enter', () => {
    const onSelect = vi.fn();
    effortPicker({ onSelect }).handleInput('\r');
    expect(onSelect).toHaveBeenCalledWith('high');
  });

  it('moves the active segment with Left/Right and stops at the edges', () => {
    const onSelect = vi.fn();
    const picker = effortPicker({ onSelect });

    // index 2 (high) -> 3 (max).
    picker.handleInput(RIGHT);
    picker.handleInput('\r');
    expect(onSelect).toHaveBeenLastCalledWith('max');

    // Already at the right edge — another Right stays put.
    picker.handleInput(RIGHT);
    picker.handleInput('\r');
    expect(onSelect).toHaveBeenLastCalledWith('max');

    // Walk back to the left edge (max -> high -> low -> off).
    picker.handleInput(LEFT);
    picker.handleInput(LEFT);
    picker.handleInput(LEFT);
    picker.handleInput('\r');
    expect(onSelect).toHaveBeenLastCalledWith('off');

    // Already at the left edge — another Left stays put.
    picker.handleInput(LEFT);
    picker.handleInput('\r');
    expect(onSelect).toHaveBeenLastCalledWith('off');
  });

  it('invokes onSessionOnlySelect on Alt+S instead of onSelect', () => {
    const onSelect = vi.fn();
    const onSessionOnlySelect = vi.fn();
    effortPicker({ onSelect, onSessionOnlySelect }).handleInput(`${ESC}s`);
    expect(onSessionOnlySelect).toHaveBeenCalledWith('high');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('cancels on Escape', () => {
    const onCancel = vi.fn();
    effortPicker({ onCancel }).handleInput(ESC);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders the warning line directly below the key-hint line when provided', () => {
    const picker = effortPicker({ warning: 'Switching may increase token usage.' });
    const lines = picker.render(120).map(strip);
    const hintIdx = lines.findIndex((l) => l.includes('←→ switch'));
    expect(hintIdx).toBeGreaterThanOrEqual(0);
    expect(lines[hintIdx + 1]).toContain('Switching may increase token usage.');
  });

  it('renders no warning line without the warning option', () => {
    const lines = effortPicker().render(120).map(strip);
    const hintIdx = lines.findIndex((l) => l.includes('←→ switch'));
    expect(hintIdx).toBeGreaterThanOrEqual(0);
    expect(lines[hintIdx + 1]).toBe('');
  });

  it('updates the description as the highlighted value changes', () => {
    const picker = effortPicker({
      currentValue: 'low',
      descriptions: {
        low: 'Light reasoning.',
        high: 'Deeper reasoning.',
        max: 'Maximum reasoning.',
      },
    });

    expect(text(picker)).toContain('Light reasoning.');
    expect(text(picker)).not.toContain('Deeper reasoning.');
    picker.handleInput(RIGHT);
    expect(text(picker)).toContain('Deeper reasoning.');
    picker.handleInput(RIGHT);
    expect(text(picker)).toContain('Maximum reasoning.');
    picker.handleInput(LEFT);
    picker.handleInput(LEFT);
    picker.handleInput(LEFT);
    expect(text(picker)).not.toContain('Light reasoning.');
    expect(text(picker)).not.toContain('Deeper reasoning.');
    expect(text(picker)).not.toContain('Maximum reasoning.');
  });

  it('wraps a warning longer than the width instead of truncating it', () => {
    const warning =
      'Note: Switching effort invalidates the existing prompt cache. Use /new to avoid extra token costs.';
    const picker = effortPicker({ warning });
    const lines = picker.render(40).map(strip);
    const hintIdx = lines.findIndex((l) => l.includes('←→ switch'));
    expect(lines[hintIdx + 1]).not.toBe('');
    expect(lines[hintIdx + 2]).not.toBe('');
    // Word-wrapped: nothing dropped — the full warning survives across lines.
    const squashed = lines.join('').replaceAll(/\s+/g, '');
    expect(squashed).toContain(warning.replaceAll(/\s+/g, ''));
  });

  it('labels values through the label option and keeps six segments on one row', () => {
    const onSelect = vi.fn();
    const picker = new SegmentedSelectorComponent({
      title: 'Select the context window',
      values: ['131072', '262144', '327680', '524288', '786432', '1048576'],
      currentValue: '262144',
      label: (value) => formatTokenCount(Number(value)),
      onSelect,
      onCancel: vi.fn(),
    });
    const row = strip(picker.render(120).find((line) => line.includes('[ 256k ]')) ?? '');
    expect(row).toContain('128k');
    expect(row).toContain('320k');
    expect(row).toContain('512k');
    expect(row).toContain('768k');
    expect(row).toContain('1M');

    picker.handleInput(RIGHT);
    picker.handleInput('\r');
    expect(onSelect).toHaveBeenCalledWith('327680');
  });

  it('truncates segments to the render width instead of overflowing', () => {
    const picker = new SegmentedSelectorComponent({
      title: 'Select the context window',
      values: ['131072', '262144', '327680', '524288', '786432', '1048576'],
      currentValue: '262144',
      label: (value) => formatTokenCount(Number(value)),
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    });
    for (const line of picker.render(24).map(strip)) {
      expect(line.length).toBeLessThanOrEqual(24);
    }
  });
});
