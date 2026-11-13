/**
 * The parts every Self v3 card shares, whichever template draws it (server docs/reading-engine/68 §4.4): "Is this
 * right?", the pattern, the ladder, the sensitive line and the plain lines for a card that is not ready. The toolbar
 * (CardToolbar) replaced the old "Edit sections" menu.
 */
import { useState } from 'react';
import type { LadderSteps, PersonalPattern } from '../../../lib/selfV2Api';
import { cardReadPending, sendSelfV3Confirm, type SelfCardId, type SelfV3CardView, type SpanReading } from '../../../lib/selfV3Api';
import { spanWords } from '../v2/words';
import { SECTION_WORD, SPAN_TONE_WORD, V3_WORDS } from './words';

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

const PATTERN_ICON: Record<PersonalPattern['kind'], { mark: string; cls: string; label: string }> = {
  risk: { mark: '!', cls: 'bg-rose-500/15 text-rose-200', label: 'Watch out' },
  watch: { mark: '~', cls: 'bg-amber-500/15 text-amber-200', label: 'Keep an eye on' },
  strength: { mark: '✓', cls: 'bg-teal-500/15 text-teal-200', label: 'Strength' },
};

const LADDER: Array<{ key: keyof LadderSteps; label: string; cls: string }> = [
  { key: 'best', label: 'Best', cls: 'text-emerald-300' },
  { key: 'practical', label: 'Practical', cls: 'text-teal-300' },
  { key: 'drift', label: 'Drift', cls: 'text-amber-300' },
  { key: 'floor', label: 'Floor', cls: 'text-rose-300' },
];

const heading = 'text-[11px] font-bold uppercase tracking-[0.08em] text-white/50';

export function PatternSection({ card }: { card: SelfV3CardView }) {
  const patterns = cardPatterns(card);
  return (
    <section className="mt-4" data-testid="section-pattern">
      <h4 className={heading}>{V3_WORDS.pattern}</h4>
      {patterns.length ? (
        <ul className="mt-1.5 space-y-2">
          {patterns.map((pt, i) => {
            const ic = PATTERN_ICON[pt.kind];
            const span = spanWords(pt.since, pt.until);
            return (
              <li key={i} className="grid grid-cols-[28px_1fr] items-start gap-2.5 rounded-xl bg-white/5 px-3 py-2.5 text-[15px]" data-kind={pt.kind}>
                <span className={`grid h-7 w-7 place-items-center rounded-lg text-sm font-extrabold ${ic.cls}`} role="img" aria-label={ic.label}>
                  {ic.mark}
                </span>
                <span>
                  <span className="text-white/90">{pt.text}</span>
                  {span && <span className="mt-0.5 block text-xs text-white/55">{span}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-white/60">{V3_WORDS.noPattern}</p>
      )}
    </section>
  );
}

export function LadderSection({ card }: { card: SelfV3CardView }) {
  const ladder = cardLadder(card);
  const steps = ladder ? LADDER.filter((s) => ladder[s.key]?.trim()) : [];
  return (
    <section className="mt-4" data-testid="section-ladder">
      <h4 className={heading}>{V3_WORDS.ladder}</h4>
      {steps.length ? (
        <ul className="mt-1.5 grid gap-1.5">
          {steps.map((s) => (
            <li key={s.key} className="grid grid-cols-[84px_1fr] gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-[15px]">
              <b className={`self-center text-xs font-bold uppercase tracking-wide ${s.cls}`}>{s.label}</b>
              <span className="text-white/80">{ladder![s.key]}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-white/60">{V3_WORDS.noLadder}</p>
      )}
    </section>
  );
}

/** "Is this right?": Yes / Partly / No; the answer replaces the question with one line. */
export function ConfirmSection({ confirm, slim = false }: { confirm: { claimId: string; text: string }; slim?: boolean }) {
  const [state, setState] = useState<'ask' | 'busy' | 'done' | 'failed'>('ask');
  const answer = async (a: 'yes' | 'partly' | 'no') => {
    setState('busy');
    setState((await sendSelfV3Confirm(confirm.claimId, a)) ? 'done' : 'failed');
  };
  if (state === 'done')
    return (
      <p className={`${slim ? '' : 'mt-4 '}text-[15px] text-teal-200`} role="status" data-testid="section-confirm-done">
        {V3_WORDS.noted}
      </p>
    );
  if (slim)
    return (
      <section className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1" data-testid="section-confirm" aria-label={V3_WORDS.isThisRight}>
        <p className="min-w-0 text-[14px] text-white/80">
          <b className="font-semibold text-white/90">{V3_WORDS.isThisRight}</b> <span className="text-white/65">{confirm.text}</span>
        </p>
        <span className="flex gap-1.5">
          {(['yes', 'partly', 'no'] as const).map((a) => (
            <button key={a} type="button" disabled={state === 'busy'} onClick={() => void answer(a)} className="self-v3-btn rounded-full border border-white/15 bg-white/5 px-3.5 text-[13px] font-semibold text-white/85 hover:bg-white/10 disabled:opacity-40" data-testid={`confirm-${a}`}>
              {a === 'yes' ? 'Yes' : a === 'partly' ? 'Partly' : 'No'}
            </button>
          ))}
        </span>
        {state === 'failed' && (
          <span role="alert" className="text-sm text-rose-300">
            {V3_WORDS.saveFailed}
          </span>
        )}
      </section>
    );
  return (
    <section className="mt-4" data-testid="section-confirm">
      <h4 className={heading}>{V3_WORDS.isThisRight}</h4>
      <p className="mt-1 text-[15px] text-white/85">{confirm.text}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(['yes', 'partly', 'no'] as const).map((a) => (
          <button
            key={a}
            type="button"
            disabled={state === 'busy'}
            onClick={() => void answer(a)}
            className="min-h-[40px] rounded-full border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white/85 hover:bg-white/10 disabled:opacity-40"
            data-testid={`confirm-${a}`}
          >
            {a === 'yes' ? 'Yes' : a === 'partly' ? 'Partly' : 'No'}
          </button>
        ))}
      </div>
      {state === 'failed' && (
        <p role="alert" className="mt-1.5 text-sm text-rose-300">
          {V3_WORDS.saveFailed}
        </p>
      )}
    </section>
  );
}

/** doc 71: the server's plain lines where a card's options cannot be honoured yet */
export function OptionNotes({ card }: { card: SelfV3CardView }) {
  if (!card.optionNotes?.length) return null;
  return (
    <p className="text-xs text-white/55" data-testid="card-option-note">
      {card.optionNotes.join(' ')}
    </p>
  );
}

export function SensitiveNote({ card }: { card: SelfV3CardView }) {
  if (!card.sensitive) return null;
  return (
    <p className="text-xs text-white/55" data-testid="card-sensitive">
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

/** "4 of 5 clocks agree", or "The clocks are split here" when too few clocks hold the span's tone */
export function SpanAgreement({ span }: { span: SpanReading | null }) {
  if (!span) return null;
  if (span.held === false)
    return (
      <p className="text-sm text-white/60" data-testid="span-agreement" data-held="false">
        {V3_WORDS.clocksSplit}
      </p>
    );
  if (!span.agreement) return null;
  return (
    <p className="text-sm text-white/60" data-testid="span-agreement" data-held="true">
      {V3_WORDS.clocksAgree(span.agreement.agree, span.agreement.of)}
    </p>
  );
}

/** the tone a span shows: none when the clocks are split on it */
export function spanToneShown<T>(span: SpanReading | null, tone: T | null): T | null {
  return span?.held === false ? null : tone;
}

/** Chart details: each clock read for the selected span, its tone and whether it agrees */
export function SpanClocks({ span, label }: { span: SpanReading | null; label: string | null }) {
  const clocks = span?.clocks ?? [];
  if (!clocks.length) return null;
  return (
    <section className="mt-5" data-testid="details-clocks">
      <h4 className={heading}>{V3_WORDS.clocksTitle(label ?? SECTION_WORD.stretch.toLowerCase())}</h4>
      <ul className="mt-2 grid gap-1.5">
        {clocks.map((c) => (
          <li
            key={c.system}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-[15px]"
            data-testid={`details-clock-${c.system}`}
            data-agrees={c.agrees ? 'true' : 'false'}
          >
            <span className="text-white/90">{c.label}</span>
            <span className="text-sm text-white/70">{SPAN_TONE_WORD[c.tone]}</span>
            <span className={`text-sm font-semibold ${c.agrees ? 'text-teal-200' : 'text-white/50'}`} data-testid="details-clock-mark">
              <span aria-hidden="true">{c.agrees ? '✓ ' : '· '}</span>
              {c.agrees ? V3_WORDS.clockAgrees : V3_WORDS.clockDiffers}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
