import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { newState, signIn, stubApi } from './stubApi';
import { selfV3Fixture } from '../src/pages/you/v3/selfV3.fixture';

/**
 * Phone card layout v2 (server docs/dashboards/12) at 360 × 800: the header (brand, card title, four actions), the
 * progress ticks, the full-width card with its three bars, the pull-down title strip, the full-screen menu and the
 * conversation opened from the card's input. Stubbed API; no real data. Screens saved to
 * docs/screenshots/phone-card-v2/. `npx playwright test --config e2e/playwright.config.ts phone-card-v2 --project phone`.
 */
const DIR = path.resolve('docs/screenshots/phone-card-v2');

test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

async function stubBoard(page: Page) {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const fx = selfV3Fixture();
  const keys = ['feature.periods', 'feature.key_dates', 'feature.why_panel', 'feature.confirm', 'feature.card_chat'];
  const board = { ...fx, features: Object.fromEntries(keys.map((k) => [k, { locked: false }])) };
  const body = board.cards.find((c) => c.id === 'body');
  if (body) body.keyDates = [{ date: '2026-12-05', label: 'A heavy pressure lifts' }, { date: '2027-03-01', label: 'Energy starts to return' }];
  await page.route('**/api/self/v3', (r) => json(r, board));
  await page.route('**/api/self/v3/layout**', (r) => json(r, board.layout));
  await page.route('**/api/self/v3/confirm', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/cards/**', (r) =>
    json(r, { card: { board: 'self', id: 'body', title: 'Body & energy' }, period: null, preamble: { headline: 'Pace yourself this winter.', lines: ['Rest comes first until March.'], keyDates: [] }, cost: { uses: 1, remaining: 17 }, thread: { chatId: null, messages: [] } }),
  );
  await page.route('**/api/notifications**', (r) => json(r, { items: [], unreadCount: 0 }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));
}

test('phone card layout v2 at 360 × 800', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone only');
  mkdirSync(DIR, { recursive: true });
  await stubApi(page, newState({ used: 3 }));
  await stubBoard(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);
  let n = 0;
  const shot = (name: string) => page.screenshot({ path: path.join(DIR, `${String(++n).padStart(2, '0')}-${name}.png`) });

  await page.goto('/dashboard/you?v2=1');
  const card = page.getByTestId('v3-card-body');
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('phone-card-title')).toBeVisible();
  await expect(page.getByTestId('header-brand-name')).toHaveText('AdAstraAI');
  // the brand is not clipped: its box is as wide as its text
  const clipped = await page.getByTestId('header-brand-name').evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(clipped).toBe(false);
  // nothing scrolls sideways
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot('read');

  await card.getByTestId('card-view-analysis').click();
  await shot('analysis');
  await card.getByTestId('card-view-calendar').click();
  await shot('calendar');
  await card.getByTestId('card-view-read').click();

  await page.getByTestId('phone-card-title').click();
  await expect(page.getByTestId('title-strip')).toHaveAttribute('data-open', 'true');
  // the board controls are pinned beside the titles, on screen
  await expect(page.getByTestId('self-phone-reading')).toBeInViewport();
  await shot('title-strip');
  await page.getByTestId('title-strip-title-1').click();
  await expect(page.getByTestId('title-strip')).toHaveAttribute('data-open', 'false');
  // the card picked from the strip is the one on screen
  await expect(page.locator('[data-slide="1"] article')).toBeInViewport({ ratio: 0.9 });
  await shot('second-card');
  await page.getByTestId('title-strip-title-0').click({ force: true }).catch(() => undefined);
  await page.getByTestId('phone-card-title').click();
  await page.getByTestId('title-strip-title-0').click();

  await page.getByTestId('profile-menu-sheet-button').click();
  await expect(page.getByTestId('profile-menu-sheet')).toBeVisible();
  await shot('menu');
  await page.getByTestId('profile-menu-sheet-close').click();

  const box = page.getByTestId('v3-card-body').getByTestId('card-chat-textarea');
  await box.click();
  await box.fill('Will my energy come back?');
  await expect(page.getByTestId('v3-card-body').getByTestId('card-chat-headline')).toBeVisible();
  await shot('conversation');
});
