/**
 * One card in Template 2, Seasons (server docs/reading-engine/68 §4.2, card-faces plan): the art band, the toolbar, a
 * period strip and one centred reading column up to 72 characters wide, using the whole card. The "Your year" column
 * that took half the card is gone; CardFrame draws the card for both templates.
 */
import CardFrame, { type CardProps } from './CardFrame';

export { currentRail, spanFor } from './cardModel';
export { notReadyBody } from './notReady';

export const v3CardShell = 'glass self-v3-card flex h-full min-h-0 flex-col rounded-2xl';

export default function SeasonsCard(props: CardProps) {
  return <CardFrame variant="seasons" {...props} />;
}
