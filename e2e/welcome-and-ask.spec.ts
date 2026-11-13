import { expect, test } from '@playwright/test';
import { newState, signIn, stubApi } from './stubApi';

/** The personalization wizard (doc 52) and Ask everywhere (doc 51), against a stubbed API. No camera in the test
 * browser, so the selfie step falls back to "Continue without a photo". */
test('welcome wizard: no camera falls back, answers saved, skip-able', async ({ page }) => {
  const s = newState();
  const saved: unknown[] = [];
  await stubApi(page, s);
  await page.route('**/api/profile/facts', (r) => {
    if (r.request().method() === 'PUT') saved.push((r.request().postDataJSON() as { facts: unknown }).facts);
    return r.fulfill({ status: 204 });
  });
  await page.route('**/api/profile/photo', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/area/career', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/lucky/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await signIn(page);
  await page.goto('/welcome');

  await expect(page.getByTestId('selfie-step')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeDisabled();
  await page.getByRole('button', { name: /Continue without a photo|I'd rather not/ }).click();
  await page.getByLabel('City, country').fill('Pune, India');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page).toHaveURL(/\/dashboard\/(today|chat)/);
  expect(saved).toEqual(expect.arrayContaining([{ 'wizard.selfie': 'skipped' }, { 'place.current': 'Pune, India' }, { 'work.status': 'yes' }]));
});

test('ask everywhere: the Work board opens a 98% reading modal; the avatar menu offers General Reading', async ({ page }) => {
  const s = newState();
  await stubApi(page, s);
  await page.route('**/api/area/career', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', work: 'yes', checks: {}, map: { asOf: '2026-11-05', month: '2026-11', present: { tone: 'steady', confidence: 'likely', votes: [], available: 5, agree: 2, ease_date: null, window_end: null, next_window_start: null, security: 'clear' }, ahead: [], horizons: [1, 3, 6, 12].map((m) => ({ months: m, best: null, hardest: null, quiet: true })), security: [], back: [], notes: [] } }) }),
  );
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/profile/photo', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await signIn(page);
  await page.goto('/dashboard/work');

  const vp = page.viewportSize()!;
  await page.getByRole('button', { name: 'Open profile menu' }).click();
  await expect(page.getByTestId('menu-general-reading')).toContainText('General Reading');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('menu-general-reading')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ask about Work' }).click();
  const modal = page.getByTestId('ask-modal');
  await expect(modal).toBeVisible();
  const box = (await modal.boundingBox())!;
  expect(box.width / vp.width).toBeGreaterThan(0.96);
  expect(box.height / vp.height).toBeGreaterThan(0.96);
  await expect(modal.getByPlaceholder('Ask about your work map…')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});
