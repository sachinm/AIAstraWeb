/**
 * The hero of the Self board v2: the person's present shade (server docs/reading-engine/66 §4.3, §4.6, mockup §1). The
 * tone word, one sentence naming the life area and the date it changes, the sub line, the six-months-each-way strip,
 * "Pressure eases" and "Sub-chapter ends", the one question (or, when there is none, the first missing fact from the
 * Personalize wizard's words), an optional mood tap, and "Why we think so ›". A split verdict is withheld: the hero then
 * says only that not enough is stored yet.
 */
import { useState } from 'react';
import { longDate } from '../../../lib/careerApi';
import { saveFacts } from '../../../lib/profileApi';
import { track } from '../../../lib/events';
import { sendSelfV2Confirm, sendSelfV2Mood, type HeroDoc, type Mood, type SelfConfirmAnswer, type WindowRef } from '../../../lib/selfV2Api';
import { STEPS } from '../../welcome/WelcomeWizard';
import { ANSWERS, MOODS, TONE_CLASS, TONE_WORD, V2_WORDS } from './words';

const SURFACE = 'self_v2';
const optCls = 'inline-flex min-h-[40px] items-center rounded-full border px-3.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

// ---------------------------------------------------------------------------------------------------------------------
// The strip
// ---------------------------------------------------------------------------------------------------------------------

const DAY = 86_400_000;
function toMs(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}
function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate());
}
function shortMonth(ms: number, withYear: boolean): string {
  return new Date(ms).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}
function shortDay(iso: string): string {
  return new Date(toMs(iso)).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

const FILL: Record<WindowRef['polarity'], string> = { presses: 'fill-rose-400', mixed: 'fill-amber-400', supports: 'fill-teal-400' };
const ORDER: Record<WindowRef['polarity'], number> = { supports: 0, mixed: 1, presses: 2 };

/** Six months back to six ahead, the windows coloured by what they do, a line at today and the date pressure eases. */
export function Strip({ windows, easesAt, today, height = 54 }: { windows: WindowRef[]; easesAt: string | null; today: string; height?: number }) {
  const t = toMs(today);
  const from = addMonths(t, -6);
  const to = addMonths(t, 6);
  const W = 360;
  const x0 = 8;
  const x1 = W - 8;
  const x = (ms: number) => x0 + ((Math.max(from, Math.min(to, ms)) - from) / (to - from)) * (x1 - x0);
  const mid = Math.round(height * 0.55);
  const shown = windows
    .filter((w) => toMs(w.to) >= from && toMs(w.from) <= to)
    .sort((a, b) => ORDER[a.polarity] - ORDER[b.polarity]);
  const tx = x(t);
  const ex = easesAt && toMs(easesAt) >= from && toMs(easesAt) <= to ? x(toMs(easesAt)) : null;
  return (
    <div data-testid="hero-strip">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/45">{V2_WORDS.stripLabel}</p>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" aria-label="Six months back to six months ahead" className="block">
        <line x1={x0} y1={mid} x2={x1} y2={mid} className="stroke-white/20" strokeWidth={2} />
        {shown.map((w) => {
          const a = x(toMs(w.from));
          const b = Math.max(a + 3, x(toMs(w.to) + DAY));
          return <rect key={w.rowId} x={a} y={mid - 6} width={b - a} height={12} rx={6} className={FILL[w.polarity]} opacity={0.4 + 0.15 * w.strength} data-polarity={w.polarity} />;
        })}
        <line x1={tx} y1={mid - 18} x2={tx} y2={mid + 18} className="stroke-white" strokeWidth={2} data-testid="hero-strip-today" />
        <text x={tx} y={9} textAnchor="middle" fontSize={10} fontWeight={700} className="fill-white">
          {V2_WORDS.today}
        </text>
        {ex !== null && easesAt && (
          <>
            <line x1={ex} y1={mid - 9} x2={ex} y2={mid + 9} className="stroke-teal-300" strokeWidth={2} />
            <text x={Math.min(x1 - 14, Math.max(x0 + 14, ex))} y={height - 2} textAnchor="middle" fontSize={10} className="fill-white/70" data-testid="hero-strip-eases">
              {shortDay(easesAt)}
            </text>
          </>
        )}
      </svg>
      <div className="flex justify-between text-[11px] text-white/45" aria-hidden="true">
        <span>{shortMonth(from, false)}</span>
        <span>{shortMonth(t, false)}</span>
        <span>{shortMonth(to, true)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The one question, the profile question and the mood
// ---------------------------------------------------------------------------------------------------------------------

function HeroQuestion({ question }: { question: { claimId: string; text: string } }) {
  const [state, setState] = useState<'ask' | 'sending' | 'done' | 'failed'>('ask');
  const answer = async (a: SelfConfirmAnswer) => {
    setState('sending');
    track('question_answer', SURFACE, 'hero', { value: a });
    setState((await sendSelfV2Confirm(question.claimId, a)) ? 'done' : 'failed');
  };
  return (
    <div className="rounded-2xl bg-white/5 p-3" data-testid="hero-question">
      <p className="text-[15px] font-semibold text-white">{question.text}</p>
      {state === 'done' ? (
        <p className="mt-2 inline-flex rounded-full bg-teal-500/15 px-3 py-1.5 text-sm font-semibold text-teal-200" role="status" data-testid="hero-thanks">
          {V2_WORDS.thanks}
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {ANSWERS.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={state === 'sending'}
                onClick={() => void answer(o.value)}
                className={`${optCls} ${o.value === 'yes' ? 'border-transparent bg-teal-500/15 text-teal-200' : 'border-white/15 text-white/80 hover:bg-white/10'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {state === 'failed' ? (
            <p className="mt-1.5 text-xs text-rose-300" role="alert">
              {V2_WORDS.saveFailed}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-white/50">{V2_WORDS.questionNote}</p>
          )}
        </>
      )}
    </div>
  );
}

/** The wizard question (server doc 52 §3 words) for the first missing fact it can ask inline; null when none. */
export function profileQuestionFor(missing: string[]) {
  for (const key of missing) {
    for (const step of STEPS) {
      for (const q of step.questions) {
        if (q.fact === 'place.current') continue; // needs the location picker: asked in Personalize only
        if (q.fact === key || q.fact.startsWith(`${key}.`) || step.id === key) return q;
      }
    }
  }
  return null;
}

function ProfileQuestion({ missing }: { missing: string[] }) {
  const q = profileQuestionFor(missing);
  const [picked, setPicked] = useState<string[]>([]);
  const [state, setState] = useState<'ask' | 'sending' | 'done' | 'failed'>('ask');
  if (!q) return null;
  const save = async (value: string | null) => {
    setState('sending');
    track('question_answer', SURFACE, q.fact, { value: value ?? 'declined' });
    let ok = false;
    try {
      ok = await saveFacts({ [q.fact]: value });
    } catch {
      ok = false;
    }
    setState(ok ? 'done' : 'failed');
  };
  const multi = q.multi ?? 0;
  return (
    <div className="rounded-2xl bg-white/5 p-3" data-testid="hero-profile-question" data-fact={q.fact}>
      <p className="text-[15px] font-semibold text-white">{q.text}</p>
      {state === 'done' ? (
        <p className="mt-2 inline-flex rounded-full bg-teal-500/15 px-3 py-1.5 text-sm font-semibold text-teal-200" role="status" data-testid="hero-thanks">
          {V2_WORDS.thanks}
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {q.options.map((o) => {
              const on = picked.includes(o.key);
              return (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={multi ? on : undefined}
                  disabled={state === 'sending'}
                  onClick={() => {
                    if (!multi) return void save(o.key);
                    setPicked((p) => (on ? p.filter((k) => k !== o.key) : p.length < multi ? [...p, o.key] : p));
                  }}
                  className={`${optCls} ${on ? 'border-transparent bg-teal-500/15 text-teal-200' : 'border-white/15 text-white/80 hover:bg-white/10'}`}
                >
                  {o.label}
                </button>
              );
            })}
            {multi > 0 && (
              <button type="button" disabled={!picked.length || state === 'sending'} onClick={() => void save(picked.join(','))} className={`${optCls} border-transparent bg-teal-500/15 text-teal-200 disabled:opacity-40`}>
                Save
              </button>
            )}
            <button type="button" disabled={state === 'sending'} onClick={() => void save(null)} className={`${optCls} border-white/15 text-white/60 hover:bg-white/10`}>
              Rather not say
            </button>
          </div>
          {state === 'failed' && (
            <p className="mt-1.5 text-xs text-rose-300" role="alert">
              {V2_WORDS.saveFailed}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function MoodTap() {
  const [state, setState] = useState<'ask' | 'done' | 'failed'>('ask');
  const send = async (m: Mood) => {
    track('chip_select', SURFACE, `mood_${m}`);
    setState((await sendSelfV2Mood(m)) ? 'done' : 'failed');
  };
  if (state === 'done')
    return (
      <p className="text-xs text-teal-200" role="status" data-testid="hero-mood-thanks">
        {V2_WORDS.thanks}
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/60" data-testid="hero-mood">
      <span>{V2_WORDS.moodAsk}</span>
      {MOODS.map((m) => (
        <button key={m.value} type="button" onClick={() => void send(m.value)} className="inline-flex min-h-[32px] items-center rounded-full border border-white/15 px-2.5 font-semibold text-white/75 hover:bg-white/10">
          {m.label}
        </button>
      ))}
      {state === 'failed' && <span className="text-rose-300">{V2_WORDS.saveFailed}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The hero
// ---------------------------------------------------------------------------------------------------------------------

export type HeroLayout = 'landscape' | 'wide' | 'portrait' | 'pane' | 'phone';

export default function Hero({
  hero,
  missing,
  today,
  subChapterEnds,
  doThisMonth,
  layout,
  onWhy,
}: {
  hero: HeroDoc | null;
  missing: string[];
  today: string;
  subChapterEnds: string | null;
  /** the ranked area's Best and Practical lines (desktop 1440 and up) */
  doThisMonth: string[];
  layout: HeroLayout;
  onWhy: () => void;
}) {
  if (!hero || hero.withheld) {
    return (
      <section className="glass rounded-2xl px-4 py-3" data-testid="hero" data-withheld="true">
        <p className="text-[15px] text-white/80" data-testid="hero-withheld">
          {V2_WORDS.heroWithheld}
        </p>
      </section>
    );
  }

  const words = (
    <div className="min-w-0">
      <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[13px] font-extrabold ${TONE_CLASS[hero.tone]}`} data-testid="hero-tone">
        <i className="inline-block h-2 w-2 rounded-full bg-current" aria-hidden="true" />
        {TONE_WORD[hero.tone]}
      </span>
      <h2 className={`mt-2 font-extrabold leading-tight text-white ${layout === 'pane' || layout === 'phone' ? 'text-lg' : 'text-[22px]'}`} data-testid="hero-sentence">
        {hero.sentence}
      </h2>
      {layout !== 'phone' && hero.sub && (
        <p className="mt-1 text-[15px] text-white/70" data-testid="hero-sub">
          {hero.sub}
        </p>
      )}
      <button type="button" onClick={onWhy} className="mt-1.5 inline-flex min-h-[32px] items-center text-[13px] font-semibold text-purple-300 hover:text-purple-200" data-testid="hero-why">
        {V2_WORDS.why} ›
      </button>
    </div>
  );

  const rows = (
    <ul className="mt-1.5 grid gap-0.5 text-[13px]" data-testid="hero-dates">
      {hero.easesAt && (
        <li className="flex justify-between gap-2 text-white/65">
          <span>{V2_WORDS.pressureEases}</span>
          <b className="font-semibold text-white/90">{longDate(hero.easesAt)}</b>
        </li>
      )}
      {subChapterEnds && (
        <li className="flex justify-between gap-2 text-white/65">
          <span>{V2_WORDS.subChapterEnds}</span>
          <b className="font-semibold text-white/90">{longDate(subChapterEnds)}</b>
        </li>
      )}
    </ul>
  );
  const strip = (
    <div className="min-w-0">
      <Strip windows={hero.strip} easesAt={hero.easesAt} today={today} height={layout === 'pane' ? 40 : 54} />
      {layout !== 'pane' && rows}
    </div>
  );
  const ask = (
    <div className="min-w-0 space-y-2">
      {hero.question ? <HeroQuestion question={hero.question} /> : missing.length > 0 ? <ProfileQuestion missing={missing} /> : null}
      {layout !== 'pane' && <MoodTap />}
    </div>
  );
  const todo = doThisMonth.length > 0 && (
    <div className="min-w-0" data-testid="hero-todo">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/45">{V2_WORDS.doThisMonth}</p>
      <ul className="mt-1 space-y-1 text-sm text-white/75">
        {doThisMonth.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );

  const grid =
    layout === 'wide'
      ? 'grid grid-cols-[1.25fr_1fr_0.9fr_0.9fr] items-start gap-4'
      : layout === 'landscape'
        ? 'grid grid-cols-[1.25fr_1fr_0.9fr] items-start gap-4'
        : layout === 'portrait'
          ? 'grid grid-cols-2 items-start gap-4'
          : 'grid grid-cols-1 gap-2.5';

  return (
    <section className={`glass rounded-2xl px-4 py-3 ${grid}`} data-testid="hero" data-layout={layout}>
      {layout === 'portrait' ? (
        <>
          <div className="min-w-0 space-y-2">
            {words}
            {ask}
          </div>
          {strip}
        </>
      ) : layout === 'phone' ? (
        words
      ) : (
        <>
          {words}
          {strip}
          {ask}
          {layout === 'wide' && todo}
        </>
      )}
    </section>
  );
}
