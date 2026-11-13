/**
 * One Self v3 card, for both templates. From the top: the card's art band, the title row with the toolbar (faces and
 * tools), the period strip, the open tool panels, then a centred reading column (headline and the face on screen,
 * up to 72 characters wide) and the slim footer ("Is this right?", Chart details). The old right-hand "Your year"
 * column is gone: the periods live in the strip and the dots, and a swipe moves between them.
 *
 * The card reads its options (face, tools, grouping, start) from `options`, already merged with the board's settings;
 * a change goes up through `onOptions` and the board saves it. Nothing here calls the network.
 */
import type { ReactNode } from 'react';
import { CARD_TOOLS, type CardOptions, type CardTool } from '../../../lib/cardOptions';
import type { SelfV3CardView, SpanReading } from '../../../lib/selfV3Api';
import { V2_WORDS } from '../v2/words';
import { CardBanner, cardAccentClass } from './CardBanner';
import CardFooter from './CardFooter';
import { SensitiveNote, cardHeadline, type CardReading } from './CardParts';
import CardToolbar from './CardToolbar';
import { neighbour, type FaceProps, type ToolProps } from './cardModel';
import FaceBody from './faces/FaceBody';
import ToolPanels from './faces/ToolPanels';
import { notReadyBody } from './notReady';
import PeriodStrip, { PeriodDots } from './PeriodStrip';
import { swipeHandlers, useCardView, useCoarsePointer } from './useCardView';

export interface CardProps {
  card: SelfV3CardView;
  /** the options in force: the card's own choices over the board's over the defaults */
  options: CardOptions;
  /** true when the card keeps choices of its own (a dot on the toolbar) */
  hasOwn?: boolean;
  confirmOn?: boolean;
  motion?: boolean;
  onOptions: (patch: Partial<CardOptions>) => void;
  onDetails: (card: SelfV3CardView, span?: SpanReading | null, label?: string | null) => void;
  focused?: boolean;
  veil?: boolean;
  reading?: CardReading;
  /** evidence keys show only when the server marks the person a practitioner */
  showEvidence?: boolean;
  builtOn?: string | null;
}

export default function CardFrame({
  variant,
  card,
  options,
  hasOwn = false,
  confirmOn = true,
  motion = true,
  onOptions,
  onDetails,
  focused = false,
  veil = true,
  reading,
  showEvidence = false,
  builtOn = null,
}: CardProps & { variant: 'seasons' | 'compact' }) {
  const view = useCardView(card, options);
  const coarse = useCoarsePointer();
  const notReady = notReadyBody(card, veil, reading);
  const headline = cardHeadline(card);
  const compact = variant === 'compact';

  const toggleTool = (t: CardTool) => onOptions({ tools: CARD_TOOLS.filter((x) => (x === t ? !options.tools.includes(t) : options.tools.includes(x))) });
  const details = () => onDetails(card, view.period?.span ?? null, view.period?.item.label ?? null);
  const face: FaceProps = { card, periods: view.periods, period: view.period, onSelect: view.select, standing: view.standing, options, expanded: view.expanded, onExpanded: view.setExpanded, showEvidence };
  const tools: ToolProps = { ...face, coarse, onGroupBy: (groupBy) => onOptions({ groupBy }), builtOn, confirmOn };
  const prev = neighbour(view.periods, view.selected, -1);
  const next = neighbour(view.periods, view.selected, 1);
  const swipe = swipeHandlers(
    () => prev !== null && view.select(prev),
    () => next !== null && view.select(next),
  );

  const body: ReactNode = (
    <>
      <PeriodStrip cardId={card.id} periods={view.periods} selected={view.selected} onSelect={view.select} />
      {!compact && <ToolPanels {...tools} />}
      <div className="self-v3-scroll min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]" data-testid="card-body" {...swipe} tabIndex={0} aria-label={`${card.title}, more`}>
        <div className="self-v3-column mx-auto w-full max-w-[72ch] space-y-3 px-1 pb-1">
          {card.status === 'stale' && <p className="text-center text-xs text-white/55" data-testid="card-stale">{V2_WORDS.cardStale}</p>}
          <p className={`text-center font-bold leading-snug text-white ${compact ? 'text-lg' : 'text-[22px] sm:text-2xl'}`} data-testid="card-line">
            {headline}
          </p>
          <FaceBody {...face} />
        </div>
      </div>
      <PeriodDots periods={view.periods} selected={view.selected} onSelect={view.select} />
    </>
  );

  return (
    <article
      className={`glass self-v3-card self-v3-${variant} flex h-full min-h-0 flex-col rounded-2xl ${cardAccentClass(card.id)} ${focused ? 'ring-1 ring-teal-300/40' : ''}`}
      data-testid={`v3-card-${card.id}`}
      data-status={card.status}
      data-state={card.state}
      data-template={variant}
      data-face={options.face}
      aria-label={card.title}
    >
      <CardBanner cardId={card.id} motion={motion} height={compact ? 56 : undefined} className="self-v3-banner shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-2.5 xl:px-5">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="min-w-0">
            <h3 className={compact ? 'text-base font-bold text-white' : 'text-[13px] font-bold uppercase tracking-[0.08em] text-white/70'}>{card.title}</h3>
            {card.status === 'pending' && <p className="text-sm text-white/60">{card.description}</p>}
            <SensitiveNote card={card} />
          </div>
          {!notReady && (
            <CardToolbar cardId={card.id} face={options.face} onFace={(f) => onOptions({ face: f })} tools={options.tools} onTool={toggleTool} onDetails={details} hasOwn={hasOwn} variant={compact ? 'compact' : 'full'} />
          )}
        </header>
        {notReady ?? (
          <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-2.5">{body}</div>
        )}
        {!notReady && <CardFooter card={card} confirmOn={confirmOn} onDetails={details} compact={compact} />}
      </div>
    </article>
  );
}
