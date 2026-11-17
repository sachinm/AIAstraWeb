/**
 * One Self v3 card (doc 75, "The foundation card"). From the top: the header art carrying the card's name, large, and
 * one line saying what it answers, with the chat bubble and "i" for Why at its right; the Read / Short switch and the
 * named period chips; the stale-dates note when the server flags one; the headline, always visible; then the body,
 * which scrolls inside the card's fixed height (the face, then Key dates); and "Is this right?" at the foot.
 *
 * A card the person's plan does not cover shows a lock and "Part of Plus", never its content. Nothing here calls the
 * network: choices go up through `onOptions`, Why through `onWhy`, the chat bubble is drawn by the board.
 */
import type { ReactNode } from 'react';
import { Info, Lock } from 'lucide-react';
import type { CardOptions } from '../../../lib/cardOptions';
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import { V2_WORDS } from '../v2/words';
import { CardBanner, cardAccentClass } from './CardBanner';
import CardFooter from './CardFooter';
import { SensitiveNote, type CardReading } from './CardParts';
import CardToolbar from './CardToolbar';
import { dayWords, headlineOf, keyDatesOf, neighbour, todayIso, type PeriodView } from './cardModel';
import FaceBody, { shownFace } from './faces/FaceBody';
import { label } from './faces/parts';
import { cardSubtitle, cardTitle, planWord } from './features';
import { notReadyBody } from './notReady';
import PeriodStrip from './PeriodStrip';
import { swipeHandlers, useCardView } from './useCardView';
import { FACE_WIRE, V3_WORDS } from './words';

/** what the board lets a card show (doc 75 feature switches) */
export interface CardAllowed {
  short: boolean;
  periods: boolean;
  keyDates: boolean;
  why: boolean;
  confirm: boolean;
}

export const ALL_ALLOWED: CardAllowed = { short: true, periods: true, keyDates: true, why: true, confirm: true };

export interface CardProps {
  card: SelfV3CardView;
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
  options,
  hasOwn = false,
  confirmOn = true,
  motion = true,
  voice = 'gentle',
  allowed = ALL_ALLOWED,
  lockedPlan = null,
  onOptions,
  onWhy,
  chat,
  onRefresh,
  focused = false,
  veil = true,
  reading,
}: CardProps & { variant: 'seasons' | 'compact' }) {
  const view = useCardView(card, voice);
  const compact = variant === 'compact';
  const title = cardTitle(card);
  const subtitle = cardSubtitle(card);
  const face = shownFace(options.face, allowed.short);
  const chips = allowed.periods ? view.chips : [];
  const period = allowed.periods ? view.period : (view.periods.find((p) => p.current && p.own) ?? null);
  const headline = headlineOf(card, period, voice);
  const notReady = lockedPlan ? null : notReadyBody(card, veil, reading);
  const panelId = `card-body-${card.id}`;
  const prev = neighbour(view.periods, view.selected, -1);
  const next = neighbour(view.periods, view.selected, 1);
  const swipe = swipeHandlers(
    () => allowed.periods && prev !== null && view.select(prev),
    () => allowed.periods && next !== null && view.select(next),
  );
  const ready = !lockedPlan && !notReady;

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
            {allowed.why && onWhy && (
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

  const body = (
    <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
      {(allowed.short || chips.length > 1) && (
        <div className="flex min-w-0 shrink-0 flex-col gap-1.5">
          {allowed.short && <CardToolbar cardId={card.id} face={face} onFace={(f) => onOptions({ face: FACE_WIRE[f] })} hasOwn={hasOwn} />}
          <PeriodStrip cardId={card.id} periods={view.periods} chips={chips} selected={view.selected} onSelect={view.select} panelId={panelId} />
        </div>
      )}
      {card.datesPassed && (
        <p role="status" className="flex shrink-0 flex-wrap items-center gap-x-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-[13px] text-amber-100" data-testid="card-dates-passed">
          {V3_WORDS.datesPassed}
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="font-semibold underline underline-offset-4" data-testid="card-refresh">
              {V3_WORDS.refresh}
            </button>
          )}
        </p>
      )}
      {card.status === 'stale' && <p className="shrink-0 text-center text-[13px] text-white/55" data-testid="card-stale">{V2_WORDS.cardStale}</p>}
      <p key={`h-${view.selected ?? -1}`} className={`self-v3-fade shrink-0 text-center font-bold leading-snug text-white ${compact ? 'text-lg' : 'text-[22px] sm:text-2xl'}`} data-testid="card-line">
        {headline}
      </p>
      <div
        id={panelId}
        role={chips.length > 1 ? 'tabpanel' : undefined}
        className="self-v3-scroll min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]"
        data-testid="card-body"
        {...swipe}
        tabIndex={0}
        aria-label={`${title}, more`}
      >
        <div className="self-v3-column mx-auto w-full max-w-[72ch] space-y-4 px-1 pb-1">
          <FaceBody face={face} card={card} periods={view.periods} period={period} standing={view.standing} />
          {face === 'read' && allowed.keyDates && <KeyDates card={card} />}
        </div>
      </div>
    </div>
  );

  return (
    <article
      className={`glass self-v3-card self-v3-${variant} flex h-full min-h-0 flex-col rounded-2xl ${cardAccentClass(card.id)} ${focused ? 'ring-1 ring-teal-300/40' : ''}`}
      data-testid={`v3-card-${card.id}`}
      data-status={card.status}
      data-state={card.state}
      data-template={variant}
      data-face={face}
      data-locked={lockedPlan ? 'true' : 'false'}
      aria-label={title}
    >
      {header}
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-2 xl:px-5">
        <SensitiveNote card={card} />
        {locked || notReady || body}
        {ready && <CardFooter card={card} confirmOn={confirmOn && allowed.confirm} />}
      </div>
    </article>
  );
}
