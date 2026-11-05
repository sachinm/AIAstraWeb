/**
 * The Work board, Phase 1 (server docs/reading-engine/42–45). It leads with where the person is now (a tone, never a
 * weather or hospital word), asks the one question that changes what it shows (do you have a job right now?), and
 * splits the rest into four pages instead of a long scroll: Now, Looking back, Ahead, Worries. Plain words only;
 * the families behind the verdict are listed in Why.
 */
import { useEffect, useState } from 'react';
import { fetchCareer, longDate, monthName, sendCheck, setWorkStatus, type CareerMap, type CareerState, type SubareaWindow, type Tone, type WorkStatus } from '../../lib/careerApi';
import { track } from '../../lib/events';
import BoardAsk from '../../components/BoardAsk';

const panel = 'rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-5';
const chip = 'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 text-sm';
const SURFACE = 'work';
type Page = 'now' | 'back' | 'ahead' | 'worries';

export const TONE_WORD: Record<Tone, string> = { demanding: 'Demanding', easing: 'Easing', steady: 'Steady', closing: 'Closing', open: 'Open' };
const TONE_ICON: Record<Tone, string> = { demanding: '◆', easing: '◇', steady: '○', closing: '◐', open: '●' };

export function headline(m: CareerMap): string {
  const p = m.present;
  const d = (s: string | null) => (s ? longDate(s) : null);
  switch (p.tone) {
    case 'demanding':
      return d(p.ease_date) ? `A demanding stretch at work. It eases from ${d(p.ease_date)}.` : 'A demanding stretch at work: what helps this week.';
    case 'easing':
      return d(p.ease_date) ? `The pressure is lifting. From ${d(p.ease_date)}, a better time to move.` : 'The pressure is lifting.';
    case 'closing':
      return d(p.window_end) ? `Finish what you started before ${d(p.window_end)}.` : 'Finish what you started this month.';
    case 'open':
      return d(p.window_end) ? `A strong stretch at work. Ask before ${d(p.window_end)}.` : 'A strong stretch at work.';
    default:
      return d(p.next_window_start) ? `A steady period at work. Build until ${d(p.next_window_start)}.` : 'A steady period at work.';
  }
}

const CONFIDENCE_LINE: Record<string, string> = {
  confirmed: '',
  likely: 'Most of your chart points this way.',
  split: 'Your chart is divided on this.',
};

export const SECURITY_WORDS: Record<string, string> = {
  clear_protected: 'Steady ground, with support',
  clear: 'No sign of a job ending',
  watch: 'Keep an eye on things',
  risk: 'Time to prepare',
  high_risk: 'Prepare now',
};

export const SUBAREA_WORDS: Record<string, string> = {
  get_job: 'Getting a job',
  job_change: 'Changing jobs',
  promotion: 'A promotion',
  job_security: 'Job security',
  abroad: 'Work abroad',
  pay: 'Your pay',
  business: 'Your business',
};

const SIDE_WORD = { support: 'points to a good stretch', test: 'points to a harder stretch', neutral: 'is quiet' };

const WORK_OPTIONS: Array<{ key: WorkStatus; label: string }> = [
  { key: 'yes', label: 'Yes' },
  { key: 'between_jobs', label: 'Between jobs' },
  { key: 'own_business', label: 'Own business' },
  { key: 'studying', label: 'Studying' },
];

export default function WorkPage() {
  const [state, setState] = useState<CareerState | null>(null);
  const [page, setPage] = useState<Page>('now');
  const [why, setWhy] = useState(false);

  const load = () => fetchCareer().then(setState).catch(() => setState({ kind: 'unavailable' }));
  useEffect(() => {
    track('board_open', SURFACE);
    void load();
  }, []);

  if (!state) return <div className="p-6 text-white/70">Loading…</div>;
  if (state.kind === 'not_ready') return <div className={`${panel} m-4 text-white/80`}>Your chart is being prepared. Check back in a minute.</div>;
  if (state.kind === 'unavailable') return <div className={`${panel} m-4 text-white/80`}>The Work board is coming soon.</div>;
  const { map, work, checks } = state;

  const answerWork = async (v: WorkStatus) => {
    track('question_answer', SURFACE, 'work.status', { value: v });
    await setWorkStatus(v);
    void load();
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-4 text-white sm:px-6" data-testid="work-page">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-3xl font-bold text-transparent">Work</h1>
        <BoardAsk category="work" />
      </div>

      {work === null && (
        <div className={`${panel} mb-4`} data-testid="work-question">
          <div className="mb-3 font-medium">Do you have a job right now?</div>
          <div className="flex flex-wrap gap-2">
            {WORK_OPTIONS.map((o) => (
              <button key={o.key} type="button" onClick={() => void answerWork(o.key)} className={`${chip} border-white/20 bg-white/5`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className={`${panel} mb-4`} data-testid="tone-card" data-tone={map.present.tone}>
        <div className="mb-1 flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
          <span aria-hidden>{TONE_ICON[map.present.tone]}</span>
          {TONE_WORD[map.present.tone]}
        </div>
        <h2 className="text-2xl font-semibold leading-snug">{headline(map)}</h2>
        {CONFIDENCE_LINE[map.present.confidence] && <p className="mt-2 text-sm text-white/60">{CONFIDENCE_LINE[map.present.confidence]}</p>}
        <button type="button" onClick={() => { setWhy(true); track('why_open', SURFACE, 'tone'); }} className="mt-3 min-h-[44px] text-sm text-purple-300 underline underline-offset-4">
          Why we think so
        </button>
      </section>

      <div role="tablist" aria-label="Work pages" className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
        {(['now', 'back', 'ahead', 'worries'] as Page[]).map((p) => (
          <button key={p} role="tab" type="button" aria-selected={page === p} onClick={() => { setPage(p); track('tab_select', SURFACE, p); }} className={`min-h-[44px] flex-1 whitespace-nowrap rounded-lg px-4 text-sm ${page === p ? 'bg-white/15 text-white' : 'text-white/60'}`}>
            {p === 'now' ? 'Now' : p === 'back' ? 'Looking back' : p === 'ahead' ? 'Ahead' : 'Your questions'}
          </button>
        ))}
      </div>

      {page === 'now' && <NowPage map={map} />}
      {page === 'back' && <BackPage map={map} checks={checks} onAnswered={() => void load()} />}
      {page === 'ahead' && <AheadPage map={map} />}
      {page === 'worries' && <WorriesPage map={map} />}

      {why && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Why we think so" onClick={() => setWhy(false)}>
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#141233] p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()} data-testid="why-sheet">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Why we think so</h2>
              <button type="button" aria-label="Close" onClick={() => setWhy(false)} className="min-h-[44px] min-w-[44px] text-white/60">✕</button>
            </div>
            <p className="mb-3 text-sm text-white/70">
              {map.present.agree} of {map.present.available} independent timing families agree.
            </p>
            <ul className="space-y-1 text-sm text-white/80">
              {map.present.votes.map((v) => (
                <li key={v.family}>
                  {v.label} {SIDE_WORD[v.vote]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function NowPage({ map }: { map: CareerMap }) {
  const next = map.ahead.find((w) => w.side === 'support' && w.from > `${map.month}-31`);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={panel} data-testid="security-card">
        <div className="text-xs uppercase tracking-wide text-white/50">Job security</div>
        <div className="mt-1 text-lg font-semibold">{SECURITY_WORDS[map.present.security]}</div>
      </div>
      <div className={panel}>
        <div className="text-xs uppercase tracking-wide text-white/50">Next opening</div>
        <div className="mt-1 text-lg font-semibold">{next ? `${SUBAREA_WORDS[next.subarea] ?? 'An opening'}, from ${longDate(next.from)}` : 'Nothing large in the next two years'}</div>
      </div>
    </div>
  );
}

function BackPage({ map, checks, onAnswered }: { map: CareerMap; checks: Record<string, string>; onAnswered: () => void }) {
  const answered = map.back.filter((b) => checks[b.month] && checks[b.month] !== 'skip');
  const yes = answered.filter((b) => checks[b.month] === 'yes').length;
  if (map.back.length === 0) return <div className={panel}>Nothing sharp enough in the last year to check with you.</div>;
  const answer = async (b: CareerMap['back'][number], a: 'yes' | 'partly' | 'no' | 'skip') => {
    track('question_answer', SURFACE, 'looking_back', { answer: a });
    await sendCheck(b.month, b.side, a);
    onAnswered();
  };
  return (
    <div>
      {answered.length > 0 && <p className="mb-3 text-white/70" data-testid="confirmed-line">You confirmed {yes} of {answered.length}.</p>}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {map.back.map((b) => (
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

function windowLine(w: SubareaWindow): string {
  return `${SUBAREA_WORDS[w.subarea] ?? w.subarea}: ${longDate(w.from)} – ${longDate(w.to)}`;
}

function AheadPage({ map }: { map: CareerMap }) {
  const [rung, setRung] = useState<number>(1);
  const h = map.horizons.find((x) => x.months === rung)!;
  return (
    <div>
      <div role="tablist" aria-label="How far ahead" className="mb-3 flex gap-2 overflow-x-auto">
        {map.horizons.map((x) => (
          <button key={x.months} role="tab" type="button" aria-selected={rung === x.months} onClick={() => { setRung(x.months); track('chip_select', SURFACE, `ahead_${x.months}`); }} className={`${chip} ${rung === x.months ? 'border-white/40 bg-white/15' : 'border-white/10 text-white/60'}`}>
            {x.months === 1 ? '1 month' : `${x.months} months`}
          </button>
        ))}
      </div>
      <div className={panel} data-testid={`rung-${rung}`}>
        {h.quiet ? (
          <div className="text-white/80">Nothing large is moving.</div>
        ) : (
          <div className="space-y-3">
            {h.best && (
              <div>
                <div className="text-xs uppercase tracking-wide text-white/50">Best stretch</div>
                <div className="font-medium">{windowLine(h.best)}</div>
              </div>
            )}
            {h.hardest && (
              <div>
                <div className="text-xs uppercase tracking-wide text-white/50">Harder stretch</div>
                <div className="font-medium">{windowLine(h.hardest)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WorriesPage({ map }: { map: CareerMap }) {
  const subs = [...new Set(map.ahead.map((w) => w.subarea))];
  const [sel, setSel] = useState<string | null>(subs[0] ?? null);
  if (!subs.length) return <div className={panel}>Nothing specific is opening or pressing in the next two years.</div>;
  const list = map.ahead.filter((w) => w.subarea === sel);
  return (
    <div>
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {subs.map((s) => (
          <button key={s} type="button" aria-pressed={sel === s} onClick={() => { setSel(s); track('worry_open', SURFACE, s); }} className={`${chip} ${sel === s ? 'border-white/40 bg-white/15' : 'border-white/10 text-white/60'}`}>
            {SUBAREA_WORDS[s] ?? s}
          </button>
        ))}
      </div>
      <ul className="grid gap-2">
        {list.map((w, i) => (
          <li key={i} className={panel}>
            <div className="font-medium">{longDate(w.from)} – {longDate(w.to)}</div>
            <div className="text-sm text-white/70">
              {w.side === 'test' ? SECURITY_WORDS[w.security ?? 'watch'] : w.band === 'high' ? 'A strong opening' : w.band === 'moderate' ? 'A good opening' : 'A small opening'}
              {` · ${w.families.length} of 5 families agree`}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
