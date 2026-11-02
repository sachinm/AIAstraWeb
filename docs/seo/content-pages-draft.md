# SEO content pages: plan and three drafts for review (2026-11-02)

Status: drafts for Sachin to review. Nothing here is published or routed. The site has only the home page, pricing and the legal pages
today, so a search engine or an AI answer engine has nothing to quote about what people actually ask.

## Why

People search "Ashwini nakshatra traits", "Saturn mahadasha effects", "what is a dasha". A public page that answers each question plainly,
with its own title and description, is what search and AI answers cite. Each page ends with a short, honest route into the product
("ask about your own chart") and never shows or computes anyone's chart.

## What a page is

- URL `/learn/<topic>` (for example `/learn/nakshatra/ashwini`, `/learn/dasha/saturn`, `/learn/what-is-a-dasha`), one idea per page.
- Title up to 60 characters, description up to 155, one `h1`, short sections with `h2`, 400 to 700 words, a three-question FAQ.
- Structured data: `Article` plus `FAQPage` (the build already emits JSON-LD for the home page FAQ).
- Wording rule: classical and educational ("the tradition reads"), never a prediction about the reader, never advice. The education and
  entertainment line from the footer sits under every page.
- Links: each page links to its neighbours (the next nakshatra, the other dashas) and to the sign-up page.
- The Terms already say none of the text or imagery may be copied elsewhere without the site owner's permission.

## How it is built

1. A data file `src/pages/learn/topics.ts` holds the pages (slug, title, description, sections, faqs). No page is hand-coded.
2. One route component renders any topic. `PUBLIC_PAGES` in `src/lib/seoConfig.ts` is built from the same list, so the sitemap and the
   prerender (which writes real HTML for crawlers) pick them up with no extra code.
3. The queued Amplify rewrite-rule change (prerendered pages must be served as files) is a prerequisite: until it runs, crawlers get the
   app shell for these URLs too.
4. `sitemap.xml` is fixed in the same change; today it returns the app page.
5. `llms.txt` lists the topics for AI crawlers.

## First batch (about 30 pages, in this order)

1. What is a dasha; the Vimshottari dasha; antardasha and pratyantardasha (3).
2. The nine mahadashas, one per planet (9).
3. The first nine nakshatras, Ashwini to Ashlesha (9).
4. What is a birth chart (kundli), the lagna, the 12 houses, the 12 signs, divisional charts such as D9 (navamsa) and D10 (dashamsha) (5).
5. Sade sati, Rahu and Ketu, retrograde planets, Manglik (4).

Second batch: planets in houses (9 x 12 = 108), written only after the first batch shows which pages earn visits.

## Open decisions for Sachin

1. URL prefix `/learn` or `/astrology`.
2. Whether pages carry an author or review line (search engines weigh this).
3. Whether the home page tagline ("mastered on the ancient text unabridged and astrological celestial sky") stays as a heading. It is a claim,
   and every page that repeats it should be able to back it up.
4. Who reviews astrological accuracy before publishing. These drafts were written from standard references and were not checked by a practitioner.

---

# Draft 1: Ashwini nakshatra

**Title:** Ashwini Nakshatra: Meaning, Ruler and Traits | AI AdAstra

**Description:** Ashwini is the first of the 27 nakshatras in Vedic astrology: ruled by Ketu, symbolised by a horse's head. Its meaning, ruler and traits.

## Ashwini, the first nakshatra

In Vedic astrology (Jyotish) the sky along the ecliptic is divided into 27 lunar mansions called nakshatras. Ashwini is the first. It begins
at 0 degrees of Aries (Mesha) and ends at 13 degrees 20 minutes, so it sits entirely inside the sign Aries.

## At a glance

- **Ruling planet:** Ketu (the lord of its Vimshottari period).
- **Deity:** the Ashwini Kumaras, the twin physicians of the gods.
- **Symbol:** a horse's head.
- **Sign:** Aries (Mesha), ruled by Mars.
- **Padas (quarters):** four, each 3 degrees 20 minutes.
- **Nature:** light and swift (the tradition calls this group kshipra).

## What the tradition says

Texts link Ashwini with beginnings, speed, healing and initiative: the horse that sets off at once and the physicians who restore. People
whose Moon sits here are traditionally described as quick to act, direct, restless in routine and drawn to helping or repairing. Ashwini
is also read as a "starting line" star, so it is often cited for new ventures.

These are traditional readings of one factor. A full reading weighs the whole chart: the Moon's sign and strength, the planets aspecting it and the running dasha.

## Questions people ask

**Which planet rules Ashwini?** Ketu. It also decides where a person's Vimshottari dasha sequence begins if their Moon is in Ashwini.

**Which sign does Ashwini fall in?** Aries (Mesha), from 0 to 13 degrees 20 minutes.

**What does the horse's head mean?** Speed, vitality and the readiness to move; the Ashwini Kumaras are said to ride horses.

Next: Bharani, the second nakshatra. Ask about your own Moon nakshatra: start a free chart on AI AdAstra.

*For education and entertainment only. Not medical, legal, financial or other professional advice.*

---

# Draft 2: Saturn (Shani) mahadasha

**Title:** Saturn Mahadasha (Shani Dasha): 19 Years Explained | AI AdAstra

**Description:** The Saturn mahadasha lasts 19 years in the Vimshottari system. What the tradition says about discipline, delay and structure, and why the chart decides.

## The Saturn mahadasha

A mahadasha is a long planetary period. In the Vimshottari system, the most used in Jyotish, the Saturn mahadasha runs 19 years, the second longest
after Venus (20).

## What the tradition says

Saturn (Shani) is the planet of time, limits, duty and long effort. Its period is traditionally read as a stretch where work, responsibility
and consequences take centre stage: slow gains that last, tests of patience, and a pull toward structure and simplicity. Many texts add that
early years of the period can feel heavy and that results often arrive later.

## It depends on the chart

No period reads the same for two people. Jyotish looks at:

- the sign and house Saturn occupies, and its strength (Saturn is strong in Libra, weak in Aries);
- which houses Saturn owns;
- the sub-periods (antardashas) inside it, each coloured by another planet;
- where Saturn is now by transit (sade sati, a separate topic).

## Questions people ask

**How long is the Saturn mahadasha?** 19 years.

**What comes before and after it?** Jupiter's period (16 years) comes before and Mercury's (17 years) after, in the standard order.

**Is it always a hard period?** The tradition does not say so; a strong, well-placed Saturn is read as steady and rewarding. Always read it with the chart.

Next: Mercury mahadasha. Find your current period: start a free chart on AI AdAstra.

*For education and entertainment only. Not medical, legal, financial or other professional advice.*

---

# Draft 3: What is a dasha?

**Title:** What Is a Dasha? Vimshottari Periods Explained | AI AdAstra

**Description:** A dasha is a planetary period that times events in Vedic astrology. The Vimshottari system's 120-year cycle, the nine planets and how to read it.

## What a dasha is

In Vedic astrology a birth chart shows what a life contains; a **dasha** is the period system that shows when each part comes into play.
The word means "state" or "period". Each period is ruled by a planet, and for its length that planet's themes lead.

## The Vimshottari dasha

Vimshottari, "120 years", is the system most Jyotish readings use. Every life is placed inside one 120-year cycle shared by nine planets:

| Planet | Years |
|---|---|
| Ketu | 7 |
| Venus | 20 |
| Sun | 6 |
| Moon | 10 |
| Mars | 7 |
| Rahu | 18 |
| Jupiter | 16 |
| Saturn | 19 |
| Mercury | 17 |

The periods always follow this order. The years add up to 120.

## Where a person starts

The starting planet is the ruler of the Moon's nakshatra at birth. Someone born with the Moon in Ashwini (ruled by Ketu) begins in Ketu's period;
how much of that period is left at birth depends on how far the Moon had travelled through the nakshatra.

## Three levels

- **Mahadasha:** the main period (years).
- **Antardasha (bhukti):** a sub-period inside it, ruled by each of the nine planets in turn (months to years).
- **Pratyantardasha:** a sub-sub-period (weeks to months).

## Questions people ask

**Is the dasha the same as a transit?** No. A dasha follows a fixed timetable set by the birth chart; a transit is where the planets are in the sky now. Readings combine both.

**Are there other systems?** Yes. Jyotish uses dozens (Yogini, Chara and others); Vimshottari is the common starting point.

Next: the nine mahadashas. Find your own current period: start a free chart on AI AdAstra.

*For education and entertainment only. Not medical, legal, financial or other professional advice.*
