import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { newState, signIn, stubApi } from './stubApi';
import { LOVE_BOARD, WORK_MAP, YOU_BOARD } from './boardFixtures';
import { selfReadingFixture } from '../src/pages/you/selfReading.fixture';

/**
 * The "Made … · Good until …" stamp under each board's title, and the question count moving when a board is built fresh
 * (server docs/billing/02 §10). Stubbed API. Screens saved to docs/screenshots/board-stamp/<device>/.
 * `npx playwright test --config e2e/playwright.config.ts board-stamp`.
 */
const ROOT = path.resolve('docs/screenshots/board-stamp');
const USAGE = { code: 'free', desired_plan: 'free', desired_interval: null, is_paid: false, interval: null, used: 3, limit: 20, remaining: 17, window: 'month', resets_at: '2026-12-01T00:00:00.000Z', exempt: false };
const STAMP = { made_at: '2026-11-09T08:30:00.000Z', valid_until: '2026-12-03' };

async function stubBoards(page: Page): Promise<void> {
  const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  // You: built fresh now, so it carries the usage after the charge; Love and Work: stored, no usage
  await page.route('**/api/area/self', (r) => json(r, { status: 'ok', built_at: '2026-11-09', cached: false, focus: 'growth', ask: false, board: YOU_BOARD, checks: {}, ...STAMP, usage: USAGE }));
  await page.route('**/api/area/love', (r) => json(r, { status: 'ok', built_at: '2026-11-09', cached: true, focus: null, ask: false, board: LOVE_BOARD, checks: {}, made_at: '2026-11-02T06:00:00.000Z', valid_until: null }));
  await page.route('**/api/area/career', (r) => json(r, { status: 'ok', map: WORK_MAP, work: 'yes', checks: {}, built_at: '2026-11-09', cached: true, ...STAMP }));
  await page.route('**/api/self/reading', (r) => json(r, { status: 'ok', built_at: '2026-11-09', cached: true, reading: selfReadingFixture() }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));
}

for (const theme of ['dark', 'light'] as const) {
  test(`${theme}: each board says when its reading was made and how long it holds`, async ({ page }, info) => {
    const dir = path.join(ROOT, info.project.name);
    mkdirSync(dir, { recursive: true });
    await stubApi(page, newState());
    await stubBoards(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((t) => localStorage.setItem('aiastra.theme', t), theme);
    await signIn(page);
    let n = theme === 'dark' ? 0 : 10;

    await page.goto('/dashboard/you');
    await expect(page.getByTestId('reading-stamp'), { timeout: 20_000 }).toHaveText('Made 9 Nov 2026 · Good until 3 Dec 2026 · Opening it again before then uses no question');
    await expect(page.locator('[data-test-id="usage-bar"]').first()).toContainText('3 of 20 questions used');
    await page.screenshot({ path: path.join(dir, `${String(++n).padStart(2, '0')}-you-${theme}.png`) });

    await page.goto('/dashboard/love');
    await expect(page.getByTestId('reading-stamp'), { timeout: 20_000 }).toHaveText('Made 2 Nov 2026 · Opening it again uses no question');
    await page.screenshot({ path: path.join(dir, `${String(++n).padStart(2, '0')}-love-${theme}.png`) });

    await page.goto('/dashboard/work');
    await expect(page.getByTestId('reading-stamp'), { timeout: 20_000 }).toContainText('Good until 3 Dec 2026');
    await page.screenshot({ path: path.join(dir, `${String(++n).padStart(2, '0')}-work-${theme}.png`) });

    const text = (await page.locator('body').textContent())!.toLowerCase();
    for (const w of ['radha', 'pyjhora', 'dasha', 'saturn']) expect(text).not.toContain(w);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
