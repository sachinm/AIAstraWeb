import { expect, test } from '@playwright/test';
import { newState, signIn, stubApi } from './stubApi';

/** The Work board, career map Phase 1 (server docs/reading-engine/42–45), against a stubbed API. */
const MAP = {
  asOf: '2026-11-05',
  month: '2026-11',
  present: { tone: 'demanding', confidence: 'likely', votes: [{ family: 'main', label: 'Main clock', vote: 'test', planet: 'Sa' }], available: 5, agree: 3, ease_date: '2026-12-10', window_end: null, next_window_start: null, security: 'watch' },
  ahead: [{ subarea: 'promotion', side: 'support', from: '2027-03-01', to: '2027-05-31', peakMonth: '2027-04', band: 'high', score: 9, families: ['main', 'rasi', 'transit'], drivers: ['Ju'] }],
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

test('work board: tone first, one question, four pages, looking back', async ({ page }) => {
  const s = newState();
  let work: string | null = null;
  const checks: Record<string, string> = {};
  await stubApi(page, s);
  await page.route('**/api/area/career', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', map: MAP, work, checks }) }));
  await page.route('**/api/profile/work-status', (r) => {
    work = (r.request().postDataJSON() as { value: string }).value;
    return r.fulfill({ status: 204 });
  });
  await page.route('**/api/area/career/checks', (r) => {
    const b = r.request().postDataJSON() as { month: string; answer: string };
    checks[b.month] = b.answer;
    return r.fulfill({ status: 204 });
  });
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await signIn(page);
  await page.goto('/dashboard/work');

  await expect(page.getByTestId('tone-card')).toContainText('A demanding stretch at work. It eases from 10 Dec 2026.');
  await page.getByTestId('work-question').getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByTestId('work-question')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Looking back' }).click();
  await page.getByTestId('back-2026-03').getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByTestId('confirmed-line')).toContainText('You confirmed 1 of 1.');

  await page.getByRole('tab', { name: 'Ahead' }).click();
  await page.getByRole('tab', { name: '6 months' }).click();
  await expect(page.getByTestId('rung-6')).toContainText('A promotion: 1 Mar 2027 – 31 May 2027');

  const t = (await page.getByTestId('work-page').textContent())!.toLowerCase();
  for (const w of ['storm', 'hospital', 'urgent', 'resort', 'saturn', 'dasha']) expect(t).not.toContain(w);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
