/**
 * The picker's design on the Self board: a card's art as a wide, short band (`CardBanner`) and as a small square for
 * the chips row (`CardThumb`), plus the class names that carry the card's category colours (`cardAccentClass`).
 *
 * Both are pure decoration: hidden from assistive technology and with no words of their own (the card prints its own
 * title). They draw the same gradient, backdrop, glyph and encrypted photo as the picker tile (CardArt); the photo
 * shows once `useLoadCardPhotos('self')` has run (the board calls it once), and until then, or when it is missing, the
 * gradient and glyph show. An unknown card id renders nothing and never throws.
 */
import type { CSSProperties } from 'react';
import CardArt from '../../../components/boardCards/CardArt';
import { selfGroupOf } from '../../../components/boardCards/cardArtRegistry';

/** the card's picker group (its colour family), or null for an id that is not a Self card */
export function cardGroupOf(cardId: string): string | null {
  return selfGroupOf(cardId);
}

/** `card-grp-<group>`: sets the card's --art-* colours on an element (a chip, a card), or '' for an unknown id */
export function cardGroupClass(cardId: string): string {
  const g = selfGroupOf(cardId);
  return g ? `card-grp-${g}` : '';
}

/**
 * The classes a card (or chip) takes for its category: the group colours (`card-grp-<group>`), the 3px top/left accent
 * edge (`card-accent`) and the faint corner glow (`card-art-glow`). '' for an unknown id.
 */
export function cardAccentClass(cardId: string): string {
  const g = cardGroupClass(cardId);
  return g ? `${g} card-accent card-art-glow` : '';
}

/** The band at the head of a board card: default 72 px (56 px on a window under 760 px tall, by CSS). */
export function CardBanner({
  cardId,
  height,
  motion = true,
  className = '',
  medallion = true,
}: {
  cardId: string;
  board?: 'self';
  /** px; omit for the responsive default (72, or 56 on a short window) */
  height?: number;
  /** the board-wide "turn animation" setting; false stops the backdrop drift */
  motion?: boolean;
  className?: string;
  /** the glyph medallion at the left (default on); the card's title can sit beside it on `.card-banner-ink` */
  medallion?: boolean;
}) {
  const group = selfGroupOf(cardId);
  if (!group) return null;
  const style: CSSProperties | undefined = height ? { height } : undefined;
  return (
    <CardArt
      id={cardId}
      group={group}
      size="banner"
      motion={motion}
      medallion={medallion}
      decorative
      testId={`card-banner-${cardId}`}
      className={`card-banner ${className}`.trim()}
      style={style}
    />
  );
}

/** A small square of the card's art for the chips row (default 28 px). */
export function CardThumb({ cardId, size = 28 }: { cardId: string; size?: number }) {
  const group = selfGroupOf(cardId);
  if (!group) return null;
  return (
    <CardArt
      id={cardId}
      group={group}
      size="thumb"
      centered
      decorative
      motion={false}
      testId={`card-thumb-${cardId}`}
      className="card-thumb"
      style={{ width: size, height: size }}
    />
  );
}

export default CardBanner;
