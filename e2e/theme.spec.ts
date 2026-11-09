import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { newState, signIn, stubApi } from './stubApi';
import { LIFE_READING, LOVE_BOARD, LUCKY_CATALOG, WORK_MAP, YOU_BOARD, buildLuckyRange } from './boardFixtures';

/**
 * Light and dark theme pass (phase 1: signed-in pages themed, public pages dark in both): the key pages in each theme, desktop and phone, saved to docs/screenshots/theme/<device>/.
 * Stubbed API (stubApi.ts), so no sign-in or real data. `npx playwright test --config e2e/playwright.config.ts theme`.
 */
const ROOT = path.resolve('docs/screenshots/theme');

const PAGES: { name: string; url: string; signedIn: boolean; ready?: (p: Page) => Promise<void> }[] = [
  { name: 'landing', url: '/', signedIn: false },
  { name: 'signin', url: '/signin', signedIn: false },
  { name: 'pricing', url: '/pricing', signedIn: false },
  { name: 'terms', url: '/terms', signedIn: false },
  { name: 'you', url: '/dashboard/you', signedIn: true, ready: (p) => expect(p.getByTestId('tone-card')).toBeVisible() },
  { name: 'love', url: '/dashboard/love', signedIn: true },
  { name: 'work', url: '/dashboard/work', signedIn: true },
  { name: 'lucky', url: '/dashboard/lucky', signedIn: true },
  { name: 'chat', url: '/dashboard/chat', signedIn: true },
  { name: 'profile-locale', url: '/profile/locale', signedIn: true },
  { name: 'profile-plan', url: '/profile/plan', signedIn: true },
];

async function stubBoards(page: Page): Promise<void> {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const picks = [
    { scenario: 'work.sign_contract', shown: true, answers: {} },
    { scenario: 'love.first_date', shown: true, answers: { relationship: 'single' } },
  ];
  await page.route('**/api/area/self', (r) => json(r, { status: 'ok', built_at: '2026-11-05', cached: true, focus: 'growth', ask: true, board: YOU_BOARD, checks: {} }));
  await page.route('**/api/area/love', (r) => json(r, { status: 'ok', built_at: '2026-11-05', cached: false, focus: null, ask: true, board: LOVE_BOARD, checks: {} }));
  await page.route('**/api/area/career', (r) => json(r, { status: 'ok', map: WORK_MAP, work: null, checks: {} }));
  await page.route('**/api/lucky/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/setup')) {
      return json(route, {
        place: 'sanjose',
        places: [
          { key: 'sanjose', name: 'San Jose, US' },
          { key: 'pune', name: 'Pune, IN' },
        ],
        scenarios: LUCKY_CATALOG,
        picks,
      });
    }
    if (url.pathname.endsWith('/range')) return json(route, buildLuckyRange(picks));
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/life-reading', (r) => json(r, LIFE_READING));
  await page.route('**/api/profile/photo', (r) => json(r, {}, 404));
  await page.route('**/api/timeline/ledger/meta', (r) => json(r, {}, 404));
  await page.route('**/api/profile/facts', (r) =>
    r.request().method() === 'GET' ? json(r, { facts: { 'place.current': 'Pune, India', 'work.status': 'yes' } }) : r.fulfill({ status: 204 }),
  );
  await page.route('**/api/area/*/checks', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} theme: key pages read cleanly`, async ({ page }, info) => {
    const dir = path.join(ROOT, info.project.name);
    mkdirSync(dir, { recursive: true });
    const report: Record<string, unknown>[] = [];
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));

    await stubApi(page, newState());
    await stubBoards(page);
    // the device says the opposite, so the picture proves the saved choice wins over System
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light', reducedMotion: 'reduce' });
    await page.addInitScript((t) => localStorage.setItem('aiastra.theme', t), theme);

    // public pages first, signed out (a session redirects / and /signin to the dashboard); then sign in
    let signedIn = false;
    let n = theme === 'light' ? 0 : 20;
    for (const p of PAGES) {
      if (p.signedIn && !signedIn) {
        await signIn(page);
        signedIn = true;
      }
      await page.goto(p.url);
      if (p.ready) await p.ready(page);
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      const cls = await page.evaluate(() => document.documentElement.className);
      // phase 1: only the signed-in pages follow the choice; the public ones stay dark (src/lib/theme.ts)
      expect(cls).toContain(p.signedIn ? theme : 'dark');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      n += 1;
      const file = `${String(n).padStart(2, '0')}-${p.name}-${theme}.png`;
      await page.screenshot({ path: path.join(dir, file) });
      report.push({ file, url: page.url(), horizontalOverflowPx: overflow });
    }

    // the switch in Profile changes the page at once, no reload
    await page.goto('/profile/locale');
    const other = theme === 'light' ? 'Dark' : 'Light';
    await page.getByRole('radio', { name: other }).click();
    await expect(page.locator('html')).toHaveClass(new RegExp(other.toLowerCase()));
    expect(await page.evaluate(() => localStorage.getItem('aiastra.theme'))).toBe(other.toLowerCase());

    writeFileSync(path.join(dir, `manifest-${theme}.json`), JSON.stringify({ steps: report, pageErrors: errors }, null, 2));
  });
}
