export const TIMELINE_SCROLL_THRESHOLD_PX = 120;
export const TIMELINE_RENDER_BATCH_SIZE = 80;
export const TIMELINE_INITIAL_RENDER_SLICE = 8;

export function initialTimelineWindowStart(
  length: number,
  batchSize = TIMELINE_RENDER_BATCH_SIZE,
): number {
  return Math.max(0, length - batchSize);
}

/** Stage the first 80 entries across frames instead of blocking one long render. */
export function stagedTimelineWindowStart(length: number): number {
  return Math.max(
    initialTimelineWindowStart(length),
    length - TIMELINE_INITIAL_RENDER_SLICE,
  );
}

export function previousTimelineWindowStart(
  currentStart: number,
  batchSize = TIMELINE_RENDER_BATCH_SIZE,
): number {
  return Math.max(0, currentStart - batchSize);
}

export function timelineWindowStartForIndex(
  index: number,
  currentStart: number,
  batchSize = TIMELINE_RENDER_BATCH_SIZE,
): number {
  if (index >= currentStart) return currentStart;
  return Math.max(0, Math.floor(index / batchSize) * batchSize);
}

export function isTimelineNearBottom(
  element: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>,
  threshold = TIMELINE_SCROLL_THRESHOLD_PX,
): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

export function timelineDistanceFromBottom(
  element: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>,
): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

export function scrollTimelineToBottom(element: HTMLElement): void {
  if (timelineDistanceFromBottom(element) <= 1) return;
  element.scrollTop = element.scrollHeight;
}

export function scrollTimelineToElement(
  container: HTMLElement,
  target: HTMLElement,
  options?: {
    readonly behavior?: ScrollBehavior;
    readonly offset?: number;
  },
): void {
  const offset = options?.offset ?? 0;
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - offset;
  if (options?.behavior === 'smooth' && typeof container.scrollTo === 'function') {
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    return;
  }
  container.scrollTop = Math.max(0, nextTop);
}

export function shouldTimelineAutoScroll(options: {
  readonly pinnedToBottom: boolean;
  readonly previousLength: number;
  readonly currentLength: number;
  readonly lastEntryKind?: string;
}): boolean {
  const userSent =
    options.currentLength > options.previousLength &&
    options.lastEntryKind === 'user';
  return options.pinnedToBottom || userSent;
}

export const TIMELINE_TURN_PROBE_OFFSET_PX = 80;

/**
 * Resolve which session turn is "current" for the turn catalog rail.
 * Picks the last turn whose anchor has crossed the probe line near the
 * container top; falls back to the first turn when none have.
 */
export function resolveVisibleTurnId(
  container: HTMLElement,
  turnIds: readonly string[],
  turnAnchorId: (id: string) => string,
  probeOffset = TIMELINE_TURN_PROBE_OFFSET_PX,
  lookup: (id: string) => Element | null = (id) => document.getElementById(id),
): string | undefined {
  if (turnIds.length === 0) return undefined;

  const probeY = container.getBoundingClientRect().top + probeOffset;
  let visibleId: string | undefined;

  for (const turnId of turnIds) {
    const anchor = lookup(turnAnchorId(turnId));
    if (anchor == null || typeof (anchor as HTMLElement).getBoundingClientRect !== 'function') {
      continue;
    }
    if ((anchor as HTMLElement).getBoundingClientRect().top <= probeY) {
      visibleId = turnId;
    }
  }

  return visibleId ?? turnIds[0];
}
