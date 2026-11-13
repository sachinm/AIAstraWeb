/**
 * One card in Template 1, Compact (server docs/reading-engine/68 §4.2): four across at tablet landscape, filled from the
 * same card view as Seasons. A short art band, a face menu, the period strip, the reading and the slim footer. Only the
 * card's body scrolls, inside the card. CardFrame draws the card for both templates.
 */
import CardFrame, { type CardProps } from './CardFrame';

export default function CompactCard(props: CardProps) {
  return <CardFrame variant="compact" {...props} />;
}
