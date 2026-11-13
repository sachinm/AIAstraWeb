import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { newState, signIn, stubApi } from './stubApi';
import { LOVE_BOARD, WORK_MAP } from './boardFixtures';
import { selfV3Fixture, selfV3Unchosen } from '../src/pages/you/v3/selfV3.fixture';

/**
 * The designed card picker and card options (server docs/reading-engine/71). Stubbed API, no real data. Screens saved
 * to docs/screenshots/71-card-picker/<device>/, dark then light.
 * `npx playwright test --config e2e/playwright.config.ts card-picker`.
 */
const ROOT = path.resolve('docs/screenshots/71-card-picker');

const LOVE_CAT = {
  groups: [
    { id: 'bond', title: 'You two' },
    { id: 'meeting', title: 'Meeting and waiting' },
    { id: 'circle', title: 'Family and friends' },
  ],
  cards: [
    { id: 'love_where', group: 'bond', title: 'Where love stands', description: 'The state of your close bonds this year, period by period', suggested: true, available: true, unavailableReason: null, subareas: ['*'] },
    { id: 'love_between', group: 'bond', title: 'How things are between you', description: 'Warmth and strain with your partner through the year', suggested: true, available: true, unavailableReason: null, subareas: ['health', 'romance'] },
    { id: 'love_strain', group: 'bond', title: 'Distance or tension', description: 'What strains it, from where, when it eases, what holds it', suggested: true, available: true, unavailableReason: null, subareas: ['strain'] },
    { id: 'love_commitment', group: 'bond', title: 'Commitment', description: 'When a bond can be made firm', suggested: false, available: true, unavailableReason: null, subareas: ['commitment'] },
    { id: 'love_reconcile', group: 'bond', title: 'Getting back together', description: 'Whether and when a door reopens', suggested: false, available: true, unavailableReason: null, subareas: ['reconcile'] },
    { id: 'love_meet', group: 'meeting', title: 'Meeting someone', description: 'When meeting is likely and what to do in the quiet months', suggested: true, available: true, unavailableReason: null, subareas: ['meet'] },
    { id: 'love_delay', group: 'meeting', title: 'Why it is taking time', description: 'What is slowing it, since when, until when', suggested: true, available: true, unavailableReason: null, subareas: ['delay'] },
    { id: 'love_partner', group: 'meeting', title: 'The partner you draw', description: 'The kind of person you are drawn to and who suits you', suggested: false, available: false, unavailableReason: 'Coming soon', subareas: [] },
    { id: 'love_family', group: 'circle', title: 'Family and in-laws', description: 'How family acceptance and the home sit this year', suggested: true, available: true, unavailableReason: null, subareas: ['family_accept'] },
    { id: 'love_friends', group: 'circle', title: 'Friendships', description: 'The friends who carry you and when to lean on them', suggested: false, available: true, unavailableReason: null, subareas: ['friends'] },
  ],
};
const WORK_CAT = {
  groups: [
    { id: 'standing', title: 'Where you stand' },
    { id: 'money', title: 'Money and moves' },
    { id: 'growth', title: 'Growth' },
  ],
  cards: [
    { id: 'work_where', group: 'standing', title: 'Where work stands', description: 'The state of your working life this year, period by period', suggested: true, available: true, unavailableReason: null, subareas: ['*'] },
    { id: 'work_wears', group: 'standing', title: 'What wears you at work', description: 'Load, conflict, a difficult superior: since when, until when', suggested: true, available: true, unavailableReason: null, subareas: ['job_security'] },
    { id: 'work_recognition', group: 'standing', title: 'Recognition', description: 'Being seen, promoted, credited', suggested: false, available: true, unavailableReason: null, subareas: ['promotion'] },
    { id: 'work_leading', group: 'standing', title: 'Leading people', description: 'Authority and those who report to you', suggested: false, available: false, unavailableReason: 'Coming soon', subareas: [] },
    { id: 'work_money', group: 'money', title: 'Money coming in', description: 'Income and gains through the year: thin stretches and openings', suggested: true, available: true, unavailableReason: null, subareas: ['pay'] },
    { id: 'work_move', group: 'money', title: 'The next move', description: 'A change of role, employer or direction: when to prepare, when to act', suggested: true, available: true, unavailableReason: null, subareas: ['job_change', 'abroad'] },
    { id: 'work_finding', group: 'money', title: 'Finding work', description: 'The search: when it opens, what to do meanwhile', suggested: false, available: true, unavailableReason: null, subareas: ['get_job'] },
    { id: 'work_build', group: 'growth', title: 'What to build', description: 'The skill or standing to build in the easier months', suggested: false, available: false, unavailableReason: 'Coming soon', subareas: [] },
    { id: 'work_venture', group: 'growth', title: 'Your own venture', description: 'Starting or steering a business', suggested: false, available: true, unavailableReason: null, subareas: ['business'] },
  ],
};

async function stubBoards(page: Page) {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  let self = selfV3Unchosen();
  const layouts: Record<string, { cards: string[]; options: Record<string, unknown> }> = { love: { cards: [], options: {} }, work: { cards: [], options: {} } };
  const view = (b: string) => ({
    board: b,
    ...layouts[b]!,
    effective: Object.fromEntries(
      layouts[b]!.cards.map((id) => {
        const o = { length: 'usual', view: 'year', words: 'plain', plan: 'with', ...(layouts[b]!.options[id] as object) };
        return [id, { options: o, notes: o.view === 'arc' ? ['The long arc shows the next three years here.'] : [] }];
      }),
    ),
    chosen: layouts[b]!.cards.length > 0,
    updatedAt: null,
  });
  await page.route('**/api/self/v3', (r) => json(r, self));
  await page.route('**/api/self/v3/layout', (r) => {
    const body = r.request().postDataJSON();
    const full = selfV3Fixture();
    self = { ...full, layout: { ...full.layout, ...body, chosen: true } };
    return json(r, self.layout);
  });
  await page.route('**/api/board/*/v3/catalogue', (r) => json(r, r.request().url().includes('/love/') ? LOVE_CAT : WORK_CAT));
  await page.route('**/api/board/*/v3/layout', (r) => {
    const b = r.request().url().includes('/love/') ? 'love' : 'work';
    if (r.request().method() === 'PUT') layouts[b] = { cards: r.request().postDataJSON().cards, options: r.request().postDataJSON().options ?? {} };
    return json(r, view(b));
  });
  await page.route('**/api/area/love', (r) => json(r, { status: 'ok', built_at: '2026-11-02', cached: true, focus: null, ask: false, board: LOVE_BOARD, checks: {}, made_at: '2026-11-02T06:00:00.000Z', valid_until: '2026-12-02', refresh_due: false }));
  await page.route('**/api/area/career', (r) => json(r, { status: 'ok', map: WORK_MAP, work: 'yes', checks: {}, built_at: '2026-11-09', cached: true, made_at: '2026-11-09T10:00:00.000Z', valid_until: '2026-12-20', refresh_due: false }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));
  // the throwaway art key the build used for this run (E2E_ART_KEY), as the API serves it to a signed-in session
  const hex = process.env.E2E_ART_KEY ?? '';
  if (hex) await page.route('**/api/assets/overlay-key', (r) => json(r, { key: Buffer.from(hex, 'hex').toString('base64'), version: 'e2e' }));
}

for (const theme of ['dark', 'light'] as const) {
  test(`${theme}: designed card pickers on Self, Love and Work, and card options`, async ({ page }, info) => {
    const dir = path.join(ROOT, info.project.name);
    mkdirSync(dir, { recursive: true });
    await stubApi(page, newState({ used: 3 }));
    await stubBoards(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((t) => localStorage.setItem('aiastra.theme', t), theme);
    await signIn(page);
    let n = theme === 'dark' ? 0 : 20;
    const shot = async (name: string) => page.screenshot({ path: path.join(dir, `${String(++n).padStart(2, '0')}-${name}-${theme}.png`) });
    const phone = info.project.name === 'phone';

    // Self: the first visit opens the picker
    await page.goto('/dashboard/you?v2=1');
    await expect(page.getByTestId('self-v3-picker')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('card-art-body')).toBeVisible();
    if (process.env.E2E_ART_KEY) await expect(page.getByTestId('card-photo-body')).toBeVisible({ timeout: 15_000 });
    await shot('self-picker');
    await page.getByTestId('picker-add-suggested').click();
    await shot('self-picker-suggested-on');
    // the tray of chosen cards must never widen the page (2026-11-11 finding)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('picker-done')).toBeInViewport();
    if (!phone) {
      await page.getByTestId('picker-groups').evaluate((el) => (el.scrollTop = el.scrollHeight));
      await shot('self-picker-indian-lens');
    }
    await page.getByTestId('picker-done').click();
    await expect(page.getByTestId('self-v3-picker')).toBeHidden({ timeout: 15_000 });
    // The old "Edit sections" popover is gone: the card toolbar carries the faces and tools, the gear the board's defaults.
    await expect(page.locator('[data-testid^="face-body-"]').first()).toBeVisible();
    await page.getByTestId('board-settings-open').click();
    await expect(page.getByTestId('board-settings-panel')).toBeVisible();
    await shot('self-card-options');
    await page.getByTestId('bs-close').click();

    // Love: nothing forced; Your cards opens the picker in a sheet
    await page.goto('/dashboard/love');
    await expect(page.getByTestId('area-cards-open')).toBeVisible({ timeout: 30_000 });
    await shot('love-board-button');
    await page.getByTestId('area-cards-open').click();
    await expect(page.getByTestId('area-cards-sheet')).toBeVisible();
    if (process.env.E2E_ART_KEY) await expect(page.getByTestId('card-photo-love_where')).toBeVisible({ timeout: 15_000 });
    await shot('love-picker');
    await page.getByTestId('picker-add-suggested').click();
    await page.getByTestId('picker-options-love_meet').click();
    await page.getByTestId('opt-love_meet-view-now').click();
    await page.getByTestId('opt-love_meet-length-glance').click();
    await page.getByTestId('card-options-love_meet').scrollIntoViewIfNeeded();
    await shot('love-picker-options');
    await page.getByTestId('picker-done').click();
    await expect(page.getByTestId('area-card-chips')).toBeVisible();
    await page.getByTestId('area-card-chip-love_meet').click();
    await shot('love-board-chips');

    // Work
    await page.goto('/dashboard/work');
    await expect(page.getByTestId('area-cards-open')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('area-cards-open').click();
    await expect(page.getByTestId('area-cards-sheet')).toBeVisible();
    if (process.env.E2E_ART_KEY) await expect(page.getByTestId('card-photo-work_where')).toBeVisible({ timeout: 15_000 });
    await shot('work-picker');
    await page.getByTestId('picker-add-suggested').click();
    await page.getByTestId('picker-options-work_money').click();
    await page.getByTestId('opt-work_money-view-arc').click();
    await page.getByTestId('card-options-work_money').scrollIntoViewIfNeeded();
    await shot('work-picker-options');
    await page.getByTestId('picker-done').click();
    await expect(page.getByTestId('area-card-chips')).toBeVisible();
    await page.getByTestId('area-card-chip-work_money').click();
    await shot('work-board-chips');

    const text = (await page.locator('body').textContent())!.toLowerCase();
    for (const w of ['radha', 'pyjhora']) expect(text).not.toContain(w);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
