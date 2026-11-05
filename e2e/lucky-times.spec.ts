import { expect, test, type Page, type Route } from '@playwright/test';
import { newState, signIn, stubApi } from './stubApi';

/**
 * Lucky times end to end (server docs/reading-engine/49-lucky-times-test-plan.md §3) against a stubbed API: place set
 * once, plans added from the catalog, one layer per plan, the one-tap question, Why, hide and remove, no month view, and
 * the analytics events the page sends.
 */
interface LuckyStub {
  place: string | null;
  picks: Array<{ scenario: string; shown: boolean; answers: Record<string, string> }>;
  events: Array<{ event: string; target?: string }>;
}

const CATALOG = [
  { area: 'work', label: 'Work', scenarios: [{ id: 'work.sign_contract', label: 'Sign a contract', ask: null }, { id: 'work.hard_talk_boss', label: 'A hard talk with the boss', ask: 'who' }] },
  { area: 'love', label: 'Love', scenarios: [{ id: 'love.first_date', label: 'A first date', ask: 'relationship' }] },
];

function range(l: LuckyStub) {
  const today = new Date().toISOString().slice(0, 10);
  const days = [];
  for (let i = -7; i <= 14; i++) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const layers = Object.fromEntries(
      l.picks.filter((p) => p.shown).map((p, k) => [p.scenario, { verdict: 'good', windows: [{ from: 600 + k * 120, to: 660 + k * 120, score: 6, reasons: ['abhijit', 'hora:Jupiter'] }], dayReasons: [] }]),
    );
    days.push({ date: d.toISOString().slice(0, 10), weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()], sunrise: 400, sunset: 1020, personal: null, avoid: [{ kind: 'rahu_kalam', from: 780, to: 860 }], good: [{ kind: 'abhijit', from: 690, to: 732 }], layers });
  }
  return { status: 'ok', place: l.place, today, nowMin: 700, from: days[0]!.date, to: days[days.length - 1]!.date, missing: [], now: { kind: 'good', what: 'abhijit', until: 732 }, days };
}

async function stubLucky(page: Page, l: LuckyStub) {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
  await page.route('**/api/lucky/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const body = req.postDataJSON?.() as Record<string, any> | null;
    if (url.pathname.endsWith('/setup')) return json(route, { place: l.place, places: [{ key: 'sanjose', name: 'San Jose, US' }, { key: 'pune', name: 'Pune, IN' }], scenarios: CATALOG, picks: l.picks });
    if (url.pathname.endsWith('/place')) {
      l.place = body!.place;
      return route.fulfill({ status: 204 });
    }
    if (url.pathname.endsWith('/picks') && method === 'POST') {
      const p = { scenario: body!.scenario, shown: true, answers: {} };
      l.picks.push(p);
      return json(route, { pick: p }, 201);
    }
    if (url.pathname.includes('/picks/')) {
      const id = decodeURIComponent(url.pathname.split('/picks/')[1]!);
      if (method === 'DELETE') {
        l.picks = l.picks.filter((p) => p.scenario !== id);
        return route.fulfill({ status: 204 });
      }
      const p = l.picks.find((x) => x.scenario === id)!;
      if (body?.shown !== undefined) p.shown = body.shown;
      if (body?.answers) p.answers = { ...p.answers, ...body.answers };
      return json(route, { pick: p });
    }
    if (url.pathname.endsWith('/range')) return json(route, range(l));
    return json(route, { error: 'not_found' }, 404);
  });
  await page.route('**/api/analytics/events', async (route) => {
    l.events.push(...((route.request().postDataJSON() as { events: LuckyStub['events'] }).events ?? []));
    return route.fulfill({ status: 204 });
  });
}

test('lucky times: place once, plans, layers, question, why, hide, remove, events', async ({ page }) => {
  const s = newState();
  const l: LuckyStub = { place: null, picks: [], events: [] };
  await stubApi(page, s);
  await stubLucky(page, l);
  await signIn(page);
  await page.goto('/dashboard/lucky');

  await expect(page.getByRole('dialog', { name: 'Where are you?' })).toBeVisible();
  await page.getByRole('button', { name: 'San Jose' }).click();
  await expect(page.getByText('What are you planning?')).toBeVisible();

  await page.getByRole('button', { name: /Add a plan/ }).click();
  await expect(page.getByRole('menuitem')).toHaveCount(3);
  await page.getByRole('menuitem', { name: 'Sign a contract' }).click();
  await expect(page.getByTestId('today-work.sign_contract')).toBeVisible();

  await page.getByRole('button', { name: /^\+ Add$/ }).click();
  await page.getByRole('menuitem', { name: 'A hard talk with the boss' }).click();
  await expect(page.getByTestId('ask-card')).toContainText('Who is it with?');
  await page.getByRole('button', { name: 'My boss' }).click();
  await expect(page.getByTestId('ask-card')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Calendar' }).click();
  await expect(page.getByRole('tab', { name: 'This week' })).toBeVisible();
  await expect(page.getByText(/month/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Sign a contract \d/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^A hard talk with the boss \d/ }).first()).toBeVisible();

  await page.getByRole('button', { name: /^Sign a contract \d/ }).first().click();
  await expect(page.getByTestId('why-sheet')).toContainText('Abhijit muhurta');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Sign a contract', pressed: true }).click();
  await expect(page.getByRole('button', { name: /^Sign a contract \d/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove A hard talk with the boss' }).click();
  await expect(page.getByRole('button', { name: 'A hard talk with the boss', pressed: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Where are you?' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign a contract', exact: true })).toBeVisible();

  // no place text on the board, and no horizontal scroll
  await expect(page.getByTestId('lucky-page')).not.toContainText('San Jose');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await expect.poll(() => l.events.map((e) => e.event), { timeout: 15_000 }).toEqual(expect.arrayContaining(['place_set', 'scenario_add', 'scenario_answer', 'view_select', 'why_open', 'scenario_layer_toggle', 'scenario_remove']));
});
