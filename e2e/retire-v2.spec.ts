import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newState, signIn, stubApi } from './stubApi';
import { selfV3Fixture, selfV3StoryCard } from '../src/pages/you/v3/selfV3.fixture';
import type { SelfV3Response } from '../src/lib/selfV3Api';

/**
 * The Self board at /dashboard/you once the v2 Self reading is retired (retire-v2 plan, web phases A and B): every card
 * with `v2: null`, the header line from the diagnosis card, the "deeper reading is ready" note, "AdAstra AI read" on
 * the server's shapes and the "i" sheet with no filler line. Stubbed API, frozen clock; no real data, no paid call.
 * Screens saved to docs/screenshots/retire-v2/ at 1920x1080 (desktop project only).
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '../docs/screenshots/retire-v2');
const TODAY = new Date('2026-11-18T12:00:00');
const FEATURE_KEYS = ['feature.periods', 'feature.key_dates', 'feature.why_panel', 'feature.confirm'];

function board(): SelfV3Response {
  const fx = selfV3Fixture();
  const story = selfV3StoryCard();
  fx.cards = fx.cards.map((c) => (c.id === 'body' ? story : c));
  fx.reading = { enabled: true, stage: 'done', clocks: [], done: 8, total: 8, capReached: false, preparing: false, deeperReadingReady: true };
  return { ...fx, features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, { locked: false }])) as SelfV3Response['features'] };
}

async function open(page: Page, b: SelfV3Response | (() => SelfV3Response)) {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const now = typeof b === 'function' ? b : () => b;
  await page.clock.setFixedTime(TODAY);
  await stubApi(page, newState({ used: 3 }));
  await page.route('**/api/self/v3', (r) => json(r, now()));
  await page.route('**/api/self/v3/layout**', (r) => json(r, now().layout));
  await page.route('**/api/profile/photo', (r) => json(r, {}, 404));
  await page.route('**/api/profile/facts', (r) => json(r, { facts: {} }));
  await page.route('**/api/notifications**', (r) => json(r, { items: [], unreadCount: 0 }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);
  await page.goto('/dashboard/you');
  await expect(page.getByTestId('v3-card-body')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(600);
}

test('retire-v2: the Self board with v2: null at 1920x1080', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop only');
  mkdirSync(DIR, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, board());
  const shot = (n: number, name: string) => page.screenshot({ path: path.join(DIR, `${String(n).padStart(2, '0')}-1920x1080-${name}.png`) });

  // 1. the header line, the deeper-reading note, the card's plain story and "Good until"
  const hero = page.getByTestId('self-hero-line');
  await expect(hero).toHaveText('In short: ideas outrun their footing until 12 Dec 2026.');
  await expect(page.getByTestId('deeper-ready')).toContainText('A deeper reading is ready. Refresh uses 1 of your questions.');
  const card = page.getByTestId('v3-card-body');
  await expect(card.getByTestId('card-good-until')).toHaveText('Good until 27 Dec 2027');
  await expect(card.getByTestId('outlook-plain-story')).toBeVisible();
  await shot(1, 'header-line-deeper-note-outlook');

  // 2. "AdAstra AI read" on the Astrology Reading tab, from the server's shapes
  await card.getByTestId('card-view-astrology').click();
  const systems = card.getByTestId('astrology-systems');
  await expect(systems).toContainText('AdAstra AI read');
  await expect(systems.getByTestId('astrology-system')).toHaveCount(4);
  await expect(systems.getByTestId('astrology-system').first()).toContainText('Life chapters');
  await expect(systems.getByTestId('astrology-system').first()).toContainText('Saturn · until 27 Dec 2027');
  await expect(systems).not.toContainText('vimshottari');
  await systems.scrollIntoViewIfNeeded();
  await shot(2, 'astrology-adastra-ai-read');

  // 3. the "i" sheet: the story and the systems, no filler line
  await card.getByTestId('card-why').click();
  const sheet = page.getByTestId('details-sheet');
  await expect(sheet.getByTestId('details-story')).toBeVisible();
  await expect(sheet.getByTestId('details-systems')).toBeVisible();
  await expect(sheet).not.toContainText('Nothing more to show');
  await shot(3, 'i-sheet-story-no-filler');
  await page.keyboard.press('Escape');

  // 4. "Refresh" in the note opens the consent sheet (it never refreshes by itself)
  await page.getByTestId('deeper-refresh').click();
  await expect(page.getByTestId('fresh-sheet')).toBeVisible();
  await shot(4, 'deeper-refresh-consent-sheet');
});

// the header row from 1280 px holds the title, the header line, the note, the chips and the controls on one row: the
// chips must keep their room and the header line must truncate, not push them out
for (const [w, h] of [
  [1280, 800],
  [1440, 900],
] as const) {
  test(`retire-v2: the header row at ${w}x${h} with the header line and the note`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop only');
    mkdirSync(DIR, { recursive: true });
    await page.setViewportSize({ width: w, height: h });
    // first without the header line and the note (the row as it was), then with both: the capped text block may take a
    // few pixels more than the clock line alone did, never the chips' room
    const plain = board();
    plain.headerLine = null;
    plain.reading = { ...plain.reading!, deeperReadingReady: false };
    const full = board();
    full.headerLine = 'You are rebuilding, not running down: a slower rhythm through the winter gives back a steadier body by spring.';
    let served = plain;
    await open(page, () => served);
    const measure = () =>
      page.evaluate(() => {
        const r = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect() ?? null;
        const title = document.querySelector('[data-testid="self-title"]') as HTMLElement | null;
        return { chips: Math.round(r('self-v3-chips-slot')?.width ?? 0), titleClipped: !!title && title.scrollWidth > title.clientWidth + 1, pageX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
    const before = await measure();
    served = full;
    await page.reload();
    await expect(page.getByTestId('self-hero-line')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('deeper-ready')).toBeVisible();
    await page.waitForTimeout(600);
    const after = await measure();
    console.log(`[retire-v2] ${w}x${h} before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
    expect.soft(after.pageX, 'no sideways page scroll').toBeLessThanOrEqual(0);
    expect.soft(after.titleClipped, 'the Self title is not clipped').toBe(false);
    expect.soft(after.chips, 'the chips keep the room they had').toBeGreaterThanOrEqual(before.chips - 16);
    await page.screenshot({ path: path.join(DIR, `${w === 1280 ? '05' : '06'}-${w}x${h}-header-row.png`) });
  });
}

// a server with the v3 board off (bare 404): the legacy You page, inside the shell held to the window, scrolls in its box
test('retire-v2: v3 off shows the legacy You page, which scrolls inside the fixed shell', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop only');
  mkdirSync(DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(TODAY);
  await stubApi(page, newState({ used: 3 }));
  const { YOU_BOARD } = await import('./boardFixtures');
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/area/self', (r) => json(r, { status: 'ok', built_at: '2026-11-09', cached: true, focus: 'growth', ask: false, board: YOU_BOARD, checks: {}, made_at: '2026-11-09T08:30:00.000Z', valid_until: '2026-12-03', refresh_due: false }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));
  await signIn(page);
  await page.goto('/dashboard/you');
  const box = page.getByTestId('you-legacy-scroll');
  await expect(box.getByTestId('tone-card')).toBeVisible({ timeout: 30_000 });
  const m = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="you-legacy-scroll"]') as HTMLElement;
    const footer = document.querySelector('[data-test-id="dashboard-footer"]')?.getBoundingClientRect();
    return { pageScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight, boxScrolls: el.scrollHeight > el.clientHeight, overflowY: getComputedStyle(el).overflowY, footerBottom: footer ? Math.round(footer.bottom) : null };
  });
  console.log('[retire-v2] legacy fallback', JSON.stringify(m));
  expect.soft(m.pageScroll, 'the page itself does not scroll').toBeLessThanOrEqual(0);
  expect.soft(m.overflowY).toBe('auto');
  expect.soft(m.footerBottom, 'footer at the bottom').toBe(900);
  await page.screenshot({ path: path.join(DIR, '07-1440x900-v3-off-legacy-page.png') });
});
