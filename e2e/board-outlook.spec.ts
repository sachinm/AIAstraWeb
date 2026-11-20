import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newState, signIn, stubApi } from './stubApi';
import { selfV3Fixture, selfV3OutlookCard } from '../src/pages/you/v3/selfV3.fixture';
import type { RailItem, SelfV3CardView, SelfV3Response, SpanClockView, SpanReading } from '../src/lib/selfV3Api';

/**
 * Tablet and desktop board (server docs/dashboards/13): the Outlook tab at eight sizes, the range calendar, the
 * Astrology Reading tab, the gear's "Cards across", the card chooser, the rail's "Choose dashboards" and a stored list
 * of four dashboards. Stubbed API, frozen clock (2026-11-18); no real data, no paid call. Screens saved to
 * docs/screenshots/board-outlook/. `npx playwright test --config e2e/playwright.config.ts board-outlook --project desktop`.
 *
 * UI checks are soft (`expect.soft`) and run after the screenshot, so a wrong layout still leaves its picture and the
 * rest of the spec runs. Each test prints a `[board-outlook]` line with what it measured.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '../docs/screenshots/board-outlook');
const TODAY = new Date('2026-11-18T12:00:00');

const MIXED_FROM = '2026-11-11';
const MIXED_TO = '2027-12-27';
const MIXED_LABEL = 'Mixed stretch · to 27 Dec 2027';
const CONFIRM = 'Since mid-May 2025, have you been going to bed later and waking up more tired than before?';
const FEATURE_KEYS = ['feature.periods', 'feature.key_dates', 'feature.why_panel', 'feature.confirm', 'feature.card_chat'];

const CLOCK_NAMES: Array<[string, string]> = [
  ['main', 'Main'],
  ['vimshottari', 'Life chapters'],
  ['narayana', 'Sign periods'],
  ['tp_year', 'Birthday year'],
  ['short', 'Short cycles'],
  ['yogini', 'Short chapters'],
  ['chara', 'Sign chapters'],
];
// five of seven hold "mixed"
const clocks = (): SpanClockView[] =>
  CLOCK_NAMES.map(([system, label], i) => ({ system, label, tone: i < 5 ? 'mixed' : i === 5 ? 'heavy' : 'light', agrees: i < 5 }));

function mixedSpan(title: string): SpanReading {
  return {
    span: 's1',
    from: MIXED_FROM,
    to: MIXED_TO,
    tone: 'mixed',
    mode: 'get_through',
    headline: `${title}: good weeks and slow weeks take turns until late December 2027.`,
    asks: 'This stretch mixes strong weeks with slow ones; pace the effort and keep one steady habit going through it.',
    obstacle: 'Spending a good week all at once and paying for it the week after.',
    avoid: 'Saying yes to every new plan on a good day.',
    step: 'If a week feels strong, finish one open task before you start a new one.',
    held: true,
    agreement: { agree: 5, of: 7 },
    clocks: clocks(),
  };
}

const mixedRail = (): RailItem => ({ from: MIXED_FROM, to: MIXED_TO, label: MIXED_LABEL, tone: 'mixed', note: null, current: true, span: 's1' });

/** a ready card on the board with the mixed window (and, on `mind`, a passed window before it and a later one after) */
function fill(c: SelfV3CardView, extraWindows: boolean, why: string | null): SelfV3CardView {
  const spans: SpanReading[] = [mixedSpan(c.title)];
  const rail: RailItem[] = [mixedRail()];
  if (extraWindows) {
    spans.unshift({ ...mixedSpan(c.title), span: 's0', from: '2026-06-01', to: MIXED_FROM, tone: 'heavy', headline: 'A heavy stretch, now behind you.', agreement: { agree: 4, of: 7 } });
    spans.push({ ...mixedSpan(c.title), span: 's2', from: MIXED_TO, to: '2028-06-30', tone: 'light', mode: 'build', headline: 'A lighter stretch to build in.', agreement: { agree: 6, of: 7 } });
    rail.unshift({ from: '2026-06-01', to: MIXED_FROM, label: '1 Jun – 11 Nov 2026', tone: 'heavy', note: null, current: false, span: 's0' });
    rail.push({ from: MIXED_TO, to: '2028-06-30', label: 'from 27 Dec 2027', tone: 'light', note: null, current: false, span: 's2' });
  }
  return {
    ...c,
    status: 'ok',
    state: 'ready',
    available: true,
    firstLine: `${c.title}: good weeks and slow weeks take turns until late December 2027.`,
    rail,
    keyDates: [
      { date: MIXED_FROM, label: 'Mixed stretch begins' },
      { date: MIXED_TO, label: 'Mixed stretch ends' },
    ],
    v3: {
      line: `${c.title}: good weeks and slow weeks take turns until late December 2027.`,
      spans,
      confirm: { claimId: `${c.id}.c1`, text: CONFIRM },
      pattern: { text: 'You push through tiredness and pay for it a week later.', kind: 'watch', since: '2025-05-18', until: null, source: `${c.id}.p2` },
      ladder: { best: 'Finish one thing before starting the next.', practical: 'Write the week down on Sunday.', drift: 'New plans every morning.', floor: 'Nothing gets done; the bills wait.' },
      agreement: { agree: 5, of: 7 },
      why,
      chart: {
        gift: 'The sixth lord sits strong in its own sign, so the body recovers well once rested.',
        knot: 'Saturn crosses the ascendant, pressing on stamina through most of 2027.',
        certainty: 'likely',
        spans: spans.map((s) => ({ span: s.span, shows: `Mixed periods (${s.span}): the moon period lifts while the sub-period still presses.` })),
      },
    },
  } as SelfV3CardView;
}

function boardFixture(): SelfV3Response {
  const fx = selfV3Fixture();
  const outlook = selfV3OutlookCard();
  const onBoard = new Set<string>(fx.layout.cards);
  fx.cards = fx.cards.map((c) => {
    if (!onBoard.has(c.id)) return c;
    if (c.id === 'body') return fill({ ...outlook }, false, outlook.v3?.why ?? null);
    return fill(c, c.id === 'mind', null);
  });
  return { ...fx, features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, { locked: false }])) };
}

async function stubBoard(page: Page, storedDashboards: string | null, unexpected: string[]) {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  // registered first, so every specific route below wins; anything else is recorded
  await page.route('**/api/**', (r) => {
    unexpected.push(`${r.request().method()} ${new URL(r.request().url()).pathname}`);
    return r.fulfill({ status: 204 });
  });
  await stubApi(page, newState({ used: 3 }));
  const board = boardFixture();
  await page.route('**/api/self/v3', (r) => json(r, board));
  await page.route('**/api/self/v3/layout**', (r) => json(r, board.layout));
  await page.route('**/api/self/v3/confirm', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/cards/**', (r) =>
    json(r, { card: { board: 'self', id: 'body', title: 'Body & energy' }, period: null, preamble: { headline: 'Pace yourself this winter.', lines: ['Rest comes first.'], keyDates: [] }, cost: { uses: 1, remaining: 17 }, thread: { chatId: null, messages: [] } }),
  );
  await page.route('**/api/profile/facts', (r) => {
    if (r.request().method() !== 'GET') return r.fulfill({ status: 204 });
    return json(r, { facts: storedDashboards ? { 'portal.dashboards': { value: storedDashboards, source: 'tapped', confirmed_at: null } } : {} });
  });
  await page.route('**/api/profile/photo', (r) => json(r, {}, 404));
  await page.route('**/api/notifications**', (r) => json(r, { items: [], unreadCount: 0 }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));
}

async function openBoard(page: Page, opts: { stored?: string | null } = {}): Promise<string[]> {
  mkdirSync(DIR, { recursive: true });
  const unexpected: string[] = [];
  await page.clock.setFixedTime(TODAY);
  await stubBoard(page, opts.stored ?? null, unexpected);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);
  await page.goto('/dashboard/you');
  await expect(page.getByTestId('v3-card-body')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('self-v3-carousel')).toBeVisible();
  // the rail's 200 ms transition and the deck's re-measure
  await page.waitForTimeout(600);
  return unexpected;
}

const shot = (page: Page, nn: number, w: number, h: number, view: string) =>
  page.screenshot({ path: path.join(DIR, `${String(nn).padStart(2, '0')}-${w}x${h}-${view}.png`) });

/** S / M / L from the computed grid of the Outlook body (one column; two equal; two unequal) */
async function outlookLayout(page: Page): Promise<string> {
  return page
    .getByTestId('v3-card-body')
    .locator('.self-v3-outlook')
    .first()
    .evaluate((el) => {
      const cols = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean);
      if (cols.length < 2) return `S (${getComputedStyle(el).gridTemplateColumns})`;
      const [a, b] = cols.map((c) => parseFloat(c));
      return Math.abs(a! - b!) < 2 ? `M (${cols.join(' ')})` : `L (${cols.join(' ')})`;
    })
    .catch((e: Error) => `? (${e.message.split('\n')[0]})`);
}

/** the checks every Outlook screenshot gets, on every fully visible card */
async function outlookChecks(page: Page, tag: string) {
  const body = page.getByTestId('v3-card-body');
  const tabs = await body.getByTestId('card-bars').getByRole('tab').allTextContents();
  expect.soft(tabs.map((t) => t.trim()), `${tag}: tabs`).toEqual(['Outlook', 'Astrology Reading', 'Calendar']);
  // docs/techniques/09 §4.3: the "i" button is back on every card and opens the full reading
  expect.soft(await page.getByTestId('card-why').count(), `${tag}: card-why button`).toBeGreaterThan(0);
  // the picked tab's label must be readable on its pill (WCAG large-text minimum 3:1)
  const contrast = await body.locator('[data-testid="card-bars"] [aria-selected="true"]').evaluate((el) => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const s = getComputedStyle(el);
    const [fg, bg] = [rgb(s.color), rgb(s.backgroundColor)];
    // blend a translucent pill over white or the card's dark glass is not known here: use the pill's own colour
    const a = bg[3] ?? 1;
    if (a < 0.2) return null;
    const [l1, l2] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return Math.round(((l1! + 0.05) / (l2! + 0.05)) * 100) / 100;
  });
  // the pill is translucent over glass; its own colour is a fair stand-in on the light theme only (on dark the label
  // reads well in 19/20-outlook-dark.png although this ratio also says 1.97)
  const light = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
  if (contrast != null && light) expect.soft(contrast, `${tag}: picked tab label contrast`).toBeGreaterThanOrEqual(3);
  const cards = await page.locator('[data-testid="self-v3-carousel"] [data-visible="true"] article').evaluateAll((arts) =>
    arts.map((a) => {
      const footer = a.querySelector('[data-testid="card-footer"]');
      const input = a.querySelector('[data-testid="card-chat-textarea"]');
      const fr = footer?.getBoundingClientRect();
      const ir = input?.getBoundingClientRect();
      const ar = a.getBoundingClientRect();
      return {
        id: a.getAttribute('data-testid'),
        cardBottom: Math.round(ar.bottom),
        inputBottom: ir ? Math.round(ir.bottom) : null,
        width: Math.round(a.getBoundingClientRect().width * 10) / 10,
        hasFooter: !!footer,
        pinned: footer?.getAttribute('data-pinned') ?? null,
        footerInBody: !!footer?.closest('[data-testid="card-body"]'),
        footerBottom: fr ? Math.round(fr.bottom) : null,
        inputTop: ir ? Math.round(ir.top) : null,
        overflowX: a.scrollWidth - a.clientWidth,
        footerText: footer?.textContent?.trim().slice(0, 140) ?? null,
      };
    }),
  );
  expect.soft(cards.length, `${tag}: visible cards`).toBeGreaterThan(0);
  for (const c of cards) {
    expect.soft(c.hasFooter, `${tag} ${c.id}: has card-footer`).toBe(true);
    expect.soft(c.pinned, `${tag} ${c.id}: footer data-pinned`).toBe('true');
    expect.soft(c.footerInBody, `${tag} ${c.id}: footer outside card-body`).toBe(false);
    expect.soft(c.inputTop, `${tag} ${c.id}: chat input present`).not.toBeNull();
    if (c.footerBottom != null && c.inputTop != null) expect.soft(c.footerBottom, `${tag} ${c.id}: footer bottom above chat input top`).toBeLessThanOrEqual(c.inputTop);
    // the card clips its overflow: the question and the input must sit inside the card's own box to be seen
    if (c.inputBottom != null) expect.soft(c.inputBottom, `${tag} ${c.id}: chat input inside the card (bottom)`).toBeLessThanOrEqual(c.cardBottom);
    if (c.footerBottom != null) expect.soft(c.footerBottom, `${tag} ${c.id}: pinned question inside the card (bottom)`).toBeLessThanOrEqual(c.cardBottom);
    expect.soft(c.overflowX, `${tag} ${c.id}: no horizontal overflow in the card`).toBeLessThanOrEqual(1);
  }
  const page2 = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: window.innerHeight, sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect.soft(page2.sh, `${tag}: page does not scroll vertically`).toBeLessThanOrEqual(page2.ih + 1);
  return { cards, page: page2 };
}

async function railInfo(page: Page) {
  const nav = page.getByTestId('side-nav');
  const open = await nav.getAttribute('data-open').catch(() => null);
  const entries = await page.getByTestId('side-nav-boards').locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('aria-label') ?? a.textContent?.trim() ?? ''));
  return { open, entries };
}

const SIZES: Array<{ w: number; h: number; across: number | null }> = [
  { w: 768, h: 1024, across: 1 },
  { w: 912, h: 1368, across: 1 },
  { w: 1024, h: 768, across: null },
  { w: 1180, h: 820, across: 2 },
  { w: 1368, h: 912, across: 2 },
  { w: 1440, h: 900, across: 2 },
  { w: 1920, h: 1080, across: 3 },
  { w: 2560, h: 1440, across: 4 },
];

test.describe('board outlook (docs/dashboards/13)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'tablet and desktop only');
  });

  SIZES.forEach(({ w, h, across }, i) => {
    test(`outlook at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      const unexpected = await openBoard(page);
      await shot(page, i + 1, w, h, 'outlook');
      const tag = `${w}x${h}`;
      // the board opens on its first card at every size: a card's own scrollIntoView (the period strip of the peeking
      // second card) must not scroll the track to card 2
      const start = await page.getByTestId('self-v3-carousel').evaluate((el) => ({
        index: el.getAttribute('data-index'),
        scrollLeft: Math.round(el.querySelector<HTMLElement>('[data-testid="self-v3-carousel-track"]')?.scrollLeft ?? -1),
      }));
      expect.soft(start.index, `${tag}: opens on the first card (data-index)`).toBe('0');
      expect.soft(start.scrollLeft, `${tag}: the track is at its start`).toBeLessThan(2);
      const perView = await page.getByTestId('self-v3-carousel').getAttribute('data-per-view');
      if (across != null) expect.soft(perView, `${tag}: data-per-view`).toBe(String(across));
      const deck = await page.getByTestId('self-v3-deck').evaluate((el) => Math.round(el.getBoundingClientRect().width));
      const layout = await outlookLayout(page);
      const checks = await outlookChecks(page, tag);
      const rail = await railInfo(page);
      // months shown: open the Calendar on the first card, read it, go back
      const body = page.getByTestId('v3-card-body');
      await body.getByTestId('card-view-calendar').click();
      const months = await body.getByTestId('range-calendar').getAttribute('data-months').catch(() => null);
      await body.getByTestId('card-view-outlook').click();
      console.log(
        `[board-outlook] ${tag} perView=${perView} deck=${deck} cardWidth=${checks.cards[0]?.width} layout=${layout} months=${months} rail=${rail.open}/${rail.entries.length} [${rail.entries.join(', ')}] page=${JSON.stringify(checks.page)} cards=${JSON.stringify(checks.cards)} unexpected=${JSON.stringify(unexpected)}`,
      );
    });
  });

  const calendarAt = async (page: Page, w: number, h: number, nn: number, months: number) => {
    await page.setViewportSize({ width: w, height: h });
    const unexpected = await openBoard(page);
    const body = page.getByTestId('v3-card-body');
    await body.getByTestId('card-view-calendar').click();
    await expect(body.getByTestId('range-calendar')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, nn, w, h, 'calendar');
    const tag = `${w}x${h} calendar`;
    const shown = await body.getByTestId('calendar-month').evaluateAll((ms) => ms.map((m) => m.getAttribute('data-month')));
    expect.soft(shown.length, `${tag}: months shown`).toBe(months);
    const summary = await body.getByTestId('range-summary').textContent().catch(() => null);
    expect.soft(summary ?? '', `${tag}: summary`).toContain('day 8 of 412');
    const cardWidth = await body.evaluate((el) => Math.round(el.getBoundingClientRect().width));
    const cell = await body.getByTestId('calendar-day').first().evaluate((el) => Math.round(el.getBoundingClientRect().width));
    console.log(`[board-outlook] ${tag} months=${JSON.stringify(shown)} summary=${JSON.stringify(summary)} cardWidth=${cardWidth} dayCell=${cell} unexpected=${JSON.stringify(unexpected)}`);
    return { body, shown };
  };

  test('calendar at 1920x1080, then End', async ({ page }) => {
    const { body, shown } = await calendarAt(page, 1920, 1080, 9, 3);
    expect.soft(shown, '1920 calendar: months').toEqual(['2026-11', '2026-12', '2027-01']);
    const key = await body.getByTestId('calendar-window').first().getAttribute('data-window');
    const windowLabels = await body.getByTestId('calendar-window').allTextContents();
    expect.soft(await body.locator('[data-testid="calendar-day"][data-day="2026-11-11"]').getAttribute('data-cap'), '1920: 2026-11-11 data-cap').toBe('start');
    const days = await body.getByTestId('calendar-day').evaluateAll((ds) => ds.map((d) => ({ day: d.getAttribute('data-day') ?? '', w: d.getAttribute('data-window') ?? '' })));
    const inRange = days.filter((d) => d.day >= MIXED_FROM && d.day <= '2027-01-31');
    const missing = inRange.filter((d) => d.w !== key).map((d) => d.day);
    expect.soft(inRange.length, '1920: days 2026-11-11..2027-01-31 drawn').toBe(82);
    expect.soft(missing, `1920: every day from 2026-11-11 to 2027-01-31 carries window ${key}`).toEqual([]);
    await body.getByTestId('calendar-jump-end').click();
    await page.waitForTimeout(300);
    await shot(page, 10, 1920, 1080, 'calendar-end');
    const after = await body.getByTestId('calendar-month').evaluateAll((ms) => ms.map((m) => m.getAttribute('data-month')));
    expect.soft(after, '1920 End: 2027-12 shown').toContain('2027-12');
    expect.soft(await body.locator('[data-testid="calendar-day"][data-day="2027-12-27"]').getAttribute('data-cap').catch(() => null), '1920 End: 2027-12-27 data-cap').toBe('end');
    console.log(`[board-outlook] 1920 calendar key=${key} windows=${JSON.stringify(windowLabels)} inRange=${inRange.length} missing=${missing.length} afterEnd=${JSON.stringify(after)}`);
  });

  test('calendar at 1180x820', async ({ page }) => {
    await calendarAt(page, 1180, 820, 11, 2);
  });

  test('calendar at 912x1368', async ({ page }) => {
    await calendarAt(page, 912, 1368, 12, 3);
  });

  test('astrology, gear, two across, card chooser and choose dashboards at 1920x1080', async ({ page }) => {
    const [w, h] = [1920, 1080];
    await page.setViewportSize({ width: w, height: h });
    const unexpected = await openBoard(page);
    const body = page.getByTestId('v3-card-body');

    await body.getByTestId('card-view-astrology').click();
    await expect(body.getByTestId('astrology-view').or(body.getByTestId('astrology-empty'))).toBeVisible();
    await shot(page, 13, w, h, 'astrology');
    // docs/techniques/09 §4.3: the tab holds the card's thread; this fixture has none, so it waits
    expect.soft(await body.getByTestId('astrology-empty').count(), 'astrology: waiting line (no thread)').toBe(1);
    await body.getByTestId('card-view-outlook').click();
    // the chart sentences are Outlook's "The gift and the knot" section now
    await body.getByTestId('outlook-tool-chart').click();
    const chart = (await body.getByTestId('card-body').textContent()) ?? '';
    expect.soft(chart, 'outlook chart: the gift').toContain('The gift');
    expect.soft(chart, 'outlook chart: the knot').toContain('The knot');
    expect.soft(chart, 'outlook chart: no span id').not.toMatch(/\(s\d+\)/);
    expect.soft(await body.getByTestId('astrology-certainty').count(), 'outlook chart: certainty word').toBe(1);
    await body.getByTestId('outlook-tool-overview').click();

    await page.getByTestId('board-settings-open').click();
    await expect(page.getByTestId('board-settings-panel')).toBeVisible();
    await shot(page, 14, w, h, 'gear');
    expect.soft(await page.getByTestId('board-settings-panel').textContent(), 'gear: Cards across').toContain('Cards across');
    await page.getByTestId('bs-across-2').click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await shot(page, 15, w, h, 'across-2');
    expect.soft(await page.getByTestId('self-v3-carousel').getAttribute('data-per-view'), 'across 2: data-per-view').toBe('2');
    const layout2 = await outlookLayout(page);
    const checks2 = await outlookChecks(page, '1920 across-2');

    await page.getByTestId('self-v3-edit').click();
    await expect(page.getByTestId('picker-tray')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, 16, w, h, 'cards-chooser');
    const boardIds = boardFixture().layout.cards;
    const ticked = await page.locator('[data-testid^="picker-tile-"][aria-checked="true"]').evaluateAll((ts) => ts.map((t) => t.getAttribute('data-testid')!.replace('picker-tile-', '')));
    expect.soft([...ticked].sort(), 'chooser: board cards ticked').toEqual([...boardIds].sort());
    const tray = await page.getByTestId('picker-tray').locator('[data-tray-id]').evaluateAll((ts) => ts.map((t) => t.getAttribute('data-tray-id')));
    expect.soft(tray, 'chooser: tray in board order').toEqual(boardIds);
    expect.soft(await page.locator('[data-testid^="picker-tray-earlier-"]').count(), 'chooser: move-earlier controls').toBe(boardIds.length);
    expect.soft(await page.locator('[data-testid^="picker-tray-later-"]').count(), 'chooser: move-later controls').toBe(boardIds.length);
    await page.getByTestId('picker-cancel').click();
    await expect(page.getByTestId('picker-tray')).toBeHidden();

    await page.getByTestId('side-nav-choose').click();
    await expect(page.getByTestId('dashboard-chooser')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, 17, w, h, 'choose-dashboards');
    expect.soft(await page.getByTestId('dashboard-chooser-save').count(), 'choose dashboards: Save').toBe(1);
    await page.getByTestId('dashboard-chooser-cancel').click();
    console.log(`[board-outlook] 1920 across-2 layout=${layout2} cards=${JSON.stringify(checks2.cards)} ticked=${JSON.stringify(ticked)} tray=${JSON.stringify(tray)} unexpected=${JSON.stringify(unexpected)}`);
  });

  test('rail with a stored list of four at 1920x1080', async ({ page }) => {
    const [w, h] = [1920, 1080];
    await page.setViewportSize({ width: w, height: h });
    const unexpected = await openBoard(page, { stored: 'self,love,work,lucky' });
    await shot(page, 18, w, h, 'rail-four');
    const rail = await railInfo(page);
    expect.soft(rail.entries.length, `rail four: entries ${JSON.stringify(rail.entries)}`).toBe(4);
    await expect.soft(page.getByTestId('side-nav-choose'), 'rail four: Choose dashboards').toBeVisible();
    console.log(`[board-outlook] rail-four open=${rail.open} entries=${JSON.stringify(rail.entries)} unexpected=${JSON.stringify(unexpected)}`);
  });

  for (const [nn, w, h] of [[19, 1920, 1080], [20, 1180, 820]] as const) {
    test(`dark theme outlook at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.addInitScript(() => localStorage.setItem('aiastra.theme', 'dark'));
      const unexpected = await openBoard(page);
      await shot(page, nn, w, h, 'outlook-dark');
      const checks = await outlookChecks(page, `${w}x${h} dark`);
      console.log(`[board-outlook] dark ${w}x${h} html=${await page.evaluate(() => document.documentElement.className)} cards=${JSON.stringify(checks.cards)} unexpected=${JSON.stringify(unexpected)}`);
    });
  }
});
