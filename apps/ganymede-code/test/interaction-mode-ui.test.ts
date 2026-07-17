import { describe, expect, it } from 'vitest';

import { nextShiftTabInteractionMode } from '../src/renderer/interaction-mode-ui';
import { resolveInteractionMode } from '../src/shared/contracts';

describe('nextShiftTabInteractionMode', () => {
  it('cycles through agent → plan → debug → multitask → ask → agent', () => {
    expect(nextShiftTabInteractionMode('agent')).toBe('plan');
    expect(nextShiftTabInteractionMode('plan')).toBe('debug');
    expect(nextShiftTabInteractionMode('debug')).toBe('multitask');
    expect(nextShiftTabInteractionMode('multitask')).toBe('ask');
    expect(nextShiftTabInteractionMode('ask')).toBe('agent');
  });

  it('returns agent when current mode is engineering (outside the Shift+Tab cycle)', () => {
    expect(nextShiftTabInteractionMode('engineering')).toBe('agent');
  });
});

describe('resolveInteractionMode engineering', () => {
  it('resolves engineering from interactionMode or engineeringMode toggle', () => {
    expect(resolveInteractionMode({ interactionMode: 'engineering' })).toBe('engineering');
    expect(resolveInteractionMode({ engineeringMode: true })).toBe('engineering');
    expect(resolveInteractionMode({ engineeringMode: true, askMode: true })).toBe('ask');
  });
});
