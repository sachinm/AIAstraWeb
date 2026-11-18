/**
 * A card's Chat view (server docs/reading-engine/85, Sachin 2026-11-18): the third face of the card, beside Read and
 * Short, drawn in place inside the card. From the top: the card's own text as the server sent it (the preamble, never
 * rebuilt from the web's card), the conversation (the one scroll, inside the card), and the input anchored to the foot
 * of the card: a textarea, the mic (dictation into the box through the browser's speech recognition, editable before
 * Send) and Send, with the cost line under it. While the phone keyboard is open the foot rises with the visual viewport,
 * so the input stays above the keyboard and the card keeps its height.
 *
 * The thread lives in the board's store, so leaving for Read or Short keeps it (and an answer still streaming).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mic, Send, Square } from 'lucide-react';
import type { CardChatRef } from '../../lib/cardChatApi';
import ClarifyCard from '../../pages/chat-interface/ClarifyCard';
import { shouldSendOnKey } from '../../pages/chat-interface/readingUi';
import { useSpeechRecognition } from '../../pages/chat-interface/useSpeechRecognition';
import type { CardChatStore, CardChatTurn } from './cardChatStore';
import { useCardChat } from './useCardChat';
import { CARD_CHAT_WORDS as W, PROBLEM_WORD } from './words';

export interface CardChatProps {
  store: CardChatStore;
  chatRef: CardChatRef;
  /** the period chip's words, fixed while the chat is open */
  periodLabel: string | null;
  /** "Uses 1 of your N questions" when the server sends none (the person's plan); null hides it */
  fallbackCostLine?: string | null;
  /** Esc goes back to the card */
  onBack: () => void;
}

/** after this long with no words, the status line says it is still reading (doc 85 §4 Timings) */
export const STILL_READING_MS = 10_000;

/** the px the on-screen keyboard covers at the foot of `el` (0 without a visual viewport) */
export function keyboardCover(rectBottom: number, vv: { height: number; offsetTop: number } | null | undefined): number {
  if (!vv) return 0;
  return Math.max(0, Math.round(rectBottom - (vv.offsetTop + vv.height)));
}

function useKeyboardInset(ref: RefObject<HTMLElement | null>): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const on = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // keep at least the input's own height on screen
      setInset(Math.min(keyboardCover(r.bottom, vv), Math.max(0, r.height - 120)));
    };
    vv.addEventListener('resize', on);
    vv.addEventListener('scroll', on);
    on();
    return () => {
      vv.removeEventListener('resize', on);
      vv.removeEventListener('scroll', on);
    };
  }, [ref]);
  return inset;
}

function Waiting({ since }: { since?: number }) {
  const [late, setLate] = useState(() => !!since && Date.now() - since >= STILL_READING_MS);
  useEffect(() => {
    if (!since || late) return;
    const t = setTimeout(() => setLate(true), Math.max(0, STILL_READING_MS - (Date.now() - since)));
    return () => clearTimeout(t);
  }, [since, late]);
  return (
    <p role="status" className="text-[14px] italic text-white/60" data-testid="card-chat-waiting">
      {late ? W.stillReading : W.reading}
    </p>
  );
}

const bubbleCls = 'max-w-[92%] rounded-2xl px-3 py-2 text-[15px] leading-relaxed';

function Turn({ turn, busy, onRetry, onAnswer, onConfirm, onChange }: {
  turn: CardChatTurn;
  busy: boolean;
  onRetry: () => void;
  onAnswer: (value: string, viaChip: boolean) => void;
  onConfirm: () => void;
  onChange: () => void;
}) {
  return (
    <li className="flex flex-col gap-1.5" data-testid="card-chat-turn" data-status={turn.status}>
      <p className={`${bubbleCls} self-end whitespace-pre-wrap bg-teal-500/20 text-white`} data-testid="card-chat-question">
        <span className="sr-only">{W.you}: </span>
        {turn.question}
      </p>
      {turn.clarify && turn.status === 'clarifying' ? (
        <div className={`${bubbleCls} self-start bg-white/5`} data-testid="card-chat-clarify">
          <ClarifyCard view={turn.clarify} busy={busy} onChip={(v) => onAnswer(v, true)} onText={(t) => onAnswer(t, false)} onConfirm={onConfirm} onChange={onChange} />
        </div>
      ) : turn.answer ? (
        <div className={`${bubbleCls} card-chat-answer self-start bg-white/5 text-white/90 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5`} data-testid="card-chat-answer" aria-live={turn.status === 'streaming' ? 'polite' : undefined}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.answer}</ReactMarkdown>
        </div>
      ) : turn.status === 'streaming' ? (
        <Waiting since={turn.since} />
      ) : null}
      {(turn.status === 'failed' || turn.status === 'stopped') && (
        <p role="alert" className="flex flex-wrap items-center gap-x-2 text-[14px] text-amber-100" data-testid="card-chat-turn-failed">
          {turn.status === 'stopped' ? W.stopped : W.sendFailed}
          <button type="button" onClick={onRetry} disabled={busy} className="font-semibold underline underline-offset-4 disabled:opacity-50" data-testid="card-chat-try-again">
            {W.tryAgain}
          </button>
        </p>
      )}
    </li>
  );
}

export default function CardChat({ store, chatRef, periodLabel, fallbackCostLine = null, onBack }: CardChatProps) {
  const chat = useCardChat(store, chatRef, periodLabel);
  const { state, setDraft } = chat;
  const root = useRef<HTMLDivElement | null>(null);
  const thread = useRef<HTMLOListElement | null>(null);
  const box = useRef<HTMLTextAreaElement | null>(null);
  const inset = useKeyboardInset(root);
  const [more, setMore] = useState(false);

  // the mic: the box holds what was typed before the mic opened, then this session's words (the transcript is cumulative)
  const base = useRef('');
  const onTranscript = useCallback((t: string) => setDraft(base.current ? `${base.current} ${t}` : t), [setDraft]);
  const mic = useSpeechRecognition({ onTranscript });
  const startMic = () => {
    base.current = state.draft.trim();
    mic.startListening();
  };

  const send = () => {
    if (mic.isListening) mic.stopListening();
    chat.send(state.draft);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldSendOnKey(e as unknown as { key: string; shiftKey: boolean; nativeEvent: { isComposing?: boolean } })) {
      e.preventDefault();
      send();
    }
  };
  const onRootKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (mic.isListening) mic.stopListening();
    else onBack();
  };

  // the newest words stay in view
  const last = state.turns[state.turns.length - 1];
  useLayoutEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.turns.length, last?.answer, last?.status]);

  // the box takes focus when the chat opens on a device with a keyboard of its own
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches) box.current?.focus();
  }, []);

  const open = state.open;
  const lines = open?.preamble.lines.slice(0, 4) ?? [];
  const shownLines = more ? lines : lines.slice(0, 1);
  const costLine = state.costLine !== undefined ? state.costLine : open ? (open.costLine ?? fallbackCostLine) : fallbackCostLine;
  const canType = state.phase === 'ready';
  const canSend = canType && !state.busy && !!state.draft.trim();
  const micTitle = !mic.isSupported ? W.micUnsupportedReason : mic.permissionDenied ? W.micDenied : W.micStart;

  return (
    <div
      ref={root}
      className="flex min-h-0 flex-1 flex-col gap-2"
      style={inset ? { paddingBottom: inset } : undefined}
      onKeyDown={onRootKey}
      data-testid="card-chat"
      data-phase={state.phase}
    >
      <section className="shrink-0 rounded-xl bg-white/[0.06] px-3 py-2 text-[14px] text-white/75" data-testid="card-chat-preamble" aria-label={W.fromCard}>
        {state.phase === 'opening' || state.phase === 'idle' ? (
          <p className="h-4 w-2/3 animate-pulse rounded bg-white/10" role="status" aria-label={W.opening} data-testid="card-chat-opening" />
        ) : state.phase === 'error' ? (
          <p role="alert" className="flex flex-wrap items-center gap-x-2 text-amber-100" data-testid="card-chat-open-failed">
            {state.problem && state.problem !== 'failed' ? PROBLEM_WORD[state.problem] : W.openFailed}
            <button type="button" onClick={chat.reopen} className="font-semibold underline underline-offset-4" data-testid="card-chat-reopen">
              {W.retry}
            </button>
          </p>
        ) : (
          <>
            <p className="text-[12px] uppercase tracking-wide text-white/50">{W.fromCard}</p>
            {open?.preamble.headline && <p className="font-semibold text-white/90" data-testid="card-chat-headline">{open.preamble.headline}</p>}
            {shownLines.map((l, i) => (
              <p key={i} className={more ? '' : 'line-clamp-2'} data-testid="card-chat-preamble-line">
                {l}
              </p>
            ))}
            {lines.length > 1 && (
              <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="mt-0.5 text-[13px] font-semibold text-teal-200 underline underline-offset-4" data-testid="card-chat-more">
                {more ? W.less : W.more}
              </button>
            )}
          </>
        )}
      </section>

      <ol ref={thread} className="self-v3-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-0.5 [scrollbar-width:thin]" data-testid="card-chat-thread" aria-label={periodLabel ?? undefined}>
        {state.turns.length === 0 && canType && <li className="text-[14px] text-white/50">{W.empty}</li>}
        {state.turns.map((t) => (
          <Turn
            key={t.key}
            turn={t}
            busy={state.busy}
            onRetry={() => chat.retry(t.key)}
            onAnswer={(v, chip) => chat.answer(t.key, v, chip)}
            onConfirm={() => chat.confirm(t.key)}
            onChange={() => chat.change(t.key)}
          />
        ))}
      </ol>

      <div className="shrink-0 border-t border-white/10 pt-2" data-testid="card-chat-input-bar" data-anchor="card-bottom">
        {state.quota && (
          <p role="status" className="mb-1.5 text-[13px] text-amber-100" data-testid="card-chat-quota">
            {W.quota}{' '}
            <a href="/pricing" className="font-semibold underline underline-offset-4">
              {W.plans}
            </a>
          </p>
        )}
        {state.problem && state.phase === 'ready' && state.problem !== 'failed' && state.problem !== 'quota' && (
          <p role="status" className="mb-1.5 text-[13px] text-amber-100" data-testid="card-chat-problem">
            {PROBLEM_WORD[state.problem]}
          </p>
        )}
        <div className="flex items-end gap-1.5">
          <textarea
            ref={box}
            value={state.draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            disabled={!canType}
            placeholder={W.placeholder}
            aria-label={W.question}
            className="max-h-28 min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-[16px] text-white placeholder-white/45 focus:outline-none focus:ring-2 focus:ring-teal-300/50 disabled:opacity-50"
            data-testid="card-chat-textarea"
          />
          {mic.isListening ? (
            <button type="button" onClick={mic.stopListening} aria-label={W.micStop} title={W.micStop} className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/90 text-white" data-testid="card-chat-mic" data-listening="true">
              <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-red-300/60" aria-hidden="true" />
              <Square className="h-4 w-4 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startMic}
              disabled={!mic.isSupported || !canType}
              aria-label={!mic.isSupported ? W.micUnavailable : mic.permissionDenied ? W.micDenied : W.micStart}
              title={micTitle}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="card-chat-mic"
              data-listening="false"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={send} disabled={!canSend} aria-label={W.send} title={W.send} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500/80 text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40" data-testid="card-chat-send">
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 flex min-h-[18px] flex-wrap items-center justify-between gap-x-3 text-[12px] text-white/55">
          {mic.isListening ? (
            <span role="status" className="text-red-200" data-testid="card-chat-listening">
              {W.micListening}
            </span>
          ) : costLine ? (
            <span data-testid="card-chat-cost">{costLine}</span>
          ) : (
            <span />
          )}
          {!mic.isSupported && <span data-testid="card-chat-mic-reason">{W.micUnavailable}</span>}
        </p>
      </div>
    </div>
  );
}
