export interface AnimationFrameClock {
  readonly request: (callback: FrameRequestCallback) => number;
  readonly cancel: (handle: number) => void;
}

export interface FrameCommitScheduler<T> {
  readonly schedule: (value: T) => void;
  readonly commitNow: (value: T) => void;
  readonly flush: () => void;
  readonly cancel: () => void;
  readonly pending: () => boolean;
}

/**
 * Keep the latest renderer state hot in a ref while limiting React commits to
 * one per animation frame. Immediate commits cancel the pending frame so
 * terminal events always land after every preceding streamed delta.
 */
export function createFrameCommitScheduler<T>(
  commit: (value: T) => void,
  clock: AnimationFrameClock,
): FrameCommitScheduler<T> {
  let frame: number | undefined;
  let nextValue: T | undefined;
  let hasValue = false;

  const flush = (): void => {
    if (frame !== undefined) {
      clock.cancel(frame);
      frame = undefined;
    }
    if (!hasValue) return;
    const value = nextValue as T;
    nextValue = undefined;
    hasValue = false;
    commit(value);
  };

  return {
    schedule(value) {
      nextValue = value;
      hasValue = true;
      if (frame !== undefined) return;
      frame = clock.request(() => {
        frame = undefined;
        if (!hasValue) return;
        const pendingValue = nextValue as T;
        nextValue = undefined;
        hasValue = false;
        commit(pendingValue);
      });
    },
    commitNow(value) {
      if (frame !== undefined) {
        clock.cancel(frame);
        frame = undefined;
      }
      nextValue = undefined;
      hasValue = false;
      commit(value);
    },
    flush,
    cancel() {
      if (frame !== undefined) clock.cancel(frame);
      frame = undefined;
      nextValue = undefined;
      hasValue = false;
    },
    pending() {
      return hasValue;
    },
  };
}

