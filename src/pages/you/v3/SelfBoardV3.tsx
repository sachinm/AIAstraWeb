/**
 * The Self board v3 (server docs/reading-engine/68 §4.1, §4.2, §4.7) at /dashboard/you: your cards, your next twelve
 * months.
 *
 * One title row (photo, Self, the clock line, the fresh-reading control, Edit and the template switch), the chips row
 * (the person's cards, `+`, arrows and "3 of 8"), then the carousel. No hero, no strip. The page never scrolls
 * vertically on tablet or desktop: one grid of three rows, the carousel in the last. Seasons (the default) shows two
 * cards across at tablet landscape with the next one peeking; one card on a phone with chips and dots. Compact shows
 * today's v2 card look four across.
 *
 * On a first visit (`layout.chosen` false) the picker fills the deck. The `+` chip opens it again. Every layout change
 * (picker, edit mode, the template, a card's sections) goes out through PUT /api/self/v3/layout.
 *
 * When the server has v3 off (GET /api/self/v3 answers 404 without a v3 body) the page renders the v2 board unchanged.
 * Loading, polling, the clock switch, the fresh reading and the build progress are the v2 board's, reused.
 *
 * Doc 70 Phase 3 (a reading per card, when `reading.enabled`): each card shows its own state (a quiet skeleton while
 * queued or reading, Try again when it failed, "Not read yet" otherwise), the header carries the board's reading line,
 * and the page polls every 2 s while any card on the board is queued or reading.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePlan } from '../../../Auth/ProfileGate';
import Carousel, { CarouselDots } from '../../../components/carousel/Carousel';
import LoadingVeil from '../../../components/LoadingVeil';
import { longDate } from '../../../lib/careerApi';
import { track } from '../../../lib/events';
import { announceUsage } from '../../../lib/planUsage';
import type { RefreshResult } from '../../../lib/boardRefresh';
import type { SelfV2Area } from '../../../lib/selfV2Api';
import {
  DEFAULT_TEMPLATE,
  MIN_READING_CARDS,
  SELF_TEMPLATES_LIVE,
  SUGGESTED_COUNT,
  cardReadPending,
  fetchSelfV3State,
  readSelfV3Card,
  type BoardReadingView,
  type SelfBoardLayout,
  type SelfBoardLayoutView,
  type SelfCardId,
  type SelfTemplateId,
  type SelfV3CardView,
  type SelfV3Response,
  type SelfV3State,
} from '../../../lib/selfV3Api';
import { ChartDetails, cardShell } from '../v2/AreaCard';
import { useLoadCardPhotos } from '../../../components/boardCards/cardPhotos';
import { getUserId } from '../../../lib/graphql';
import { getActiveCard, getSelfV3Cached, readSelfV3Persisted, setActiveCard, setSelfV3Cached, writeSelfV3Persisted } from '../../../lib/selfV3Cache';
import ClockSheet from '../v2/ClockSheet';
import { BuildStatus, FreshControl, FreshSheet } from '../v2/FreshReading';
import SelfBoardV2, { PersonalizeModal, SelfTitle, V2_MAX_WAIT_MS, V2_POLL_MS, buildActive, buildStopped, useBoardMode, veilProgress, type BoardMode } from '../v2/SelfBoardV2';
import Sheet from '../v2/Sheet';
import { V2_WORDS } from '../v2/words';
import CardChips from './CardChips';
import type { CardReading } from './CardParts';
import type { CardAllowed, CardProps } from './CardFrame';
import type { PeriodView } from './cardModel';
import CompactCard from './CompactCard';
import { optionsFor, type CardOptions } from '../../../lib/cardOptions';
import BoardSettings from './BoardSettings';
import { boardNow, cardNow, hasOwnOptions } from './boardOptions';
import { NOT_SUGGESTED, cardAccess, cardTitle, featureOn, featureState } from './features';
import { useLayoutSaves } from './useLayoutSaves';
import type { SaveProblem } from './layoutSaver';
import Picker from './Picker';
import SeasonsCard from './SeasonsCard';
import { LAYOUT_ERROR_WORD, TEMPLATE_WORD, V3_WORDS } from './words';
import './selfBoardV3.css';

const SURFACE = 'self_v3';

/** Cards across per template: Seasons two at tablet landscape and up, Compact four; one on a phone. */
export function perViewFor(template: SelfTemplateId, mode: BoardMode): number {
  if (mode === 'phone') return 1;
  if (template === 'compact') return mode === 'portrait' ? 2 : 4;
  return mode === 'portrait' ? 1 : 2;
}

/** the next card left showing past the last full card */
export const PEEK_PX = 40;
/** the gutter between Seasons cards */
export const SEASONS_GAP = 24;
/** doc 70 §4.3 item 3: poll every 2 s while any card on the board is queued or reading */
export const READING_POLL_MS = 2000;

/** true while the per-card reading is on and a card on the person's board is queued or reading */
export function readingPending(board: SelfV3Response | null): boolean {
  if (!board?.reading?.enabled) return false;
  const byId = new Map(board.cards.map((c) => [c.id, c]));
  return board.layout.cards.some((id) => cardReadPending(byId.get(id)?.state));
}

/** The board's reading line (doc 70 §4.4); null for idle and done. */
export function readingLine(reading: BoardReadingView | null | undefined): string | null {
  if (!reading?.enabled) return null;
  if (reading.preparing) return V3_WORDS.chartPreparing;
  if (reading.stage === 'clocks') return V3_WORDS.stageClocks;
  if (reading.stage === 'ledger') return V3_WORDS.stageLedger;
  if (reading.stage === 'cards') return V3_WORDS.stageCards(reading.done, reading.total);
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The page: loads, polls and falls back to the v2 board
// ---------------------------------------------------------------------------------------------------------------------

export default function SelfBoardV3() {
  // the picker's and the cards' photos load once for the board
  useLoadCardPhotos('self');
  // paints at once from the cache (memory, then the encrypted copy on disk) and revalidates behind it
  const [state, setState] = useState<SelfV3State | null>(() => {
    const held = getSelfV3Cached();
    return held ? { kind: 'ok', board: held.data } : null;
  });
  const [late, setLate] = useState(false);
  const [rebuild, setRebuild] = useState<{ system: string; label: string } | null>(null);
  const [fresh, setFresh] = useState<{ builtAt: string | null; from: SelfV3Response } | null>(null);
  const [freshFailed, setFreshFailed] = useState(false);
  const waitStart = useRef<number | null>(null);

  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  const load = useCallback(
    () =>
      fetchSelfV3State()
        .then(({ state: next, notModified }) => {
          if (!alive.current) return;
          // a board that is on screen stays when the server is briefly unable: no flash of an empty or loading state
          setState((prev) => {
            if (prev?.kind === 'ok' && (next.kind === 'error' || next.kind === 'preparing')) return prev;
            if (prev?.kind === 'ok' && next.kind === 'ok' && prev.board === next.board) return prev;
            return next;
          });
          const held = getSelfV3Cached();
          if (!notModified && next.kind === 'ok' && held && held.data === next.board) void writeSelfV3Persisted({ userId: getUserId() ?? '', kundliId: null }, held.data, held.etag);
        })
        .catch(() => alive.current && setState((prev) => (prev?.kind === 'ok' ? prev : { kind: 'error' }))),
    [],
  );

  useEffect(() => {
    let off = false;
    const start = () => void load();
    // no board in memory: the encrypted copy on disk, if there is one, draws first; its tag goes into the request
    if (getSelfV3Cached()) {
      start();
      return;
    }
    void readSelfV3Persisted({ userId: getUserId() ?? '', kundliId: null })
      .then((entry) => {
        if (off || !entry) return;
        setSelfV3Cached(entry.data, entry.etag);
        setState((prev) => prev ?? { kind: 'ok', board: entry.data });
      })
      .catch(() => undefined)
      .finally(() => !off && start());
    return () => {
      off = true;
    };
  }, [load]);
  // counted once, on the first v3 board (a v2 fallback counts its own open)
  const opened = useRef(false);
  useEffect(() => {
    if (state?.kind === 'ok' && !opened.current) {
      opened.current = true;
      track('board_open', SURFACE);
    }
  }, [state]);

  const board = state?.kind === 'ok' ? state.board : null;
  const rebuilding = !!rebuild && !(board && board.status === 'ok' && board.clock.system === rebuild.system);
  const freshFailedNow = !!fresh && !!board && board !== fresh.from && ((!!board.refresh?.failed && !board.refresh?.building) || board.build?.state === 'failed');
  const freshBuilding = !!fresh && !freshFailedNow && !(board && board.status === 'ok' && board.builtAt !== fresh.builtAt);
  const stopped = buildStopped(board?.build);
  const building = buildActive(board?.build);
  const waiting = state?.kind === 'preparing' || (!stopped && (board?.status === 'pending' || board?.status === 'preparing' || rebuilding || freshBuilding || building));

  // poll while something is being built, for at most six minutes; then say so and offer Retry (as the v2 board does)
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
    const left = V2_MAX_WAIT_MS - (Date.now() - waitStart.current);
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

  // doc 70: poll every 2 s while a card on the board is queued or reading; stops when none is (and on unmount)
  const cardsPending = readingPending(board);
  const v2Polling = waiting && !late;
  useEffect(() => {
    if (!cardsPending || v2Polling) return;
    const t = setTimeout(() => void load(), READING_POLL_MS);
    return () => clearTimeout(t);
  }, [state, cardsPending, v2Polling, load]);

  const retry = () => {
    setLate(false);
    waitStart.current = Date.now();
    void load();
  };

  const lateLine = late && waiting && (
    <p role="status" className="text-sm text-white/70" data-testid="self-v3-late">
      {V2_WORDS.stillWorking}{' '}
      <button type="button" onClick={retry} className="min-h-[40px] font-semibold text-purple-300 underline underline-offset-4">
        {V2_WORDS.retry}
      </button>
    </p>
  );

  const frame = (body: ReactNode, testId: string) => (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden px-4 py-3 text-white sm:px-6" data-testid="self-v3-page">
      <div className="relative min-h-0 flex-1" data-testid={testId}>
        {body}
      </div>
    </div>
  );

  if (state?.kind === 'v2') return <SelfBoardV2 />;
  if (!state) return frame(<LoadingVeil testId="self-v3-loading" note={V2_WORDS.loading}><div className={`${cardShell} h-full`} /></LoadingVeil>, 'self-v3-wait');
  if (state.kind === 'preparing')
    return frame(
      <LoadingVeil testId="self-v3-preparing" note={V2_WORDS.preparing} foreground={lateLine || undefined}>
        <div className={`${cardShell} h-full`} />
      </LoadingVeil>,
      'self-v3-wait',
    );
  if (state.kind === 'no_kundli' || board?.status === 'no_kundli')
    return frame(<div className={`${cardShell} h-auto text-white/80`} data-testid="board-no-kundli">{V2_WORDS.noKundli}</div>, 'self-v3-empty');
  if (state.kind === 'error' || !board)
    return frame(
      <div role="alert" className={`${cardShell} h-auto text-white/80`} data-testid="board-error">
        <p>{V2_WORDS.error}</p>
        <button type="button" onClick={() => { setState(null); void load(); }} className="mt-3 inline-flex min-h-[44px] w-fit items-center rounded-full border border-white/20 bg-white/5 px-4 text-sm">
          {V2_WORDS.retry}
        </button>
      </div>,
      'self-v3-error',
    );

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

// ---------------------------------------------------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------------------------------------------------

/** Why reuses the v2 Chart details sheet body, which reads only `details`. */
function detailsArea(card: SelfV3CardView): SelfV2Area {
  return {
    id: 'diagnosis',
    group: 'you',
    title: cardTitle(card),
    status: card.status,
    card: card.v2?.card ?? null,
    floor: [],
    details: { ...(card.v2?.details ?? { evidence: [] }), certainty: card.v2?.details?.certainty as SelfV2Area['details']['certainty'] },
  };
}

/** the options of the cards still on the board, sent only when there are any (an older body stays as it was) */
function keptOptions(all: SelfBoardLayout['options'], cards: readonly string[]): Pick<SelfBoardLayout, 'options'> {
  const kept = optionsFor(all, cards);
  return Object.keys(kept).length ? { options: kept } : {};
}

/** where the sign-in page is, with the way back to this board */
export function signInHref(): string {
  const back = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/dashboard/you';
  return `/signin?next=${encodeURIComponent(back)}`;
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
  board: SelfV3Response;
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
  const { plan, setPlan, refreshPlan } = usePlan();
  const [layout, setLayout] = useState<SelfBoardLayoutView>(board.layout);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  // every layout write goes through one queue: per-card PATCHes with the version, 409 reapplied, 401 refreshed
  const saves = useLayoutSaves({
    initial: board.layout,
    onLayout: setLayout,
    onProblem: (p: SaveProblem) => {
      if (p === 'session') {
        setSessionEnded(true);
        setSaveError(V3_WORDS.sessionEnded);
      } else setSaveError(LAYOUT_ERROR_WORD[p] ?? V3_WORDS.saveFailed);
    },
    onSaved: () => {
      setSessionEnded(false);
      setSaveError(null);
    },
    onQueued: () => onReload(),
  });
  // a board read again (poll, rebuild) carries the stored layout; taken unless a change of ours is outstanding
  useEffect(() => {
    saves.serverLayout(board.layout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.layout]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [editing, setEditing] = useState<SelfCardId[] | null>(null);
  // a reload lands on the card the person was reading
  const [index, setIndex] = useState(() => Math.max(0, board.layout.cards.findIndex((id) => id === getActiveCard())));
  const [details, setDetails] = useState<{ card: SelfV3CardView; period: PeriodView | null } | null>(null);
  const [clockOpen, setClockOpen] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [freshOpen, setFreshOpen] = useState(false);
  const [freshAnswer, setFreshAnswer] = useState<'no_questions' | 'failed' | null>(null);
  const [notDue, setNotDue] = useState<{ validUntil: string | null } | null>(null);
  useEffect(() => setNotDue(null), [board]);
  useEffect(() => {
    if (freshFailed) void refreshPlan();
  }, [freshFailed, refreshPlan]);

  // the cards the server allows (doc 75): `off` cards are not drawn at all, `locked` ones show a lock
  const offered = useMemo(() => board.cards.filter((c) => cardAccess(board, c.id) !== 'off'), [board]);
  const byId = useMemo(() => new Map(offered.map((c) => [c.id, c])), [offered]);
  const titles = useMemo(() => Object.fromEntries(offered.map((c) => [c.id, cardTitle(c)])) as Partial<Record<SelfCardId, string>>, [offered]);
  const order = editing ?? layout.cards;
  const shown = useMemo(() => order.map((id) => byId.get(id)).filter((c): c is SelfV3CardView => !!c), [order, byId]);
  const shownIds = useMemo(() => shown.map((c) => c.id), [shown]);
  // an edit moves only the cards on screen; ones the plan hides keep their place in the saved deck, at its end
  const editOrder = (next: SelfCardId[]) => setEditing([...next, ...order.filter((id) => !byId.has(id))]);
  const compactOn = featureOn(board, 'feature.compact');
  const live = compactOn ? SELF_TEMPLATES_LIVE : SELF_TEMPLATES_LIVE.filter((t) => t === DEFAULT_TEMPLATE);
  const template: SelfTemplateId = live.includes(layout.template) ? layout.template : DEFAULT_TEMPLATE;
  const perView = perViewFor(template, mode);
  const active = shown[Math.min(index, shown.length - 1)] ?? null;
  const suggested = useMemo(() => offered.filter((c) => c.suggested && c.available && !NOT_SUGGESTED.has(c.id)).slice(0, SUGGESTED_COUNT).map((c) => c.id), [offered]);
  const canAdd = offered.some((c) => c.available && !order.includes(c.id));
  const pickerCards = useMemo(() => offered.map((c) => ({ ...c, title: cardTitle(c), suggested: c.suggested && !NOT_SUGGESTED.has(c.id) })), [offered]);
  const allowed: CardAllowed = {
    short: featureOn(board, 'feature.face.short'),
    periods: featureOn(board, 'feature.periods'),
    keyDates: featureOn(board, 'feature.key_dates'),
    why: featureOn(board, 'feature.why_panel'),
    confirm: featureOn(board, 'feature.confirm'),
  };
  const voiceOn = featureOn(board, 'feature.voice') && offered.some((c) => !!c.voices?.direct);

  /** save the deck (template, cards, sections): shown at once, sent at once through the queue */
  const save = useCallback(
    (next: SelfBoardLayout): Promise<boolean> => {
      setSaveError(null);
      return saves.saveDeck({ template: next.template, cards: next.cards, sections: next.sections });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // after "Sign in again" in another tab, coming back sends what is waiting
  useEffect(() => {
    if (!sessionEnded) return;
    const back = () => saves.retry();
    window.addEventListener('focus', back);
    return () => window.removeEventListener('focus', back);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEnded]);

  // doc 70 Phase 3: the per-card reading, and Try again (queue the card, then read the board again)
  const readingOn = !!board.reading?.enabled;
  const cardReading = useMemo<CardReading>(
    () => ({
      on: readingOn,
      onReadAgain: async (id) => {
        await readSelfV3Card(id);
        onReload();
      },
    }),
    [readingOn, onReload],
  );
  const stageLine = readingLine(board.reading);
  const fewForReading = readingOn && layout.chosen && layout.cards.length < MIN_READING_CARDS;

  const select = useCallback(
    (i: number) => {
      setIndex(i);
      const c = shown[i];
      if (c) {
        setActiveCard(c.id);
        track('chip_select', SURFACE, c.id);
      }
    },
    [shown],
  );
  const selectId = (id: SelfCardId) => select(Math.max(0, shown.findIndex((c) => c.id === id)));

  const optionsOf = (c: SelfV3CardView) => cardNow(layout, c.id);
  const boardSettings = boardNow(layout);
  const confirmOn = boardSettings.confirm !== false;
  const motionOn = boardSettings.motion !== false;
  const voice = voiceOn ? (boardSettings.voice ?? 'gentle') : 'gentle';
  const setTemplate = (t: SelfTemplateId) => {
    if (t === template) return;
    track('chip_select', SURFACE, `template_${t}`);
    void save({ template: t, cards: layout.cards, sections: layout.sections });
  };

  const pickerDone = async (cards: SelfCardId[]) => {
    setPickerBusy(true);
    const sections = Object.fromEntries(Object.entries(layout.sections).filter(([id]) => cards.includes(id as SelfCardId))) as SelfBoardLayout['sections'];
    const ok = await save({ template, cards, sections, ...keptOptions(layout.options, cards) });
    setPickerBusy(false);
    if (ok) {
      setPickerOpen(false);
      setIndex(0);
    }
  };

  const editDone = async () => {
    if (!editing) return;
    const same = editing.length === layout.cards.length && editing.every((id, i) => id === layout.cards[i]);
    if (same) {
      setEditing(null);
      return;
    }
    const sections = Object.fromEntries(Object.entries(layout.sections).filter(([id]) => editing.includes(id as SelfCardId))) as SelfBoardLayout['sections'];
    if (await save({ template, cards: editing, sections, ...keptOptions(layout.options, editing) })) {
      setEditing(null);
      setIndex(0);
    }
  };

  // the header (reused from the v2 board)
  const clockLine = (
    <p className="truncate text-[13px] text-white/65" data-testid="self-clock-line">
      <span>Read on your {board.clock.label} clock</span> ·{' '}
      <button type="button" onClick={() => setClockOpen(true)} className="font-semibold text-purple-300 underline underline-offset-4 hover:text-purple-200" data-testid="self-clock-change">
        Change
      </button>
      {board.builtAt && <span data-testid="self-built-line"> · built {longDate(board.builtAt.slice(0, 10))}</span>}
    </p>
  );
  const readingStatus =
    stageLine || fewForReading ? (
      <p className="truncate text-[13px] text-white/65" role="status" data-testid="self-reading-line">
        {stageLine ?? V3_WORDS.addFive}
      </p>
    ) : null;
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
      plan={plan}
      building={freshBuilding}
      noQuestions={freshAnswer === 'no_questions'}
      failed={freshAnswer === 'failed'}
      buildFailed={freshFailed}
      onAsk={() => setFreshOpen(true)}
      compact={mode === 'phone' || mode === 'duo'}
    />
  );
  const buildStatus = freshFailed ? null : <BuildStatus build={board.build} onRetry={onRetryBuild} />;

  const showPicker = !layout.chosen || pickerOpen;
  const templateSwitch = live.length > 1 && (
    <div role="radiogroup" aria-label={V3_WORDS.template} className="flex shrink-0 rounded-full border border-white/10 bg-white/5 p-0.5" data-testid="template-switch">
      {(live as Array<'compact' | 'seasons'>).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={template === t}
          onClick={() => setTemplate(t)}
          disabled={showPicker}
          className={`min-h-[36px] rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-40 ${template === t ? 'bg-teal-500/20 text-teal-200' : 'text-white/65 hover:text-white'}`}
          data-testid={`template-${t}`}
        >
          {TEMPLATE_WORD[t]}
        </button>
      ))}
    </div>
  );
  // while editing, Done (in the chips row) is the only way out: the Edit button is hidden
  const editButton = !editing && (
    <button
      type="button"
      onClick={() => setEditing(layout.cards.slice())}
      disabled={showPicker}
      className="min-h-[40px] shrink-0 rounded-full border border-white/15 px-4 text-[13px] font-semibold text-white/85 hover:bg-white/5 disabled:opacity-40"
      data-testid="self-v3-edit"
    >
      {V3_WORDS.edit}
    </button>
  );

  // the build's veil over the deck, as on the v2 board
  const progress = veilProgress(board.build);
  const buildVeil = !rebuild && !freshBuilding && !!progress && (board.status !== 'ok' || shown.some((c) => c.status === 'pending'));
  const veiled = !!rebuild || freshBuilding || buildVeil;

  const slideLabel = (i: number) => `${i + 1} of ${shown.length}: ${shown[i] ? cardTitle(shown[i]) : ''}`;
  const renderSlide = (i: number) => {
    const c = shown[i]!;
    const lock = featureState(board, `card.self.${c.id}`);
    const props: CardProps = {
      card: c,
      options: optionsOf(c),
      hasOwn: hasOwnOptions(layout, c.id),
      confirmOn,
      motion: motionOn,
      voice,
      allowed,
      lockedPlan: cardAccess(board, c.id) === 'locked' && !lock.on && lock.locked ? lock.minPlan : null,
      onOptions: (patch: Partial<CardOptions>) => {
        track('chip_select', SURFACE, `option_${Object.keys(patch).join('_')}`);
        saves.changeCard(c.id, patch);
      },
      onWhy: (card: SelfV3CardView, period: PeriodView | null) => setDetails({ card, period }),
      onRefresh: onReload,
      focused: perView > 1 && i === index,
      veil: !(veiled && progress),
      reading: cardReading,
    };
    return template === 'compact' ? <CompactCard key={c.id} {...props} /> : <SeasonsCard key={c.id} {...props} />;
  };
  const carousel = (
    <Carousel
      key={template}
      count={shown.length}
      index={index}
      onIndexChange={select}
      perView={perView}
      label="Your cards"
      slideLabel={slideLabel}
      renderSlide={renderSlide}
      peek={template === 'compact'}
      peekPx={template === 'seasons' ? PEEK_PX : 0}
      gap={template === 'seasons' ? SEASONS_GAP : 14}
      testId="self-v3-carousel"
    />
  );
  const veil = (testId: string, note: string) => (
    <div className="relative h-full min-h-0" data-testid={`${testId}-wrap`}>
      <LoadingVeil testId={testId} note={note} foreground={lateLine || undefined} progress={progress}>
        {carousel}
      </LoadingVeil>
    </div>
  );
  const deck = showPicker ? (
    <Picker
      key={layout.chosen ? 'again' : 'first'}
      cards={pickerCards}
      initial={layout.chosen ? layout.cards : []}
      busy={pickerBusy}
      error={saveError}
      onDone={(cards) => void pickerDone(cards)}
      onCancel={layout.chosen ? () => { setPickerOpen(false); setSaveError(null); } : undefined}
      readingOn={readingOn}
    />
  ) : rebuild ? (
    veil('self-rebuild-veil', V2_WORDS.rebuilding(rebuild.label))
  ) : freshBuilding ? (
    veil('self-fresh-veil', V2_WORDS.fresh.veil)
  ) : buildVeil ? (
    veil('self-build-veil', V2_WORDS.writing)
  ) : (
    carousel
  );

  return (
    <div
      className={`grid h-full min-h-0 w-full flex-1 gap-3 overflow-hidden px-4 py-3 text-white sm:px-6 xl:gap-2 xl:py-2 ${!showPicker && mode === 'phone' ? 'grid-rows-[auto_minmax(0,1fr)_auto]' : 'grid-rows-[auto_minmax(0,1fr)]'}`}
      data-testid="self-v3-page"
      data-board-grid="true"
      data-mode={mode}
      data-template={template}
    >
      {/* from 1280 px the title, the chips and the controls share one row (the two groups become flex items around the chips) */}
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:flex-nowrap xl:items-center xl:gap-3" data-testid="self-v3-head">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 xl:contents" data-testid="self-board-row">
        <div className="flex min-w-0 items-center gap-4 xl:order-1 xl:shrink xl:basis-auto">
          <SelfTitle onAddPhoto={() => setWizard(true)} small={mode === 'phone'} />
          <div className="min-w-0">
            {clockLine}
            {!showPicker && readingStatus}
            {!veiled && lateLine}
          </div>
          {mode !== 'phone' && freshControl}
          {buildStatus}
        </div>
        <div className="flex shrink-0 items-center gap-2 xl:order-3">
          {mode === 'phone' && freshControl}
          {editButton}
          {templateSwitch}
          <BoardSettings
            value={boardSettings}
            onChange={(patch) => saves.changeBoard(patch)}
            shortOn={allowed.short}
            voiceOn={voiceOn}
            confirmOn={allowed.confirm}
            phone={mode === 'phone'}
            disabled={showPicker}
          />
        </div>
      </div>
      {!showPicker && (
        <div className="min-w-0 xl:order-2 xl:flex-1" data-testid="self-v3-chips-slot">
        <CardChips
          cards={shownIds}
          titles={titles}
          activeId={active?.id ?? null}
          index={index}
          onSelect={selectId}
          onIndexChange={select}
          onAdd={() => {
            setSaveError(null);
            setPickerOpen(true);
          }}
          editing={!!editing}
          onEditOrder={editOrder}
          onReset={() => setEditing(suggested.slice())}
          onEditDone={() => void editDone()}
          error={saveError}
          canAdd={canAdd}
          action={
            sessionEnded ? (
              <a href={signInHref()} target="_blank" rel="noopener" className="font-semibold text-purple-200 underline underline-offset-4" data-testid="self-sign-in-again">
                {V3_WORDS.signInAgain}
              </a>
            ) : null
          }
        />
        </div>
      )}
      </div>
      <div className="relative min-h-0 min-w-0" data-testid="self-v3-deck">
        {deck}
      </div>
      {!showPicker && mode === 'phone' && <CarouselDots index={index} count={shown.length} onIndexChange={select} label={slideLabel} testId="self-v3-carousel" />}

      {details && (
        <Sheet title={`${cardTitle(details.card)} · ${V3_WORDS.why}`} onClose={() => setDetails(null)} testId="details-sheet">
          <ChartDetails area={detailsArea(details.card)} showEvidence={false} />
        </Sheet>
      )}
      {clockOpen && (
        <ClockSheet
          clock={board.clock}
          plan={plan}
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
      {wizard && <PersonalizeModal onClose={() => setWizard(false)} />}
      {freshOpen && <FreshSheet plan={plan} onClose={() => setFreshOpen(false)} onDone={freshAnswered} />}
    </div>
  );
}
