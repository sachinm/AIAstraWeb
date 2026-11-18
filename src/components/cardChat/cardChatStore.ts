/**
 * The card chats of one board (server docs/reading-engine/85 §4 "Frontend experience"). The board owns one store, so a
 * card's thread, its typed draft and an answer still streaming outlive the Chat view: going back to Read or Short keeps
 * them, and opening the card's chat again shows them at once. Every stream is aborted when the board goes away.
 *
 * Per card: open (GET, the card's preamble and thread) → ready → send (ask-stream with the card, a turnId and the
 * thread's chatId) → clarifying (the clarifier's chips, then confirm-stream) or streaming → answered; plus error (the
 * open failed), failed or stopped turns (Try again reuses the turn's turnId, or its clarify runId), and quota (the
 * question goes back in the box).
 */
import {
  CardChatError,
  costLineFor,
  newTurnId,
  openCardChat,
  problemOf,
  toWireCard,
  type CardChatOpen,
  type CardChatProblem,
  type CardChatRef,
} from '../../lib/cardChatApi';
import { QuotaExhaustedError, type PlanStatus } from '../../lib/billing';
import { answerClarify, ChatStreamError, confirmClarifyStream, isClarifyEnabled, sendChatMessageStream } from '../../pages/UserData';
import type { ReadingStreamEvent } from '../../pages/chat-interface/readingProgress';
import { browserTimeZone, LOCATION_CRITERION, toClarifyView, type ClarifyView } from '../../pages/chat-interface/readingUi';
import { createTokenDeltaFlusher } from '../../pages/chat-interface/tokenFlusher';

export type CardChatTurnStatus = 'done' | 'streaming' | 'clarifying' | 'failed' | 'stopped';

export interface CardChatTurn {
  /** local key for React; never shown */
  key: string;
  question: string;
  answer: string;
  periodLabel: string | null;
  status: CardChatTurnStatus;
  /** the send id the turn went out with; a retry reuses it */
  turnId?: string;
  /** set while the clarifier holds the turn, and kept so a failed confirm can be tried again */
  runId?: string;
  clarify?: ClarifyView;
  /** when the turn started waiting for its first words (ms) */
  since?: number;
  /** the last answer to the clarifier did not go through; its question stays up to answer again */
  clarifyFailed?: boolean;
  /** why a failed turn did not go through, in the web's own words */
  problem?: CardChatProblem;
}

export interface CardChatState {
  phase: 'idle' | 'opening' | 'ready' | 'error';
  problem: CardChatProblem | null;
  open: CardChatOpen | null;
  /** the period the open was made for */
  openFor: string | null;
  chatId: string | null;
  turns: CardChatTurn[];
  /** a send, a clarify answer or a confirm is in flight (one per card at a time) */
  busy: boolean;
  /** the plan has no questions left; the question went back in the box */
  quota: boolean;
  draft: string;
  /** the cost line after the latest answer (the server's usage), over the open's */
  costLine: string | null | undefined;
}

export const EMPTY_CHAT: CardChatState = Object.freeze({
  phase: 'idle',
  problem: null,
  open: null,
  openFor: null,
  chatId: null,
  turns: [],
  busy: false,
  quota: false,
  draft: '',
  costLine: undefined,
}) as CardChatState;

export const chatKey = (ref: Pick<CardChatRef, 'board' | 'cardId'>) => `${ref.board}:${ref.cardId}`;
const periodKey = (ref: CardChatRef) => `${ref.from ?? ''}..${ref.to ?? ''}`;

export interface CardChatStoreOptions {
  /** the question count after a send (the board puts it on its plan) */
  onUsage?: (usage: PlanStatus) => void;
}

/** a thrown send error to the web's own problem word */
function sendProblem(err: unknown): CardChatProblem {
  if (err instanceof CardChatError) return err.problem;
  if (err instanceof ChatStreamError) return problemOf(err.status, err.code);
  if (err instanceof Error && err.message === 'Not authenticated') return 'auth';
  return 'failed';
}

const isAbort = (err: unknown) => (err as { name?: string } | null)?.name === 'AbortError';

export class CardChatStore {
  private states = new Map<string, CardChatState>();
  private listeners = new Map<string, Set<() => void>>();
  private controllers = new Map<string, AbortController>();
  private opening = new Map<string, AbortController>();
  private seq = 0;

  constructor(private readonly opts: CardChatStoreOptions = {}) {}

  get(key: string): CardChatState {
    return this.states.get(key) ?? EMPTY_CHAT;
  }

  subscribe(key: string, fn: () => void): () => void {
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, (set = new Set()));
    set.add(fn);
    return () => void set!.delete(fn);
  }

  private set(key: string, patch: Partial<CardChatState> | ((s: CardChatState) => Partial<CardChatState>)) {
    const prev = this.get(key);
    const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
    this.states.set(key, next);
    this.listeners.get(key)?.forEach((fn) => fn());
  }

  private patchTurn(key: string, turnKey: string, patch: Partial<CardChatTurn> | ((t: CardChatTurn) => Partial<CardChatTurn>)) {
    this.set(key, (s) => ({ turns: s.turns.map((t) => (t.key === turnKey ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)) }));
  }

  /** GET the card's preamble and thread; nothing when this period is already open */
  open(ref: CardChatRef): void {
    const key = chatKey(ref);
    const s = this.get(key);
    const pk = periodKey(ref);
    if ((s.phase === 'ready' && s.openFor === pk) || (s.phase === 'opening' && s.openFor === pk)) return;
    this.opening.get(key)?.abort();
    const ctl = new AbortController();
    this.opening.set(key, ctl);
    this.set(key, { phase: 'opening', problem: null, openFor: pk });
    openCardChat(ref, ctl.signal)
      .then((open) => {
        if (ctl.signal.aborted) return;
        this.set(key, (cur) => ({
          phase: 'ready',
          open,
          chatId: cur.chatId ?? open.chatId,
          // a thread already on screen (this visit's turns) is newer than the server's copy
          turns: cur.turns.length ? cur.turns : open.thread.map((t) => ({ key: this.nextKey(), question: t.question, answer: t.answer, periodLabel: t.periodLabel, status: 'done' as const })),
        }));
      })
      .catch((err: unknown) => {
        if (ctl.signal.aborted || isAbort(err)) return;
        this.set(key, { phase: 'error', problem: err instanceof CardChatError ? err.problem : 'failed' });
      })
      .finally(() => {
        if (this.opening.get(key) === ctl) this.opening.delete(key);
      });
  }

  setDraft(key: string, draft: string): void {
    if (this.get(key).draft === draft) return;
    this.set(key, { draft });
  }

  private nextKey(): string {
    this.seq += 1;
    return `t${this.seq}`;
  }

  /** a typed or dictated question: one send per card at a time; the turn keeps its turnId for Try again */
  send(ref: CardChatRef, question: string, periodLabel: string | null): boolean {
    const key = chatKey(ref);
    const q = question.trim();
    const s = this.get(key);
    if (!q || s.busy || s.phase !== 'ready') return false;
    const turn: CardChatTurn = { key: this.nextKey(), question: q, answer: '', periodLabel, status: 'streaming', turnId: newTurnId(), since: Date.now() };
    this.set(key, (cur) => ({ turns: [...cur.turns, turn], draft: '', quota: false }));
    void this.ask(ref, turn.key);
    return true;
  }

  /** Try again on a failed or stopped turn: the same turnId (ask) or the same runId (confirm), so it is charged once */
  retry(ref: CardChatRef, turnKey: string): void {
    const key = chatKey(ref);
    const s = this.get(key);
    const t = s.turns.find((x) => x.key === turnKey);
    if (!t || s.busy || (t.status !== 'failed' && t.status !== 'stopped')) return;
    this.patchTurn(key, turnKey, { status: 'streaming', answer: '', since: Date.now(), problem: undefined });
    if (t.runId) void this.confirm(ref, turnKey);
    else void this.ask(ref, turnKey);
  }

  private onUsage(key: string, usage: PlanStatus | undefined | null) {
    if (!usage) return;
    this.opts.onUsage?.(usage);
    this.set(key, { costLine: usage.exempt ? null : costLineFor(1, usage.remaining) });
  }

  private begin(key: string): AbortController {
    this.controllers.get(key)?.abort();
    const ctl = new AbortController();
    this.controllers.set(key, ctl);
    this.set(key, { busy: true });
    return ctl;
  }

  private end(key: string, ctl: AbortController) {
    if (this.controllers.get(key) === ctl) this.controllers.delete(key);
    this.set(key, { busy: false });
  }

  private flusherFor(key: string, turnKey: string) {
    return createTokenDeltaFlusher({ intervalMs: 50, onFlush: (chunk) => this.patchTurn(key, turnKey, (t) => ({ answer: t.answer + chunk })) });
  }

  private failed(key: string, turnKey: string, err: unknown) {
    if (err instanceof QuotaExhaustedError) {
      // no answer is coming: the question goes back in the box and the plan line shows
      const t = this.get(key).turns.find((x) => x.key === turnKey);
      this.onUsage(key, err.usage);
      this.set(key, (s) => ({ turns: s.turns.filter((x) => x.key !== turnKey), quota: true, draft: s.draft || t?.question || '' }));
      return;
    }
    if (isAbort(err)) {
      this.patchTurn(key, turnKey, { status: 'stopped', clarify: undefined });
      return;
    }
    const problem = sendProblem(err);
    this.patchTurn(key, turnKey, { status: 'failed', clarify: undefined, problem });
    if (problem === 'auth') this.set(key, { problem });
  }

  private onEvent(key: string, turnKey: string) {
    return (ev: ReadingStreamEvent) => {
      if (ev.type === 'usage') return this.onUsage(key, ev.usage);
      const view = toClarifyView(ev as Record<string, unknown>);
      if (view) this.patchTurn(key, turnKey, { status: 'clarifying', clarify: view, ...(view.runId ? { runId: view.runId } : {}) });
    };
  }

  private async ask(ref: CardChatRef, turnKey: string) {
    const key = chatKey(ref);
    const t = this.get(key).turns.find((x) => x.key === turnKey);
    if (!t) return;
    // the thread's first question goes through the clarifier, pre-filled from the card (server docs/reading-engine/85);
    // a follow-up (any answered turn before it, this visit's or the saved thread's) is answered directly
    const s0 = this.get(key);
    const first = !s0.turns.some((x) => x.key !== turnKey && x.status === 'done' && !!x.answer);
    const ctl = this.begin(key);
    const flusher = this.flusherFor(key, turnKey);
    try {
      const r = await sendChatMessageStream(t.question, this.get(key).chatId, (d) => flusher.push(d), {
        signal: ctl.signal,
        ...(first && isClarifyEnabled() ? { clarify: true } : {}),
        card: toWireCard(ref),
        turnId: t.turnId ?? newTurnId(),
        onEvent: this.onEvent(key, turnKey),
      });
      flusher.flushSync();
      if (r.clarifyingRunId) {
        this.patchTurn(key, turnKey, { status: 'clarifying', runId: r.clarifyingRunId, answer: '' });
        return;
      }
      this.set(key, { chatId: r.chatId || this.get(key).chatId, problem: null });
      this.patchTurn(key, turnKey, { status: 'done', answer: r.answer, since: undefined });
    } catch (err) {
      flusher.flushSync();
      this.failed(key, turnKey, err);
    } finally {
      flusher.dispose();
      this.end(key, ctl);
    }
  }

  /** a chip or typed answer to the clarifier; `ready` goes straight to the reading */
  async answer(ref: CardChatRef, turnKey: string, value: string, viaChip: boolean): Promise<void> {
    const key = chatKey(ref);
    const t = this.get(key).turns.find((x) => x.key === turnKey);
    if (!t?.runId || this.get(key).busy) return;
    const tz = t.clarify?.type === 'clarify' && t.clarify.criterion === LOCATION_CRITERION ? browserTimeZone() : undefined;
    this.set(key, { busy: true });
    this.patchTurn(key, turnKey, { clarifyFailed: false });
    let ready = false;
    try {
      const next = tz ? await answerClarify(t.runId, value, viaChip, { tz }) : await answerClarify(t.runId, value, viaChip);
      if (next.type === 'ready') ready = true;
      else {
        const view = toClarifyView(next as unknown as Record<string, unknown>);
        if (view) this.patchTurn(key, turnKey, { clarify: view, ...(view.type === 'declined' ? { status: 'done', answer: view.reply } : {}) });
      }
    } catch {
      // the clarifier's question stays up to be answered again (Try again would skip it)
      this.patchTurn(key, turnKey, { clarifyFailed: true });
    } finally {
      this.set(key, { busy: false });
    }
    if (ready) await this.confirm(ref, turnKey);
  }

  /** "Yes, read it": the reading streams into the same turn (the server takes the card from the clarify state) */
  async confirm(ref: CardChatRef, turnKey: string): Promise<void> {
    const key = chatKey(ref);
    const t = this.get(key).turns.find((x) => x.key === turnKey);
    if (!t?.runId) return;
    const ctl = this.begin(key);
    this.patchTurn(key, turnKey, { status: 'streaming', clarify: undefined, answer: '', since: Date.now() });
    const flusher = this.flusherFor(key, turnKey);
    try {
      const r = await confirmClarifyStream(t.runId, this.get(key).chatId, (d) => flusher.push(d), { signal: ctl.signal, onEvent: this.onEvent(key, turnKey) });
      flusher.flushSync();
      this.set(key, { chatId: r.chatId || this.get(key).chatId, problem: null });
      this.patchTurn(key, turnKey, { status: 'done', answer: r.answer, since: undefined });
    } catch (err) {
      flusher.flushSync();
      this.failed(key, turnKey, err);
    } finally {
      flusher.dispose();
      this.end(key, ctl);
    }
  }

  /** "Change" on the clarifier's proposal: the question goes back in the box */
  change(ref: CardChatRef, turnKey: string): void {
    const key = chatKey(ref);
    const t = this.get(key).turns.find((x) => x.key === turnKey);
    if (!t) return;
    this.set(key, (s) => ({ turns: s.turns.filter((x) => x.key !== turnKey), draft: t.question }));
  }

  /** the board went away: every stream and open stops (an open's period is forgotten so the next mount opens again) */
  dispose(): void {
    this.controllers.forEach((c) => c.abort());
    this.opening.forEach((c) => c.abort());
    this.controllers.clear();
    this.opening.clear();
    this.states.forEach((st, key) => {
      if (st.phase === 'opening') this.states.set(key, { ...st, phase: 'idle', openFor: null });
    });
  }
}

export function createCardChatStore(opts?: CardChatStoreOptions): CardChatStore {
  return new CardChatStore(opts);
}
