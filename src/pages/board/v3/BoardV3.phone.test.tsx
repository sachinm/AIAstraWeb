/**
 * The v3 board on a phone (server docs/dashboards/12): the card on screen in the header ("n/N"), the 4 px progress
 * ticks, a full-width card with no side peek, no chips row, and the strip of card titles that a pull on the card (from
 * its top only) or a tap on the header title reveals; a title picks its card, the strip follows the cards both ways, and
 * it collapses on a pick, a push back up, or after a few idle seconds.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import BoardV3, { PULL_OPEN_PX, STRIP_IDLE_MS } from './BoardV3';
import { selfV3Fixture } from '../../you/v3/selfV3.fixture';
import { clearSelfV3Cached } from '../../../lib/selfV3Cache';

const plan = vi.hoisted(() => ({ setPlan: vi.fn(), refreshPlan: vi.fn(async () => {}) }));
vi.mock('../../../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: null, setPlan: plan.setPlan, refreshPlan: plan.refreshPlan }) }));

beforeEach(() => {
  clearSelfV3Cached();
  sessionStorage.clear();
  localStorage.setItem('token', 't');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00'));
  Object.defineProperty(window, 'innerWidth', { value: 360, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      if (/\/api\/self\/v3$/.test(String(url)) && method === 'GET') return new Response(JSON.stringify(selfV3Fixture()), { status: 200 });
      return new Response(null, { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function mount() {
  render(<BoardV3 board="self" />);
  await screen.findByTestId('self-v3-carousel');
}

const strip = () => screen.getByTestId('title-strip');
const selectedTitle = () => within(strip()).getAllByRole('tab').findIndex((t) => t.getAttribute('aria-selected') === 'true');
const count = () => screen.getByTestId('phone-card-count').textContent;

/** a vertical drag on the deck, starting on `from` */
function pullDown(from: Element, dy: number) {
  fireEvent.touchStart(from, { touches: [{ clientX: 100, clientY: 200 }] });
  fireEvent.touchMove(from, { touches: [{ clientX: 102, clientY: 200 + dy }] });
  fireEvent.touchEnd(from, { changedTouches: [{ clientX: 102, clientY: 200 + dy }] });
}

describe('the phone board', () => {
  it('the header shows the card on screen with n/N; ticks, one card, no peek and no chips row', async () => {
    await mount();
    const n = selfV3Fixture().layout.cards.length;
    expect(await screen.findByTestId('phone-card-title-text')).toHaveTextContent(screen.getAllByTestId(/^v3-card-/)[0]!.getAttribute('aria-label')!);
    expect(count()).toBe(`1/${n}`);
    expect(screen.queryByTestId('self-v3-chips')).toBeNull();
    const ticks = screen.getByTestId('progress-ticks');
    expect(ticks.querySelectorAll('[data-tick]')).toHaveLength(n);
    expect(ticks.querySelector('[data-on="true"]')).toHaveAttribute('data-tick', '0');
    const carousel = screen.getByTestId('self-v3-carousel');
    expect(carousel).toHaveAttribute('data-per-view', '1');
    // full width: no px kept for the next card
    expect(screen.getByTestId('self-v3-carousel-track').style.gridAutoColumns).toBe('calc((100% - 0px) / 1)');
    expect(screen.getAllByTestId(/^v3-card-/)[0]!.closest('[data-peek]')).toHaveAttribute('data-peek', 'false');
  });

  it('a pull on the card reveals the title strip only when the card is scrolled to its top', async () => {
    await mount();
    expect(strip()).toHaveAttribute('data-open', 'false');
    const body = screen.getAllByTestId('card-body')[0]!;
    // the card's text is scrolled: the pull is the text's own scroll, not the strip
    body.scrollTop = 120;
    pullDown(body, PULL_OPEN_PX + 40);
    expect(strip()).toHaveAttribute('data-open', 'false');
    // at the top: a short drag does nothing, past the threshold it opens
    body.scrollTop = 0;
    pullDown(body, PULL_OPEN_PX - 10);
    expect(strip()).toHaveAttribute('data-open', 'false');
    pullDown(body, PULL_OPEN_PX + 10);
    expect(strip()).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('phone-card-title')).toHaveAttribute('aria-expanded', 'true');
    // pushing the card back up closes it
    pullDown(body, -(PULL_OPEN_PX + 10));
    expect(strip()).toHaveAttribute('data-open', 'false');
  });

  it('the rubber band follows the finger while pulling, then snaps', async () => {
    await mount();
    const body = screen.getAllByTestId('card-body')[0]!;
    fireEvent.touchStart(body, { touches: [{ clientX: 100, clientY: 200 }] });
    fireEvent.touchMove(body, { touches: [{ clientX: 100, clientY: 240 }] });
    expect(screen.getByTestId('phone-strip-wrap')).toHaveAttribute('data-pull', '20');
    fireEvent.touchEnd(body, { changedTouches: [{ clientX: 100, clientY: 240 }] });
    expect(screen.getByTestId('phone-strip-wrap')).toHaveAttribute('data-pull', '0');
    expect(strip()).toHaveAttribute('data-open', 'false');
    // a touch the browser cancels leaves nothing half open
    fireEvent.touchStart(body, { touches: [{ clientX: 100, clientY: 200 }] });
    fireEvent.touchMove(body, { touches: [{ clientX: 100, clientY: 260 }] });
    expect(screen.getByTestId('phone-strip-wrap')).toHaveAttribute('data-pull', '30');
    fireEvent.touchCancel(body);
    expect(screen.getByTestId('phone-strip-wrap')).toHaveAttribute('data-pull', '0');
  });

  it('the board controls sit pinned beside the titles, outside their scroll, and take no focus while closed', async () => {
    await mount();
    const button = screen.getByTestId('self-phone-reading');
    expect(within(screen.getByTestId('title-strip-list')).queryByTestId('self-phone-reading')).toBeNull();
    expect(button).toHaveAttribute('tabindex', '-1');
    fireEvent.click(screen.getByTestId('phone-card-title'));
    expect(button).toHaveAttribute('tabindex', '0');
  });

  it('a tapped title changes the card and the strip collapses', async () => {
    await mount();
    fireEvent.click(screen.getByTestId('phone-card-title'));
    expect(strip()).toHaveAttribute('data-open', 'true');
    fireEvent.click(screen.getByTestId('title-strip-title-2'));
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-index', '2');
    expect(count()).toMatch(/^3\//);
    expect(screen.getByTestId('progress-ticks').querySelector('[data-on="true"]')).toHaveAttribute('data-tick', '2');
    expect(strip()).toHaveAttribute('data-open', 'false');
  });

  it('moving the cards moves the strip with them', async () => {
    await mount();
    fireEvent.click(screen.getByTestId('phone-card-title'));
    expect(selectedTitle()).toBe(0);
    // the deck moves on (its arrow key, as a swipe does)
    fireEvent.keyDown(screen.getByTestId('self-v3-carousel'), { key: 'ArrowRight' });
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-index', '1');
    expect(selectedTitle()).toBe(1);
    expect(strip()).toHaveAttribute('data-open', 'true');
  });

  it('the strip collapses by itself after a few idle seconds', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T12:00:00'));
    render(<BoardV3 board="self" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    fireEvent.click(screen.getByTestId('phone-card-title'));
    expect(strip()).toHaveAttribute('data-open', 'true');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STRIP_IDLE_MS + 10);
    });
    expect(strip()).toHaveAttribute('data-open', 'false');
  });

  it('the board sheet (from the strip) holds the reading, Edit, Add a card and the gear', async () => {
    await mount();
    fireEvent.click(screen.getByTestId('self-phone-reading'));
    const sheet = await screen.findByTestId('self-reading-sheet');
    expect(within(sheet).getByTestId('self-v3-edit')).toBeInTheDocument();
    expect(within(sheet).getByTestId('board-settings-open')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByTestId('self-v3-edit'));
    // editing brings the chips row back on a phone
    expect(screen.getByTestId('self-v3-chips')).toHaveAttribute('data-editing', 'true');
  });
});
