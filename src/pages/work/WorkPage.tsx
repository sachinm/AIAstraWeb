/**
 * The Work board, Phase 1 (server docs/reading-engine/42–45). It leads with where the person is now (a tone, never a
 * weather or hospital word), asks the one question that changes what it shows (do you have a job right now?), and
 * splits the rest into four pages instead of a long scroll: Now, Looking back, Ahead, Your questions. Plain words only;
 * the timing clocks behind the verdict are listed in Why and in the Master-Detail inspector.
 */
import { useEffect, useState } from 'react';
import {
  fetchCareer,
  getCachedCareer,
  longDate,
  monthName,
  sendCheck,
  setWorkStatus,
  type CareerMap,
  type CareerState,
  type SubareaWindow,
  type Tone,
  type WorkStatus,
} from '../../lib/careerApi';
import { track } from '../../lib/events';
import BoardAsk from '../../components/BoardAsk';
import LoadingVeil from '../../components/LoadingVeil';

const panel = 'glass glass-lift rounded-2xl p-4 sm:p-5';
const chip = 'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 text-sm';
const techBadgeClass =
  'inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/15 px-2.5 py-0.5 font-mono text-[11px] font-medium text-purple-200';
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
const SIDE_WORD_PLURAL = { support: 'point to a good stretch', test: 'point to a harder stretch', neutral: 'are quiet' };

const WORK_CLOCK_LABELS: Record<string, string> = {
  main: 'Main Period Clock (Vimshottari)',
  conditional: 'Conditional Period Clock',
  rasi: 'Jaimini Sign Clock (Narayana)',
  karaka: 'Jaimini Karaka Clock (Chara)',
  short: 'Short Rhythm Clocks (Yogini & Lunar)',
  transit: 'Slow Sky Movement (Shani & Guru)',
  annual: 'Annual Solar Return Chart (Varshaphal)',
  jaimini: 'Jaimini Arudha & Karaka Indicators',
};

function formatVoteLine(v: CareerMap['present']['votes'][number]): string {
  if (v.family === 'jaimini' || v.label === 'Jaimini points') {
    return `Jaimini indicators ${SIDE_WORD_PLURAL[v.vote]}`;
  }
  if (v.family === 'short' || v.family === 'transit') {
    return `${v.label} ${SIDE_WORD_PLURAL[v.vote]}`;
  }
  return `${v.label} ${SIDE_WORD[v.vote]}`;
}

const WORK_OPTIONS: Array<{ key: WorkStatus; label: string }> = [
  { key: 'yes', label: 'Yes' },
  { key: 'between_jobs', label: 'Between jobs' },
  { key: 'own_business', label: 'Own business' },
  { key: 'studying', label: 'Studying' },
];

export default function WorkPage() {
  const [state, setState] = useState<CareerState | null>(() => getCachedCareer());
  const [page, setPage] = useState<Page>('now');
  const [why, setWhy] = useState(false);

  const load = () =>
    fetchCareer()
      .then(setState)
      .catch(() => setState((prev) => prev ?? { kind: 'unavailable' }));
  useEffect(() => {
    const cached = getCachedCareer();
    if (cached) setState(cached);
    track('board_open', SURFACE);
    void load();
  }, []);

  if (!state)
    return (
      <LoadingVeil fullScreen testId="work-loading" />
    );
  if (state.kind === 'not_ready') return <div className={`${panel} m-4 text-white/80`}>Your chart is being prepared. Check back in a minute.</div>;
  if (state.kind === 'unavailable') return <div className={`${panel} m-4 text-white/80`}>The Work board is coming soon.</div>;
  const { map, work, checks } = state;

  const answerWork = async (v: WorkStatus) => {
    track('question_answer', SURFACE, 'work.status', { value: v });
    await setWorkStatus(v);
    void load();
  };

  return (
    <div className="w-full px-4 pb-24 pt-4 text-white sm:px-6 lg:px-10" data-testid="work-page">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-3xl font-bold text-transparent">Work</h1>
        <BoardAsk category="work" />
      </div>

      {work === null && (
        <div className={`${panel} mb-4`} data-testid="work-question">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">Do you have a job right now?</div>
            <span className={techBadgeClass} data-testid="question-technique-badge">
              work.status · Companion Fact
            </span>
          </div>
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
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
            <span aria-hidden>{TONE_ICON[map.present.tone]}</span>
            {TONE_WORD[map.present.tone]}
          </div>
          <span className={techBadgeClass} data-testid="panel-technique-badge">
            work.present_tone · Present Tone
          </span>
        </div>
        <h2 className="text-2xl font-semibold leading-snug">{headline(map)}</h2>
        {CONFIDENCE_LINE[map.present.confidence] && <p className="mt-2 text-sm text-white/60">{CONFIDENCE_LINE[map.present.confidence]}</p>}
        <button type="button" onClick={() => { setWhy(true); track('why_open', SURFACE, 'tone'); }} className="mt-3 min-h-[44px] text-sm text-purple-300 underline underline-offset-4">
          Why we think so
        </button>
      </section>

      <div role="tablist" aria-label="Work pages" className="mb-4 flex gap-1 overflow-x-auto glass rounded-xl p-1">
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
                <li key={v.family}>{formatVoteLine(v)}</li>
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
  const yearNum = Number(map.asOf.slice(0, 4)) || 2026;
  const arc = map.characterArc;
  const voc = map.vocationBlueprint;
  const defaultVocationChoices = [
    {
      title: '1. Systems Architecture, Engineering & Technical Product',
      whyItFits: 'Designing scalable platforms, technical infrastructure, or analytical tools with measurable output (Dasamsa D10 & Budha-Shani).',
    },
    {
      title: '2. Executive Operations, Strategy & Program Stewardship',
      whyItFits: 'Guiding complex organizations, P&L execution, or cross-functional turnarounds requiring a steady hand and long-horizon planning (10th Bhava & Surya).',
    },
    {
      title: '3. Independent Advisory, Consulting & Specialist Practice',
      whyItFits: 'High-trust advisory, research, finance, or specialized domain consulting where clients rely on your diagnostic rigor (Amatyakaraka AmK & Guru).',
    },
    {
      title: '4. Founder-Led Ventures & Asset-Building Enterprises',
      whyItFits: 'Building an independent business, IP portfolio, or specialized firm with lean, high-competence collaborators (Rajya Pada A10 & 11th Bhava).',
    },
  ];
  const vocationChoices = voc?.whatFeelsGood?.length === 4 ? voc.whatFeelsGood : defaultVocationChoices;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={panel} data-testid="security-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-white/50">Job security</div>
            <span className={techBadgeClass} data-testid="panel-technique-badge">
              work.security · Stability Check
            </span>
          </div>
          <div className="mt-1 text-lg font-semibold">{SECURITY_WORDS[map.present.security]}</div>
        </div>
        <div className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-white/50">Next opening</div>
            <span className={techBadgeClass} data-testid="panel-technique-badge">
              work.subareas · Next Opening
            </span>
          </div>
          <div className="mt-1 text-lg font-semibold">{next ? `${SUBAREA_WORDS[next.subarea] ?? 'An opening'}, from ${longDate(next.from)}` : 'Nothing large in the next two years'}</div>
        </div>
      </div>

      <section className={panel} data-testid="work-character-arc">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-purple-300">
            Work & Ambition Evolution (Past 10 Years → Your Standing Today → Next 10 Years)
          </div>
          <span className={techBadgeClass} data-testid="panel-technique-badge">
            work.character_arc · 3-Decade Ambition Evolution
          </span>
        </div>
        <h3 className="mt-1 text-lg font-semibold text-white">
          {arc?.headline ?? 'How your work identity, accountability, and professional authority evolve across three chapters'}
        </h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5" data-testid="work-stage-past_10y">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">{arc?.pastDecade.label ?? 'Past 10 Years'}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/75">{arc?.pastDecade.windowLabel ?? `${yearNum - 10}–${yearNum}`}</span>
            </div>
            <div className="mt-1.5 font-medium text-white">{arc?.pastDecade.headline ?? 'Building Foundational Craft & Discipline'}</div>
            <p className="mt-1 text-sm leading-relaxed text-white/75">
              {arc?.pastDecade.summary ??
                'Through the past decade you forged hands-on capability, reliable execution, and practical resilience through real accountability.'}
            </p>
            <div className="mt-2 text-xs text-purple-200/90">Core quality: {arc?.pastDecade.anchorTrait ?? 'Self-reliant stamina'}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5" data-testid="work-stage-now">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">{arc?.presentNow.label ?? 'Your Standing Today'}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/75">{arc?.presentNow.windowLabel ?? String(yearNum)}</span>
            </div>
            <div className="mt-1.5 font-medium text-white">{arc?.presentNow.headline ?? 'Earned Authority & Strategic Focus'}</div>
            <p className="mt-1 text-sm leading-relaxed text-white/75">
              {arc?.presentNow.summary ?? 'Today you bring calm command, structured judgment, and trusted follow-through to high-stakes work.'}
            </p>
            <div className="mt-2 text-xs text-purple-200/90">Core quality: {arc?.presentNow.anchorTrait ?? 'Principled execution'}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5" data-testid="work-stage-next_10y">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">{arc?.nextDecade.label ?? 'Next 10 Years'}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/75">{arc?.nextDecade.windowLabel ?? `${yearNum}–${yearNum + 10}`}</span>
            </div>
            <div className="mt-1.5 font-medium text-white">{arc?.nextDecade.headline ?? 'Stepping Into Advisory Scope & Lasting Impact'}</div>
            <p className="mt-1 text-sm leading-relaxed text-white/75">
              {arc?.nextDecade.summary ??
                'Across the coming decade your role shifts from carrying every task yourself to setting direction, mentoring talent, and compounding long-term equity.'}
            </p>
            <div className="mt-2 text-xs text-purple-200/90">Core quality: {arc?.nextDecade.anchorTrait ?? 'Strategic stewardship'}</div>
          </div>
        </div>
      </section>

      <section className={panel} data-testid="work-personality-vocation">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-pink-300">
            Your Work Style & Choice of Vocation (10th Bhava · Dasamsa D10 · Amatyakaraka AmK · Rajya Pada A10)
          </div>
          <span className={techBadgeClass} data-testid="panel-technique-badge">
            work.personality_vocation · Vocation Blueprint
          </span>
        </div>
        <h3 className="mt-1 text-lg font-semibold text-white">
          {voc?.headline ?? 'Methodical systems thinking paired with calm, accountable authority'}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/80">
          {voc?.personalitySummary ??
            'In work you thrive when given clear ownership of results, autonomy to design the system, and direct accountability for quality.'}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-purple-200">Execution & Management Style (10th Bhava & Surya-Shani)</div>
            <p className="mt-1 text-sm text-white/75">
              {voc?.emotionalMindStyle ??
                'You lead by example and clear standards—setting realistic milestones, protecting team focus, and delivering without fanfare.'}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-pink-200">Problem-Solving & Decision Style (Dasamsa D10 & Budha)</div>
            <p className="mt-1 text-sm text-white/75">
              {voc?.intellectualWitStyle ??
                'You diagnose root causes quickly, break complex initiatives into sequential steps, and stay composed when priorities shift.'}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Best-Fit Choices of Work & Vocation Domains</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {vocationChoices.map((ch, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-3" data-testid={`vocation-choice-${idx}`}>
                <div className="font-medium text-white">{ch.title}</div>
                <div className="mt-0.5 text-xs text-white/70">{ch.whyItFits}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
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
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-white/50">{monthName(b.month)}</div>
              <span className={techBadgeClass} data-testid="panel-technique-badge">
                work.back · Past Window Check
              </span>
            </div>
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
        <div className="mb-2 flex items-center justify-end">
          <span className={techBadgeClass} data-testid="panel-technique-badge">
            work.horizons · Horizon Window
          </span>
        </div>
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
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  if (!subs.length) return <div className={panel}>Nothing specific is opening or pressing in the next two years.</div>;
  const list = map.ahead.filter((w) => w.subarea === sel);
  const activeWin = list[selectedIdx] ?? list[0]!;
  const activeClocks = (activeWin?.families ?? []).map((f) => WORK_CLOCK_LABELS[f] ?? f);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto">
          {subs.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sel === s}
              onClick={() => {
                setSel(s);
                setSelectedIdx(0);
                track('worry_open', SURFACE, s);
              }}
              className={`${chip} ${sel === s ? 'border-white/40 bg-white/15' : 'border-white/10 text-white/60'}`}
            >
              {SUBAREA_WORDS[s] ?? s}
            </button>
          ))}
        </div>
        <span className={techBadgeClass} data-testid="panel-technique-badge">
          work.subareas · Multi-Clock Topic Windows
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ul className="grid gap-2 lg:col-span-5" data-testid="findings-list-view">
          {list.map((w, i) => {
            const isSelected = i === selectedIdx;
            const clockList = w.families.map((f) => WORK_CLOCK_LABELS[f] ?? f).join(' · ');
            const openingText =
              w.side === 'test'
                ? SECURITY_WORDS[w.security ?? 'watch']
                : w.band === 'high'
                  ? 'A strong opening'
                  : w.band === 'moderate'
                    ? 'A good opening'
                    : 'A small opening';
            return (
              <li
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={`${panel} cursor-pointer transition ${
                  isSelected ? 'border-purple-400/60 bg-purple-500/15' : 'hover:border-white/25'
                }`}
                data-testid={`finding-item-${i}`}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-1.5">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-purple-200">
                    {SUBAREA_WORDS[w.subarea] ?? w.subarea}
                  </span>
                  <span className={techBadgeClass} data-testid="panel-technique-badge">
                    work.subareas · {w.subarea}
                  </span>
                </div>
                <div className="font-medium">{longDate(w.from)} – {longDate(w.to)}</div>
                <div className="text-sm text-white/70">
                  {openingText}
                  {` · ${w.families.length} of 5 families agree`}
                </div>
                {clockList && (
                  <div className="mt-1 text-xs text-purple-200/90">
                    Vedic Timing Clocks Aligned: {clockList}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {activeWin && (
          <div className={`${panel} lg:col-span-7`} data-testid="finding-detail-panel">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-purple-300">
                  {SUBAREA_WORDS[activeWin.subarea] ?? activeWin.subarea}
                </span>
                <h3 className="mt-0.5 text-xl font-semibold text-white">
                  {longDate(activeWin.from)} – {longDate(activeWin.to)}
                </h3>
              </div>
              <span className={techBadgeClass} data-testid="panel-technique-badge">
                work.subareas · work.d10_check
              </span>
            </div>

            <div className="mb-3 inline-flex items-center gap-2 rounded-xl border border-purple-400/25 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-100" data-testid="finding-detail-dates">
              <span>Time Window:</span>
              <span>{longDate(activeWin.from)} – {longDate(activeWin.to)} (Peak: {monthName(activeWin.peakMonth)})</span>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-white/85">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Astrology Oracle Reading</div>
                <p className="mt-1" data-testid="finding-detail-reading">
                  {activeWin.side === 'support'
                    ? `A ${activeWin.band === 'high' ? 'high-conviction' : 'constructive'} window for ${(SUBAREA_WORDS[activeWin.subarea] ?? activeWin.subarea).toLowerCase()} (${longDate(activeWin.from)} – ${longDate(activeWin.to)}), peaking around ${monthName(activeWin.peakMonth)}. ${activeWin.families.length} of 5 independent Vedic timing clocks align (${activeClocks.join(', ')}), making this a clear period to initiate proposals, negotiate terms, or step into broader scope.`
                    : `A testing window for ${(SUBAREA_WORDS[activeWin.subarea] ?? activeWin.subarea).toLowerCase()} (${longDate(activeWin.from)} – ${longDate(activeWin.to)}). ${activeWin.families.length} of 5 Vedic timing clocks flag pressure (${activeClocks.join(', ')}), advising you to document deliverables clearly, protect your bandwidth, and avoid unforced leaps until ${longDate(activeWin.to)}.`}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-purple-200">Natal Promise (10th Bhava & Dasamsa D10)</div>
                  <p className="mt-1 text-xs leading-relaxed text-white/75" data-testid="finding-detail-promise">
                    Grounded in your 10th Bhava, Dasamsa (D10), and Amatyakaraka (AmK) alignment—supporting durable authority when timing clocks converge.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-pink-200">Time-Period Charter</div>
                  <p className="mt-1 text-xs leading-relaxed text-white/75" data-testid="finding-detail-charter">
                    {activeWin.families.length} of 5 Vedic timing clocks align across {longDate(activeWin.from)} – {longDate(activeWin.to)} ({activeClocks.join(' + ')}).
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-purple-200">
                  Vedic Timing Clocks & Significators Activated
                </div>
                <ul className="mt-1.5 space-y-1 text-xs text-white/80" data-testid="finding-detail-aspects">
                  {activeClocks.map((c, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-purple-300">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2">
                    <span className="text-purple-300">•</span>
                    <span>Dasamsa (D10) & 10th Bhava Convergence Score: {activeWin.score} ({activeWin.band.toUpperCase()} band)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
