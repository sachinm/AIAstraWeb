import { expect, test, type Page, type Route } from '@playwright/test';
import { newState, signIn, stubApi } from './stubApi';
import { selfV3Fixture } from '../src/pages/you/v3/selfV3.fixture';

async function stubSelfV3(page: Page) {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  const fixture = selfV3Fixture();
  // Make `lagna` a zero-optional-tool card (single untoned stretch, no ladder) so we test empty-toolbar suppression alongside rich cards
  const lagna = fixture.cards.find((c) => c.id === 'lagna');
  if (lagna) {
    lagna.rail = lagna.rail.slice(0, 1);
    if (lagna.v2?.card) lagna.v2.card.ladder = null;
  }
  fixture.layout.cards = ['body', 'stuck', 'lagna', 'mind', 'chapter', 'diagnosis', 'drive', 'year'];

  let current = fixture;
  await page.route('**/api/self/v3', (r) => json(r, current));
  await page.route('**/api/self/v3/layout', (r) => {
    const body = r.request().postDataJSON();
    current = { ...current, layout: { ...current.layout, ...body, chosen: true, updatedAt: '2026-11-14T12:00:00Z' } };
    return json(r, current.layout);
  });
  await page.route('**/api/self/v3/confirm', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/analytics/events', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/telemetry/page-render', (r) => json(r, { ok: true }));
}

test('real Chromium layout, container queries, tool vetting, single-tab-stop toolbar, and required Chart details', async ({ page }, info) => {
  await stubApi(page, newState({ used: 2 }));
  await stubSelfV3(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);

  await page.goto('/dashboard/you');
  const bodyCard = page.getByTestId('v3-card-body');
  await expect(bodyCard).toBeVisible({ timeout: 30_000 });

  // 1. Vetted tools on `body`: table, calendar, dates, timeframe, plan; `info` omitted; Chart details visible
  await expect(bodyCard.getByTestId('tool-table')).toBeVisible();
  await expect(bodyCard.getByTestId('tool-calendar')).toBeVisible();
  await expect(bodyCard.getByTestId('tool-dates')).toBeVisible();
  await expect(bodyCard.getByTestId('tool-timeframe')).toBeVisible();
  await expect(bodyCard.getByTestId('tool-plan')).toBeVisible();
  await expect(bodyCard.getByTestId('tool-info')).toHaveCount(0);
  await expect(bodyCard.getByTestId('toolbar-details')).toBeVisible();
  await expect(bodyCard.getByTestId('card-details-open')).toBeVisible();

  // 2. Separator has a real CSS border and active buttons have a non-none inset box-shadow cue
  const sepBorderWidth = await bodyCard.getByRole('separator').evaluate((el) => getComputedStyle(el).borderLeftWidth);
  expect(sepBorderWidth).toBe('1px');
  const activeBoxShadow = await bodyCard.getByTestId('face-read').evaluate((el) => getComputedStyle(el).boxShadow);
  expect(activeBoxShadow).not.toBe('none');

  // 3. Open Calendar + Plan on `body`: verify Month 5 (`month-2027-3`, where Light begins) is NOT display:none under @container self-card
  await bodyCard.getByTestId('tool-calendar').click();
  await bodyCard.getByTestId('tool-plan').click();
  const marchMonth = bodyCard.getByTestId('month-2027-3');
  await expect(marchMonth).toHaveCount(1);
  const marchDisplay = await marchMonth.evaluate((el) => getComputedStyle(el).display);
  expect(marchDisplay).not.toBe('none');

  // Primary reading column keeps >= 50% of stage height (>= 170px desktop, >= 40px phone — never 39.5px desktop or 0px phone!) and footer stays in viewport
  const { scrollHeight, stageHeight } = await bodyCard.evaluate((cardEl) => {
    const stage = cardEl.querySelector('.self-v3-stage')!;
    const body = cardEl.querySelector('[data-testid="card-body"]')!;
    return {
      scrollHeight: body.getBoundingClientRect().height,
      stageHeight: stage.getBoundingClientRect().height,
    };
  });
  expect(scrollHeight / stageHeight).toBeGreaterThanOrEqual(0.5);
  expect(scrollHeight).toBeGreaterThanOrEqual(info.project.name === 'phone' ? 40 : 170);
  await expect(bodyCard.getByTestId('card-details-open')).toBeInViewport();

  // Switching to Breakdown while Plan tool is open renders only ONE `section-plan` (no duplicate inline ladder)
  await bodyCard.getByTestId('face-breakdown').click();
  await expect(bodyCard.getByTestId('section-plan')).toHaveCount(1);

  // 4. Navigate to `lagna` (zero vetted optional tools): `tool-switch` & `separator` absent, `Chart details` still opens sheet
  await page.getByTestId('self-v3-chip-lagna').click();
  const lagnaCard = page.getByTestId('v3-card-lagna');
  await expect(lagnaCard.getByTestId('tool-switch')).toHaveCount(0);
  await expect(lagnaCard.getByRole('separator')).toHaveCount(0);
  await expect(lagnaCard.getByTestId('toolbar-details')).toBeVisible();
  await lagnaCard.getByTestId('toolbar-details').click();
  await expect(page.getByTestId('details-sheet')).toBeVisible();
  await page.keyboard.press('Escape');

  // 5. BoardSettings omits 0-card `info`, shows card-support ratios, and `bs-close` works on both desktop and phone
  await page.getByTestId('board-settings-open').click();
  await expect(page.getByTestId('board-settings-panel')).toBeVisible();
  await expect(page.getByTestId('bs-tool-info')).toHaveCount(0);
  await expect(page.getByTestId('bs-tool-table')).toContainText('2/8');
  await page.getByTestId('bs-close').click();
  await expect(page.getByTestId('board-settings-panel')).toBeHidden();

  // 6. On desktop, also check 1920x1080 (3 cards across) has zero horizontal page overflow and Month 5 stays rendered
  if (info.project.name === 'desktop') {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByTestId('self-v3-chip-body').click();
    await expect(page.getByTestId('self-v3-carousel')).toHaveAttribute('data-per-view', '3');
    const marchAt1920 = await bodyCard.getByTestId('month-2027-3').evaluate((el) => getComputedStyle(el).display);
    expect(marchAt1920).not.toBe('none');
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
