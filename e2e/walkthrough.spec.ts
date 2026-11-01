import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { newState, signIn, stubApi, type StubState } from './stubApi';

const ROOT = path.resolve('docs/screenshots/walkthrough');

interface StepRecord {
  file: string;
  step: string;
  url: string;
  horizontalOverflowPx: number;
  pageScrollable: boolean;
  consoleErrors: string[];
  failedRequests: string[];
}

/** Takes numbered screenshots and records what the picture cannot show. */
class Walkthrough {
  private n = 0;
  private readonly steps: StepRecord[] = [];
  private consoleErrors: string[] = [];
  private failedRequests: string[] = [];
  private readonly dir: string;

  constructor(
    private readonly page: Page,
    info: TestInfo,
    private readonly stub: StubState
  ) {
    this.dir = path.join(ROOT, info.project.name);
    mkdirSync(this.dir, { recursive: true });
    for (const f of readdirSync(this.dir)) rmSync(path.join(this.dir, f));
    page.on('console', (m) => {
      if (m.type() === 'error') this.consoleErrors.push(m.text().slice(0, 300));
    });
    page.on('pageerror', (e) => this.consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`));
    page.on('requestfailed', (r) => this.failedRequests.push(`${r.method()} ${r.url().slice(0, 160)}`));
  }

  async shot(step: string, opts: { fullPage?: boolean } = {}): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => undefined);
    await this.page.waitForTimeout(300);
    this.n += 1;
    const file = `${String(this.n).padStart(2, '0')}-${step}.png`;
    await this.page.screenshot({ path: path.join(this.dir, file), fullPage: opts.fullPage ?? false });
    const m = await this.page.evaluate(() => ({
      over: document.documentElement.scrollWidth - window.innerWidth,
      tall: document.documentElement.scrollHeight > window.innerHeight,
    }));
    this.steps.push({
      file,
      step,
      url: new URL(this.page.url()).pathname,
      horizontalOverflowPx: m.over,
      pageScrollable: m.tall,
      consoleErrors: this.consoleErrors,
      failedRequests: this.failedRequests,
    });
    this.consoleErrors = [];
    this.failedRequests = [];
  }

  save(): void {
    writeFileSync(
      path.join(this.dir, 'manifest.json'),
      JSON.stringify({ steps: this.steps, operationsNotStubbed: [...this.stub.unhandled] }, null, 2)
    );
  }
}

test('signed-out walkthrough, then the free plan to its limit', async ({ page, context }, info) => {
  const phone = info.project.name === 'phone';
  const state = newState();
  await stubApi(page, state);
  const w = new Walkthrough(page, info, state);

  // signed out
  await page.goto('/');
  await w.shot('landing-top');
  await w.shot('landing-full', { fullPage: true });
  await page.getByRole('radio', { name: /India/i }).or(page.getByRole('button', { name: /India/i })).first().click();
  await w.shot('landing-india-selected');
  await page.goto('/pricing');
  await w.shot('pricing-india-rupees', { fullPage: true });
  await page.getByRole('button', { name: /annual|year/i }).first().click();
  await w.shot('pricing-india-annual', { fullPage: true });
  await page.getByRole('radio', { name: /US/ }).or(page.getByRole('button', { name: /US/ })).first().click();
  await w.shot('pricing-us-dollars', { fullPage: true });
  await page.goto('/signin');
  await w.shot('sign-in');
  await page.goto('/signup');
  await w.shot('sign-up');

  // registration page 2, then the signed-in app
  await signIn(page);
  state.profileComplete = false;
  await page.goto('/signup/details');
  await expect(page, 'the birth details page stays open').toHaveURL(/signup\/details/);
  await expect(page.getByText(/हिन्दी/).first()).toBeVisible();
  await w.shot('registration-details', { fullPage: true });
  const hindi = page.getByText(/हिन्दी/).first();
  if (await hindi.isVisible()) {
    await hindi.click();
    await w.shot('registration-hindi-chosen', { fullPage: true });
  }

  state.profileComplete = true;
  await page.goto('/dashboard/chat');
  await expect(page.getByPlaceholder(/Ask about work, money/i)).toBeVisible();
  await w.shot('chat-free-2-of-20');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight), 'chat page has no page scrollbar').toBe(true);

  if (phone) {
    await page.getByRole('button', { name: 'Open conversations' }).click();
    await w.shot('phone-conversations-open');
    await page.mouse.click(380, 400);
    await page.getByRole('button', { name: 'Open your Kundli' }).click();
    await expect(page.locator('[data-test-id="chat-right-sidebar-facts"]')).toBeVisible();
    await w.shot('phone-kundli-open');
    await page.mouse.click(10, 400);
  }
  const expand = page.getByRole('button', { name: 'Expand right sidebar' });
  if (await expand.isVisible()) {
    await expand.click();
    await w.shot('chat-right-sidebar-basic');
    state.research = true;
    await page.reload();
    await expect(page.getByPlaceholder(/Ask about work, money/i)).toBeVisible();
    await w.shot('chat-right-sidebar-research');
    state.research = false;
    await page.getByRole('button', { name: 'Collapse right sidebar' }).click();
  }

  await page.getByRole('button', { name: /account|profile|menu/i }).first().click();
  await w.shot('profile-menu-open');
  await page.keyboard.press('Escape');

  const ask = async (q: string) => {
    await page.getByPlaceholder(/Ask about work, money/i).fill(q);
    await page.getByPlaceholder(/Ask about work, money/i).press('Enter');
    await page.waitForTimeout(800);
  };
  await ask('What does my career look like next year?');
  await w.shot('chat-after-question-3-of-20');
  state.used = 18;
  await ask('And my finances?');
  await w.shot('chat-last-question-amber');
  await ask('And my relationships?');
  await w.shot('chat-limit-reached');
  await expect(page.locator('[data-test-id="upgrade-card"]'), 'the upgrade card replaces the input').toBeVisible();

  // a long conversation: the header, footer and sidebars must not move
  state.messages = 30;
  state.used = 2;
  await page.reload();
  await expect(page.getByPlaceholder(/Ask about work, money/i)).toBeVisible();
  const list = page.locator('[data-test-id="chat-main-area-messages"]');
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight / 2;
  });
  await w.shot('chat-long-conversation-scrolled');
  expect(await page.evaluate(() => window.scrollY), 'the window itself does not scroll').toBe(0);

  await page.goto('/pricing');
  await w.shot('pricing-signed-in', { fullPage: true });
  const choose = page.getByRole('button', { name: /choose|upgrade|select|get/i }).first();
  if (await choose.isVisible()) {
    await choose.click();
    await w.shot('pricing-choice-saved', { fullPage: true });
  }

  for (const [name, url] of [['charts', '/dashboard/charts'], ['remedies', '/dashboard/remedies'], ['mantras', '/dashboard/mantras'], ['profile', '/profile']] as const) {
    await page.goto(url);
    await w.shot(`page-${name}`, { fullPage: true });
  }

  // the phone keyboard is not emulated, so this also records the plain phone layout of the same pages
  if (phone) await context.clearCookies();
  w.save();
});
