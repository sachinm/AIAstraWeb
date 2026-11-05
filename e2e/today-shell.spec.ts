import { expect, test } from '@playwright/test';
import { newState, signIn, stubApi } from './stubApi';

/** The boards shell, Phase 0 (server docs/reading-engine/45 §4): Today home, the tab bar, Work live, Love says it comes next. */
test('today shell: home, tab bar, boards', async ({ page }) => {
  const s = newState();
  await stubApi(page, s);
  await page.route('**/api/area/career', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', work: 'yes', checks: {}, map: { asOf: '2026-11-05', month: '2026-11', present: { tone: 'steady', confidence: 'likely', votes: [], available: 5, agree: 2, ease_date: null, window_end: null, next_window_start: '2027-03-01', security: 'clear' }, ahead: [], horizons: [1, 3, 6, 12].map((m) => ({ months: m, best: null, hardest: null, quiet: true })), security: [], back: [], notes: [] } }) }),
  );
  await page.route('**/api/lucky/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await signIn(page);
  await page.goto('/dashboard/today');

  await expect(page.getByTestId('today-line')).toContainText('A steady period at work. Build until 1 Mar 2027.');
  await expect(page.getByTestId('board-tabbar')).toBeVisible();
  await page.getByTestId('board-tabbar').getByRole('link', { name: 'Work' }).click();
  await expect(page.getByTestId('tone-card')).toContainText('Steady');
  await page.getByTestId('board-tabbar').getByRole('link', { name: 'Love' }).click();
  await expect(page.getByTestId('love-page')).toContainText('being built next');
  await page.getByTestId('board-tabbar').getByRole('link', { name: 'Today' }).click();
  await expect(page.getByTestId('today-page')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
