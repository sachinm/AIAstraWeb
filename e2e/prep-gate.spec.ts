import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { newState, signIn, stubApi } from './stubApi';
import { selfV3Fixture } from '../src/pages/you/v3/selfV3.fixture';
import { LOCKED_PIPELINE, OPEN_PIPELINE } from './boardFixtures';

/**
 * The reading gate: while the chart is still being built and prepared, the board's fresh-reading control is disabled
 * and says "Building your chart data" with the server's step line; once the server unlocks it, the control is back.
 * Stubbed API; no real data. Screens saved to docs/screenshots/prep-gate/ (desktop 1440 wide, phone 390 wide).
 * `npx playwright test --config e2e/playwright.config.ts prep-gate`.
 */
const DIR = path.resolve('docs/screenshots/prep-gate');

async function stubBoard(page: Page, pipeline: typeof LOCKED_PIPELINE | typeof OPEN_PIPELINE) {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const fx = selfV3Fixture();
  // a due reading, so the unlocked board shows the live control
  const board = { ...fx, refresh: { madeAt: '2026-10-20T09:00:00Z', validUntil: '2026-11-08', due: true, building: false, failed: false }, pipeline };
  await page.route('**/api/self/v3', (r) => json(r, board));
  await page.route('**/api/self/v3/layout**', (r) => json(r, board.layout));
  await page.route('**/api/self/v3/confirm', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/notifications**', (r) => json(r, { items: [], unreadCount: 0 }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));
}

for (const [locked, pipeline] of [
  [true, LOCKED_PIPELINE],
  [false, OPEN_PIPELINE],
] as const) {
  test(`the reading gate, ${locked ? 'locked' : 'open'}`, async ({ page }, info) => {
    const phone = info.project.name === 'phone';
    mkdirSync(DIR, { recursive: true });
    await stubApi(page, newState({ used: 3 }));
    await stubBoard(page, pipeline);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signIn(page);
    await page.goto('/dashboard/you?v2=1');
    await expect(page.getByTestId('self-v3-carousel')).toBeVisible({ timeout: 30_000 });
    if (phone) {
      // a phone keeps the board's reading controls in its sheet, opened from the title strip
      await page.getByTestId('phone-card-title').click();
      await page.getByTestId('self-phone-reading').click();
      await expect(page.getByTestId('self-reading-sheet')).toBeVisible();
    }
    const button = page.getByTestId('fresh-button');
    if (locked) {
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('data-state', 'locked');
      await expect(button).toHaveText('Building your chart data');
      await expect(page.getByTestId('fresh-locked-line')).toHaveText(`${LOCKED_PIPELINE.line} · ${LOCKED_PIPELINE.done} of ${LOCKED_PIPELINE.total}`);
    } else {
      await expect(button).toBeEnabled();
      await expect(button).toHaveAttribute('data-state', 'due');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const n = locked ? (phone ? '02' : '01') : phone ? '04' : '03';
    const name = `${n}-${locked ? 'locked' : 'open'}-${phone ? 'phone' : 'desktop'}.png`;
    await page.screenshot({ path: path.join(DIR, name) });
  });
}
