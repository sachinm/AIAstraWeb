/**
 * The parts every Self v3 card shares, whichever template draws it: "Is this right?", the sensitive line and the plain
 * lines for a card that is not ready (server docs/reading-engine/68 §4.4, doc 75).
 */
import { useState } from 'react';
import type { LadderSteps, PersonalPattern } from '../../../lib/selfV2Api';
import { cardReadPending, sendSelfV3Confirm, type SelfCardId, type SelfV3CardView, type SpanReading } from '../../../lib/selfV3Api';
import { CONFIRM_ANSWERS, V3_WORDS } from './words';
import { useBoardId } from './boardContext';

/** the card's headline: the v3 line, else the stored v2 headline */
export function cardHeadline(card: SelfV3CardView): string | null {
  return card.v3?.line || card.v2?.card?.headline || null;
}

/** the patterns a card can show: the v3 pattern, else the v2 card's */
export function cardPatterns(card: SelfV3CardView): PersonalPattern[] {
  if (card.v3) return card.v3.pattern ? [card.v3.pattern] : [];
  return card.v2?.card?.patterns ?? [];
}

export function cardLadder(card: SelfV3CardView): LadderSteps | null {
  if (card.v3) return card.v3.ladder;
  return card.v2?.card?.ladder ?? null;
}

/** "Is this right?": Yes / Not really / Not sure, one tap; the answer replaces the question with one line. */
export function ConfirmSection({ confirm }: { confirm: { claimId: string; text: string } }) {
  const [state, setState] = useState<'ask' | 'busy' | 'done' | 'failed'>('ask');
  const board = useBoardId();
  const answer = async (a: 'yes' | 'no' | 'skip') => {
    setState('busy');
    setState((await sendSelfV3Confirm(confirm.claimId, a, board)) ? 'done' : 'failed');
  };
  if (state === 'done')
    return (
      <p className="text-[15px] text-teal-200" role="status" data-testid="section-confirm-done">
        {V3_WORDS.noted}
      </p>
    );
  return (
    <section className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5" data-testid="section-confirm" aria-label={V3_WORDS.isThisRight}>
      <p className="min-w-0 text-[15px] text-white/80" title={confirm.text}>
        <b className="font-semibold text-white/90">{V3_WORDS.isThisRight}</b> <span className="text-white/70">{confirm.text}</span>
      </p>
      <span className="flex flex-wrap gap-1.5">
        {CONFIRM_ANSWERS.map((a) => (
          <button
            key={a.value}
            type="button"
            disabled={state === 'busy'}
            onClick={() => void answer(a.value)}
            className="self-v3-btn rounded-full border border-white/15 bg-white/5 px-3.5 text-[13px] font-semibold text-white/85 hover:bg-white/10 disabled:opacity-40"
            data-testid={`confirm-${a.value}`}
          >
            {a.label}
          </button>
        ))}
      </span>
      {state === 'failed' && (
        <span role="alert" className="text-[13px] text-rose-300">
          {V3_WORDS.saveFailed}
        </span>
      )}
    </section>
  );
}

export function SensitiveNote({ card }: { card: SelfV3CardView }) {
  if (!card.sensitive) return null;
  return (
    <p className="text-[13px] text-white/55" data-testid="card-sensitive">
      {V3_WORDS.sensitive}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Doc 70 Phase 3: a reading per card (§4.3, §4.4)
// ---------------------------------------------------------------------------------------------------------------------

/** the per-card reading as a card sees it: on when the board's `reading.enabled`, and the Try again call */
export interface CardReading {
  on: boolean;
  onReadAgain: (id: SelfCardId) => Promise<void> | void;
}

/** true when the card shows its reading state instead of its body */
export function showsReadState(card: SelfV3CardView, reading: CardReading | undefined): boolean {
  return !!reading?.on && !!card.state && card.state !== 'ready';
}

/**
 * A card that is not read yet: a quiet skeleton and one line while it is queued or reading; "This one did not come
 * through" with Try again when it failed; "Not read yet" otherwise (also at the spend cap, never an error).
 */
export function ReadStateBody({ card, reading }: { card: SelfV3CardView; reading: CardReading }) {
  const [busy, setBusy] = useState(false);
  if (cardReadPending(card.state)) {
    return (
      <div className="mt-3 min-h-[120px] flex-1" role="status" data-testid="card-reading" data-state={card.state}>
        <div className="space-y-2.5" aria-hidden="true">
          <div className="h-5 w-3/4 animate-pulse rounded-md bg-white/10 motion-reduce:animate-none" />
          <div className="h-3.5 w-full animate-pulse rounded-md bg-white/[0.07] motion-reduce:animate-none" />
          <div className="h-3.5 w-5/6 animate-pulse rounded-md bg-white/[0.07] motion-reduce:animate-none" />
        </div>
        <p className="mt-4 text-[15px] text-white/65" data-testid="card-reading-line">
          {card.state === 'reading' ? V3_WORDS.cardReading : V3_WORDS.cardQueued}
        </p>
      </div>
    );
  }
  if (card.state === 'failed') {
    const again = async () => {
      setBusy(true);
      try {
        await reading.onReadAgain(card.id);
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="mt-3" data-testid="card-read-failed">
        <p className="text-[15px] text-white/75">{V3_WORDS.cardNotThrough}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void again()}
          className="mt-3 inline-flex min-h-[44px] items-center rounded-full border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white/85 hover:bg-white/10 disabled:opacity-40"
          data-testid="card-try-again"
        >
          {V3_WORDS.tryAgain}
        </button>
      </div>
    );
  }
  return (
    <p className="mt-3 text-[15px] text-white/60" data-testid="card-not-read">
      {V3_WORDS.notReadYet}
    </p>
  );
}

/** the tone a span shows: none when the clocks are split on it */
export function spanToneShown<T>(span: SpanReading | null, tone: T | null): T | null {
  return span?.held === false ? null : tone;
}
