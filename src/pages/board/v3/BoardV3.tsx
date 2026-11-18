/**
 * One v3 board for Self, Love and Work (server docs/dashboards/10 W2), made from the Self board v3 (server
 * docs/reading-engine/68 §4.1, §4.2, §4.7). `board="self"` is /dashboard/you exactly as before; Love and Work are the
 * same page with their own cards, a lens switcher (docs/dashboards/10 §4.4) and their legacy board as the fallback when
 * the server has their v3 off. Self-only: the photo title, the clock line, Personalize and the v2 fallback.
 *
 * What follows is the Self board's own description, which holds for every board.
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
 *
 * Love and Work open on `?lens=<id>` when the link carries one (a focused dashboard in the side menu, server
 * docs/dashboards/11): the board switches to that lens and saves it as its lens, then the parameter leaves the URL.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInRouterContext, useSearchParams } from 'react-router-dom';
import { BoardIdContext } from '../../you/v3/boardContext';
import { LensTabs, LensTitleButton, type LensOption } from './LensSwitcher';
import { usePlan } from '../../../Auth/ProfileGate';
import { RefreshCw } from 'lucide-react';
import BoardHeaderSlot from '../../../components/BoardHeaderSlot';
import Carousel from '../../../components/carousel/Carousel';
import LoadingVeil from '../../../components/LoadingVeil';
import { longDate } from '../../../lib/careerApi';
import { track } from '../../../lib/events';
import { announceUsage } from '../../../lib/planUsage';
import type { RefreshResult } from '../../../lib/boardRefresh';
import type { SelfV2Area } from '../../../lib/selfV2Api';
import {
  BOARD_LENSES,
  DEFAULT_TEMPLATE,
  SELF_TEMPLATES_LIVE,
  SUGGESTED_COUNT,
  cardReadPending,
  fetchSelfV3State,
  minCardsFor,
  minReadingCardsFor,
  readSelfV3Card,
  type BoardId,
  type BoardReadingView,
  type SelfBoardLayout,
  type SelfBoardLayoutView,
  type SelfCardId,
  type SelfTemplateId,
  type SelfV3CardView,
  type SelfV3Response,
  type SelfV3State,
} from '../../../lib/selfV3Api';
import { ChartDetails, cardShell } from '../../you/v2/AreaCard';
import { useLoadCardPhotos } from '../../../components/boardCards/cardPhotos';
import { getUserId } from '../../../lib/graphql';
import { getActiveCard, getSelfV3Cached, readSelfV3Persisted, setActiveCard, setSelfV3Cached, writeSelfV3Persisted } from '../../../lib/selfV3Cache';
import ClockSheet from '../../you/v2/ClockSheet';
import { BuildStatus, FreshControl, FreshSheet } from '../../you/v2/FreshReading';
import SelfBoardV2, { PersonalizeModal, SelfTitle, V2_MAX_WAIT_MS, V2_POLL_MS, buildActive, buildStopped, useBoardMode, veilProgress, type BoardMode } from '../../you/v2/SelfBoardV2';
import Sheet from '../../you/v2/Sheet';
import { V2_WORDS } from '../../you/v2/words';
import CardChips from '../../you/v3/CardChips';
import type { CardReading } from '../../you/v3/CardParts';
import type { CardAllowed, CardProps } from '../../you/v3/CardFrame';
import type { PeriodView } from '../../you/v3/cardModel';
import CompactCard from '../../you/v3/CompactCard';
import { optionsFor, type CardOptions } from '../../../lib/cardOptions';
import BoardSettings from '../../you/v3/BoardSettings';
import { boardNow, cardNow, hasOwnOptions } from '../../you/v3/boardOptions';
import { NOT_SUGGESTED, cardAccess, cardKey, cardTitle, featureOn, featureState } from '../../you/v3/features';
import { cardGroupOf } from '../../you/v3/CardBanner';
import { useLayoutSaves } from '../../you/v3/useLayoutSaves';
import type { SaveProblem } from '../../you/v3/layoutSaver';
import Picker from '../../you/v3/Picker';
import SeasonsCard from '../../you/v3/SeasonsCard';
import { LAYOUT_ERROR_WORD, TEMPLATE_WORD, V3_WORDS } from '../../you/v3/words';
import '../../you/v3/selfBoardV3.css';

/** the board's name in its header and its words (Self keeps "You") */
export const BOARD_TITLE: Record<BoardId, string> = { self: V3_WORDS.boardTitle, love: 'Love', work: 'Work' };

/** the lenses a board offers, from the server when it sends them, else the page's own list */
export function boardLenses(board: BoardId, b: Pick<SelfV3Response, 'lenses'> | null | undefined): Array<LensOption & { suggested: SelfCardId[] }> {
  if (board === 'self') return [];
  const fromServer = b?.lenses?.filter((l) => l && typeof l.id === 'string');
  if (fromServer?.length) return fromServer.map((l) => ({ id: l.id, title: l.title || l.id, suggested: Array.isArray(l.suggested) ? l.suggested : [] }));
  return BOARD_LENSES[board].map((l) => ({ ...l, suggested: [] }));
}

/** the lens the board opens on: the person's stored choice, the server's active lens, its default, else the first */
export function activeLensOf(board: BoardId, b: Pick<SelfV3Response, 'lenses' | 'activeLens' | 'defaultLens'> & { layout: Pick<SelfBoardLayoutView, 'boardOptions'> }): string | null {
  if (board === 'self') return null;
  const ids = boardLenses(board, b).map((l) => l.id as string);
  for (const id of [b.layout.boardOptions?.lens, b.activeLens, b.defaultLens]) if (id && ids.includes(id)) return id;
  return ids[0] ?? null;
}

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

/**
 * Reads `?lens=` (inside a router only) and hands it up; once the board has taken it, drops it from the URL so the
 * lens switcher on the board is not fought by it and a reload opens the stored lens.
 */
function UrlLens({ onLens, taken, onDropped }: { onLens: (id: string | null) => void; taken: string | null; onDropped: () => void }) {
  const [params, setParams] = useSearchParams();
  const lens = params.get('lens');
  useEffect(() => onLens(lens), [lens, onLens]);
  useEffect(() => {
    if (!taken) return;
    onDropped();
    if (lens !== taken) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('lens');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken]);
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The page: loads, polls and falls back to the v2 board
// ---------------------------------------------------------------------------------------------------------------------

export default function BoardV3({ board: boardId = 'self', legacy = null }: { board?: BoardId; legacy?: ReactNode }) {
  const SURFACE = `${boardId}_v3`;
  // the picker's and the cards' photos load once for the board
  useLoadCardPhotos(boardId);
  // paints at once from the cache (memory, then the encrypted copy on disk) and revalidates behind it
  const [state, setState] = useState<SelfV3State | null>(() => {
    const held = getSelfV3Cached(boardId);
    return held ? { kind: 'ok', board: held.data } : null;
  });
  const [late, setLate] = useState(false);
  const [rebuild, setRebuild] = useState<{ system: string; label: string } | null>(null);
  const [fresh, setFresh] = useState<{ builtAt: string | null; from: SelfV3Response } | null>(null);
  const [freshFailed, setFreshFailed] = useState(false);
  const waitStart = useRef<number | null>(null);
  // Love and Work: the lens the link asks for (`?lens=`), and the one the board has taken
  const inRouter = useInRouterContext();
  const [urlLens, setUrlLens] = useState<string | null>(null);
  const [urlLensTaken, setUrlLensTaken] = useState<string | null>(null);
  const dropUrlLens = useCallback(() => setUrlLensTaken(null), []);

  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  const load = useCallback(
    () =>
      fetchSelfV3State({ board: boardId })
        .then(({ state: next, notModified }) => {
          if (!alive.current) return;
          // a board that is on screen stays when the server is briefly unable: no flash of an empty or loading state
          setState((prev) => {
            if (prev?.kind === 'ok' && (next.kind === 'error' || next.kind === 'preparing')) return prev;
            if (prev?.kind === 'ok' && next.kind === 'ok' && prev.board === next.board) return prev;
            return next;
          });
          const held = getSelfV3Cached(boardId);
          if (!notModified && next.kind === 'ok' && held && held.data === next.board) void writeSelfV3Persisted({ userId: getUserId() ?? '', kundliId: null, board: boardId }, held.data, held.etag);
        })
        .catch(() => alive.current && setState((prev) => (prev?.kind === 'ok' ? prev : { kind: 'error' }))),
    [boardId],
  );

  useEffect(() => {
    let off = false;
    const start = () => void load();
    // no board in memory: the encrypted copy on disk, if there is one, draws first; its tag goes into the request
    if (getSelfV3Cached(boardId)) {
      start();
      return;
    }
    void readSelfV3Persisted({ userId: getUserId() ?? '', kundliId: null, board: boardId })
      .then((entry) => {
        if (off || !entry) return;
        setSelfV3Cached(entry.data, entry.etag, boardId);
        setState((prev) => prev ?? { kind: 'ok', board: entry.data });
      })
      .catch(() => undefined)
      .finally(() => !off && start());
    return () => {
      off = true;
    };
  }, [load, boardId]);
  // counted once, on the first v3 board (a v2 fallback counts its own open)
  const opened = useRef(false);
  useEffect(() => {
    if (state?.kind === 'ok' && !opened.current) {
      opened.current = true;
      track('board_open', SURFACE);
    }
  }, [state, SURFACE]);

  const board = state?.kind === 'ok' ? state.board : null;
  const rebuilding = !!rebuild && !(board && board.status === 'ok' && board.clock?.system === rebuild.system);
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

  // the server has this board's v3 off: Self shows its v2 board, Love and Work their legacy board. Love and Work also
  // fall back on an error before any v3 board was drawn (the legacy board still works on an older server)
  if (state?.kind === 'v2') return boardId === 'self' ? <SelfBoardV2 /> : <>{legacy}</>;
  if (boardId !== 'self' && state?.kind === 'error') return <>{legacy}</>;
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
    <BoardIdContext.Provider value={boardId}>
    {inRouter && boardId !== 'self' && <UrlLens onLens={setUrlLens} taken={urlLensTaken} onDropped={dropUrlLens} />}
    <Board
      boardId={boardId}
      board={board}
      urlLens={urlLens}
      onUrlLensTaken={setUrlLensTaken}
      rebuild={rebuilding ? rebuild : null}
      freshBuilding={freshBuilding}
      freshFailed={freshFailed}
      lateLine={lateLine || null}
      onRebuild={(system, label) => { setLate(false); waitStart.current = Date.now(); setRebuild({ system, label }); void load(); }}
      onFreshStarted={() => { setLate(false); setFreshFailed(false); waitStart.current = Date.now(); setFresh({ builtAt: board.builtAt, from: board }); }}
      onReload={() => void load()}
      onRetryBuild={retry}
    />
    </BoardIdContext.Provider>
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
export function signInHref(board: BoardId = 'self'): string {
  const back = typeof window !== 'undefined' ? window.location.pathname + window.location.search : `/dashboard/${board === 'self' ? 'you' : board}`;
  return `/signin?next=${encodeURIComponent(back)}`;
}

function Board({
  boardId,
  board,
  rebuild,
  freshBuilding,
  freshFailed = false,
  lateLine,
  onRebuild,
  onFreshStarted,
  onReload,
  onRetryBuild,
  urlLens = null,
  onUrlLensTaken,
}: {
  boardId: BoardId;
  board: SelfV3Response;
  /** Love and Work: the lens the link asks for (`?lens=`) */
  urlLens?: string | null;
  onUrlLensTaken?: (id: string) => void;
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
  const SURFACE = `${boardId}_v3`;
  const isSelf = boardId === 'self';
  const boardTitle = BOARD_TITLE[boardId];
  const minCards = minCardsFor(boardId);
  const { plan, setPlan, refreshPlan } = usePlan();
  const [layout, setLayout] = useState<SelfBoardLayoutView>(board.layout);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  // every layout write goes through one queue: per-card PATCHes with the version, 409 reapplied, 401 refreshed
  const saves = useLayoutSaves({
    board: boardId,
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
  const [index, setIndex] = useState(() => Math.max(0, board.layout.cards.filter((id) => isSelf || cardGroupOf(id) === activeLensOf(boardId, board)).findIndex((id) => id === getActiveCard(boardId))));
  // Love and Work: the lens whose cards show, and the lens the picker was opened for (a lens with no cards yet)
  const lenses = useMemo(() => boardLenses(boardId, board), [boardId, board]);
  const lens = activeLensOf(boardId, { ...board, layout });
  const [pickLens, setPickLens] = useState<string | null>(null);
  const [details, setDetails] = useState<{ card: SelfV3CardView; period: PeriodView | null } | null>(null);
  const [clockOpen, setClockOpen] = useState(false);
  // the phone's reading sheet (server docs/dashboards/09)
  const [readingOpen, setReadingOpen] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [freshOpen, setFreshOpen] = useState(false);
  const [freshAnswer, setFreshAnswer] = useState<'no_questions' | 'failed' | null>(null);
  const [notDue, setNotDue] = useState<{ validUntil: string | null } | null>(null);
  useEffect(() => setNotDue(null), [board]);
  useEffect(() => {
    if (freshFailed) void refreshPlan();
  }, [freshFailed, refreshPlan]);

  // the cards the server allows (doc 75): `off` cards are not drawn at all, `locked` ones show a lock
  const offered = useMemo(() => board.cards.filter((c) => cardAccess(board, c.id, boardId) !== 'off'), [board, boardId]);
  /** a card of the lens on screen (every card on Self) */
  const inLens = useCallback((c: SelfV3CardView) => isSelf || c.group === lens, [isSelf, lens]);
  const byId = useMemo(() => new Map(offered.map((c) => [c.id, c])), [offered]);
  const titles = useMemo(() => Object.fromEntries(offered.map((c) => [c.id, cardTitle(c)])) as Partial<Record<SelfCardId, string>>, [offered]);
  const order = editing ?? layout.cards;
  const shown = useMemo(() => order.map((id) => byId.get(id)).filter((c): c is SelfV3CardView => !!c && inLens(c)), [order, byId, inLens]);
  const shownIds = useMemo(() => shown.map((c) => c.id), [shown]);
  // an edit moves only the cards on screen; ones the plan hides (and, on Love and Work, other lenses' cards) keep their
  // place in the saved deck, at its end
  const editOrder = (next: SelfCardId[]) => setEditing([...next, ...order.filter((id) => !shownIds.includes(id))]);
  const compactOn = featureOn(board, 'feature.compact');
  const live = compactOn ? SELF_TEMPLATES_LIVE : SELF_TEMPLATES_LIVE.filter((t) => t === DEFAULT_TEMPLATE);
  const template: SelfTemplateId = live.includes(layout.template) ? layout.template : DEFAULT_TEMPLATE;
  const perView = perViewFor(template, mode);
  const active = shown[Math.min(index, shown.length - 1)] ?? null;
  /** a lens's starter cards: the server's list for the person, else the cards it marks suggested */
  const lensSuggested = useCallback(
    (id: string | null): SelfCardId[] => {
      const fromServer = lenses.find((l) => l.id === id)?.suggested ?? [];
      const ok = fromServer.filter((c) => byId.get(c)?.available);
      return ok.length ? ok : offered.filter((c) => c.group === id && c.suggested && c.available).map((c) => c.id);
    },
    [lenses, byId, offered],
  );
  const suggested = useMemo(
    () =>
      isSelf
        ? offered.filter((c) => c.suggested && c.available && !NOT_SUGGESTED.has(c.id)).slice(0, SUGGESTED_COUNT).map((c) => c.id)
        : [...lensSuggested(lens), ...order.filter((id) => !shownIds.includes(id))],
    [isSelf, offered, lensSuggested, lens, order, shownIds],
  );
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
        await readSelfV3Card(id, boardId);
        onReload();
      },
    }),
    [readingOn, onReload, boardId],
  );
  const stageLine = readingLine(board.reading);
  const fewForReading = readingOn && layout.chosen && layout.cards.length < minReadingCardsFor(boardId);

  const select = useCallback(
    (i: number) => {
      setIndex(i);
      const c = shown[i];
      if (c) {
        setActiveCard(c.id, boardId);
        track('chip_select', SURFACE, c.id);
      }
    },
    [shown, boardId, SURFACE],
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

  /** Love and Work: a lens chosen. Its cards show at once; a lens with none opens the picker with its starters ticked. */
  const pickLensNow = (id: string) => {
    if (id === lens && !pickLens) return;
    track('chip_select', SURFACE, `lens_${id}`);
    setEditing(null);
    setIndex(0);
    if (layout.cards.some((c) => byId.get(c)?.group === id)) {
      setPickLens(null);
      setPickerOpen(false);
      saves.changeBoard({ lens: id });
      return;
    }
    setSaveError(null);
    setPickLens(id);
    setPickerOpen(true);
  };

  // a link's lens (`?lens=`), taken once per value: switched to and saved exactly as a tap on its tab would be
  const urlLensDone = useRef<string | null>(null);
  useEffect(() => {
    if (!urlLens) {
      urlLensDone.current = null;
      return;
    }
    if (isSelf || urlLensDone.current === urlLens) return;
    urlLensDone.current = urlLens;
    if (lenses.some((l) => l.id === urlLens)) pickLensNow(urlLens);
    onUrlLensTaken?.(urlLens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLens, isSelf, lenses]);

  const pickerDone = async (cards: SelfCardId[]) => {
    setPickerBusy(true);
    // the lens the picker was opened for goes out in the same save as the deck (one PUT)
    if (pickLens) saves.changeBoard({ lens: pickLens });
    const sections = Object.fromEntries(Object.entries(layout.sections).filter(([id]) => cards.includes(id as SelfCardId))) as SelfBoardLayout['sections'];
    const ok = await save({ template, cards, sections, ...keptOptions(layout.options, cards) });
    setPickerBusy(false);
    if (ok) {
      setPickerOpen(false);
      setPickLens(null);
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
  const clockLine = isSelf && (
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
  // a phone (server docs/dashboards/09): the board's title and controls live in the app header; the reading details
  // (clock, status, fresh reading, build, Edit, template) open in one sheet, so the main area holds only the cards
  const readingNeedsLook = Boolean(refresh?.due) || freshBuilding || freshFailed || freshAnswer !== null || Boolean(stageLine);

  const showPicker = !layout.chosen || pickerOpen;
  // the template switch is Self's; Love and Work read in Seasons
  const templateSwitch = isSelf && live.length > 1 && (
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

  const boardSettingsControl = (
    <BoardSettings
      value={boardSettings}
      onChange={(patch) => saves.changeBoard(patch)}
      shortOn={allowed.short}
      voiceOn={voiceOn}
      confirmOn={allowed.confirm}
      phone={mode === 'phone'}
      disabled={showPicker}
    />
  );
  const lensLabel = `${boardTitle}: what to read`;
  const phoneHead = mode === 'phone' && (
    <BoardHeaderSlot>
      {isSelf ? (
        <span className="min-w-0 truncate pl-1 text-base font-bold text-white" data-testid="self-phone-title">
          {V3_WORDS.boardTitle}
        </span>
      ) : (
        <LensTitleButton boardTitle={boardTitle} lenses={lenses} active={pickLens ?? lens} onPick={pickLensNow} label={lensLabel} />
      )}
      <button
        type="button"
        onClick={() => setReadingOpen(true)}
        aria-label={V3_WORDS.readingSheet}
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        data-testid="self-phone-reading"
      >
        <RefreshCw className="h-[18px] w-[18px]" aria-hidden="true" />
        {readingNeedsLook && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-teal-300" data-testid="self-phone-reading-dot" />}
      </button>
      {boardSettingsControl}
    </BoardHeaderSlot>
  );
  const readingSheet = mode === 'phone' && readingOpen && (
    <Sheet title={V3_WORDS.readingSheet} onClose={() => setReadingOpen(false)} testId="self-reading-sheet">
      <div className="flex flex-col gap-3">
        {clockLine}
        {!showPicker && readingStatus}
        {!veiled && lateLine}
        {freshControl}
        {buildStatus}
        <div className="flex flex-wrap items-center gap-2">
          {editButton && <span onClickCapture={() => setReadingOpen(false)}>{editButton}</span>}
          {templateSwitch}
        </div>
      </div>
    </Sheet>
  );


  const slideLabel = (i: number) => `${i + 1} of ${shown.length}: ${shown[i] ? cardTitle(shown[i]) : ''}`;
  const renderSlide = (i: number) => {
    const c = shown[i]!;
    const lock = featureState(board, cardKey(c.id, boardId));
    const props: CardProps = {
      card: c,
      options: optionsOf(c),
      hasOwn: hasOwnOptions(layout, c.id),
      confirmOn,
      motion: motionOn,
      voice,
      allowed,
      lockedPlan: cardAccess(board, c.id, boardId) === 'locked' && !lock.on && lock.locked ? lock.minPlan : null,
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
  const carouselLabel = isSelf ? 'Your cards' : `Your ${boardTitle} cards`;
  const carousel = (
    <Carousel
      key={template}
      count={shown.length}
      index={index}
      onIndexChange={select}
      perView={perView}
      label={carouselLabel}
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
  // the cards ticked when the picker opens: Self none on a first visit; Love and Work the deck plus the lens's starters
  const pickerInitial: SelfCardId[] = isSelf
    ? layout.chosen
      ? layout.cards
      : []
    : [...new Set([...(layout.chosen ? layout.cards : layout.cards.filter((id) => byId.get(id)?.available)), ...(pickLens || !layout.chosen ? lensSuggested(pickLens ?? lens) : [])])];
  const deck = showPicker ? (
    <Picker
      key={`${layout.chosen ? 'again' : 'first'}:${pickLens ?? ''}`}
      cards={pickerCards}
      initial={pickerInitial}
      busy={pickerBusy}
      error={saveError}
      onDone={(cards) => void pickerDone(cards)}
      onCancel={layout.chosen ? () => { setPickerOpen(false); setPickLens(null); setSaveError(null); } : undefined}
      readingOn={readingOn}
      {...(isSelf
        ? {}
        : {
            board: boardId,
            groups: lenses,
            title: `Your ${boardTitle} cards`,
            lead: V3_WORDS.boardPickerLead,
            minCards,
            minReadingCards: minReadingCardsFor(boardId),
          })}
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
      // a phone: no head row and no dots (docs/dashboards/09): the chips row, then the deck at full height
      className={`grid h-full min-h-0 w-full flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden text-white sm:px-6 xl:gap-2 xl:py-2 ${mode === 'phone' ? 'gap-2 px-3 pb-2 pt-2' : 'gap-3 px-4 py-3'}`}
      data-testid="self-v3-page"
      data-board={boardId}
      data-board-grid="true"
      data-mode={mode}
      data-template={template}
    >
      {/* from 1280 px the title, the chips and the controls share one row (the two groups become flex items around the chips) */}
      {phoneHead}
      {readingSheet}
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:flex-nowrap xl:items-center xl:gap-3" data-testid="self-v3-head">
      {mode !== 'phone' && (
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 xl:contents" data-testid="self-board-row">
        <div className="flex min-w-0 items-center gap-4 xl:order-1 xl:shrink xl:basis-auto">
          {isSelf ? (
            <SelfTitle onAddPhoto={() => setWizard(true)} small={false} />
          ) : (
            <>
              <h1 className="shrink-0 text-2xl font-bold text-white" data-testid="board-title">
                {boardTitle}
              </h1>
              <LensTabs lenses={lenses} active={pickLens ?? lens} onPick={pickLensNow} label={lensLabel} />
            </>
          )}
          <div className="min-w-0">
            {clockLine}
            {!showPicker && readingStatus}
            {!veiled && lateLine}
          </div>
          {freshControl}
          {buildStatus}
        </div>
        <div className="flex shrink-0 items-center gap-2 xl:order-3">
          {editButton}
          {templateSwitch}
          {boardSettingsControl}
        </div>
      </div>
      )}
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
          {...(isSelf ? {} : { minCards: 1, editHint: V3_WORDS.editHintOne, label: carouselLabel })}
          action={
            sessionEnded ? (
              <a href={signInHref(boardId)} target="_blank" rel="noopener" className="font-semibold text-purple-200 underline underline-offset-4" data-testid="self-sign-in-again">
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

      {details && (
        <Sheet title={`${cardTitle(details.card)} · ${V3_WORDS.why}`} onClose={() => setDetails(null)} testId="details-sheet">
          <ChartDetails area={detailsArea(details.card)} showEvidence={false} />
        </Sheet>
      )}
      {isSelf && clockOpen && (
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
      {isSelf && wizard && <PersonalizeModal onClose={() => setWizard(false)} />}
      {freshOpen && <FreshSheet plan={plan} board={boardId} onClose={() => setFreshOpen(false)} onDone={freshAnswered} />}
    </div>
  );
}
