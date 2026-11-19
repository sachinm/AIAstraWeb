/**
 * One Self v3 card (doc 75, "The foundation card"; server docs/dashboards/12). From the top: the header art carrying the
 * card's name and one line saying what it answers, with the chat bubble and "i" for Why at its right; three wide bars,
 * Read · Analysis · Calendar; the named period chips (Read and Analysis); the stale-dates note when the server flags
 * one; on Read the headline; then the body, the card's one vertical scroll (`overscroll-behavior: contain`); "Is this
 * right?"; and at the foot, always, the card's chat input.
 *
 * A card the person's plan does not cover shows a lock and "Part of Plus", never its content. Nothing here calls the
 * network: choices go up through `onOptions`, Why through `onWhy`, the chat is drawn by the board.
 *
 * Card chat (server docs/reading-engine/85, docs/dashboards/12): with `chatFace`, the thin input sits at the card's
 * foot on every view. Starting to type opens the conversation over the card's view, with "Back to card" and the
 * period it is about; the bars, Back, Esc or the browser's Back return to the card. The board keeps the conversation.
 * The periods no longer change on a sideways swipe inside the card: on a phone that swipe moves between cards.
 *
 * `shape` (server docs/dashboards/13): `'phone'` (the default) is the card above, unchanged. `'board'` is the tablet and
 * desktop card: Outlook · Astrology Reading · Calendar, no "i" button (Why is inside the card and the reasoning is its own
 * tab), no 72-character cap (the card's own width lays it out), and "Is this right?" pinned between the view and the
 * chat input on Outlook.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Info, Lock } from 'lucide-react';
import type { CardOptions } from '../../../lib/cardOptions';
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import { V2_WORDS } from '../v2/words';
import { CardBanner, cardAccentClass } from './CardBanner';
import CardFooter from './CardFooter';
import { SensitiveNote, type CardReading } from './CardParts';
import AstrologyView from './AstrologyView';
import { AnalysisView, BOARD_VIEWS, CalendarView, CardViewBars, VIEW_WORDS, type CardViewId } from './CardViews';
import OutlookView from './OutlookView';
import RangeCalendar from './RangeCalendar';
import { dayWords, headlineOf, keyDatesOf, todayIso, type PeriodView } from './cardModel';
import FaceBody from './faces/FaceBody';
import { label } from './faces/parts';
import { cardSubtitle, cardTitle, planWord } from './features';
import { notReadyBody } from './notReady';
import PeriodStrip from './PeriodStrip';
import { useCardView } from './useCardView';
import { V3_WORDS } from './words';

/** what the board lets a card show (doc 75 feature switches) */
export interface CardAllowed {
  short: boolean;
  periods: boolean;
  keyDates: boolean;
  why: boolean;
  confirm: boolean;
}

/**
 * The card's conversation a board gives a card (server docs/dashboards/12): open or not, the way in and out, and the
 * chat itself. `render` is called on every ready card, open or not: closed it draws only the thin input anchored at the
 * card's foot (`conversation` false), and `onStart` (focus, typing, the mic) opens the conversation over the card's view.
 */
export interface CardChatFace {
  open: boolean;
  onOpen: (card: SelfV3CardView, period: PeriodView | null) => void;
  onClose: () => void;
  render: (card: SelfV3CardView, period: PeriodView | null, opts: { conversation: boolean; onStart: () => void }) => ReactNode;
}

export const ALL_ALLOWED: CardAllowed = { short: true, periods: true, keyDates: true, why: true, confirm: true };

/** `'phone'`: today's card; `'board'`: the tablet and desktop card (server docs/dashboards/13) */
export type CardShape = 'phone' | 'board';

export interface CardProps {
  card: SelfV3CardView;
  /** the card's shape; `'phone'` when absent */
  shape?: CardShape;
  /** the options in force: the card's own choices over the board's over the defaults */
  options: CardOptions;
  hasOwn?: boolean;
  confirmOn?: boolean;
  motion?: boolean;
  voice?: 'gentle' | 'direct';
  allowed?: CardAllowed;
  /** the plan that unlocks this card, when the person's does not */
  lockedPlan?: string | null;
  onOptions: (patch: Partial<CardOptions>) => void;
  onWhy?: (card: SelfV3CardView, period: PeriodView | null) => void;
  /** the chat bubble for this card and the period on screen; absent while card chat is off */
  chat?: (card: SelfV3CardView, period: PeriodView | null) => ReactNode;
  /** the card's Chat face (doc 85), drawn by the board; absent while card chat is off */
  chatFace?: CardChatFace;
  onRefresh?: () => void;
  focused?: boolean;
  veil?: boolean;
  reading?: CardReading;
}

const iconBtn =
  'self-v3-btn inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white hover:bg-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

export function KeyDates({ card }: { card: SelfV3CardView }) {
  const today = todayIso();
  const dates = keyDatesOf(card, today);
  if (!dates.length) return null;
  return (
    <section data-testid="key-dates">
      <h4 className={label}>{V3_WORDS.keyDates}</h4>
      <ul className="mt-1.5 grid gap-1">
        {dates.map((k) => (
          <li key={`${k.date}-${k.label}`} className={`flex gap-2 text-[15px] ${k.passed ? 'text-white/45' : 'text-white/85'}`} data-testid="key-date" data-passed={k.passed ? 'true' : 'false'}>
            <b className="shrink-0 font-semibold">{dayWords(k.date, { short: true, today })}:</b>{' '}
            <span>
              {k.label}
              {k.passed && <span className="ml-1.5 text-[13px] italic">({V3_WORDS.passed})</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CardFrame({
  variant,
  card,
  shape = 'phone',
  options,
  hasOwn = false,
  confirmOn = true,
  motion = true,
  voice = 'gentle',
  allowed = ALL_ALLOWED,
  lockedPlan = null,
  onWhy,
  chat,
  chatFace,
  onRefresh,
  focused = false,
  veil = true,
  reading,
}: CardProps & { variant: 'seasons' | 'compact' }) {
  const view = useCardView(card, voice);
  const compact = variant === 'compact';
  const title = cardTitle(card);
  const subtitle = cardSubtitle(card);
  // the three bars replace Read / Short (server docs/dashboards/12): a stored Short reads as Read, whose top it now is
  const boardShape = shape === 'board';
  const [shownView, setShownView] = useState<CardViewId>(boardShape ? 'outlook' : 'read');
  const chips = allowed.periods ? view.chips : [];
  const period = allowed.periods ? view.period : (view.periods.find((p) => p.current && p.own) ?? null);
  const headline = headlineOf(card, period, voice);
  const notReady = lockedPlan ? null : notReadyBody(card, veil, reading);
  const panelId = `card-body-${card.id}`;
  const ready = !lockedPlan && !notReady;
  const chatting = ready && !!chatFace?.open;
  // a card that stops being readable (a new build, a lock) leaves its conversation; the board keeps it
  const chatOpenButNotReady = !ready && !!chatFace?.open;
  const closeChatFace = chatFace?.onClose;
  useEffect(() => {
    if (chatOpenButNotReady) closeChatFace?.();
  }, [chatOpenButNotReady, closeChatFace]);
  /** a bar picked: from the conversation it goes back to the card on that view */
  const pickView = (v: CardViewId) => {
    if (chatting) chatFace!.onClose();
    setShownView(v);
  };
  const bars = (
    <CardViewBars cardId={card.id} view={chatting ? null : shownView} onView={pickView} panelId={panelId} hasOwn={hasOwn} {...(boardShape ? { views: BOARD_VIEWS } : {})} />
  );

  const header = (
    <div className="relative shrink-0" data-testid="card-header">
      <CardBanner cardId={card.id} motion={motion} height={compact ? 64 : 84} className="self-v3-banner" />
      <div className={`${compact ? 'min-h-[64px]' : 'min-h-[84px]'} absolute inset-0 flex items-center gap-2 pl-16 pr-3`}>
        <div className="card-banner-ink min-w-0 flex-1">
          <h3 className={`truncate font-bold leading-tight ${compact ? 'text-lg' : 'text-[22px]'}`} data-testid="card-title">
            {title}
          </h3>
          {subtitle && (
            <p className="truncate text-[13px] opacity-85" data-testid="card-subtitle">
              {subtitle}
            </p>
          )}
        </div>
        {ready && (
          <div className="flex shrink-0 items-center gap-1" data-testid="card-header-icons">
            {chat?.(card, period)}
            {!boardShape && allowed.why && onWhy && (
              <button type="button" onClick={() => onWhy(card, period)} aria-label={`${V3_WORDS.why}: ${title}`} title={V3_WORDS.why} className={iconBtn} data-testid="card-why">
                <Info className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const locked = lockedPlan && (
    <div className="mt-4 flex items-center gap-2 text-[15px] text-white/75" data-testid="card-locked">
      <Lock className="h-4 w-4" aria-hidden="true" />
      {V3_WORDS.locked(planWord(lockedPlan))}
    </div>
  );

  // the view under the bars: the reading, the analysis or the calendar (the body is the card's one vertical scroll)
  const viewBody =
    shownView === 'outlook' ? (
      <OutlookView
        card={card}
        period={period}
        periods={view.periods}
        standing={view.standing}
        options={options}
        showWhy={allowed.why}
        showDates={allowed.keyDates}
        onAstrology={() => pickView('astrology')}
      />
    ) : shownView === 'astrology' ? (
      <AstrologyView card={card} period={period} showDetails={allowed.why} />
    ) : shownView === 'calendar' && boardShape ? (
      <RangeCalendar card={card} periods={view.periods} showWindows={allowed.periods} showDates={allowed.keyDates} />
    ) : shownView === 'analysis' ? (
      <AnalysisView card={card} period={period} options={options} why={allowed.why} />
    ) : shownView === 'calendar' ? (
      <CalendarView card={card} periods={view.periods} showWindows={allowed.periods} showDates={allowed.keyDates} />
    ) : (
      <>
        <FaceBody face="read" card={card} periods={view.periods} period={period} standing={view.standing} />
        {allowed.keyDates && <KeyDates card={card} />}
      </>
    );
  const withPeriods = shownView !== 'calendar' && chips.length > 1;
  const pinnedFooter = boardShape && !chatting && shownView === 'outlook' && confirmOn && allowed.confirm && !!card.v3?.confirm;

  // every slot below keeps its place whether or not the conversation is open, so the chat input (last) is never
  // remounted: a focused box keeps its focus and the phone keyboard
  const body = (
    <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2" data-testid="card-stage">
      {bars}
      {chatting ? (
        <div className="flex min-w-0 shrink-0 flex-nowrap items-center gap-2" data-testid="card-chat-face">
          <button type="button" onClick={() => chatFace!.onClose()} className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 text-[13px] font-semibold text-white hover:bg-white/15" data-testid="card-chat-back">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {VIEW_WORDS.backToCard}
          </button>
          {period?.label && (
            <span className="min-w-0 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] text-white/75" data-testid="card-chat-period">
              {period.label}
            </span>
          )}
        </div>
      ) : withPeriods ? (
        <PeriodStrip cardId={card.id} periods={view.periods} chips={chips} selected={view.selected} onSelect={view.select} panelId={panelId} />
      ) : null}
      {!chatting && card.datesPassed ? (
        <p role="status" className="flex shrink-0 flex-wrap items-center gap-x-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-[13px] text-amber-100" data-testid="card-dates-passed">
          {V3_WORDS.datesPassed}
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="font-semibold underline underline-offset-4" data-testid="card-refresh">
              {V3_WORDS.refresh}
            </button>
          )}
        </p>
      ) : null}
      {!chatting && card.status === 'stale' ? <p className="shrink-0 text-center text-[13px] text-white/55" data-testid="card-stale">{V2_WORDS.cardStale}</p> : null}
      {!chatting && shownView === 'read' ? (
        <p key={`h-${view.selected ?? -1}`} className={`self-v3-fade shrink-0 text-center font-bold leading-snug text-white ${compact ? 'text-lg' : 'text-[22px] sm:text-2xl'}`} data-testid="card-line">
          {headline}
        </p>
      ) : null}
      {!chatting ? (
        <div
          id={panelId}
          role="tabpanel"
          // the text scrolls inside the card and never hands the scroll on to the page (server docs/dashboards/12)
          className={`self-v3-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]${pinnedFooter ? ' self-v3-scroll-pinned' : ''}`}
          style={{ overscrollBehavior: 'contain' }}
          data-testid="card-body"
          data-card-scroll="true"
          data-view={shownView}
          tabIndex={0}
          aria-label={`${title}, ${VIEW_WORDS[shownView]}`}
        >
          {/* the board card's headline scrolls with the reading: on a short card the pinned question and the input
              keep their place and nothing is pushed out of the card (server docs/dashboards/13 §4.3) */}
          {shownView === 'outlook' ? (
            <p key={`h-${view.selected ?? -1}`} className={`self-v3-fade self-v3-headline mb-3 text-center font-bold leading-snug text-white ${compact ? 'text-lg' : 'text-[22px] sm:text-2xl'}`} data-testid="card-line">
              {headline}
            </p>
          ) : null}
          <div className={boardShape ? 'self-v3-column w-full space-y-4 px-1 pb-1' : 'self-v3-column mx-auto w-full max-w-[72ch] space-y-4 px-1 pb-1'}>{viewBody}</div>
          {/* "Is this right?" ends the reading inside its scroll, so it is never cut off on a short phone */}
          {shownView === 'read' ? <CardFooter card={card} confirmOn={confirmOn && allowed.confirm} /> : null}
        </div>
      ) : null}
      {/* tablet and desktop: "Is this right?" pinned between the view and the chat input; the slot is always here so the
          input after it keeps its place */}
      {pinnedFooter ? <CardFooter card={card} confirmOn={confirmOn && allowed.confirm} pinned /> : null}
      {chatFace ? chatFace.render(card, period, { conversation: chatting, onStart: () => chatFace.onOpen(card, period) }) : null}
    </div>
  );

  return (
    <article
      className={`glass self-v3-card self-v3-${variant} flex h-full min-h-0 flex-col rounded-2xl ${cardAccentClass(card.id)} ${focused ? 'ring-1 ring-teal-300/40' : ''}`}
      data-testid={`v3-card-${card.id}`}
      data-status={card.status}
      data-state={card.state}
      data-template={variant}
      {...(boardShape ? { 'data-shape': 'board' } : {})}
      data-face={chatting ? 'chat' : shownView}
      data-locked={lockedPlan ? 'true' : 'false'}
      aria-label={title}
    >
      {header}
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-2 xl:px-5">
        <SensitiveNote card={card} />
        {locked || notReady || body}
      </div>
    </article>
  );
}
