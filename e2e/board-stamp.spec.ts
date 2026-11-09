import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { newState, signIn, stubApi } from './stubApi';
import { LOVE_BOARD, WORK_MAP, YOU_BOARD } from './boardFixtures';
import { selfReadingFixture } from '../src/pages/you/selfReading.fixture';

/**
 * Offline-first boards (server docs/billing/02 §10, 03): each board says when its reading was made and how long it
 * holds; once due, the person asks for a fresh one, which takes one question. Stubbed API. Screens saved to
 * docs/screenshots/board-stamp/<device>/. `npx playwright test --config e2e/playwright.config.ts board-stamp`.
 */
const ROOT = path.resolve('docs/screenshots/board-stamp');
const USAGE = { code: 'free', desired_plan: 'free', desired_interval: null, is_paid: false, interval: null, used: 3, limit: 20, remaining: 17, window: 'month', resets_at: '2026-12-01T00:00:00.000Z', exempt: false };

async function stubBoards(page: Page): Promise<{ refreshes: string[] }> {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const refreshes: string[] = [];
  let workFresh = false;
  await page.route('**/api/area/self', (r) => json(r, { status: 'ok', built_at: '2026-11-09', cached: true, focus: 'growth', ask: false, board: YOU_BOARD, checks: {}, made_at: '2026-11-09T08:30:00.000Z', valid_until: '2026-12-03', refresh_due: false }));
  await page.route('**/api/area/love', (r) => json(r, { status: 'ok', built_at: '2026-11-02', cached: true, focus: null, ask: false, board: LOVE_BOARD, checks: {}, made_at: '2026-11-02T06:00:00.000Z', valid_until: null, refresh_due: false }));
  await page.route('**/api/area/career', (r) =>
    json(r, workFresh
      ? { status: 'ok', map: WORK_MAP, work: 'yes', checks: {}, built_at: '2026-11-09', cached: false, made_at: '2026-11-09T10:00:00.000Z', valid_until: '2026-12-20', refresh_due: false }
      : { status: 'ok', map: WORK_MAP, work: 'yes', checks: {}, built_at: '2026-10-01', cached: true, made_at: '2026-10-01T10:00:00.000Z', valid_until: '2026-11-05', refresh_due: true }),
  );
  await page.route('**/api/boards/*/refresh', (r) => {
    refreshes.push(new URL(r.request().url()).pathname);
    workFresh = true;
    return json(r, { status: 'ok', map: WORK_MAP, usage: { ...USAGE, used: 4, remaining: 16 } });
  });
  await page.route('**/api/self/reading', (r) => json(r, { status: 'ok', built_at: '2026-11-09', cached: true, reading: selfReadingFixture() }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));
  return { refreshes };
}

for (const theme of ['dark', 'light'] as const) {
  test(`${theme}: boards keep their last reading; a fresh one only when asked, once due`, async ({ page }, info) => {
    const dir = path.join(ROOT, info.project.name);
    mkdirSync(dir, { recursive: true });
    await stubApi(page, newState({ used: 3 }));
    const { refreshes } = await stubBoards(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((t) => localStorage.setItem('aiastra.theme', t), theme);
    await signIn(page);
    let n = theme === 'dark' ? 0 : 10;
    const shot = async (name: string) => page.screenshot({ path: path.join(dir, `${String(++n).padStart(2, '0')}-${name}-${theme}.png`) });
    const stamp = () => page.getByTestId('reading-stamp');

    await page.goto('/dashboard/you');
    await expect(stamp()).toContainText('Made 9 Nov 2026 · Good until 3 Dec 2026', { timeout: 20_000 });
    await expect(page.getByTestId('refresh-later')).toHaveText('Fresh reading after 3 Dec 2026');
    await shot('you-not-due');

    await page.goto('/dashboard/love');
    await expect(stamp()).toContainText('Made 2 Nov 2026 · Opening it again uses no question', { timeout: 20_000 });
    await shot('love-no-end');

    await page.goto('/dashboard/work');
    await expect(page.getByTestId('refresh-button')).toHaveText('Get a fresh reading · uses 1 question', { timeout: 20_000 });
    await expect(page.locator('[data-test-id="usage-bar"]').first()).toContainText('3 of 20 questions used');
    await shot('work-due');
    await page.getByTestId('refresh-button').click();
    await expect(stamp()).toContainText('Made 9 Nov 2026 · Good until 20 Dec 2026', { timeout: 20_000 });
    await expect(page.getByTestId('refresh-later')).toHaveText('Fresh reading after 20 Dec 2026');
    await expect(page.locator('[data-test-id="usage-bar"]').first()).toContainText('4 of 20 questions used');
    expect(refreshes).toEqual(['/api/boards/work/refresh']);
    await shot('work-after-fresh');

    const text = (await page.locator('body').textContent())!.toLowerCase();
    for (const w of ['radha', 'pyjhora', 'dasha', 'saturn']) expect(text).not.toContain(w);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
