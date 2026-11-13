import { expect, test, type Page, type Route } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { newState, signIn, stubApi } from './stubApi';
import { LIFE_READING, LOVE_BOARD, LUCKY_CATALOG, WORK_MAP, YOU_BOARD, buildLuckyRange } from './boardFixtures';
import { BANNED_ON_BOARD } from '../src/pages/lucky/words';

/**
 * Digest boards Wave 1–3 end-to-end verification & screenshot pass:
 * You (/dashboard/you), Love (/dashboard/love), Work (/dashboard/work),
 * Lucky Times (/dashboard/lucky), and Life Reading (/profile/timeline).
 */

const SERVER_SCREENSHOT_DIR = 'C:/Users/Owner/Documents/work/AIAstra_Server/docs/screenshots/p4-01-digest-boards-wave1-3';
const P5_SCREENSHOT_DIR = 'C:/Users/Owner/Documents/work/AIAstra_Server/docs/screenshots/p5-01-amplify-p0-p3-verification';
const BRAIN_SCREENSHOT_DIR = 'C:/Users/Owner/.gemini/antigravity/brain/3dd78bf0-3477-463d-b316-67ebf3b900bd';


async function saveShot(page: Page, filename: string, saveToTargets: boolean, p5Filename?: string): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
  if (!saveToTargets) return;
  mkdirSync(SERVER_SCREENSHOT_DIR, { recursive: true });
  mkdirSync(P5_SCREENSHOT_DIR, { recursive: true });
  mkdirSync(BRAIN_SCREENSHOT_DIR, { recursive: true });
  const serverPath = path.join(SERVER_SCREENSHOT_DIR, filename);
  const brainPath = path.join(BRAIN_SCREENSHOT_DIR, filename);
  await page.screenshot({ path: serverPath, fullPage: true });
  copyFileSync(serverPath, brainPath);
  if (p5Filename) {
    const p5Path = path.join(P5_SCREENSHOT_DIR, p5Filename);
    copyFileSync(serverPath, p5Path);
  }
}

async function saveP5OnlyShot(page: Page, p5Filename: string, saveToTargets: boolean): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
  if (!saveToTargets) return;
  mkdirSync(P5_SCREENSHOT_DIR, { recursive: true });
  const p5Path = path.join(P5_SCREENSHOT_DIR, p5Filename);
  await page.screenshot({ path: p5Path, fullPage: false });
}

async function assertNoOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('digest boards wave 1-3: you, love, work, lucky times, and life reading timeline render cleanly with screenshots', async ({ page }, info) => {
  const isPhone = info.project.name === 'phone';
  const saveToTargets = !isPhone;
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const s = newState();
  await stubApi(page, s);

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });

  const picks = [
    { scenario: 'work.sign_contract', shown: true, answers: {} },
    { scenario: 'love.first_date', shown: true, answers: { relationship: 'single' } },
  ];

  await page.route('**/api/area/self', (r) =>
    json(r, { status: 'ok', built_at: '2026-11-05', cached: true, focus: 'growth', ask: true, board: YOU_BOARD, checks: {} }),
  );
  await page.route('**/api/area/love', (r) =>
    json(r, { status: 'ok', built_at: '2026-11-05', cached: false, focus: null, ask: true, board: LOVE_BOARD, checks: {} }),
  );
  await page.route('**/api/area/career', (r) =>
    json(r, { status: 'ok', map: WORK_MAP, work: null, checks: {} }),
  );
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
    if (url.pathname.endsWith('/range')) {
      return json(route, buildLuckyRange(picks));
    }
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/life-reading', (r) => json(r, LIFE_READING));
  await page.route('**/api/profile/photo', (r) => json(r, {}, 404));
  await page.route('**/api/timeline/ledger/meta', (r) => json(r, {}, 404));
  await page.route('**/api/profile/facts', (r) => {
    if (r.request().method() === 'GET') {
      return json(r, {
        facts: {
          'place.current': 'Pune, India',
          'work.status': 'yes',
          'self.focus': 'career',
          'love.status': 'partnered',
        },
      });
    }
    return r.fulfill({ status: 204 });
  });
  await page.route('**/api/profile/work-status', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/area/*/checks', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));

  await signIn(page);

  // 1. You board (/dashboard/you) + 3-Decade Character Evolution & Moon/Mercury Joy
  await page.goto('/dashboard/you');
  await expect(page.getByTestId('tone-card')).toContainText('A clear stretch for a fresh start. Begin before 31 May 2027.');
  await expect(page.getByTestId('self-character-arc')).toBeVisible();
  await expect(page.getByTestId('character-stage-past_10y')).toContainText('Last 10 Years');
  await expect(page.getByTestId('character-stage-now')).toContainText('Who You Are Now');
  await expect(page.getByTestId('character-stage-next_10y')).toContainText('Next 10 Years');
  await expect(page.getByTestId('self-personality-joy')).toBeVisible();
  await expect(page.getByTestId('joy-item-0')).toContainText('Cooking, music & tactile comfort at home');
  await expect(page.getByRole('button', { name: 'Open profile menu' })).toBeVisible();
  await expect(page.getByAltText('Shri Ganesh')).toBeVisible();
  const youText = (await page.getByTestId('you-page').textContent())!.toLowerCase();
  for (const w of [...BANNED_ON_BOARD, 'house', 'lord', 'kendra', 'dusthana', 'aspected', 'd1.']) {
    expect(youText).not.toContain(w);
  }
  if (!isPhone) {
    await page.setViewportSize({ width: 1440, height: 1550 });
  }
  await assertNoOverflow(page);
  await saveShot(page, '01-you-board.png', saveToTargets, '03-you-board-3-decade-character-and-joy.png');
  if (!isPhone) {
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  // 1b. Personalize Wizard Modal (opened from the avatar menu)
  await page.getByRole('button', { name: 'Open profile menu' }).click();
  await page.getByTestId('menu-personalize-wizard').click();
  await expect(page.getByTestId('header-wizard-modal')).toBeVisible();
  await expect(page.getByTestId('header-wizard-modal')).toContainText('Personalize Your Readings');
  await saveP5OnlyShot(page, '04-header-personalize-wizard-modal.png', saveToTargets);
  await page.getByTestId('header-wizard-close').click();
  await expect(page.getByTestId('header-wizard-modal')).toHaveCount(0);

  // 2. Love board (/dashboard/love)
  await page.goto('/dashboard/love');
  await expect(page.getByTestId('tone-card')).toContainText('A strained stretch in love. It eases from 3 Mar 2027.');
  const loveText = (await page.getByTestId('love-page').textContent())!.toLowerCase();
  for (const w of [...BANNED_ON_BOARD, 'divorce', 'cheat', 'house', 'lord', 'aspected']) {
    expect(loveText).not.toContain(w);
  }
  await assertNoOverflow(page);
  await saveShot(page, '02-love-board.png', saveToTargets, '05-love-board-ndjson-stream.png');

  // 3. Work board (/dashboard/work)
  await page.goto('/dashboard/work');
  await expect(page.getByTestId('tone-card')).toContainText('A demanding stretch at work. It eases from 10 Dec 2026.');
  const workText = (await page.getByTestId('work-page').textContent())!.toLowerCase();
  for (const w of BANNED_ON_BOARD) {
    expect(workText).not.toContain(w);
  }
  await assertNoOverflow(page);
  await saveShot(page, '03-work-board.png', saveToTargets, '06-work-board-ndjson-stream.png');

  // 4. Lucky Times board (/dashboard/lucky)
  await page.goto('/dashboard/lucky');
  await expect(page.getByTestId('today-work.sign_contract')).toBeVisible();
  const luckyText = (await page.getByTestId('lucky-page').textContent())!.toLowerCase();
  for (const w of BANNED_ON_BOARD) {
    expect(luckyText).not.toContain(w);
  }
  await assertNoOverflow(page);
  await saveShot(page, '04-lucky-times-board.png', saveToTargets);

  // 5. Life Reading timeline (/profile/timeline)
  await page.goto('/profile/timeline');
  const lifeDash = page.getByTestId('life-dashboard');
  await expect(lifeDash).toBeVisible();
  await expect(page.getByTestId('life-rule-now')).toContainText('Until 7 Feb 2027, hold off');
  const workAreaLoc = page.getByTestId(isPhone ? 'life-card-work' : 'life-row-work');
  await expect(workAreaLoc).toBeVisible();
  await expect(workAreaLoc).toContainText('Has work felt harder to move lately?');
  const lifeVisibleText = (await lifeDash.innerText()).toLowerCase();
  for (const w of BANNED_ON_BOARD) {
    expect(lifeVisibleText).not.toContain(w);
  }
  await assertNoOverflow(page);
  await saveShot(page, '05-life-reading-timeline.png', saveToTargets);

  expect(pageErrors).toEqual([]);
});

test('admin research lab (self, love, work, 10-step trace, 8-gate verifier) and page performance telemetry render cleanly with screenshots', async ({ page }, info) => {
  if (info.project.name === 'phone') return;

  const adminDistDir = 'C:/Users/Owner/Documents/work/aiadastra_admin/web/dist';
  const sampleJsonPath = path.join(P5_SCREENSHOT_DIR, 'research-runs-sample.json');
  expect(existsSync(adminDistDir)).toBe(true);
  expect(existsSync(sampleJsonPath)).toBe(true);

  const researchFixtures = JSON.parse(readFileSync(sampleJsonPath, 'utf8')) as {
    self: unknown;
    love: unknown;
    work: unknown;
  };

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  // Serve the built aiadastra_admin/web SPA from http://admin.local
  await page.route('http://admin.local/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/admin/')) {
      return route.fallback();
    }
    const rel = url.pathname === '/' || !url.pathname.includes('.') ? 'index.html' : url.pathname.replace(/^\//, '');
    const filePath = path.join(adminDistDir, rel);
    if (!existsSync(filePath)) {
      return route.fulfill({ status: 404, body: 'Not found' });
    }
    const contentType = filePath.endsWith('.html')
      ? 'text/html; charset=utf-8'
      : filePath.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : filePath.endsWith('.js')
          ? 'application/javascript; charset=utf-8'
          : 'application/octet-stream';
    return route.fulfill({ status: 200, contentType, body: readFileSync(filePath) });
  });

  await page.route('**/api/admin/me', (r) =>
    json(r, {
      id: 'staff-1',
      username: 'adastra-superadmin',
      displayName: 'Sachin (Superadmin)',
      role: 'superadmin',
    }),
  );

  await page.route('**/api/admin/research-lab**', (route) => {
    const url = new URL(route.request().url());
    const area = (url.searchParams.get('boardArea') || 'self') as 'self' | 'love' | 'work';
    const picked = researchFixtures[area] ?? researchFixtures.self;
    if (url.pathname.includes('/runs/')) {
      const ov = picked as { featuredRun: unknown };
      return json(route, ov.featuredRun);
    }
    return json(route, picked);
  });

  await page.route('**/api/admin/pages**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/requests')) {
      return json(route, {
        items: [
          {
            id: 'req-row-1',
            requestId: 'trace-you-ndjson-01',
            sessionId: 'sess-101',
            userId: 'u-1',
            emailMasked: 's***@y***.com',
            pagePath: '/dashboard/you',
            routePattern: '/dashboard/you',
            source: 'section_stream',
            method: 'GET',
            operation: 'sections-stream:self',
            sectionKey: 'character_arc',
            statusCode: 200,
            durationMs: 68,
            ttfbMs: 24,
            serverMs: 68,
            renderMs: 42,
            drawMs: 58,
            queryCount: 2,
            slowCount: 0,
            cacheHit: true,
            bodyBytes: 9420,
            errorCode: null,
            createdAt: '2026-11-07T20:30:00.000Z',
          },
          {
            id: 'req-row-2',
            requestId: 'trace-love-ndjson-02',
            sessionId: 'sess-101',
            userId: 'u-1',
            emailMasked: 's***@y***.com',
            pagePath: '/dashboard/love',
            routePattern: '/dashboard/love',
            source: 'section_stream',
            method: 'GET',
            operation: 'sections-stream:love',
            sectionKey: 'tone',
            statusCode: 200,
            durationMs: 74,
            ttfbMs: 28,
            serverMs: 74,
            renderMs: 39,
            drawMs: 53,
            queryCount: 2,
            slowCount: 0,
            cacheHit: true,
            bodyBytes: 8120,
            errorCode: null,
            createdAt: '2026-11-07T20:31:00.000Z',
          },
        ],
        nextCursor: null,
      });
    }
    return json(route, {
      window: '7d',
      totals: {
        totalRequests: 420,
        uniquePages: 5,
        uniqueUsers: 25,
        p50Ms: 92,
        p95Ms: 340,
        p99Ms: 690,
        avgServerMs: 112,
        avgRenderMs: 44,
        avgDrawMs: 61,
        slowRequests: 2,
        failedRequests: 0,
        errorRate: 0,
        cacheHitRate: 0.78,
      },
      pages: [
        {
          pagePath: '/dashboard/you',
          routePattern: '/dashboard/you',
          requests: 165,
          uniqueUsers: 24,
          p50Ms: 78,
          p95Ms: 240,
          p99Ms: 410,
          avgMs: 95,
          maxMs: 490,
          avgServerMs: 82,
          avgRenderMs: 41,
          avgDrawMs: 56,
          slowCount: 0,
          failedCount: 0,
          errorRate: 0,
          cacheHitRate: 0.84,
          avgBytes: 9420,
          lastSeenAt: '2026-11-07T20:30:00.000Z',
        },
        {
          pagePath: '/dashboard/love',
          routePattern: '/dashboard/love',
          requests: 130,
          uniqueUsers: 21,
          p50Ms: 84,
          p95Ms: 265,
          p99Ms: 450,
          avgMs: 104,
          maxMs: 510,
          avgServerMs: 88,
          avgRenderMs: 43,
          avgDrawMs: 59,
          slowCount: 1,
          failedCount: 0,
          errorRate: 0,
          cacheHitRate: 0.76,
          avgBytes: 8120,
          lastSeenAt: '2026-11-07T20:31:00.000Z',
        },
        {
          pagePath: '/dashboard/work',
          routePattern: '/dashboard/work',
          requests: 125,
          uniqueUsers: 22,
          p50Ms: 96,
          p95Ms: 290,
          p99Ms: 520,
          avgMs: 118,
          maxMs: 610,
          avgServerMs: 98,
          avgRenderMs: 47,
          avgDrawMs: 65,
          slowCount: 1,
          failedCount: 0,
          errorRate: 0,
          cacheHitRate: 0.74,
          avgBytes: 10240,
          lastSeenAt: '2026-11-07T20:32:00.000Z',
        },
      ],
      operations: [
        {
          pagePath: '/dashboard/you',
          source: 'section_stream',
          operation: 'sections-stream:self',
          requests: 165,
          p50Ms: 68,
          p95Ms: 190,
          avgMs: 79,
          maxMs: 320,
          slowCount: 0,
          failedCount: 0,
        },
      ],
      alerts: [],
    });
  });

  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      'aiadastra_admin_session',
      JSON.stringify({
        token: 'e2e-staff-token',
        expiresAt: '2029-01-01T00:00:00.000Z',
        me: {
          id: 'staff-1',
          username: 'adastra-superadmin',
          displayName: 'Sachin (Superadmin)',
          role: 'superadmin',
        },
      }),
    );
  });

  // 7. Admin Research Lab — Self (You) board + 3-Decade Character Evolution + Moon/Mercury Joy
  await page.goto('http://admin.local/research-lab');
  await expect(page.getByTestId('board-area-self')).toBeVisible();
  await expect(page.getByTestId('panel-dashboard')).toContainText('3-Decade Character Evolution');
  await expect(page.getByTestId('panel-dashboard')).toContainText('Vedic Personality & What Brings You Joy');
  await page.screenshot({ path: path.join(P5_SCREENSHOT_DIR, '07-admin-research-lab-self-board.png'), fullPage: true });

  // 8. Admin Research Lab — Love board
  await page.getByTestId('board-area-love').click();
  await expect(page.getByTestId('panel-dashboard')).toContainText('Love & Bonds');
  await page.screenshot({ path: path.join(P5_SCREENSHOT_DIR, '08-admin-research-lab-love-board.png'), fullPage: true });

  // 9. Admin Research Lab — Work board
  await page.getByTestId('board-area-work').click();
  await expect(page.getByTestId('panel-dashboard')).toContainText('10H');
  await page.screenshot({ path: path.join(P5_SCREENSHOT_DIR, '09-admin-research-lab-work-board.png'), fullPage: true });

  // 10. Admin Research Lab — 10-Step Technical Trace & 8-Gate Independent Verifier
  await page.getByTestId('tab-verifier').click();
  await expect(page.getByTestId('panel-verifier')).toContainText('Independent Technical Verifier Agent');
  await page.screenshot({ path: path.join(P5_SCREENSHOT_DIR, '10-admin-research-lab-10step-trace-and-verifier.png'), fullPage: true });

  // 11. Admin Page Response Times & Per-Request Execution Logs (/pages)
  await page.goto('http://admin.local/pages');
  await expect(page.getByTestId('page-kpi-Total executions')).toContainText('420');
  await page.screenshot({ path: path.join(P5_SCREENSHOT_DIR, '11-admin-page-timing-telemetry.png'), fullPage: true });
});
