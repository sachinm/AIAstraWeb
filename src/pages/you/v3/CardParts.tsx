/**
 * The parts every Self v3 card shares, whichever template draws it (server docs/reading-engine/68 §4.4): the sections
 * menu, "Is this right?", the pattern, the ladder, the sensitive line and the plain lines for a card that is not ready.
 */
import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import type { LadderSteps, PersonalPattern } from '../../../lib/selfV2Api';
import { FIXED_SECTIONS, SELF_SECTIONS, sendSelfV3Confirm, type SelfSectionId, type SelfV3CardView } from '../../../lib/selfV3Api';
import { spanWords } from '../v2/words';
import { SECTION_WORD, V3_WORDS } from './words';

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
export function ConfirmSection({ confirm }: { confirm: { claimId: string; text: string } }) {
  const [state, setState] = useState<'ask' | 'busy' | 'done' | 'failed'>('ask');
  const answer = async (a: 'yes' | 'partly' | 'no') => {
    setState('busy');
    setState((await sendSelfV3Confirm(confirm.claimId, a)) ? 'done' : 'failed');
  };
  if (state === 'done')
    return (
      <p className="mt-4 text-[15px] text-teal-200" role="status" data-testid="section-confirm-done">
        {V3_WORDS.noted}
      </p>
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

/** "Edit sections": line and year are shown on and locked; the others toggle and save at once. */
export function SectionsMenu({ card, sections, onChange }: { card: SelfV3CardView; sections: SelfSectionId[]; onChange: (next: SelfSectionId[]) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open]);
  const on = new Set(sections);
  const toggle = (s: SelfSectionId) => {
    if (FIXED_SECTIONS.includes(s)) return;
    const next = new Set(on);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange(SELF_SECTIONS.filter((x) => next.has(x) || FIXED_SECTIONS.includes(x)));
  };
  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-[40px] items-center rounded-lg px-2 text-[13px] font-semibold text-purple-300 hover:text-purple-200"
        data-testid={`edit-sections-${card.id}`}
      >
        {V3_WORDS.editSections}
      </button>
      {open && (
        <div role="group" aria-label={V3_WORDS.sectionsTitle(card.title)} className="absolute right-0 top-full z-20 mt-1 w-60 rounded-2xl border border-white/10 bg-[#141233] p-2 shadow-2xl" data-testid={`sections-menu-${card.id}`}>
          {SELF_SECTIONS.map((s) => {
            const fixed = FIXED_SECTIONS.includes(s);
            return (
              <label key={s} className={`flex min-h-[40px] items-center justify-between gap-2 rounded-lg px-2 text-sm ${fixed ? 'text-white/55' : 'cursor-pointer text-white/85 hover:bg-white/5'}`}>
                <span className="flex items-center gap-2">
                  {SECTION_WORD[s]}
                  {fixed && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      {V3_WORDS.locked}
                    </span>
                  )}
                </span>
                <input type="checkbox" className="h-4 w-4 accent-teal-400" checked={on.has(s) || fixed} disabled={fixed} onChange={() => toggle(s)} data-testid={`section-toggle-${s}`} />
              </label>
            );
          })}
        </div>
      )}
    </div>
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
