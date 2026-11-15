/**
 * Coalesces high-frequency SSE token deltas onto 50ms / requestAnimationFrame boundaries
 * so React state updates stay <= 20 FPS during rapid streaming (Roadmap 4.2 INP target < 50ms).
 */
export interface TokenDeltaFlusherOptions {
  /** Called with the concatenated chunk ready to append to React state. */
  onFlush: (chunk: string) => void;
  /** Minimum interval in milliseconds between scheduled flushes (default 50ms => max 20 FPS). */
  intervalMs?: number;
  /** Clock function override for deterministic unit tests. */
  now?: () => number;
}

export interface TokenDeltaFlusher {
  /** Queues a streamed token delta for batched delivery. */
  push: (delta: string) => void;
  /** Cancels any pending frame/timer and flushes buffered deltas synchronously. */
  flushSync: () => void;
  /** Cancels any pending frame/timer and discards un-flushed deltas (e.g. on unmount). */
  dispose: () => void;
  /** Pending un-flushed buffer length (for diagnostics/tests). */
  pendingLength: () => number;
}

export function createTokenDeltaFlusher(options: TokenDeltaFlusherOptions): TokenDeltaFlusher {
  const intervalMs = Math.max(0, options.intervalMs ?? 50);
  const nowFn = options.now ?? (() => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()));

  let buffer = '';
  let lastFlushAt = -Infinity;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let rafId: number | null = null;
  let disposed = false;

  const cancelScheduled = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const commit = () => {
    cancelScheduled();
    if (disposed || !buffer) return;
    const chunk = buffer;
    buffer = '';
    lastFlushAt = nowFn();
    options.onFlush(chunk);
  };

  const scheduleFrame = () => {
    if (disposed || rafId !== null) return;
    if (typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        commit();
      });
    } else {
      timerId = setTimeout(commit, 0);
    }
  };

  const schedule = () => {
    if (disposed || timerId !== null || rafId !== null) return;
    const elapsed = nowFn() - lastFlushAt;
    const waitMs = elapsed >= intervalMs ? 0 : Math.ceil(intervalMs - elapsed);
    if (waitMs <= 0) {
      scheduleFrame();
    } else {
      timerId = setTimeout(() => {
        timerId = null;
        scheduleFrame();
      }, waitMs);
    }
  };

  return {
    push(delta: string) {
      if (disposed || !delta) return;
      buffer += delta;
      schedule();
    },
    flushSync() {
      commit();
    },
    dispose() {
      disposed = true;
      cancelScheduled();
      buffer = '';
    },
    pendingLength() {
      return buffer.length;
    },
  };
}
