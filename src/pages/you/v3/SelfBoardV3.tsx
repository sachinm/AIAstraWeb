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
  cardSections,
  fetchSelfV3,
  readSelfV3Card,
  saveSelfV3Layout,
  type BoardReadingView,
  type SelfBoardLayout,
  type SelfBoardLayoutView,
  type SelfCardId,
  type SelfSectionId,
  type SelfTemplateId,
  type SelfV3CardView,
  type SelfV3Response,
  type SelfV3State,
  type SpanReading,
} from '../../../lib/selfV3Api';
import { ChartDetails, cardShell } from '../v2/AreaCard';
import ClockSheet from '../v2/ClockSheet';
import { BuildStatus, FreshControl, FreshSheet } from '../v2/FreshReading';
import SelfBoardV2, { PersonalizeModal, SelfTitle, V2_MAX_WAIT_MS, V2_POLL_MS, buildActive, buildStopped, useBoardMode, veilProgress, type BoardMode } from '../v2/SelfBoardV2';
import Sheet from '../v2/Sheet';
import { V2_WORDS } from '../v2/words';
import CardChips from './CardChips';
import { SpanClocks, type CardReading } from './CardParts';
import CompactCard from './CompactCard';
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
  const [state, setState] = useState<SelfV3State | null>(null);
  const [late, setLate] = useState(false);
  const [rebuild, setRebuild] = useState<{ system: string; label: string } | null>(null);
  const [fresh, setFresh] = useState<{ builtAt: string | null; from: SelfV3Response } | null>(null);
  const [freshFailed, setFreshFailed] = useState(false);
  const waitStart = useRef<number | null>(null);

  const load = useCallback(() => fetchSelfV3().then(setState).catch(() => setState({ kind: 'error' })), []);

  useEffect(() => {
    void load();
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

/** Chart details reuses the v2 sheet body, which reads only `details`. */
function detailsArea(card: SelfV3CardView): SelfV2Area {
  return {
    id: 'diagnosis',
    group: 'you',
    title: card.title,
    status: card.status,
    card: card.v2?.card ?? null,
    floor: [],
    details: { ...(card.v2?.details ?? { evidence: [] }), certainty: card.v2?.details.certainty as SelfV2Area['details']['certainty'] },
  };
}

function plainLayout(l: SelfBoardLayoutView): SelfBoardLayout {
  return { template: l.template, cards: l.cards, sections: l.sections };
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
  // a board read again (poll, rebuild) carries the stored layout; take it unless a save is on its way
  const saving = useRef(0);
  useEffect(() => {
    if (!saving.current) setLayout(board.layout);
  }, [board.layout]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [editing, setEditing] = useState<SelfCardId[] | null>(null);
  const [index, setIndex] = useState(0);
  const [details, setDetails] = useState<{ card: SelfV3CardView; span: SpanReading | null; label: string | null } | null>(null);
  const [clockOpen, setClockOpen] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [freshOpen, setFreshOpen] = useState(false);
  const [freshAnswer, setFreshAnswer] = useState<'no_questions' | 'failed' | null>(null);
  const [notDue, setNotDue] = useState<{ validUntil: string | null } | null>(null);
  useEffect(() => setNotDue(null), [board]);
  useEffect(() => {
    if (freshFailed) void refreshPlan();
  }, [freshFailed, refreshPlan]);

  const byId = useMemo(() => new Map(board.cards.map((c) => [c.id, c])), [board.cards]);
  const titles = useMemo(() => Object.fromEntries(board.cards.map((c) => [c.id, c.title])) as Partial<Record<SelfCardId, string>>, [board.cards]);
  const order = editing ?? layout.cards;
  const shown = useMemo(() => order.map((id) => byId.get(id)).filter((c): c is SelfV3CardView => !!c), [order, byId]);
  const template: SelfTemplateId = SELF_TEMPLATES_LIVE.includes(layout.template) ? layout.template : DEFAULT_TEMPLATE;
  const perView = perViewFor(template, mode);
  const active = shown[Math.min(index, shown.length - 1)] ?? null;
  const suggested = useMemo(() => board.cards.filter((c) => c.suggested && c.available).slice(0, SUGGESTED_COUNT).map((c) => c.id), [board.cards]);

  /** save a layout: shown at once, the server's answer kept; a refusal puts the last saved layout back */
  const save = useCallback(
    async (next: SelfBoardLayout): Promise<boolean> => {
      const before = layout;
      setSaveError(null);
      setLayout({ ...before, ...next });
      saving.current += 1;
      const r = await saveSelfV3Layout(next);
      saving.current -= 1;
      if (r.ok) {
        setLayout(r.layout);
        // cards were queued for reading: read the board again so their states show and the polling starts
        if (r.queued.length) onReload();
        return true;
      }
      setLayout(before);
      setSaveError(LAYOUT_ERROR_WORD[r.error] ?? V3_WORDS.saveFailed);
      return false;
    },
    [layout, onReload],
  );

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
      if (c) track('chip_select', SURFACE, c.id);
    },
    [shown],
  );
  const selectId = (id: SelfCardId) => select(Math.max(0, shown.findIndex((c) => c.id === id)));

  const setSections = (id: SelfCardId, next: SelfSectionId[]) => void save({ ...plainLayout(layout), sections: { ...layout.sections, [id]: next } });
  const setTemplate = (t: SelfTemplateId) => {
    if (t === template) return;
    track('chip_select', SURFACE, `template_${t}`);
    void save({ ...plainLayout(layout), template: t });
  };

  const pickerDone = async (cards: SelfCardId[]) => {
    setPickerBusy(true);
    const sections = Object.fromEntries(Object.entries(layout.sections).filter(([id]) => cards.includes(id as SelfCardId))) as SelfBoardLayout['sections'];
    const ok = await save({ template, cards, sections });
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
    if (await save({ template, cards: editing, sections })) {
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
  const templateSwitch = (
    <div role="radiogroup" aria-label={V3_WORDS.template} className="flex shrink-0 rounded-full border border-white/10 bg-white/5 p-0.5" data-testid="template-switch">
      {(SELF_TEMPLATES_LIVE as Array<'compact' | 'seasons'>).map((t) => (
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
  const editButton = (
    <button
      type="button"
      onClick={() => setEditing(editing ? null : layout.cards.slice())}
      disabled={showPicker}
      aria-pressed={!!editing}
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

  const slideLabel = (i: number) => `${i + 1} of ${shown.length}: ${shown[i]?.title ?? ''}`;
  const renderSlide = (i: number) => {
    const c = shown[i]!;
    const props = {
      card: c,
      sections: cardSections(layout, c),
      onSections: (next: SelfSectionId[]) => setSections(c.id, next),
      onDetails: (card: SelfV3CardView, span?: SpanReading | null, label?: string | null) => setDetails({ card, span: span ?? null, label: label ?? null }),
      focused: perView > 1 && i === index,
      veil: !(veiled && progress),
      reading: cardReading,
    };
    return template === 'compact' ? <CompactCard key={c.id} {...props} /> : <SeasonsCard key={c.id} {...props} />;
  };
  const carousel = (
    <Carousel
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
      cards={board.cards}
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
      className={`grid h-full min-h-0 w-full flex-1 gap-3 overflow-hidden px-4 py-3 text-white sm:px-6 ${showPicker ? 'grid-rows-[auto_minmax(0,1fr)]' : mode === 'phone' ? 'grid-rows-[auto_auto_minmax(0,1fr)_auto]' : 'grid-rows-[auto_auto_minmax(0,1fr)]'}`}
      data-testid="self-v3-page"
      data-board-grid="true"
      data-mode={mode}
      data-template={template}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2" data-testid="self-board-row">
        <div className="flex min-w-0 items-center gap-4">
          <SelfTitle onAddPhoto={() => setWizard(true)} small={mode === 'phone'} />
          <div className="min-w-0">
            {clockLine}
            {!showPicker && readingStatus}
            {!veiled && lateLine}
          </div>
          {mode !== 'phone' && freshControl}
          {buildStatus}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === 'phone' && freshControl}
          {editButton}
          {templateSwitch}
        </div>
      </div>
      {!showPicker && (
        <CardChips
          cards={order}
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
          onEditOrder={setEditing}
          onReset={() => setEditing(suggested.slice())}
          onEditDone={() => void editDone()}
          error={saveError}
        />
      )}
      <div className="relative min-h-0" data-testid="self-v3-deck">
        {deck}
      </div>
      {!showPicker && mode === 'phone' && <CarouselDots index={index} count={shown.length} onIndexChange={select} label={slideLabel} testId="self-v3-carousel" />}

      {details && (
        <Sheet title={`${details.card.title} · ${V2_WORDS.chartDetails}`} onClose={() => setDetails(null)} testId="details-sheet">
          <ChartDetails area={detailsArea(details.card)} showEvidence={board.profile?.role === 'practitioner'} />
          <SpanClocks span={details.span} label={details.label} />
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
