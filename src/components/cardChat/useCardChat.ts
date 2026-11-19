/**
 * One card's chat, read from the board's store (server docs/reading-engine/85 §4 "Frontend experience"). Mounting the
 * Chat view opens the card (GET, once per period); the callbacks are stable so the mic's transcript handler does not
 * restart recognition on every streamed token.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { CardChatRef } from '../../lib/cardChatApi';
import { chatKey, type CardChatState, type CardChatStore } from './cardChatStore';

export interface CardChatControls {
  state: CardChatState;
  reopen: () => void;
  setDraft: (text: string) => void;
  send: (question: string) => boolean;
  retry: (turnKey: string) => void;
  answer: (turnKey: string, value: string, viaChip: boolean) => void;
  confirm: (turnKey: string) => void;
  change: (turnKey: string) => void;
}

/**
 * `active` false (the card's idle input, server docs/dashboards/12) holds the open back: every card on a board carries
 * the input, and a board must not open every card's chat on render. It opens once the person starts.
 */
export function useCardChat(store: CardChatStore, ref: CardChatRef, periodLabel: string | null, active = true): CardChatControls {
  const key = chatKey(ref);
  const { board, cardId, from, to } = ref;
  // the ref as a stable value: a new object each render must not reopen the card
  const stable = useMemo<CardChatRef>(() => ({ board, cardId, from: from ?? null, to: to ?? null }), [board, cardId, from, to]);
  const state = useSyncExternalStore(
    useCallback((fn: () => void) => store.subscribe(key, fn), [store, key]),
    () => store.get(key),
    () => store.get(key),
  );
  useEffect(() => {
    if (active) store.open(stable);
  }, [store, stable, active]);
  const reopen = useCallback(() => {
    store.open(stable);
  }, [store, stable]);
  const setDraft = useCallback((text: string) => store.setDraft(key, text), [store, key]);
  const send = useCallback((q: string) => store.send(stable, q, periodLabel), [store, stable, periodLabel]);
  const retry = useCallback((t: string) => store.retry(stable, t), [store, stable]);
  const answer = useCallback((t: string, v: string, chip: boolean) => void store.answer(stable, t, v, chip), [store, stable]);
  const confirm = useCallback((t: string) => void store.confirm(stable, t), [store, stable]);
  const change = useCallback((t: string) => store.change(stable, t), [store, stable]);
  return { state, reopen, setDraft, send, retry, answer, confirm, change };
}
