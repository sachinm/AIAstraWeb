/**
 * The Astrology Reading tab of a card on tablet and desktop (server plan revision 2 §6): the Oracle's technical story,
 * `card.v3.story`, as readable prose (paragraphs, a ~72-character measure, no headings), and under it a small "AdAstra
 * AI read" list from `card.v3.systems` (each system's plain label and the period running today: "Life chapters · Saturn ·
 * until 27 Dec 2027"; the internal system key is never shown). Until the story is served the tab says it is being prepared.
 *
 * A served reading field is never hidden: the card's older long reading (its v2 chart details) is shown here too, under
 * the story or under the waiting line. The short chart sentences (the gift, the knot, how sure, what the chart shows)
 * are Outlook's "The gift and the knot" section. Nothing is computed here.
 */
import type { AreaCertainty } from '../../../lib/boardTypes';
import type { CardSystemView, SelfV3CardView } from '../../../lib/selfV3Api';
import { ChartDetails, hasChartDetails } from '../../../components/board/ChartDetails';
import { CERTAINTY_WORD } from '../../../components/board/words';
import { dayWords, type PeriodView } from './cardModel';
import { cardDetails } from './CardViews';
import { label } from './faces/parts';
import { OUTLOOK_WORDS } from './words';

/** the certainty word for a stored enum; null for anything the page has no word for */
export function certaintyWord(certainty: string | null | undefined): string | null {
  const key = certainty?.trim().toLowerCase();
  return key && Object.prototype.hasOwnProperty.call(CERTAINTY_WORD, key) ? CERTAINTY_WORD[key as AreaCertainty] : null;
}

/**
 * Served text with the stored span ids taken out ("Mixed periods (s1): …" → "Mixed periods: …"). The ids are internal
 * keys; the server should not write them into prose (filed in the server's TODOS), and the page never shows them.
 */
export function withoutSpanIds(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/[ \t]*\((?:span\s*)?s\d+\)/gi, '')
    .replace(/\b(?:span[ \t]+)?s\d+\b[ \t]*/gi, '')
    .replace(/[ \t]+([,.:;])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** what the chart shows for the picked stretch: matched by its span id, with any span id taken out of the text */
export function chartShows(card: SelfV3CardView, period: PeriodView | null): string | null {
  const id = period?.span?.span ?? period?.item.span ?? null;
  if (!id) return null;
  return withoutSpanIds(card.v3?.chart?.spans?.find((s) => s?.span === id)?.shows) || null;
}

/** a served story's paragraphs (blank-line separated), span ids taken out; [] when there is none */
export function storyParagraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => withoutSpanIds(p.replace(/\s*\n\s*/g, ' ')))
    .filter(Boolean);
}

/** a story as prose: paragraphs on a readable measure */
export function StoryProse({ text, testId }: { text: string | null | undefined; testId: string }) {
  const paras = storyParagraphs(text);
  if (!paras.length) return null;
  return (
    <div className="max-w-[72ch] space-y-3" data-testid={testId}>
      {paras.map((p, i) => (
        <p key={i} className="text-[15px] leading-relaxed text-white/85">
          {p}
        </p>
      ))}
    </div>
  );
}

/** true when the plain story is being written again and none is served yet (server `plain.pending`) */
export function plainPending(card: SelfV3CardView): boolean {
  return card.v3?.plain?.pending === true && !storyParagraphs(card.v3?.plain?.story).length;
}

/** the plain story under the headline, or a calm line while it is being written; nothing when neither */
export function PlainStory({ card }: { card: SelfV3CardView }) {
  if (plainPending(card))
    return (
      <p className="text-[15px] italic text-white/60" role="status" data-testid="plain-pending">
        {OUTLOOK_WORDS.plainPending}
      </p>
    );
  return <StoryProse text={card.v3?.plain?.story} testId="outlook-plain-story" />;
}

/** the systems a card's story read that have a plain name to show (the internal key is never shown) */
export function systemsRead(card: SelfV3CardView): CardSystemView[] {
  return (card.v3?.systems ?? []).filter((s): s is CardSystemView => !!s && typeof s.label === 'string' && !!s.label.trim());
}

/** what is running on one system, in words: "Saturn · until 27 Dec 2027", "Saturn" with no end date, '' with none */
export function systemRunning(s: Pick<CardSystemView, 'running'>): string {
  const lord = s.running?.lord?.trim();
  if (!lord) return '';
  const to = s.running?.to?.trim();
  return to ? `${lord} · ${OUTLOOK_WORDS.until(dayWords(to))}` : lord;
}

/** "AdAstra AI read": each system the story read, by its plain name, with the period running today */
export function SystemsRead({ card, testId = 'astrology-systems' }: { card: SelfV3CardView; testId?: string }) {
  const systems = systemsRead(card);
  if (!systems.length) return null;
  return (
    <section data-testid={testId}>
      <h4 className={label}>{OUTLOOK_WORDS.systemsRead}</h4>
      <ul className="mt-1.5 grid gap-1 text-[14px]">
        {systems.map((s, i) => {
          const running = systemRunning(s);
          return (
            <li key={`${s.label}-${i}`} className="flex flex-wrap gap-x-2" data-testid="astrology-system">
              <b className="shrink-0 font-semibold text-white/90">{s.label.trim()}</b>
              {running && <span className="text-white/65">· {running}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** true when the card carries its older long reading (v2 chart details) */
export function hasLongReading(card: SelfV3CardView): boolean {
  return hasChartDetails(cardDetails(card));
}

export default function AstrologyView({ card, showDetails = true }: { card: SelfV3CardView; period?: PeriodView | null; showDetails?: boolean }) {
  const story = storyParagraphs(card.v3?.story);
  const longReading = showDetails && hasLongReading(card);
  return (
    <div className="self-v3-fade self-v3-astrology space-y-5" data-testid="astrology-view">
      {story.length ? (
        <StoryProse text={card.v3?.story} testId="astrology-story" />
      ) : (
        <p className="text-center text-[15px] text-white/60" data-testid="astrology-empty">
          {OUTLOOK_WORDS.storyPending}
        </p>
      )}
      <SystemsRead card={card} />
      {longReading && (
        <section data-testid="astrology-details">
          <h4 className={label}>{OUTLOOK_WORDS.fullReading}</h4>
          <div className="mt-1.5">
            <ChartDetails details={cardDetails(card)!} showEvidence={false} emptyLine={false} />
          </div>
        </section>
      )}
    </div>
  );
}
