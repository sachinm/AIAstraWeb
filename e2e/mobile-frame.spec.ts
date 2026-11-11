import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { newState, signIn, stubApi } from './stubApi';
import { LIFE_READING, LOVE_BOARD, WORK_MAP, YOU_BOARD } from './boardFixtures';

/**
 * The phone frame (Sachin, 2026-11-10): on the public pages the scene covers the whole screen with no edge, the header
 * and footer stay pinned and the page itself never scrolls; on the signed-in boards the left rail becomes a drawer behind
 * a menu button and the footer is a thin line. Saves to docs/screenshots/mobile-frame/.
 * `npx playwright test --config e2e/playwright.config.ts mobile-frame --project desktop`.
 */
const ROOT = path.resolve('docs/screenshots/mobile-frame');

const SIZES = [
  { name: 'portrait', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1440, height: 900 },
];
const PUBLIC = [
  { name: 'landing', url: '/' },
  { name: 'signin', url: '/signin' },
  { name: 'signup', url: '/signup' },
];
const BOARD_SIZES = [
  { name: 'phone', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
];

async function stubBoards(page: Page): Promise<void> {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/area/self', (r) => json(r, { status: 'ok', built_at: '2026-11-05', cached: true, focus: 'growth', ask: true, board: YOU_BOARD, checks: {} }));
  await page.route('**/api/area/love', (r) => json(r, { status: 'ok', built_at: '2026-11-05', cached: false, focus: null, ask: true, board: LOVE_BOARD, checks: {} }));
  await page.route('**/api/area/career', (r) => json(r, { status: 'ok', map: WORK_MAP, work: null, checks: {} }));
  await page.route('**/api/life-reading', (r) => json(r, LIFE_READING));
  await page.route('**/api/profile/photo', (r) => json(r, {}, 404));
  await page.route('**/api/timeline/ledger/meta', (r) => json(r, {}, 404));
  await page.route('**/api/profile/facts', (r) => (r.request().method() === 'GET' ? json(r, { facts: {} }) : r.fulfill({ status: 204 })));
  await page.route('**/api/area/*/checks', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));
}

/** Where the frame sits: the page's own scroll room, and the header's top and the footer's bottom against the viewport. */
const frame = (page: Page, footer: string) =>
  page.evaluate((sel) => {
    const el = document.scrollingElement as HTMLElement;
    const f = document.querySelector(sel)?.getBoundingClientRect();
    return { pageScroll: el.scrollHeight - innerHeight, footerBottom: f ? Math.round(f.bottom) : null, footerHeight: f ? Math.round(f.height) : null, viewport: innerHeight };
  }, footer);

test('public pages and boards keep the phone frame', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sizes are set per step');
  mkdirSync(ROOT, { recursive: true });
  const report: Record<string, unknown>[] = [];
  await stubApi(page, newState());
  await stubBoards(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  let n = 0;
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const p of PUBLIC) {
      await page.goto(p.url);
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      const f = await frame(page, '[data-test-id="public-footer"]');
      expect(f.pageScroll, `${p.name} ${size.name}: the page itself scrolls`).toBeLessThanOrEqual(0);
      expect(f.footerBottom, `${p.name} ${size.name}: footer not at the bottom`).toBe(size.height);
      // the scene covers the screen: its picture box is at least the viewport
      const scene = await page.evaluate(() => {
        const r = document.querySelector('.sky-image')?.getBoundingClientRect();
        return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) } : null;
      });
      expect(scene, `${p.name} ${size.name}: no scene`).not.toBeNull();
      expect(scene!.top).toBeLessThanOrEqual(0);
      expect(scene!.bottom).toBeGreaterThanOrEqual(size.height);
      expect(scene!.left).toBeLessThanOrEqual(0);
      expect(scene!.right).toBeGreaterThanOrEqual(size.width);
      n += 1;
      const file = `${String(n).padStart(2, '0')}-${p.name}-${size.name}.png`;
      await page.screenshot({ path: path.join(ROOT, file) });
      report.push({ file, ...f, scene });
    }
  }

  await signIn(page);
  for (const size of BOARD_SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/dashboard/you');
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const f = await frame(page, '[data-test-id="dashboard-footer"]');
    expect(f.pageScroll, `board ${size.name}: the page itself scrolls`).toBeLessThanOrEqual(0);
    expect(f.footerBottom).toBe(size.height);
    const menu = page.getByTestId('header-menu-button');
    if (size.width < 768) {
      expect(f.footerHeight!, 'phone footer is a sliver').toBeLessThanOrEqual(30);
      await expect(page.getByTestId('side-nav')).not.toBeInViewport();
      await expect(menu).toBeVisible();
      // the header row fits: nothing in it is pushed past its edge or over its neighbour
      const crowded = await page.evaluate(() => {
        const row = document.querySelector('nav[aria-label="Main"] .h-16');
        if (!row) return 'no header row';
        const boxes = [...row.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0);
        for (let i = 1; i < boxes.length; i++) if (boxes[i].left < boxes[i - 1].right - 1) return `item ${i} overlaps the one before`;
        return boxes.at(-1)!.right <= innerWidth ? null : 'past the edge';
      });
      expect(crowded).toBeNull();
    } else {
      await expect(menu).toBeHidden();
      await expect(page.getByTestId('side-nav')).toBeVisible();
    }
    n += 1;
    let file = `${String(n).padStart(2, '0')}-board-${size.name}.png`;
    await page.screenshot({ path: path.join(ROOT, file) });
    report.push({ file, ...f });
    if (size.width < 768) {
      await menu.click();
      await expect(page.getByTestId('side-nav')).toBeInViewport();
      await page.waitForTimeout(400);
      n += 1;
      file = `${String(n).padStart(2, '0')}-board-${size.name}-menu-open.png`;
      await page.screenshot({ path: path.join(ROOT, file) });
      report.push({ file });
      await page.getByRole('link', { name: 'Love' }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/love/);
      await expect(page.getByTestId('side-nav')).not.toBeInViewport();
    }
  }
  writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(report, null, 2));
});
