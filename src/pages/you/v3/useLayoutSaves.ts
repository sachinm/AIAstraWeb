/**
 * The board's hold on its LayoutSaver: one saver for the board's life, wired to the real calls. A change waiting its
 * 400 ms goes out when the board closes.
 */
import { useEffect, useRef } from 'react';
import type { BoardOptions, CardOptions } from '../../../lib/cardOptions';
import { refreshSession } from '../../../lib/sessionRefresh';
import { fetchSelfV3Layout, patchSelfV3Layout, putSelfV3LayoutResult, type SelfBoardLayoutView, type SelfCardId } from '../../../lib/selfV3Api';
import { withBoardChange, withCardChange } from './boardOptions';
import { LayoutSaver, type Deck, type SaveProblem, type SaverDeps } from './layoutSaver';

export interface LayoutSaves {
  changeCard: (id: string, patch: Partial<CardOptions>) => void;
  changeBoard: (patch: Partial<BoardOptions>) => void;
  saveDeck: (deck: Deck) => Promise<boolean>;
  serverLayout: (l: SelfBoardLayoutView) => void;
  retry: () => void;
  busy: () => boolean;
}

export function useLayoutSaves(args: {
  initial: SelfBoardLayoutView;
  onLayout: (l: SelfBoardLayoutView) => void;
  onProblem: (p: SaveProblem) => void;
  onSaved?: () => void;
  onQueued?: (ids: SelfCardId[]) => void;
  deps?: Partial<Pick<SaverDeps, 'patch' | 'put' | 'refetch' | 'refresh' | 'delay'>>;
}): LayoutSaves {
  const cb = useRef(args);
  cb.current = args;
  const saver = useRef<LayoutSaver | null>(null);
  if (!saver.current) {
    saver.current = new LayoutSaver(args.initial, {
      patch: args.deps?.patch ?? patchSelfV3Layout,
      put: args.deps?.put ?? putSelfV3LayoutResult,
      refetch: args.deps?.refetch ?? fetchSelfV3Layout,
      refresh: args.deps?.refresh ?? refreshSession,
      ...(args.deps?.delay !== undefined ? { delay: args.deps.delay } : {}),
      onLayout: (l) => cb.current.onLayout(l),
      onProblem: (p) => cb.current.onProblem(p),
      onSaved: () => cb.current.onSaved?.(),
      onQueued: (ids) => cb.current.onQueued?.(ids),
    });
  }
  useEffect(
    () => () => {
      const s = saver.current;
      if (s?.busy()) void s.flush();
    },
    [],
  );
  const s = saver.current;
  return {
    changeCard: (id, patch) => {
      const own = withCardChange(s.view(), id, patch)[id] ?? {};
      s.changeCard(id, own);
    },
    changeBoard: (patch) => s.changeBoard(withBoardChange(s.view(), patch)),
    saveDeck: (deck) => s.saveDeck(deck),
    serverLayout: (l) => {
      s.serverLayout(l);
      if (!s.busy()) cb.current.onLayout(s.view());
    },
    retry: () => void s.flush(),
    busy: () => s.busy(),
  };
}
