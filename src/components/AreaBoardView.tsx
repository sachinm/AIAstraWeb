/**
 * The page shared by the You and Love boards (server docs/reading-engine/45 §6–§9, 54 §3), built like the Work board:
 * the present tone first, the one question the board needs when the companion memory lacks the fact (doc 48), then
 * sibling pages instead of a long scroll (doc 45 rule 11): Now · What holds you up · What presses · Ahead · Looking back.
 * Ahead is one panel per sub-area: a swipeable carousel with chips and dots on the phone, a tab panel on the desktop.
 * Plain words only; the chart terms the server sends as evidence never reach the screen.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchArea, saveAreaFact, sendAreaCheck, type AreaBoard, type AreaId, type AreaState, type AreaWindow } from '../lib/areaApi';
import { longDate, monthName, type Tone } from '../lib/careerApi';
import { track } from '../lib/events';
import BoardAsk from './BoardAsk';

const panel = 'glass glass-lift rounded-2xl p-4 sm:p-5';
const chip = 'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 text-sm';
type Page = 'now' | 'holds' | 'presses' | 'ahead' | 'back';

export const TONE_WORD: Record<Tone, string> = { demanding: 'Demanding', easing: 'Easing', steady: 'Steady', closing: 'Closing', open: 'Open' };
const TONE_ICON: Record<Tone, string> = { demanding: '◆', easing: '◇', steady: '○', closing: '◐', open: '●' };
const CONFIDENCE_LINE: Record<string, string> = { confirmed: '', likely: 'Most of your chart points this way.', split: 'Your chart is divided on this.' };
const FAMILY_WORDS: Record<string, string> = {
  main: 'Your main timing clock',
  conditional: 'A second timing clock',
  rasi: 'The sign clock',
  karaka: 'The clock of what you seek',
  short: 'The short clocks',
  transit: 'The slow-moving sky',
  annual: "This year's chart",
};
const VOTE_WORDS = { support: 'points to a good stretch', test: 'points to a harder stretch', neutral: 'is quiet' };

export interface BoardQuestion {
  key: 'self.focus' | 'love.status';
  text: string;
  options: Array<{ value: string | null; label: string }>;
}

export interface AreaBoardConfig {
  area: AreaId;
  surface: string;
  title: string;
  testId: string;
  askCategory: string;
  holdsTitle: string;
  pressesTitle: string;
  headline: (b: AreaBoard, focus: string | null) => string;
  subareas: Record<string, string>;
  question: BoardQuestion;
  emptyAhead: string;
  emptyBack: string;
  unavailable: string;
}


export default function AreaBoardView({ cfg }: { cfg: AreaBoardConfig }) {
  const [state, setState] = useState<AreaState | null>(null);
  const [page, setPage] = useState<Page>('now');
  const [why, setWhy] = useState(false);
  const polls = useRef(0);

  const load = () =>
    fetchArea(cfg.area)
      .then(setState)
      .catch(() => setState({ kind: 'error' }));
  useEffect(() => {
    track('board_open', cfg.surface);
    void load();
  }, []);
  // a chart still being prepared is checked again every 30 s, up to 10 times
  useEffect(() => {
    if (state?.kind !== 'preparing' || polls.current >= 10) return;
    const t = setTimeout(() => {
      polls.current += 1;
      void load();
    }, 30_000);
    return () => clearTimeout(t);
  }, [state]);

  const shell = (body: ReactNode) => (
    <div className="w-full px-4 pb-24 pt-4 text-white sm:px-6 lg:px-10" data-testid={cfg.testId}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-3xl font-bold text-transparent">{cfg.title}</h1>
        <BoardAsk category={cfg.askCategory} />
      </div>
      {body}
    </div>
  );

  if (!state) return shell(<div className="p-2 text-white/70" data-testid="board-loading">Loading…</div>);
  if (state.kind === 'preparing') return shell(<div className={`${panel} text-white/80`} data-testid="board-preparing">Your chart is still being prepared. This page will update by itself.</div>);
  if (state.kind === 'no_kundli') return shell(<div className={`${panel} text-white/80`} data-testid="board-no-kundli">Add your birth details in your profile to see this board.</div>);
  if (state.kind === 'unavailable') return shell(<div className={`${panel} text-white/80`} data-testid="board-unavailable">{cfg.unavailable}</div>);
  if (state.kind === 'error')
    return shell(
      <div role="alert" className={`${panel} text-white/80`} data-testid="board-error">
        <p>This page did not load.</p>
        <button type="button" onClick={() => { setState(null); void load(); }} className={`${chip} mt-3 border-white/20 bg-white/5`}>
          Retry
        </button>
      </div>,
    );

  const { board, focus, ask, checks } = state;
  const answer = async (value: string | null) => {
    track('question_answer', cfg.surface, cfg.question.key, { value: value ?? 'declined' });
    await saveAreaFact(cfg.question.key, value);
    void load();
  };
  const PAGES: Array<[Page, string]> = [['now', 'Now'], ['holds', cfg.holdsTitle], ['presses', cfg.pressesTitle], ['ahead', 'Ahead'], ['back', 'Looking back']];

  return shell(
    <>
      {ask && (
        <div className={`${panel} mb-4`} data-testid="board-question">
          <div className="mb-3 font-medium">{cfg.question.text}</div>
          <div className="flex flex-wrap gap-2">
            {cfg.question.options.map((o) => (
              <button key={o.label} type="button" onClick={() => void answer(o.value)} className={`${chip} border-white/20 bg-white/5`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className={`${panel} mb-4`} data-testid="tone-card" data-tone={board.tone.tone}>
        <div className="mb-1 flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
          <span aria-hidden>{TONE_ICON[board.tone.tone]}</span>
          {TONE_WORD[board.tone.tone]}
        </div>
        <h2 className="text-2xl font-semibold leading-snug">{cfg.headline(board, focus)}</h2>
        {CONFIDENCE_LINE[board.tone.confidence] && <p className="mt-2 text-sm text-white/60">{CONFIDENCE_LINE[board.tone.confidence]}</p>}
        <button type="button" onClick={() => { setWhy(true); track('why_open', cfg.surface, 'tone'); }} className="mt-3 min-h-[44px] text-sm text-purple-300 underline underline-offset-4">
          Why we think so
        </button>
      </section>

      <div role="tablist" aria-label={`${cfg.title} pages`} className="mb-4 flex gap-1 overflow-x-auto glass rounded-xl p-1">
        {PAGES.map(([p, label]) => (
          <button key={p} role="tab" type="button" aria-selected={page === p} onClick={() => { setPage(p); track('tab_select', cfg.surface, p); }} className={`min-h-[44px] flex-1 whitespace-nowrap rounded-lg px-4 text-sm ${page === p ? 'bg-white/15 text-white' : 'text-white/60'}`}>
            {label}
          </button>
        ))}
      </div>

      {page === 'now' && <NowPage board={board} focus={focus} cfg={cfg} />}
      {page === 'holds' && <LinesPage testId="holds" empty="Nothing stands out yet." lines={board.supports.map((s) => ({ text: s.text }))} />}
      {page === 'presses' && <LinesPage testId="presses" empty="Nothing is pressing on this now." lines={board.pressures.map((p) => ({ text: p.text, sub: p.until ? `Eases by ${longDate(p.until)}` : 'A steady weight: it asks for care, not worry.' }))} />}
      {page === 'ahead' && <AheadPage board={board} focus={focus} cfg={cfg} />}
      {page === 'back' && <BackPage board={board} checks={checks} cfg={cfg} onAnswered={() => void load()} />}

      {why && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Why we think so" onClick={() => setWhy(false)}>
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#141233] p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()} data-testid="why-sheet">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Why we think so</h2>
              <button type="button" aria-label="Close" onClick={() => setWhy(false)} className="min-h-[44px] min-w-[44px] text-white/60">✕</button>
            </div>
            <p className="mb-3 text-sm text-white/70">
              {board.tone.families.filter((f) => f.vote !== 'neutral').length} of {board.tone.families.length} independent signals have a view.
            </p>
            <ul className="space-y-1 text-sm text-white/80">
              {board.tone.families.map((f) => (
                <li key={f.family}>
                  {FAMILY_WORDS[f.family] ?? 'Another signal'} {VOTE_WORDS[f.vote]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>,
  );
}

function NowPage({ board, focus, cfg }: { board: AreaBoard; focus: string | null; cfg: AreaBoardConfig }) {
  const lead = board.ahead.find((w) => w.subarea === focus) ?? board.ahead[0] ?? null;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={panel} data-testid="year-card">
          <div className="text-xs uppercase tracking-wide text-white/50">This year</div>
          <div className="mt-1 text-lg font-semibold">{board.year ? board.year.note : "This year's chart is not ready yet."}</div>
        </div>
        <div className={panel} data-testid="lead-card">
          <div className="text-xs uppercase tracking-wide text-white/50">{lead ? cfg.subareas[lead.subarea] ?? 'Next' : 'Next'}</div>
          <div className="mt-1 text-lg font-semibold">{lead ? `${lead.label}, ${longDate(lead.from)} – ${longDate(lead.to)}` : cfg.emptyAhead}</div>
        </div>
      </div>

      {board.characterArc && (
        <section className={panel} data-testid="self-character-arc">
          <div className="text-xs uppercase tracking-wide text-purple-300">Character Evolution (Last 10 Years → Now → Next 10 Years)</div>
          <h3 className="mt-1 text-lg font-semibold text-white">{board.characterArc.headline}</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {[board.characterArc.pastDecade, board.characterArc.presentNow, board.characterArc.nextDecade].map((st) => (
              <div key={st.stage} className="rounded-xl border border-white/10 bg-white/5 p-3.5" data-testid={`character-stage-${st.stage}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">{st.label}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/75">{st.windowLabel}</span>
                </div>
                <div className="mt-1.5 font-medium text-white">{st.headline}</div>
                <p className="mt-1 text-sm leading-relaxed text-white/75">{st.summary}</p>
                <div className="mt-2 text-xs text-purple-200/90">Core quality: {st.anchorTrait}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {board.personalityAndJoy && (
        <section className={panel} data-testid="self-personality-joy">
          <div className="text-xs uppercase tracking-wide text-pink-300">Your Personality & What Makes You Feel Good</div>
          <h3 className="mt-1 text-lg font-semibold text-white">{board.personalityAndJoy.headline}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">{board.personalityAndJoy.personalitySummary}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-purple-200">Emotional Rhythm & Comfort</div>
              <p className="mt-1 text-sm text-white/75">{board.personalityAndJoy.emotionalMindStyle}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-pink-200">Curiosity, Wit & Expression</div>
              <p className="mt-1 text-sm text-white/75">{board.personalityAndJoy.intellectualWitStyle}</p>
            </div>
          </div>
          {board.personalityAndJoy.whatFeelsGood.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">What You Naturally Enjoy & Recharge With</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {board.personalityAndJoy.whatFeelsGood.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-3" data-testid={`joy-item-${idx}`}>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-0.5 text-xs text-white/70">{item.whyItFits}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-2 text-xs text-purple-100">
            {board.personalityAndJoy.rechargeRule}
          </div>
        </section>
      )}
    </div>
  );
}

function LinesPage({ lines, empty, testId }: { lines: Array<{ text: string; sub?: string }>; empty: string; testId: string }) {
  if (!lines.length) return <div className={panel} data-testid={testId}>{empty}</div>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2" data-testid={testId}>
      {lines.map((l) => (
        <li key={l.text} className={panel}>
          <div className="font-medium">{l.text}</div>
          {l.sub && <div className="mt-1 text-sm text-white/65">{l.sub}</div>}
        </li>
      ))}
    </ul>
  );
}

function windowLine(w: AreaWindow): string {
  return `${longDate(w.from)} – ${longDate(w.to)}`;
}

function SubareaPanel({ id, windows, cfg }: { id: string; windows: AreaWindow[]; cfg: AreaBoardConfig }) {
  return (
    <div className={panel} data-testid={`ahead-${id}`}>
      <div className="mb-2 text-xs uppercase tracking-wide text-white/50">{cfg.subareas[id] ?? id}</div>
      <ul className="space-y-3">
        {windows.map((w, i) => (
          <li key={i}>
            <div className="font-medium">{w.label}</div>
            <div className="text-sm text-white/70">{windowLine(w)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AheadPage({ board, focus, cfg }: { board: AreaBoard; focus: string | null; cfg: AreaBoardConfig }) {
  const subs = [...new Set(board.ahead.map((w) => w.subarea))];
  const [sel, setSel] = useState<string | null>(focus && subs.includes(focus) ? focus : subs[0] ?? null);
  const rail = useRef<HTMLDivElement | null>(null);
  if (!subs.length || !sel) return <div className={panel} data-testid="ahead-empty">{cfg.emptyAhead}</div>;
  const pick = (s: string) => {
    setSel(s);
    track('chip_select', cfg.surface, `ahead_${s}`);
    const el = rail.current?.querySelector<HTMLElement>(`[data-slide="${s}"]`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };
  const onScroll = () => {
    const r = rail.current;
    if (!r || !r.clientWidth) return;
    const i = Math.round(r.scrollLeft / r.clientWidth);
    if (subs[i] && subs[i] !== sel) setSel(subs[i]!);
  };
  return (
    <div>
      <div role="tablist" aria-label="Ahead by topic" className="mb-3 flex gap-2 overflow-x-auto">
        {subs.map((s) => (
          <button key={s} role="tab" type="button" aria-selected={sel === s} onClick={() => pick(s)} className={`${chip} ${sel === s ? 'border-white/40 bg-white/15' : 'border-white/10 text-white/60'}`}>
            {cfg.subareas[s] ?? s}
          </button>
        ))}
      </div>
      {/* phone and tablet: a swipeable carousel with dots */}
      <div className="lg:hidden">
        <div ref={rail} onScroll={onScroll} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" data-testid="ahead-carousel">
          {subs.map((s) => (
            <div key={s} data-slide={s} className="w-full shrink-0 snap-start">
              <SubareaPanel id={s} windows={board.ahead.filter((w) => w.subarea === s)} cfg={cfg} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden="true">
          {subs.map((s) => (
            <span key={s} className={`h-1.5 w-1.5 rounded-full ${sel === s ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>
      </div>
      {/* desktop: a tab panel */}
      <div className="hidden lg:block" role="tabpanel" data-testid="ahead-tabpanel">
        <SubareaPanel id={sel} windows={board.ahead.filter((w) => w.subarea === sel)} cfg={cfg} />
      </div>
    </div>
  );
}

function BackPage({ board, checks, cfg, onAnswered }: { board: AreaBoard; checks: Record<string, string>; cfg: AreaBoardConfig; onAnswered: () => void }) {
  const answered = board.back.filter((b) => checks[b.month] && checks[b.month] !== 'skip');
  const yes = answered.filter((b) => checks[b.month] === 'yes').length;
  if (board.back.length === 0) return <div className={panel} data-testid="back-empty">{cfg.emptyBack}</div>;
  const answer = async (b: AreaBoard['back'][number], a: 'yes' | 'partly' | 'no' | 'skip') => {
    track('question_answer', cfg.surface, 'looking_back', { answer: a });
    await sendAreaCheck(cfg.area, b.month, b.side, a);
    onAnswered();
  };
  return (
    <div>
      {answered.length > 0 && <p className="mb-3 text-white/70" data-testid="confirmed-line">You confirmed {yes} of {answered.length}.</p>}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {board.back.map((b) => (
          <div key={b.month} className={`${panel} w-[85%] shrink-0 snap-start sm:w-[48%]`} data-testid={`back-${b.month}`}>
            <div className="text-xs uppercase tracking-wide text-white/50">{monthName(b.month)}</div>
            <div className="mt-1 font-medium">Around then, {b.label}.</div>
            {checks[b.month] ? (
              <div className="mt-3 text-sm text-white/60">Thanks — noted.</div>
            ) : (
              <>
                <div className="mt-3 text-sm text-white/70">Did that feel right?</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['yes', 'partly', 'no', 'skip'] as const).map((a) => (
                    <button key={a} type="button" onClick={() => void answer(b, a)} className={`${chip} border-white/20 bg-white/5`}>
                      {a === 'yes' ? 'Yes' : a === 'partly' ? 'Partly' : a === 'no' ? 'Not really' : 'Skip'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

