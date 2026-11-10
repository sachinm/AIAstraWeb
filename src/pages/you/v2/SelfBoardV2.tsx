/**
 * The Self board v2 (server docs/reading-engine/66 §2, §4.6 and the mockup frames §1, §2, §4) at /dashboard/you.
 *
 * The app header and footer stay as Dashboard renders them; this board fills the space between them and never scrolls:
 * one fixed grid of three rows (the board row with the selfie, Self, the clock line and the carousel controls; the
 * hero; the carousel). Only a card's body scrolls, inside the card. Cards across: 3 at tablet landscape, 4 from 1440,
 * 2 in portrait, 1 on a phone. On a two-fold (Surface Duo) the left pane holds selfie, hero, question and the area list,
 * the right pane one card; Chart details opens over the right pane only.
 *
 * States: preparing (chart not ready) polls every 30 s, pending (board being written) every 10 s, both for at most six
 * minutes and then "Still working… Retry" (never a silent stop). A clock change rebuilds behind the veil the same way.
 * A fresh reading (server docs/billing/03) is asked for only by a tap and a consent sheet in the board row, never on load;
 * while it is made the cards are veiled and the page polls until the board's `builtAt` moves, or until a board read
 * after the ask says the build failed (`refresh.failed`): then polling stops and the row says the question was given
 * back, with Try again.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePlan } from '../../../Auth/ProfileGate';
import Carousel, { CarouselArrows, CarouselDots } from '../../../components/carousel/Carousel';
import Chips, { useSeenCounts, type ChipGroup } from '../../../components/carousel/Chips';
import LoadingVeil, { type VeilProgress } from '../../../components/LoadingVeil';
import UserAvatar from '../../../components/UserAvatar';
import { ShriGaneshAvatar } from '../../../components/ShriGaneshAvatar';
import { longDate } from '../../../lib/careerApi';
import { track } from '../../../lib/events';
import { announceUsage } from '../../../lib/planUsage';
import type { RefreshResult } from '../../../lib/boardRefresh';
import { fetchSelfV2, type SelfV2Area, type SelfV2BuildView, type SelfV2Response, type SelfV2State } from '../../../lib/selfV2Api';
import WelcomeWizard from '../../welcome/WelcomeWizard';
import AreaCard, { ChartDetails, cardShell } from './AreaCard';
import ClockSheet from './ClockSheet';
import { BuildStatus, FreshControl, FreshSheet } from './FreshReading';
import Hero, { type HeroLayout } from './Hero';
import Sheet from './Sheet';
import { BUILD_STAGE_WORDS, GROUP_LABEL, V2_WORDS } from './words';
import './selfBoardV2.css';

const SURFACE = 'self_v2';
/**
 * pending (the board being written) and a clock rebuild: every 10 s; preparing (the chart): every 30 s; a build the
 * server says is queued or running (`board.build`, server docs/loading-overlay/05): every 2 s, so the bar moves
 */
export const V2_POLL_MS = { pending: 10_000, preparing: 30_000, build: 2_000 } as const;
/** after this long waiting the board says so and offers Retry */
export const V2_MAX_WAIT_MS = 6 * 60_000;
const SEEN_KEY = 'aiastra.self.v2.seen';

// ---------------------------------------------------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------------------------------------------------

export type BoardMode = 'phone' | 'portrait' | 'landscape' | 'wide' | 'duo';

function mq(q: string): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
  } catch {
    return false;
  }
}

/**
 * The board's shape for this window. A two-fold reports two horizontal viewport segments; where the browser does not,
 * a touch screen at least 1200 wide and at most 740 tall is read as one spanned across its hinge.
 */
export function boardMode(w: number, h: number, segments = mq('(horizontal-viewport-segments: 2)'), coarse = mq('(pointer: coarse)')): BoardMode {
  if (segments || (w >= 1200 && h <= 740 && coarse)) return 'duo';
  if (w >= 1440) return 'wide';
  if (w >= 1100) return 'landscape';
  if (w >= 768) return 'portrait';
  return 'phone';
}

export const PER_VIEW: Record<BoardMode, number> = { phone: 1, portrait: 2, landscape: 3, wide: 4, duo: 1 };

export function useBoardMode(): BoardMode {
  const read = () => (typeof window === 'undefined' ? 'landscape' : boardMode(window.innerWidth, window.innerHeight));
  const [mode, setMode] = useState<BoardMode>(read);
  useEffect(() => {
    const on = () => setMode(read());
    window.addEventListener('resize', on);
    let seg: MediaQueryList | null = null;
    try {
      seg = typeof window.matchMedia === 'function' ? window.matchMedia('(horizontal-viewport-segments: 2)') : null;
      seg?.addEventListener?.('change', on);
    } catch {
      seg = null;
    }
    return () => {
      window.removeEventListener('resize', on);
      seg?.removeEventListener?.('change', on);
    };
  }, []);
  return mode;
}

/** The server says a build is queued or running now. */
export function buildActive(build: SelfV2BuildView | undefined): boolean {
  return build?.state === 'queued' || build?.state === 'running';
}

/** The server says the build failed or stalled: the page stops polling and the header offers Try again. */
export function buildStopped(build: SelfV2BuildView | undefined): boolean {
  return build?.state === 'failed' || build?.state === 'stuck';
}

/** The veil's bar from the server's build, while one is queued or running; undefined otherwise (no bar). */
export function veilProgress(build: SelfV2BuildView | undefined): VeilProgress | undefined {
  if (!build || !buildActive(build)) return undefined;
  const label = build.state === 'queued' || !build.stage ? BUILD_STAGE_WORDS.queued : BUILD_STAGE_WORDS[build.stage];
  return {
    percent: build.percent,
    nextPercent: build.nextPercent,
    stageExpectedMs: build.stageExpectedMs,
    stageAt: build.stageAt,
    label,
    step: build.state === 'running' ? build.step : 0,
    steps: build.steps,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------------------------------------------------
// The title: the person is the title
// ---------------------------------------------------------------------------------------------------------------------

export function SelfTitle({ onAddPhoto, small = false }: { onAddPhoto: () => void; small?: boolean }) {
  const size = small ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar
        className={size}
        fallback={
          <button type="button" onClick={onAddPhoto} className="group flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60" data-testid="self-add-photo" aria-label={V2_WORDS.addPhoto}>
            {/* the avatar alone is the way in (Sachin 2026-11-09: no "Add your photo" words in the header) */}
            <ShriGaneshAvatar className={size} />
          </button>
        }
      />
      <div className="min-w-0">
        <h1 className={`bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text font-extrabold leading-none tracking-tight text-transparent ${small ? 'text-2xl' : 'text-3xl'}`} data-testid="self-title">
          {V2_WORDS.title}
        </h1>
      </div>
    </div>
  );
}

export function PersonalizeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Personalize your readings" onClick={onClose} data-testid="self-personalize-modal">
      <div className="relative flex h-[min(640px,88vh)] w-[min(880px,94vw)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0d0c24] p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-lg font-semibold text-white">Personalize Your Readings</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>
        <WelcomeWizard onFinish={onClose} inModal />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------------------------------------------------

/** The texts on a card that count as "new since the last visit": its headline and patterns. */
function seenItems(areas: SelfV2Area[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const a of areas) if (a.status === 'ok' && a.card) out[a.id] = [a.card.headline, ...a.card.patterns.map((p) => p.text)];
  return out;
}

export default function SelfBoardV2() {
  const [state, setState] = useState<SelfV2State | null>(null);
  const [late, setLate] = useState(false);
  const [rebuild, setRebuild] = useState<{ system: string; label: string } | null>(null);
  /** a fresh reading asked for: the board's builtAt when it was asked, so the poll knows when the new one lands */
  const [fresh, setFresh] = useState<{ builtAt: string | null; from: SelfV2Response } | null>(null);
  /** the fresh build asked for failed (server `refresh.failed`); cleared when the person asks again */
  const [freshFailed, setFreshFailed] = useState(false);
  const waitStart = useRef<number | null>(null);

  const load = useCallback(
    () =>
      fetchSelfV2()
        .then((s) => {
          if (s.kind === 'ok' && s.board.usage) announceUsage(s.board.usage);
          setState(s);
        })
        .catch(() => setState({ kind: 'error' })),
    [],
  );

  useEffect(() => {
    track('board_open', SURFACE);
    void load();
  }, [load]);

  const board = state?.kind === 'ok' ? state.board : null;
  const rebuilding = !!rebuild && !(board && board.status === 'ok' && board.clock.system === rebuild.system);
  // only a board read after the ask can say the fresh build failed (the one on screen may carry an earlier failure)
  const freshFailedNow =
    !!fresh && !!board && board !== fresh.from && ((!!board.refresh?.failed && !board.refresh?.building) || board.build?.state === 'failed');
  const freshBuilding = !!fresh && !freshFailedNow && !(board && board.status === 'ok' && board.builtAt !== fresh.builtAt);
  // a build the server says failed or stalled stops the poll; the header says so and offers Try again
  const stopped = buildStopped(board?.build);
  const building = buildActive(board?.build);
  const waiting =
    state?.kind === 'preparing' || (!stopped && (board?.status === 'pending' || board?.status === 'preparing' || rebuilding || freshBuilding || building));

  // poll while something is being built, for at most six minutes; then say so and offer Retry
  useEffect(() => {
    if (rebuild && !rebuilding) setRebuild(null);
    if (fresh && !freshBuilding) {
      setFresh(null);
      if (freshFailedNow) setFreshFailed(true);
    }
    if (!waiting) {
      waitStart.current = null;
      if (late) setLate(false);
      return;
    }
    if (late) return;
    if (waitStart.current === null) waitStart.current = Date.now();
    const elapsed = Date.now() - waitStart.current;
    const left = V2_MAX_WAIT_MS - elapsed;
    if (left <= 0) {
      setLate(true);
      return;
    }
    const every = building ? V2_POLL_MS.build : state?.kind === 'preparing' || board?.status === 'preparing' ? V2_POLL_MS.preparing : V2_POLL_MS.pending;
    const t = setTimeout(() => {
      if (Date.now() - (waitStart.current ?? Date.now()) >= V2_MAX_WAIT_MS) setLate(true);
      else void load();
    }, Math.min(every, left));
    return () => clearTimeout(t);
  }, [state, waiting, late, rebuild, rebuilding, fresh, freshBuilding, freshFailedNow, board?.status, building, load]);

  const retry = () => {
    setLate(false);
    waitStart.current = Date.now();
    void load();
  };

  const lateLine = late && waiting && (
    <p role="status" className="text-sm text-white/70" data-testid="self-v2-late">
      {V2_WORDS.stillWorking}{' '}
      <button type="button" onClick={retry} className="min-h-[40px] font-semibold text-purple-300 underline underline-offset-4">
        {V2_WORDS.retry}
      </button>
    </p>
  );

  const frame = (body: ReactNode, testId: string) => (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden px-4 py-3 text-white sm:px-6" data-testid="self-v2-page">
      <div className="relative min-h-0 flex-1" data-testid={testId}>
        {body}
      </div>
    </div>
  );

  if (!state) return frame(<LoadingVeil testId="self-v2-loading" note={V2_WORDS.loading}><div className={`${cardShell} h-full`} /></LoadingVeil>, 'self-v2-wait');
  if (state.kind === 'preparing')
    return frame(
      <LoadingVeil testId="self-v2-preparing" note={V2_WORDS.preparing} foreground={lateLine || undefined}>
        <div className={`${cardShell} h-full`} />
      </LoadingVeil>,
      'self-v2-wait',
    );
  if (state.kind === 'no_kundli') return frame(<div className={`${cardShell} h-auto text-white/80`} data-testid="board-no-kundli">{V2_WORDS.noKundli}</div>, 'self-v2-empty');
  if (state.kind === 'unavailable') return frame(<div className={`${cardShell} h-auto text-white/80`} data-testid="board-unavailable">{V2_WORDS.unavailable}</div>, 'self-v2-empty');
  if (state.kind === 'error' || !board)
    return frame(
      <div role="alert" className={`${cardShell} h-auto text-white/80`} data-testid="board-error">
        <p>{V2_WORDS.error}</p>
        <button type="button" onClick={() => { setState(null); void load(); }} className="mt-3 inline-flex min-h-[44px] w-fit items-center rounded-full border border-white/20 bg-white/5 px-4 text-sm">
          {V2_WORDS.retry}
        </button>
      </div>,
      'self-v2-error',
    );
  if (board.status === 'no_kundli') return frame(<div className={`${cardShell} h-auto text-white/80`} data-testid="board-no-kundli">{V2_WORDS.noKundli}</div>, 'self-v2-empty');

  return (
    <Board
      board={board}
      rebuild={rebuilding ? rebuild : null}
      freshBuilding={freshBuilding}
      freshFailed={freshFailed}
      lateLine={lateLine || null}
      onRebuild={(system, label) => { setLate(false); waitStart.current = Date.now(); setRebuild({ system, label }); void load(); }}
      onFreshStarted={() => { setLate(false); setFreshFailed(false); waitStart.current = Date.now(); setFresh({ builtAt: board.builtAt, from: board }); }}
      onReload={() => void load()}
      onRetryBuild={retry}
    />
  );
}

function Board({
  board,
  rebuild,
  freshBuilding,
  freshFailed = false,
  lateLine,
  onRebuild,
  onFreshStarted,
  onReload,
  onRetryBuild,
}: {
  board: SelfV2Response;
  rebuild: { system: string; label: string } | null;
  freshBuilding: boolean;
  freshFailed?: boolean;
  lateLine: ReactNode;
  onRebuild: (system: string, label: string) => void;
  onFreshStarted: () => void;
  onReload: () => void;
  onRetryBuild: () => void;
}) {
  const mode = useBoardMode();
  const perView = PER_VIEW[mode];
  const { plan, setPlan, refreshPlan } = usePlan();
  const areas = board.areas;
  const [index, setIndex] = useState(0);
  const [details, setDetails] = useState<SelfV2Area | null>(null);
  const [why, setWhy] = useState(false);
  const [clockOpen, setClockOpen] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [freshOpen, setFreshOpen] = useState(false);
  const [freshAnswer, setFreshAnswer] = useState<'no_questions' | 'failed' | null>(null);
  /** a 409 not_due names the server's last good day; shown until the board is read again */
  const [notDue, setNotDue] = useState<{ validUntil: string | null } | null>(null);
  useEffect(() => setNotDue(null), [board]);
  // a failed fresh build gave its question back: read the plan again so the count on screen is right
  useEffect(() => {
    if (freshFailed) void refreshPlan();
  }, [freshFailed, refreshPlan]);
  const today = useMemo(todayIso, []);
  const items = useMemo(() => seenItems(areas), [areas]);
  const { counts, markSeen } = useSeenCounts(SEEN_KEY, items);
  const active = areas[Math.min(index, areas.length - 1)] ?? null;

  // a card that stays in focus for a moment counts as seen: its red count clears
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => markSeen(active.id), 1500);
    return () => clearTimeout(t);
  }, [active, markSeen]);

  const select = useCallback(
    (i: number) => {
      setIndex(i);
      const a = areas[i];
      if (a) track('chip_select', SURFACE, a.id);
    },
    [areas],
  );
  const selectId = (id: string) => select(Math.max(0, areas.findIndex((a) => a.id === id)));

  const groups: ChipGroup[] = (['now', 'you', 'time'] as const)
    .map((g) => ({ id: g, label: GROUP_LABEL[g], items: areas.filter((a) => a.group === g).map((a) => ({ id: a.id, label: a.title, count: counts[a.id] })) }))
    .filter((g) => g.items.length);

  const clockLine = (
    <p className="truncate text-[13px] text-white/65" data-testid="self-clock-line">
      <span>Read on your {board.clock.label} clock</span> ·{' '}
      <button type="button" onClick={() => setClockOpen(true)} className="font-semibold text-purple-300 underline underline-offset-4 hover:text-purple-200" data-testid="self-clock-change">
        Change
      </button>
      {board.builtAt && (
        <span data-testid="self-built-line">
          {' '}
          · built {longDate(board.builtAt.slice(0, 10))}
          {board.nextCheck ? `, next check ${longDate(board.nextCheck)}` : ''}
        </span>
      )}
    </p>
  );

  const refresh = board.refresh && notDue ? { ...board.refresh, due: false, validUntil: notDue.validUntil ?? board.refresh.validUntil } : board.refresh;
  const freshAnswered = (r: RefreshResult) => {
    setFreshOpen(false);
    if (r.kind === 'made' || r.kind === 'building') {
      setFreshAnswer(null);
      if (r.usage) {
        setPlan(r.usage);
        announceUsage(r.usage);
      } else void refreshPlan();
      if (r.kind === 'building') onFreshStarted();
      else onReload();
    } else if (r.kind === 'no_questions') {
      setFreshAnswer('no_questions');
      if (r.usage) setPlan(r.usage);
    } else if (r.kind === 'not_due') {
      setFreshAnswer(null);
      setNotDue({ validUntil: r.validUntil });
      onReload();
    } else setFreshAnswer('failed');
  };
  const freshControl = (
    <FreshControl
      refresh={refresh}
      plan={plan ?? board.usage}
      building={freshBuilding}
      noQuestions={freshAnswer === 'no_questions'}
      failed={freshAnswer === 'failed'}
      buildFailed={freshFailed}
      onAsk={() => setFreshOpen(true)}
      compact={mode === 'duo' || mode === 'phone'}
    />
  );

  // a paid fresh build that failed keeps its own Try again (the consent sheet) in the fresh control
  const buildStatus = freshFailed ? null : <BuildStatus build={board.build} onRetry={onRetryBuild} />;

  const heroLayout: HeroLayout = mode === 'duo' ? 'pane' : mode;
  const ranked = areas.find((a) => a.status === 'ok' && a.card?.ladder);
  const hero = (
    <Hero
      hero={board.hero}
      missing={board.profile?.missing ?? []}
      today={today}
      subChapterEnds={board.subChapterEnds !== undefined ? board.subChapterEnds : (board.hero?.nextCheck ?? board.nextCheck)}
      doThisMonth={ranked?.card?.ladder ? [ranked.card.ladder.best, ranked.card.ladder.practical] : []}
      layout={heroLayout}
      onWhy={() => {
        track('why_open', SURFACE, 'hero');
        setWhy(true);
      }}
    />
  );

  // the build's progress for every veil; a first build or a rebuild the server is running gets one veil over the deck
  // (not one quip veil per pending card)
  const progress = veilProgress(board.build);
  const buildVeil = !rebuild && !freshBuilding && !!progress && (board.status !== 'ok' || areas.some((a) => a.status === 'pending'));
  const veiled = !!rebuild || freshBuilding || buildVeil;

  const slideLabel = (i: number) => `${i + 1} of ${areas.length}: ${areas[i]?.title ?? ''}`;
  const carousel = (
    <Carousel
      count={areas.length}
      index={index}
      onIndexChange={select}
      perView={perView}
      label="Self areas"
      slideLabel={slideLabel}
      renderSlide={(i) => <AreaCard area={areas[i]!} nextCheck={board.nextCheck} onDetails={setDetails} focused={perView > 1 && i === index} veil={!(veiled && progress)} />}
      testId="self-carousel"
    />
  );
  const deck = rebuild ? (
    <div className="relative h-full min-h-0" data-testid="self-rebuilding">
      <LoadingVeil testId="self-rebuild-veil" note={V2_WORDS.rebuilding(rebuild.label)} foreground={lateLine || undefined} progress={progress}>
        {carousel}
      </LoadingVeil>
    </div>
  ) : freshBuilding ? (
    <div className="relative h-full min-h-0" data-testid="self-fresh-building">
      <LoadingVeil testId="self-fresh-veil" note={V2_WORDS.fresh.veil} foreground={lateLine || undefined} progress={progress}>
        {carousel}
      </LoadingVeil>
    </div>
  ) : buildVeil ? (
    <div className="relative h-full min-h-0" data-testid="self-building">
      <LoadingVeil testId="self-build-veil" note={V2_WORDS.writing} foreground={lateLine || undefined} progress={progress}>
        {carousel}
      </LoadingVeil>
    </div>
  ) : (
    carousel
  );

  const sheets = (
    <>
      {clockOpen && (
        <ClockSheet
          clock={board.clock}
          plan={plan ?? board.usage}
          onClose={() => setClockOpen(false)}
          onChanged={(system, label, r) => {
            track('chip_select', SURFACE, `clock_${system}`);
            if (r.usage) {
              setPlan(r.usage);
              announceUsage(r.usage);
            } else void refreshPlan();
            setClockOpen(false);
            onRebuild(system, label);
          }}
        />
      )}
      {why && (
        <Sheet title={V2_WORDS.whyTitle} onClose={() => setWhy(false)} testId="why-sheet">
          <WhyBody areas={areas} supporting={board.hero?.supporting} />
        </Sheet>
      )}
      {wizard && <PersonalizeModal onClose={() => setWizard(false)} />}
      {freshOpen && <FreshSheet plan={plan ?? board.usage} onClose={() => setFreshOpen(false)} onDone={freshAnswered} />}
    </>
  );

  const detailsSheet = (inPane: boolean) =>
    details && (
      <Sheet title={`${details.title} · ${V2_WORDS.chartDetails}`} onClose={() => setDetails(null)} testId="details-sheet" inPane={inPane}>
        <ChartDetails area={details} showEvidence={board.profile?.role === 'practitioner'} />
      </Sheet>
    );

  if (mode === 'duo') {
    return (
      <DuoFrame
        left={
          <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden" data-testid="self-duo-left">
            <div className="flex min-w-0 items-center gap-3">
              <SelfTitle onAddPhoto={() => setWizard(true)} small />
              <div className="min-w-0 flex-1">
                {clockLine}
                {!veiled && lateLine}
              </div>
              {freshControl}
              {buildStatus}
            </div>
            {hero}
            <nav aria-label="Self areas" className="min-h-0 overflow-y-auto [scrollbar-width:thin]" data-testid="self-area-list">
              {groups.map((g) => (
                <div key={g.id} className="mb-1.5">
                  <p className="px-0.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/45">{g.label}</p>
                  <div className="grid gap-1.5">
                    {g.items.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        aria-current={active?.id === it.id ? 'true' : undefined}
                        onClick={() => selectId(it.id)}
                        className={`flex min-h-[44px] items-center justify-between rounded-xl border px-3 text-[15px] font-semibold ${active?.id === it.id ? 'border-transparent bg-teal-500/15 text-teal-200' : 'border-white/10 bg-white/5 text-white/75'}`}
                      >
                        {it.label}
                        {it.count ? <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">{it.count}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        }
        right={
          <div className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden" data-testid="self-duo-right">
            <div className="flex items-center justify-between">
              <CarouselDots index={index} count={areas.length} onIndexChange={select} label={slideLabel} testId="self-carousel" />
              <CarouselArrows index={index} count={areas.length} onIndexChange={select} testId="self-carousel" />
            </div>
            {deck}
            {detailsSheet(true)}
          </div>
        }
      >
        {sheets}
      </DuoFrame>
    );
  }

  return (
    <div
      className="grid h-full min-h-0 w-full flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden px-4 py-3 text-white sm:px-6"
      data-testid="self-v2-page"
      data-board-grid="true"
      data-mode={mode}
    >
      <div className="flex min-w-0 items-center justify-between gap-4" data-testid="self-board-row">
        <div className="flex min-w-0 items-center gap-4">
          <SelfTitle onAddPhoto={() => setWizard(true)} />
          <div className="min-w-0">
            {clockLine}
            {!veiled && lateLine}
          </div>
          {freshControl}
          {buildStatus}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {mode !== 'phone' && <CarouselDots index={index} count={areas.length} onIndexChange={select} label={slideLabel} testId="self-carousel" />}
          <CarouselArrows index={index} count={areas.length} onIndexChange={select} testId="self-carousel" />
        </div>
      </div>
      {hero}
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5" data-testid="self-deck">
        <Chips groups={groups} activeId={active?.id ?? null} onSelect={selectId} compact={mode === 'portrait' || mode === 'phone'} label="Self areas" testId="self-chips" />
        {deck}
      </div>
      {detailsSheet(false)}
      {sheets}
    </div>
  );
}

/** The two panes either side of the hinge; their widths follow the device's viewport segments when it reports them. */
function DuoFrame({ left, right, children }: { left: ReactNode; right: ReactNode; children?: ReactNode }) {
  const root = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const el = root.current;
    if (el && typeof el.getBoundingClientRect === 'function') setOffset(Math.round(el.getBoundingClientRect().left));
  }, []);
  return (
    <div ref={root} className="self-v2-duo h-full min-h-0 w-full flex-1 overflow-hidden text-white" style={{ '--board-left': `${offset}px` } as CSSProperties} data-testid="self-v2-page" data-board-grid="true" data-mode="duo">
      <div className="min-h-0 overflow-hidden px-4 py-3">{left}</div>
      <div aria-hidden="true" />
      <div className="min-h-0 overflow-hidden px-4 py-3">{right}</div>
      {children}
    </div>
  );
}

/**
 * The hero's reasons in plain words: the headlines of the areas the server says ground the hero (`hero.supporting`);
 * for a board without that field, the ready cards of the Now group.
 */
function WhyBody({ areas, supporting }: { areas: SelfV2Area[]; supporting?: SelfV2Area['id'][] }) {
  const ready = (a: SelfV2Area) => a.status === 'ok' && a.card;
  const now = supporting ? supporting.map((id) => areas.find((a) => a.id === id)).filter((a): a is SelfV2Area => Boolean(a && ready(a))) : areas.filter((a) => a.group === 'now' && ready(a));
  if (!now.length) return <p className="text-sm text-white/70">{V2_WORDS.whyEmpty}</p>;
  return (
    <ul className="space-y-2" data-testid="why-list">
      {now.map((a) => (
        <li key={a.id} className="rounded-xl bg-white/5 px-3 py-2.5 text-sm">
          <b className="block font-semibold text-white">{a.title}</b>
          <span className="text-white/75">{a.card!.headline}</span>
        </li>
      ))}
    </ul>
  );
}
