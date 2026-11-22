/**
 * One v3 board for Self, Love and Work (server docs/dashboards/10 W2), made from the Self board v3 (server
 * docs/reading-engine/68 §4.1, §4.2, §4.7). `board="self"` is /dashboard/you exactly as before; Love and Work are the
 * same page with their own cards, a lens switcher (docs/dashboards/10 §4.4) and their legacy board as the fallback when
 * the server has their v3 off. Self-only: the photo title, the clock line and Personalize. Every board, Self included, is
 * given its legacy page as `legacy` and shows it when the server has its v3 off.
 *
 * What follows is the Self board's own description, which holds for every board.
 *
 * One title row (photo, Self, the clock line, the fresh-reading control, Edit and the template switch), the chips row
 * (the person's cards, `+`, arrows and "3 of 8"), then the carousel. Self's header carries one line from its `diagnosis`
 * card (`selfHeaderLine`; on a phone, in the reading sheet); no hero card, no strip. The page never scrolls
 * vertically on tablet or desktop: one grid of three rows, the carousel in the last. Seasons (the default) shows two
 * cards across at tablet landscape with the next one peeking; one card on a phone with chips and dots. Compact shows
 * today's v2 card look four across.
 *
 * On a first visit (`layout.chosen` false) the picker fills the deck. The `+` chip opens it again. Every layout change
 * (picker, edit mode, the template, a card's sections) goes out through PUT /api/self/v3/layout.
 *
 * When the server has v3 off (GET /api/self/v3 answers 404 without a v3 body) the page renders its `legacy` unchanged.
 * Loading, polling, the clock switch, the fresh reading and the build progress come from components/board, shared with
 * the older Self board.
 *
 * Doc 70 Phase 3 (a reading per card, when `reading.enabled`): each card shows its own state (a quiet skeleton while
 * queued or reading, Try again when it failed, "Not read yet" otherwise), the header carries the board's reading line,
 * and the page polls every 2 s while any card on the board is queued or reading.
 *
 * Love and Work open on `?lens=<id>` when the link carries one (a focused dashboard in the side menu, server
 * docs/dashboards/11): the board switches to that lens and saves it as its lens, then the parameter leaves the URL.
 *
 * The reading gate (server prep gate): while the board's `pipeline.locked` (or a start was just refused with 409
 * `preparing`), every control that starts a reading (the fresh reading, a card's Try again, a clock rebuild) is disabled
 * and says "Building your chart data" with the server's line; the page polls every 5 s within the same cap and, once the
 * server unlocks, the controls are back as they were. Picking cards and saving the layout stay open; nothing is started.
 *
 * Card chat (server docs/reading-engine/85), when the server grants `feature.card_chat`: each card carries a chat
 * bubble, and its tap turns that card, in place, into its Chat face. One card is in Chat at a time; the carousel is held
 * still while it is; Read or Short on the card, Esc, or the browser's Back return to the card with the conversation kept
 * (the board's chat store holds every card's thread). A chip, a lens, the picker, Edit or a template change also close
 * it.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { useInRouterContext, useSearchParams } from 'react-router-dom';
import { BoardIdContext } from '../../you/v3/boardContext';
import { LensTabs, type LensOption } from './LensSwitcher';
import { usePlan } from '../../../Auth/ProfileGate';
import { plainLabel } from '../../../lib/plainLabel';
import { Plus, RefreshCw, X } from 'lucide-react';
import BoardHeaderSlot from '../../../components/BoardHeaderSlot';
import Carousel from '../../../components/carousel/Carousel';
import TitleStrip, { ProgressTicks } from '../../../components/carousel/TitleStrip';
import LoadingVeil from '../../../components/LoadingVeil';
import { longDate } from '../../../lib/careerApi';
import { track } from '../../../lib/events';
import { announceUsage } from '../../../lib/planUsage';
import type { RefreshResult } from '../../../lib/boardRefresh';
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
import { ChartDetails, cardShell } from '../../../components/board/ChartDetails';
import { useLoadCardPhotos } from '../../../components/boardCards/cardPhotos';
import { getUserId } from '../../../lib/graphql';
import { getActiveCard, getSelfV3Cached, readSelfV3Persisted, setActiveCard, setSelfV3Cached, writeSelfV3Persisted } from '../../../lib/selfV3Cache';
import ClockSheet from '../../../components/board/ClockSheet';
import { BuildStatus, FreshControl, FreshSheet } from '../../../components/board/FreshReading';
import { refreshBoard } from '../../../lib/boardRefresh';
import type { SelfV2BuildView } from '../../../lib/boardTypes';
import PersonalizeModal from '../../../components/board/PersonalizeModal';
import { SelfTitle } from '../../../components/board/SelfTitle';
import { V2_MAX_WAIT_MS, V2_POLL_MS, buildActive, buildStopped, veilProgress } from '../../../components/board/buildState';
import { useBoardMode, type BoardMode } from '../../../components/board/boardMode';
import Sheet from '../../../components/board/Sheet';
import { BUILD_STAGE_WORDS, PIPELINE_WORDS, V2_WORDS, pipelineLine } from '../../../components/board/words';
import { PIPELINE_POLL_MS, onPipelineAnnounced, pipelineLocked, type PipelineView } from '../../../lib/pipelineStatus';
import CardChips from '../../you/v3/CardChips';
import { cardDetails } from '../../you/v3/CardViews';
import { StoryProse, SystemsRead, hasLongReading, storyParagraphs, systemsRead, withoutSpanIds } from '../../you/v3/AstrologyView';
import type { CardReading } from '../../you/v3/CardParts';
import type { CardAllowed, CardProps } from '../../you/v3/CardFrame';
import type { PeriodView } from '../../you/v3/cardModel';
import CompactCard from '../../you/v3/CompactCard';
import CardChat from '../../../components/cardChat/CardChat';
import CardChatBubble from '../../../components/cardChat/CardChatBubble';
import { createCardChatStore } from '../../../components/cardChat/cardChatStore';
import { costLineFor } from '../../../lib/cardChatApi';
import { optionsFor, type CardOptions } from '../../../lib/cardOptions';
import BoardSettings from '../../you/v3/BoardSettings';
import { boardNow, cardNow, hasOwnOptions } from '../../you/v3/boardOptions';
import { NOT_SUGGESTED, cardAccess, cardFeatureUsable, cardKey, cardTitle, featureOn, featureState } from '../../you/v3/features';
import { cardGroupOf } from '../../you/v3/CardBanner';
import { useLayoutSaves } from '../../you/v3/useLayoutSaves';
import type { SaveProblem } from '../../you/v3/layoutSaver';
import Picker from '../../you/v3/Picker';
import SeasonsCard from '../../you/v3/SeasonsCard';
import { deckPerView, useAcross, useDeckWidth } from '../../you/v3/useDeckWidth';
import { LAYOUT_ERROR_WORD, OUTLOOK_WORDS, TEMPLATE_WORD, V3_WORDS } from '../../you/v3/words';
import '../../you/v3/selfBoardV3.css';

/** the board's name in its header and its words (Self keeps "You") */
export const BOARD_TITLE: Record<BoardId, string> = { self: V3_WORDS.boardTitle, love: 'Love', work: 'Work' };

/** the lenses a board offers, from the server when it sends them, else the page's own list */
export function boardLenses(board: BoardId, b: Pick<SelfV3Response, 'lenses'> | null | undefined): Array<LensOption & { suggested: SelfCardId[] }> {
  if (board === 'self') return [];
  const fromServer = b?.lenses?.filter((l) => l && typeof l.id === 'string');
  if (fromServer?.length) return fromServer.map((l) => ({ id: l.id, title: l.title?.trim() || lensName(board, l.id), suggested: Array.isArray(l.suggested) ? l.suggested : [] }));
  return BOARD_LENSES[board].map((l) => ({ ...l, suggested: [] }));
}

/** a lens's display name when the server sent none: the page's own name for it, never its id */
function lensName(board: Exclude<BoardId, 'self'>, id: string): string {
  return BOARD_LENSES[board].find((l) => l.id === id)?.title ?? plainLabel(id);
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

/** the history entry the Chat face pushes, so Back closes it (the BoardAsk pattern) */
const CARD_CHAT_KEY = '__cardChat';

/** the next card left showing past the last full card */
export const PEEK_PX = 40;
/** a phone's pull-down: the drag that opens the title strip, the rubber band's limit, and its idle close (docs/dashboards/12) */
export const PULL_OPEN_PX = 48;
export const PULL_MAX_PX = 56;
export const STRIP_IDLE_MS = 4000;
/** the gutter between Seasons cards */
export const SEASONS_GAP = 24;
/** doc 70 §4.3 item 3: poll every 2 s while any card on the board is queued or reading */
export const READING_POLL_MS = 2000;
/** a Love/Work lens refresh: board reads after the answer before the chip stops waiting for a change */
export const LENS_ASK_TRIES = 5;

/** true while the per-card reading is on and a card on the person's board is queued or reading */
export function readingPending(board: SelfV3Response | null): boolean {
  if (!board?.reading?.enabled) return false;
  const byId = new Map(board.cards.map((c) => [c.id, c]));
  return board.layout.cards.some((id) => cardReadPending(byId.get(id)?.state));
}

/**
 * The board's reading line (doc 70 §4.4); null for idle and done. While the chart is still being prepared, the reading
 * gate's own line (server `pipeline.line`) is preferred to the page's.
 */
export function readingLine(reading: BoardReadingView | null | undefined, pipeline?: PipelineView | null): string | null {
  if (!reading?.enabled) return null;
  if (reading.preparing) return pipelineLine(pipeline) || V3_WORDS.chartPreparing;
  if (reading.stage === 'clocks') return V3_WORDS.stageClocks;
  if (reading.stage === 'ledger') return V3_WORDS.stageLedger;
  if (reading.stage === 'cards') return V3_WORDS.stageCards(reading.done, reading.total);
  return null;
}

/**
 * The header's reading line for the deck on screen (TODOS 2026-11-19 "0 of 19"). While the day's build is still running
 * and no card of the deck is being written yet, it names the build's stage (from `build.stage`) instead of a counter
 * that cannot move. Love and Work count only their active lens's cards that are being read or were read (the server's
 * `done`/`total` cover every lens on the deck); Self keeps the server's counts. A lens with nothing being read says
 * nothing even when another lens is.
 */
export function deckReadingLine(
  reading: BoardReadingView | null | undefined,
  build: SelfV2BuildView | null | undefined,
  deck: ReadonlyArray<Pick<SelfV3CardView, 'state' | 'available'>>,
  lensDeck: boolean,
  /** the reading gate: its server line is preferred to the page's while the chart is being prepared */
  pipeline?: PipelineView | null,
): { text: string; fromBuild: boolean } | null {
  if (!reading?.enabled) return null;
  if (reading.preparing) return { text: pipelineLine(pipeline) || V3_WORDS.chartPreparing, fromBuild: false };
  if (reading.stage === 'clocks') return { text: V3_WORDS.stageClocks, fromBuild: false };
  if (reading.stage === 'ledger') return { text: V3_WORDS.stageLedger, fromBuild: false };
  const pending = deck.filter((c) => cardReadPending(c.state));
  const cardsStage = reading.stage === 'cards' || pending.length > 0;
  if (cardsStage && lensDeck && !pending.length) return null;
  const buildOn = !!build && (build.state === 'queued' || build.state === 'running');
  if (cardsStage && buildOn && !deck.some((c) => c.state === 'reading')) {
    const step = (build!.state === 'running' && build!.stage ? BUILD_STAGE_WORDS[build!.stage] : null) ?? BUILD_STAGE_WORDS.queued;
    return { text: V3_WORDS.stagePreparing(step), fromBuild: true };
  }
  if (cardsStage && lensDeck) {
    const done = deck.filter((c) => c.available !== false && c.state === 'ready').length;
    return { text: V3_WORDS.stageCards(done, done + pending.length), fromBuild: false };
  }
  const line = readingLine(reading);
  return line ? { text: line, fromBuild: false } : null;
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
// The page: loads, polls and falls back to the legacy board
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

  // the reading gate: a start the server refused (409 `preparing`) holds the lock it named until the board is read again
  const [gateHeld, setGateHeld] = useState<PipelineView | null>(null);
  // bumped on every read of the board, so the gate's poll runs again even when the body did not change
  const [reads, setReads] = useState(0);

  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  useEffect(() => onPipelineAnnounced((p) => alive.current && setGateHeld(p)), []);
  const load = useCallback(
    () =>
      fetchSelfV3State({ board: boardId })
        .then(({ state: next, notModified }) => {
          if (!alive.current) return;
          setGateHeld(null);
          setReads((n) => n + 1);
          // a board that is on screen stays when the server is briefly unable: no flash of an empty or loading state
          setState((prev) => {
            if (prev?.kind === 'ok' && (next.kind === 'error' || next.kind === 'preparing')) return prev;
            if (prev?.kind === 'ok' && next.kind === 'ok' && prev.board === next.board) return prev;
            return next;
          });
          const held = getSelfV3Cached(boardId);
          if (!notModified && next.kind === 'ok' && held && held.data === next.board) void writeSelfV3Persisted({ userId: getUserId() ?? '', kundliId: null, board: boardId }, held.data, held.etag);
        })
        .catch(() => {
          if (!alive.current) return;
          setReads((n) => n + 1);
          setState((prev) => (prev?.kind === 'ok' ? prev : { kind: 'error' }));
        }),
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
  // counted once, on the first v3 board (a legacy fallback counts its own open)
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
  // the reading gate: a refused start's lock, else the board's block (absent on an older server: open)
  const pipeline: PipelineView | null = gateHeld ?? board?.pipeline ?? (state?.kind === 'preparing' ? (state.pipeline ?? null) : null);
  const locked = pipelineLocked(pipeline);
  // locked polls even when a build stopped: the server says it is trying again (`blocked`)
  const waiting = state?.kind === 'preparing' || locked || (!stopped && (board?.status === 'pending' || board?.status === 'preparing' || rebuilding || freshBuilding || building));
  // while locked, each read (even one that changed nothing on screen) schedules the next; otherwise as before
  const lockedReads = locked ? reads : 0;

  // poll while something is being built, for at most six minutes; then say so and offer Retry (as the v2 board does).
  // While the gate is locked, every 5 s; it stops when the board says it is open (no reading is started then)
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
    const every = building ? V2_POLL_MS.build : locked ? PIPELINE_POLL_MS : state?.kind === 'preparing' || board?.status === 'preparing' ? V2_POLL_MS.preparing : V2_POLL_MS.pending;
    const t = setTimeout(() => {
      if (Date.now() - (waitStart.current ?? Date.now()) >= V2_MAX_WAIT_MS) setLate(true);
      else void load();
    }, Math.min(every, left));
    return () => clearTimeout(t);
  }, [state, lockedReads, waiting, late, rebuild, rebuilding, fresh, freshBuilding, freshFailedNow, board?.status, building, locked, load]);

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

  // the server has this board's v3 off: every board shows the legacy page it was given. Love and Work also
  // fall back on an error before any v3 board was drawn (the legacy board still works on an older server)
  if (state?.kind === 'legacy') return <>{legacy}</>;
  if (boardId !== 'self' && state?.kind === 'error') return <>{legacy}</>;
  if (!state) return frame(<LoadingVeil testId="self-v3-loading" note={V2_WORDS.loading}><div className={`${cardShell} h-full`} /></LoadingVeil>, 'self-v3-wait');
  if (state.kind === 'preparing')
    return frame(
      <LoadingVeil testId="self-v3-preparing" note={pipelineLine(pipeline) || V2_WORDS.preparing} foreground={lateLine || undefined}>
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
      pipeline={pipeline}
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

/** the card whose plain line heads the Self board (retire-v2 plan; docs/techniques/09) */
export const HEADER_CARD = 'diagnosis';

/**
 * The Self board's header line: the server's `headerLine`, else the `diagnosis` card's own plain line (its v3 line, else
 * the first paragraph of its plain story), read from every card the board carries, not only the ones on screen. Nothing
 * (null) on Love and Work, and when that card is off or locked for this person, unread, not ready, or has no v3 text.
 * Never the older v2 headline.
 */
export function selfHeaderLine(board: SelfV3Response, boardId: BoardId = 'self'): string | null {
  if (boardId !== 'self') return null;
  const card = board.cards.find((c) => c.id === HEADER_CARD);
  if (card && cardAccess(board, card.id, boardId) !== 'on') return null;
  const served = board.headerLine?.trim();
  if (served) return withoutSpanIds(served) || null;
  // the server said there is none (unread, not this person's): the page does not guess
  if (board.headerLine === null) return null;
  if (!card || card.available === false || card.state !== 'ready' || (card.status !== 'ok' && card.status !== 'stale')) return null;
  const line = card.v3?.line?.trim() || storyParagraphs(card.v3?.plain?.story)[0] || '';
  return withoutSpanIds(line) || null;
}

/**
 * The "i" sheet's body: the card's technical story when served (plan revision 2 §6), "AdAstra AI read" under it, then its
 * older long reading only when the card has one. A card with none of them says its reading is being prepared, never a
 * filler line.
 */
export function DetailsBody({ card }: { card: SelfV3CardView }) {
  const story = storyParagraphs(card.v3?.story).length > 0;
  const systems = systemsRead(card).length > 0;
  const long = hasLongReading(card);
  if (!story && !systems && !long)
    return (
      <p className="text-[15px] text-white/60" data-testid="details-empty">
        {OUTLOOK_WORDS.storyPending}
      </p>
    );
  return (
    <div className="space-y-4" data-testid="details-body">
      <StoryProse text={card.v3?.story} testId="details-story" />
      <SystemsRead card={card} testId="details-systems" />
      {long && <ChartDetails details={cardDetails(card)!} showEvidence={false} emptyLine={false} />}
    </div>
  );
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
  pipeline = null,
}: {
  boardId: BoardId;
  board: SelfV3Response;
  /** the reading gate: while `locked`, every control that starts a reading is disabled and says why */
  pipeline?: PipelineView | null;
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
  const locked = pipelineLocked(pipeline);
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
      } else if (p === 'preparing') setSaveError(PIPELINE_WORDS.saveLater);
      else setSaveError(LAYOUT_ERROR_WORD[p] ?? V3_WORDS.saveFailed);
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
  // a phone's strip of card titles (docs/dashboards/12): open, the live pull distance, and the idle timer's restart
  const [stripOpen, setStripOpen] = useState(false);
  const [pull, setPull] = useState(0);
  const [stripTouched, setStripTouched] = useState(0);
  const touch = useRef<{ x: number; y: number; atTop: boolean; inStrip: boolean } | null>(null);
  const [wizard, setWizard] = useState(false);
  const [freshOpen, setFreshOpen] = useState(false);
  const [freshAnswer, setFreshAnswer] = useState<'no_questions' | 'failed' | 'catching_up' | null>(null);
  // Love and Work: the lens refresh just asked for (server lensRefresh.ts), shown as building until its cards are read
  const [lensAsk, setLensAsk] = useState<{ lens: string | null; from: SelfV3Response; note: string | null } | null>(null);
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
  // tablet and desktop (server docs/dashboards/13 §4.3): Seasons cards across follows the deck's measured width
  const [deckRef, deckWidth] = useDeckWidth<HTMLDivElement>();
  const [across, setAcross] = useAcross();
  const perView = deckPerView({ phone: mode === 'phone', seasons: template === 'seasons', across, width: deckWidth, fallback: perViewFor(template, mode) });
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

  // card chat (doc 85): one store per board holds every card's thread; one card in its Chat face at a time
  const chatOn = featureOn(board, 'feature.card_chat');
  const setPlanNow = useRef(setPlan);
  setPlanNow.current = setPlan;
  const [chatStore] = useState(() => createCardChatStore({ onUsage: (u) => setPlanNow.current(u) }));
  useEffect(() => () => chatStore.dispose(), [chatStore]);
  const [chatCard, setChatCard] = useState<SelfCardId | null>(null);
  const chatCardNow = useRef<SelfCardId | null>(null);
  chatCardNow.current = chatCard;
  const focusAfterChat = useRef<SelfCardId | null>(null);
  // our own Back (dropping the entry we pushed) is not the person's Back
  const poppingOwn = useRef(false);
  const closeChat = useCallback((returnFocus = false) => {
    const prev = chatCardNow.current;
    if (prev && returnFocus) focusAfterChat.current = prev;
    setChatCard(null);
    const s: unknown = window.history.state;
    if (s && typeof s === 'object' && CARD_CHAT_KEY in s) {
      poppingOwn.current = true;
      window.history.back();
    }
  }, []);
  const openChat = useCallback((card: SelfV3CardView) => {
    track('chip_select', SURFACE, 'card_chat');
    const s: unknown = window.history.state;
    if (!(s && typeof s === 'object' && CARD_CHAT_KEY in s)) window.history.pushState({ ...(s && typeof s === 'object' ? s : {}), [CARD_CHAT_KEY]: true }, '');
    setChatCard(card.id);
  }, [SURFACE]);
  // Back (or anything else that pops the entry) closes the Chat face
  useEffect(() => {
    const onPop = () => {
      if (poppingOwn.current) {
        poppingOwn.current = false;
        return;
      }
      const id = chatCardNow.current;
      if (!id) return;
      focusAfterChat.current = id;
      setChatCard(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // focus goes back to the card's bubble once its Chat face has gone
  useEffect(() => {
    const id = focusAfterChat.current;
    if (chatCard || !id) return;
    focusAfterChat.current = null;
    document.querySelector<HTMLElement>(`[data-card-chat="${boardId}:${id}"]`)?.focus();
  }, [chatCard, boardId]);
  const chatFallbackCost = plan && !plan.exempt ? costLineFor(1, plan.remaining) : null;

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
      // a refused read (409 `preparing`) is announced by the call; the page holds the lock until the board is read again
      onReadAgain: async (id) => {
        await readSelfV3Card(id, boardId);
        onReload();
      },
      pipeline,
    }),
    [readingOn, onReload, boardId, pipeline],
  );
  const deckLine = deckReadingLine(board.reading, board.build, shown, !isSelf, pipeline);
  const stageLine = deckLine?.text ?? null;
  const fewForReading = readingOn && layout.chosen && layout.cards.length < minReadingCardsFor(boardId);

  const select = useCallback(
    (i: number) => {
      // another card taken from the chips or arrows: the Chat face closes, its conversation kept
      if (chatCard && shown[i]?.id !== chatCard) closeChat();
      setIndex(i);
      const c = shown[i];
      if (c) {
        setActiveCard(c.id, boardId);
        track('chip_select', SURFACE, c.id);
      }
    },
    [shown, boardId, SURFACE, chatCard, closeChat],
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

  // the header line (the diagnosis card's plain line), then the clock line
  const heroLine = selfHeaderLine(board, boardId);
  const heroLineEl = (phoneSheet: boolean) =>
    heroLine ? (
      <p className={phoneSheet ? 'text-[15px] font-semibold leading-snug text-white' : 'truncate text-[14px] font-semibold text-white/90'} title={phoneSheet ? undefined : heroLine} data-testid="self-hero-line">
        {heroLine}
      </p>
    ) : null;
  const clockLine = isSelf && (
    <p className="truncate text-[13px] text-white/65" data-testid="self-clock-line">
      <span>Read on your {board.clock.label} clock</span> ·{' '}
      <button type="button" onClick={() => setClockOpen(true)} className="font-semibold text-purple-300 underline underline-offset-4 hover:text-purple-200" data-testid="self-clock-change">
        Change
      </button>
      {board.builtAt && <span data-testid="self-built-line"> · built {longDate(board.builtAt.slice(0, 10))}</span>}
    </p>
  );
  // while locked, the gate's line sits under the fresh-reading control: not said twice in the header
  const statusLine = locked && stageLine === pipelineLine(pipeline) ? null : stageLine;
  const readingStatus =
    statusLine || fewForReading ? (
      <p className="truncate text-[13px] text-white/65" role="status" data-testid="self-reading-line">
        {statusLine ?? V3_WORDS.addFive}
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
      if (!isSelf) {
        // Love and Work: the lens's cards are queued; what it cost is said under the chip while they are read
        const W = V2_WORDS.fresh;
        const note = r.kind === 'made' ? (r.first ? W.free : r.repeat ? W.repeat : r.charged === true ? W.used : r.charged === false ? W.included : null) : null;
        setLensAsk({ lens, from: board, note });
        onReload();
      } else if (r.kind === 'building') onFreshStarted();
      else onReload();
    } else if (r.kind === 'no_questions') {
      setFreshAnswer('no_questions');
      if (r.usage) setPlan(r.usage);
    } else if (r.kind === 'not_due') {
      setFreshAnswer(null);
      setNotDue({ validUntil: r.validUntil });
      onReload();
    } else if (r.kind === 'preparing') {
      // the reading gate: nothing was started or counted. Not an error; the refused lock was announced to the page,
      // which shows it and polls until the board says it is open
      setFreshAnswer(null);
    } else if (r.kind === 'busy') {
      // the chart's own build is running: nothing new was started or counted; the board read again shows it
      setFreshAnswer(null);
      onReload();
    } else if (r.kind === 'not_ready') setFreshAnswer('catching_up');
    else setFreshAnswer('failed');
  };
  // the lens asked for is being read: from the answer until the board read after it has no card of the lens pending
  const lensPending = shown.some((c) => cardReadPending(c.state));
  const lensBusy = !isSelf && !!lensAsk && lensAsk.lens === lens && (board === lensAsk.from || lensPending);
  useEffect(() => {
    if (lensAsk && !lensBusy) setLensAsk(null);
  }, [lensAsk, lensBusy]);
  // the board has not moved since the answer (nothing queued yet, or an unchanged read): read it again a few times,
  // then let the chip go back to the served dates rather than say "Making" for ever
  const [lensTries, setLensTries] = useState(0);
  useEffect(() => {
    if (!lensAsk || board !== lensAsk.from) {
      if (lensTries) setLensTries(0);
      return undefined;
    }
    const t = setTimeout(() => {
      if (lensTries >= LENS_ASK_TRIES) setLensAsk(null);
      else {
        setLensTries((n) => n + 1);
        onReload();
      }
    }, READING_POLL_MS);
    return () => clearTimeout(t);
  }, [lensAsk, board, lensTries, onReload]);
  // another lens on screen: the last answer was about the one before
  useEffect(() => setFreshAnswer(null), [lens]);
  // Love and Work, a lens never read with nothing of it queued: its first reading, free (server docs/billing/03 §10).
  // Saving the lens queues its unread cards already; this is the way back when that did not happen (a queue that failed,
  // cards that did not come through). It mirrors the server's rule (no card of the lens has a reading) and only for the
  // lens the served `refresh` describes, so "Free" is never shown for a lens that would be charged.
  const firstReadable =
    !isSelf &&
    readingOn &&
    board.activeLens === lens &&
    !refresh?.madeAt &&
    !refresh?.due &&
    !lensPending &&
    !shown.some((c) => c.state === 'ready') &&
    shown.some((c) => c.available && (c.state === 'not_read' || c.state === 'failed'));
  const [firstBusy, setFirstBusy] = useState(false);
  const readFirst = async () => {
    // the reading gate: no reading may be started (the control is locked; this is the guard behind it)
    if (firstBusy || locked) return;
    setFirstBusy(true);
    const r = await refreshBoard(boardId, { lens });
    setFirstBusy(false);
    freshAnswered(r);
  };
  const freshControl = (
    <FreshControl
      refresh={refresh}
      plan={plan}
      building={freshBuilding || lensBusy || firstBusy}
      noQuestions={freshAnswer === 'no_questions'}
      failed={freshAnswer === 'failed'}
      buildFailed={freshFailed}
      catchingUp={freshAnswer === 'catching_up'}
      onAsk={() => setFreshOpen(true)}
      {...(firstReadable ? { onFirst: () => void readFirst() } : {})}
      note={lensBusy ? (lensAsk?.note ?? null) : null}
      compact={mode === 'phone' || mode === 'duo'}
      pipeline={pipeline}
    />
  );
  // docs/techniques/09 §6: a card on this board was read before the full-thread reading. One calm note beside the
  // freshness chip; its "Refresh" opens the same consent sheet as the chip (it never refreshes by itself). Hidden for the
  // rest of the session once the person closes it.
  const deeperKey = `aiastra.deeper.hidden.${boardId}`;
  const [deeperHidden, setDeeperHidden] = useState(() => {
    try {
      return sessionStorage.getItem(deeperKey) === '1';
    } catch {
      return false;
    }
  });
  const hideDeeper = () => {
    setDeeperHidden(true);
    try {
      sessionStorage.setItem(deeperKey, '1');
    } catch {
      /* private window: hidden for this page only */
    }
  };
  // hidden while the reading gate is locked: its Refresh would start a reading
  const deeperOn = !!board.reading?.deeperReadingReady && !deeperHidden && !locked && !freshBuilding && !lensBusy && !(!layout.chosen || pickerOpen);
  const deeperNotice = deeperOn ? (
    <p role="status" className="flex min-w-0 items-start gap-1.5 text-[13px] leading-[18px] text-teal-100/85" data-testid="deeper-ready">
      <span className="min-w-0">
        {V3_WORDS.deeperReady}{' '}
        <button
          type="button"
          onClick={() => {
            track('chip_select', SURFACE, 'deeper_refresh');
            setReadingOpen(false);
            setFreshOpen(true);
          }}
          className="font-semibold text-teal-200 underline underline-offset-4 hover:text-teal-100"
          data-testid="deeper-refresh"
        >
          {V3_WORDS.deeperRefresh}
        </button>{' '}
        {V3_WORDS.deeperCost}
      </span>
      <button type="button" onClick={hideDeeper} aria-label={V3_WORDS.deeperHide} title={V3_WORDS.deeperHide} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/55 hover:bg-white/10 hover:text-white" data-testid="deeper-hide">
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </p>
  ) : null;
  // one state in the header: a served reading is not contradicted by a failed background build, and the build's stage
  // is not said twice when the reading line already names it
  const served = board.status === 'ok' && !!refresh?.madeAt && !shown.some((c) => c.status === 'pending');
  const buildStatus = freshFailed || deckLine?.fromBuild ? null : <BuildStatus build={board.build} onRetry={onRetryBuild} served={served} />;
  // a phone (server docs/dashboards/09): the board's title and controls live in the app header; the reading details
  // (clock, status, fresh reading, build, Edit, template) open in one sheet, so the main area holds only the cards
  const readingNeedsLook = Boolean(refresh?.due) || deeperOn || freshBuilding || freshFailed || freshAnswer !== null || Boolean(stageLine) || lensBusy || firstReadable || locked;

  const showPicker = !layout.chosen || pickerOpen;
  const lastTemplate = useRef(template);
  useEffect(() => {
    if (lastTemplate.current !== template && chatCard) closeChat();
    lastTemplate.current = template;
  }, [template, chatCard, closeChat]);
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
  // while editing, Done (in the chips row) is the only way out: the Edit button is hidden. Tablet and desktop (server
  // docs/dashboards/13 §4.3): "Cards" opens the card chooser with the board's cards ticked, in order
  const editButton = !editing && (
    <button
      type="button"
      onClick={() => {
        if (mode === 'phone') {
          setEditing(layout.cards.slice());
          return;
        }
        setSaveError(null);
        setPickerOpen(true);
      }}
      disabled={showPicker}
      className="min-h-[40px] shrink-0 rounded-full border border-white/15 px-4 text-[13px] font-semibold text-white/85 hover:bg-white/5 disabled:opacity-40"
      data-testid="self-v3-edit"
    >
      {mode === 'phone' ? V3_WORDS.edit : V3_WORDS.cards}
    </button>
  );

  // the build's veil over the deck, as on the v2 board
  const progress = veilProgress(board.build);
  const buildVeil = !rebuild && !freshBuilding && !!progress && (board.status !== 'ok' || shown.some((c) => c.status === 'pending'));
  const veiled = !!rebuild || freshBuilding || buildVeil;
  // the card in its Chat face left the deck (a lens, the picker, Edit, a build veil or the feature went): close it
  const chatGone = !!chatCard && (!chatOn || showPicker || !!editing || veiled || !shownIds.includes(chatCard));
  useEffect(() => {
    if (chatGone) closeChat();
  }, [chatGone, closeChat]);

  const boardSettingsControl = (
    <BoardSettings
      value={boardSettings}
      onChange={(patch) => saves.changeBoard(patch)}
      // docs/dashboards/12: the three bars replaced Read / Short, so the gear no longer offers a face
      shortOn={false}
      voiceOn={voiceOn}
      confirmOn={allowed.confirm}
      phone={mode === 'phone'}
      disabled={showPicker}
      across={across}
      // Compact keeps its own count; the choice is kept for when Seasons is back
      onAcross={template === 'seasons' ? setAcross : undefined}
    />
  );
  const lensLabel = `${boardTitle}: what to read`;
  // a phone (server docs/dashboards/12): the header's middle holds the card on screen, "n/N"; a tap (or pulling the card
  // down from its top) opens the strip of card titles under the header. The board's own controls (lens, reading,
  // settings, Edit, add a card) live in the board sheet, opened from the strip's last chip.
  const phone = mode === 'phone';
  const titleList = useMemo(() => shown.map((c) => cardTitle(c)), [shown]);
  const phoneHead = phone && (
    <BoardHeaderSlot>
      <button
        type="button"
        onClick={() => setStripOpen((o) => !o)}
        aria-expanded={stripOpen}
        aria-controls="phone-title-strip"
        aria-label={active && !showPicker ? `${cardTitle(active)}, card ${Math.min(index + 1, shown.length)} of ${shown.length}. Show all card titles` : boardTitle}
        className="relative flex min-w-0 max-w-full flex-col items-center rounded-lg px-1.5 py-0.5 leading-tight text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
        data-testid="phone-card-title"
      >
        {/* up to two lines at 360 px, so the card's name reads whole instead of "Body &…" */}
        <span className="line-clamp-2 max-w-full break-words text-center text-[12.5px] font-bold leading-[1.15]" data-testid="phone-card-title-text">
          {active && !showPicker ? cardTitle(active) : boardTitle}
        </span>
        {active && !showPicker && (
          <span className="text-[10.5px] leading-none tabular-nums text-white/60" data-testid="phone-card-count">
            {Math.min(index + 1, shown.length)}/{shown.length}
          </span>
        )}
        {readingNeedsLook && <span className="absolute right-0 top-0.5 h-2 w-2 rounded-full bg-teal-300" data-testid="self-phone-reading-dot" />}
      </button>
    </BoardHeaderSlot>
  );
  // the strip closes by itself after a few idle seconds, and whenever a conversation, the picker or Edit takes over
  useEffect(() => {
    if (!stripOpen) return undefined;
    const t = setTimeout(() => setStripOpen(false), STRIP_IDLE_MS);
    return () => clearTimeout(t);
  }, [stripOpen, stripTouched, index]);
  useEffect(() => {
    if (chatCard || showPicker || editing || !phone) setStripOpen(false);
  }, [chatCard, showPicker, editing, phone]);
  /**
   * Pulling the card down reveals the strip: only from a card whose own scroll is at its very top (so it never fights
   * the card's text), past PULL_OPEN_PX, with a rubber band while dragging; pushing the card back up closes it. A touch
   * that starts on the strip is the strip's own. The page's pull-to-refresh stays off (`app-frame` on html and body).
   */
  const pullHandlers = {
    onTouchStart: (e: ReactTouchEvent<HTMLDivElement>) => {
      const t = e.touches[0];
      if (!t || chatCard) {
        touch.current = null;
        return;
      }
      const target = e.target as HTMLElement | null;
      const scroller = target?.closest?.('[data-card-scroll], .self-v3-scroll') as HTMLElement | null;
      touch.current = { x: t.clientX, y: t.clientY, atTop: !scroller || scroller.scrollTop <= 0, inStrip: false };
    },
    onTouchMove: (e: ReactTouchEvent<HTMLDivElement>) => {
      const s = touch.current;
      const t = e.touches[0];
      if (!s || !t || stripOpen || !s.atTop) return;
      const dy = t.clientY - s.y;
      const dx = t.clientX - s.x;
      if (dy <= 0 || Math.abs(dx) > dy) {
        if (pull) setPull(0);
        return;
      }
      // the rubber band: half the finger's travel, never past the strip's height
      setPull(Math.min(PULL_MAX_PX, Math.round(dy * 0.5)));
    },
    onTouchEnd: (e: ReactTouchEvent<HTMLDivElement>) => {
      const s = touch.current;
      touch.current = null;
      setPull(0);
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dy = t.clientY - s.y;
      const dx = t.clientX - s.x;
      if (Math.abs(dx) > Math.abs(dy)) return;
      if (!stripOpen && s.atTop && dy >= PULL_OPEN_PX) {
        setStripOpen(true);
        track('chip_select', SURFACE, 'title_strip_pull');
      } else if (stripOpen && dy <= -PULL_OPEN_PX) setStripOpen(false);
    },
    // a touch the browser took over (a native scroll, a system gesture): nothing stays half open
    onTouchCancel: () => {
      touch.current = null;
      setPull(0);
    },
  };
  const readingSheet = phone && readingOpen && (
    <Sheet title={isSelf ? V3_WORDS.readingSheet : boardTitle} onClose={() => setReadingOpen(false)} testId="self-reading-sheet">
      <div className="flex flex-col gap-3">
        {!isSelf && <LensTabs lenses={lenses} active={pickLens ?? lens} onPick={(id) => { setReadingOpen(false); pickLensNow(id); }} label={lensLabel} />}
        {heroLineEl(true)}
        {clockLine}
        {!showPicker && readingStatus}
        {!veiled && lateLine}
        {freshControl}
        {deeperNotice}
        {buildStatus}
        <div className="flex flex-wrap items-center gap-2">
          {editButton && <span onClickCapture={() => setReadingOpen(false)}>{editButton}</span>}
          {!showPicker && canAdd && (
            <button
              type="button"
              onClick={() => {
                setReadingOpen(false);
                setSaveError(null);
                setPickerOpen(true);
              }}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-4 text-[13px] font-semibold text-white/85 hover:bg-white/5"
              data-testid="phone-add-card"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {V3_WORDS.addCard}
            </button>
          )}
          {templateSwitch}
          {boardSettingsControl}
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
      shape: mode === 'phone' ? 'phone' : 'board',
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
      ...(chatOn && cardFeatureUsable(c, 'feature.card_chat')
        ? {
            chat: (card: SelfV3CardView) => (
              <CardChatBubble
                title={cardTitle(card)}
                open={chatCard === card.id}
                onOpen={() => (chatCard === card.id ? closeChat(true) : openChat(card))}
                cardKey={`${boardId}:${card.id}`}
              />
            ),
            chatFace: {
              open: chatCard === c.id,
              onOpen: (card: SelfV3CardView) => openChat(card),
              onClose: () => closeChat(true),
              // every ready card carries the thin input (docs/dashboards/12); the conversation opens over it on start
              render: (card: SelfV3CardView, period: PeriodView | null, opts: { conversation: boolean; onStart: () => void }) => (
                <CardChat
                  store={chatStore}
                  chatRef={{ board: boardId, cardId: card.id, from: period?.item.from ?? null, to: period?.item.to ?? null }}
                  periodLabel={period?.label ?? null}
                  fallbackCostLine={chatFallbackCost}
                  onBack={() => closeChat(true)}
                  conversation={opts.conversation}
                  onStart={opts.onStart}
                />
              ),
            },
          }
        : {}),
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
      // a phone: the card is full width with no side peek (docs/dashboards/12)
      peek={!phone && template === 'compact'}
      peekPx={!phone && template === 'seasons' ? PEEK_PX : 0}
      gap={phone ? 12 : template === 'seasons' ? SEASONS_GAP : 14}
      testId="self-v3-carousel"
      locked={!!chatCard}
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
      locked={locked}
      // tablet and desktop: the chooser sets the order too, and offers "Reset to suggested"
      {...(mode === 'phone' ? {} : { reorder: true, suggestedIds: suggested })}
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
          {/* capped, so a long header line or the deeper-reading note truncates or wraps here instead of squeezing the
              chips that share this row from 1280 px */}
          <div className="min-w-0 max-w-[20rem] 2xl:max-w-[28rem]" data-testid="self-head-text">
            {heroLineEl(false)}
            {clockLine}
            {!showPicker && readingStatus}
            {!veiled && lateLine}
            {deeperNotice}
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
      {phone && !showPicker && (
        <div className="flex min-w-0 flex-col gap-1" data-testid="phone-board-head">
          <ProgressTicks count={shown.length} index={index} />
          <div id="phone-title-strip" style={pull && !stripOpen ? { height: pull, overflow: 'hidden', opacity: Math.min(1, pull / PULL_OPEN_PX) } : undefined} data-testid="phone-strip-wrap" data-pull={pull}>
            <TitleStrip
              titles={titleList}
              index={Math.min(index, Math.max(0, shown.length - 1))}
              open={stripOpen || pull > 0}
              onSelect={(i, fromScroll) => {
                select(i);
                if (!fromScroll) setStripOpen(false);
              }}
              onActivity={() => setStripTouched((n) => n + 1)}
              label={carouselLabel}
              trailing={
                <button
                  type="button"
                  onClick={() => {
                    setStripOpen(false);
                    setReadingOpen(true);
                  }}
                  aria-label={isSelf ? V3_WORDS.readingSheet : `${boardTitle}: ${V3_WORDS.readingSheet}`}
                  tabIndex={stripOpen ? 0 : -1}
                  className="relative inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/15 px-3 text-[13px] font-semibold text-white/80"
                  data-testid="self-phone-reading"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {readingNeedsLook && <span className="absolute right-1 top-1.5 h-2 w-2 rounded-full bg-teal-300" />}
                </button>
              }
            />
          </div>
        </div>
      )}
      {/* a phone keeps the chips row only while editing the deck or saying a save failed */}
      {!showPicker && (!phone || !!editing || !!saveError) && (
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
      <div ref={deckRef} className="relative min-h-0 min-w-0" data-testid="self-v3-deck" {...(phone && !showPicker ? pullHandlers : {})}>
        {deck}
      </div>

      {details && (
        <Sheet title={`${cardTitle(details.card)} · ${V3_WORDS.why}`} onClose={() => setDetails(null)} testId="details-sheet">
          <DetailsBody card={details.card} />
        </Sheet>
      )}
      {isSelf && clockOpen && (
        <ClockSheet
          clock={board.clock}
          plan={plan}
          pipeline={pipeline}
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
      {freshOpen && !locked && <FreshSheet plan={plan} board={boardId} lens={isSelf ? null : lens} onClose={() => setFreshOpen(false)} onDone={freshAnswered} />}
    </div>
  );
}
