/**
 * Saving card and board options as they change: the layout updates on screen at once (optimistic); one PUT goes out
 * 400 ms after the last change with the whole options maps; a refusal puts the last saved layout back and tells the
 * caller. A change made while a save is in flight rides on the next one. The data layer does the sending
 * (`saveLayoutOptimistic` + `putSelfV3Layout`).
 */
import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { BoardOptions, CardOptions } from '../../../lib/cardOptions';
import { putSelfV3Layout, saveLayoutOptimistic, type SelfBoardLayoutView } from '../../../lib/selfV3Api';
import { clearOwn, withBoardChange, withCardChange } from './boardOptions';

export const OPTION_SAVE_DELAY_MS = 400;

export interface OptionSaves {
  changeCard: (id: string, patch: Partial<CardOptions>) => void;
  changeBoard: (patch: Partial<BoardOptions>) => void;
  applyToAll: () => void;
}

export function useOptionSaves(args: {
  layout: SelfBoardLayoutView;
  setLayout: (l: SelfBoardLayoutView) => void;
  /** the board's in-flight counter: while above 0 a re-read board does not overwrite the layout */
  saving: MutableRefObject<number>;
  onError: () => void;
  delay?: number;
}): OptionSaves {
  const { layout, setLayout, saving, onError, delay = OPTION_SAVE_DELAY_MS } = args;
  const latest = useRef(layout);
  const saved = useRef(layout);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const errorRef = useRef(onError);
  errorRef.current = onError;

  useEffect(() => {
    latest.current = layout;
    if (!held.current) saved.current = layout;
  }, [layout]);

  const release = () => {
    if (held.current) {
      held.current = false;
      saving.current -= 1;
    }
  };

  const flush = useCallback(async () => {
    timer.current = null;
    const snap = latest.current;
    try {
      const { done } = saveLayoutOptimistic({ current: snap, patch: { options: snap.options ?? {}, boardOptions: snap.boardOptions ?? {} }, send: putSelfV3Layout });
      const { reading: _reading, ...view } = await done;
      saved.current = view;
      if (timer.current === null) {
        latest.current = view;
        setLayout(view);
        release();
      }
    } catch {
      if (timer.current === null) {
        latest.current = saved.current;
        setLayout(saved.current);
        release();
        errorRef.current();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLayout]);

  // a change still waiting its 400 ms goes out when the board closes
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void flush();
      }
    },
    [flush],
  );

  const apply = useCallback(
    (next: SelfBoardLayoutView) => {
      latest.current = next;
      setLayout(next);
      if (!held.current) {
        held.current = true;
        saving.current += 1;
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flush, setLayout, delay],
  );

  return {
    changeCard: (id, patch) => apply({ ...latest.current, options: withCardChange(latest.current, id, patch) }),
    changeBoard: (patch) => apply({ ...latest.current, boardOptions: withBoardChange(latest.current, patch) }),
    applyToAll: () => apply({ ...latest.current, options: clearOwn(latest.current) }),
  };
}
