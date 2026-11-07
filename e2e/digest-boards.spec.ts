import { expect, test, type Page, type Route } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { newState, signIn, stubApi } from './stubApi';
import { BANNED_ON_BOARD } from '../src/pages/lucky/words';

/**
 * Digest boards Wave 1–3 end-to-end verification & screenshot pass:
 * You (/dashboard/you), Love (/dashboard/love), Work (/dashboard/work),
 * Lucky Times (/dashboard/lucky), and Life Reading (/profile/timeline).
 */

const SERVER_SCREENSHOT_DIR = 'C:/Users/Owner/Documents/work/AIAstra_Server/docs/screenshots/p4-01-digest-boards-wave1-3';
const BRAIN_SCREENSHOT_DIR = 'C:/Users/Owner/.gemini/antigravity/brain/3dd78bf0-3477-463d-b316-67ebf3b900bd';

const YOU_BOARD = {
  asOf: '2026-11-05',
  tone: {
    tone: 'open',
    confidence: 'likely',
    families: [
      { family: 'main', vote: 'support' },
      { family: 'rasi', vote: 'support' },
      { family: 'annual', vote: 'neutral' },
    ],
    date: '2027-05-31',
  },
  supports: [
    { text: 'Your sense of self has firm footing.', evidence: ['D1.h1 lord Ma in h10 (kendra)'] },
    { text: 'Something steady watches over your feelings.', evidence: ['D1.Mo aspected_by Ju'] },
  ],
  pressures: [
    { text: 'A heavy influence presses on your peace of mind.', until: '2031-03-01', evidence: ['D1.h4 occupant Sa'] },
    { text: 'Your ideas and learning takes more effort than it looks.', until: null, evidence: ['D1.h5 lord Su in h8 (dusthana)'] },
  ],
  ahead: [
    { subarea: 'growth', label: 'A clear stretch for a fresh start', from: '2026-11-05', to: '2027-05-31', side: 'support', grade: 'strong', systems: ['vimshottari', 'yogini'] },
    { subarea: 'mind', label: 'A slower stretch: give it room', from: '2027-06-01', to: '2028-10-31', side: 'test', grade: 'moderate', systems: ['vimshottari'] },
    { subarea: 'purpose', label: 'A good stretch to build', from: '2026-11-05', to: '2027-05-31', side: 'support', grade: 'moderate', systems: ['vimshottari'] },
  ],
  year: { year: 2026, note: "This year's chart backs you: a good year to begin something of your own." },
  back: [
    { month: '2026-02', side: 'support', label: 'a lighter, stronger stretch for you began' },
    { month: '2025-09', side: 'test', label: 'a heavier stretch for you began' },
  ],
  notes: [],
};

const LOVE_BOARD = {
  asOf: '2026-11-05',
  tone: {
    tone: 'demanding',
    confidence: 'split',
    families: [
      { family: 'main', vote: 'test' },
      { family: 'transit', vote: 'test' },
    ],
    date: '2027-03-03',
  },
  supports: [{ text: 'Your partnerships has firm footing.', evidence: ['D1.h7 lord Ve in h7 (kendra)'] }],
  pressures: [{ text: 'A heavy influence presses on your partnerships.', until: '2027-03-01', evidence: ['D1.h7 aspected_by Sa'] }],
  ahead: [
    { subarea: 'health', label: 'A tense stretch: go gently', from: '2026-11-05', to: '2027-03-02', side: 'test', grade: 'moderate', systems: ['vimshottari'] },
    { subarea: 'friends', label: 'A good stretch', from: '2027-04-01', to: '2027-12-31', side: 'support', grade: 'moderate', systems: ['vimshottari'] },
  ],
  year: { year: 2026, note: "This year's chart asks for patience in love: go slowly with big decisions." },
  back: [],
  notes: [],
};

const WORK_MAP = {
  asOf: '2026-11-05',
  month: '2026-11',
  present: {
    tone: 'demanding',
    confidence: 'likely',
    votes: [{ family: 'main', label: 'Main clock', vote: 'test', planet: 'Sa' }],
    available: 5,
    agree: 3,
    ease_date: '2026-12-10',
    window_end: null,
    next_window_start: null,
    security: 'watch',
  },
  ahead: [
    { subarea: 'promotion', side: 'support', from: '2027-03-01', to: '2027-05-31', peakMonth: '2027-04', band: 'high', score: 9, families: ['main', 'rasi', 'transit'], drivers: ['Ju'] },
  ],
  horizons: [
    { months: 1, best: null, hardest: null, quiet: true },
    { months: 3, best: null, hardest: null, quiet: true },
    { months: 6, best: { subarea: 'promotion', side: 'support', from: '2027-03-01', to: '2027-05-31', peakMonth: '2027-04', band: 'high', score: 9, families: ['main'], drivers: ['Ju'] }, hardest: null, quiet: false },
    { months: 12, best: null, hardest: null, quiet: true },
  ],
  security: [],
  back: [{ month: '2026-03', side: 'test', band: 'moderate', label: 'a demanding stretch at work began' }],
  notes: [],
};

const LUCKY_CATALOG = [
  {
    area: 'work',
    label: 'Work',
    scenarios: [
      { id: 'work.sign_contract', label: 'Sign a contract', ask: null },
      { id: 'work.hard_talk_boss', label: 'A hard talk with the boss', ask: 'who' },
    ],
  },
  {
    area: 'love',
    label: 'Love',
    scenarios: [{ id: 'love.first_date', label: 'A first date', ask: 'relationship' }],
  },
];

const LIFE_READING = {
  status: 'ok',
  built_at: '2026-11-05',
  cached: false,
  rule_now: 'Until 7 Feb 2027, hold off on big decisions that are hard to undo: signing, quitting, buying, ending.',
  areas: [
    {
      id: 'work',
      label: 'Work',
      verdict: 'promised',
      score: 74,
      issue: 'Your current chapter is testing work until 7 Feb 2027. Has work felt harder to move lately?',
      cause: {
        planets: ['Rahu', 'Saturn'],
        dashas: ['Vimshottari Moon–Rahu (to 7 Feb 2027)'],
        text: 'Mostly because the chapter you are in now leans against this part of life.',
      },
      improves: [
        { from: '2027-02-07', to: '2027-09-15', md: 'Moon', ad: 'Saturn', systems: ['Vimshottari', 'Yogini'], grade: 'moderate', basis: 'moderate: two systems agree' },
      ],
      solution: ['Keep a running list of what you delivered.', 'Act between 7 Feb 2027 and 15 Sep 2027: what you prepare now is used then.'],
      grade: 'moderate',
      basis: 'moderate: two systems agree',
    },
    {
      id: 'money',
      label: 'Money',
      verdict: 'partial',
      score: 52,
      issue: 'No sign of pressure on money and savings right now.',
      cause: { planets: [], dashas: [], text: 'Your chart shows steady support here.' },
      improves: [
        { from: '2028-03-01', to: '2029-01-10', md: 'Mars', ad: 'Jupiter', systems: ['Vimshottari', 'Narayana', 'Yogini', 'Dwisaptati'], grade: 'strong', basis: 'strong: four systems agree, the year chart confirms' },
      ],
      solution: ['Keep a simple monthly record of what comes in and what goes out.'],
      grade: 'strong',
      basis: 'strong: four systems agree, the year chart confirms',
    },
  ],
};

function buildLuckyRange(picks: Array<{ scenario: string; shown: boolean; answers: Record<string, string> }>) {
  const today = new Date().toISOString().slice(0, 10);
  const days = [];
  for (let i = -7; i <= 14; i++) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const layers = Object.fromEntries(
      picks
        .filter((p) => p.shown)
        .map((p, k) => [
          p.scenario,
          {
            verdict: 'good',
            windows: [
              {
                from: 600 + k * 120,
                to: 660 + k * 120,
                score: 6,
                reasons: [
                  { key: 'abhijit', scope: 'general' },
                  { key: 'hora:Jupiter', scope: 'general' },
                  { key: 'personal:tara_good', scope: 'personal' },
                ],
                reasonKeys: ['abhijit', 'hora:Jupiter', 'personal:tara_good'],
              },
            ],
            dayReasons: [],
          },
        ]),
    );
    days.push({
      date: d.toISOString().slice(0, 10),
      weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()],
      sunrise: 400,
      sunset: 1020,
      personal: { tara_good: true, moon_good: true },
      avoid: [{ kind: 'rahu_kalam', from: 780, to: 860 }],
      good: [{ kind: 'abhijit', from: 690, to: 732 }],
      yoga: { name: 'Siddha', endHour: 18.5 },
      karana: { name: 'Bava', endHour: 14.25 },
      layers,
    });
  }
  return {
    status: 'ok',
    place: 'sanjose',
    today,
    nowMin: 700,
    from: days[0]!.date,
    to: days[days.length - 1]!.date,
    missing: [],
    now: { kind: 'good', what: 'abhijit', until: 732 },
    days,
  };
}

async function saveShot(page: Page, filename: string, saveToTargets: boolean): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
  if (!saveToTargets) return;
  mkdirSync(SERVER_SCREENSHOT_DIR, { recursive: true });
  mkdirSync(BRAIN_SCREENSHOT_DIR, { recursive: true });
  const serverPath = path.join(SERVER_SCREENSHOT_DIR, filename);
  const brainPath = path.join(BRAIN_SCREENSHOT_DIR, filename);
  await page.screenshot({ path: serverPath, fullPage: true });
  copyFileSync(serverPath, brainPath);
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
  await page.route('**/api/profile/facts', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/profile/work-status', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/area/*/checks', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));

  await signIn(page);

  // 1. You board (/dashboard/you)
  await page.goto('/dashboard/you');
  await expect(page.getByTestId('tone-card')).toContainText('A clear stretch for a fresh start. Begin before 31 May 2027.');
  await expect(page.getByAltText('Shri Ganesh')).toBeVisible();
  const youText = (await page.getByTestId('you-page').textContent())!.toLowerCase();
  for (const w of [...BANNED_ON_BOARD, 'house', 'lord', 'kendra', 'dusthana', 'aspected', 'd1.']) {
    expect(youText).not.toContain(w);
  }
  await assertNoOverflow(page);
  await saveShot(page, '01-you-board.png', saveToTargets);

  // 2. Love board (/dashboard/love)
  await page.goto('/dashboard/love');
  await expect(page.getByTestId('tone-card')).toContainText('A strained stretch in love. It eases from 3 Mar 2027.');
  const loveText = (await page.getByTestId('love-page').textContent())!.toLowerCase();
  for (const w of [...BANNED_ON_BOARD, 'divorce', 'cheat', 'house', 'lord', 'aspected']) {
    expect(loveText).not.toContain(w);
  }
  await assertNoOverflow(page);
  await saveShot(page, '02-love-board.png', saveToTargets);

  // 3. Work board (/dashboard/work)
  await page.goto('/dashboard/work');
  await expect(page.getByTestId('tone-card')).toContainText('A demanding stretch at work. It eases from 10 Dec 2026.');
  const workText = (await page.getByTestId('work-page').textContent())!.toLowerCase();
  for (const w of BANNED_ON_BOARD) {
    expect(workText).not.toContain(w);
  }
  await assertNoOverflow(page);
  await saveShot(page, '03-work-board.png', saveToTargets);

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
