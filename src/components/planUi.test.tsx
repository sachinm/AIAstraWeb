import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import ProfileMenu from './ProfileMenu';
import RegionSwitch from './RegionSwitch';
import UpgradeCard from './UpgradeCard';
import UsageRing from './UsageRing';
import { usePlan } from '../Auth/ProfileGate';
import { fetchPlanBreakdown } from '../Auth/api';
import { formatPrice, loadRegion, saveRegion } from '../lib/region';
import { isExhausted, type PlanStatus } from '../lib/billing';

vi.mock('../Auth/ProfileGate', () => ({ usePlan: vi.fn(), useMe: () => null }));
vi.mock('../Auth/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../Auth/api')>()),
  fetchPlanBreakdown: vi.fn(async () => null),
}));

const free = (used: number): PlanStatus => ({
  code: 'free',
  desired_plan: null,
  desired_interval: null,
  is_paid: false,
  interval: null,
  used,
  limit: 5,
  remaining: 5 - used,
  window: 'month',
  resets_at: null,
  exempt: false,
});

const withPlan = (plan: PlanStatus | null) =>
  vi.mocked(usePlan).mockReturnValue({ plan, setPlan: vi.fn(), refreshPlan: vi.fn() });

const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('UsageRing', () => {
  const ring = () => document.querySelector('[data-test-id="usage-ring"]');
  const panel = () => document.querySelector('[data-test-id="usage-ring-panel"]');

  it('shows nothing when limits are off, on Unlimited, or for exempt staff; shows on Plus', () => {
    withPlan(null);
    const { container, rerender } = inRouter(<UsageRing />);
    expect(container).toBeEmptyDOMElement();
    withPlan({ ...free(0), code: 'unlimited', limit: null, remaining: null, is_paid: true });
    rerender(<MemoryRouter><UsageRing /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
    withPlan({ ...free(0), exempt: true, limit: null, remaining: null, window: 'none' });
    rerender(<MemoryRouter><UsageRing /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
    withPlan({ ...free(0), code: 'plus', limit: 20, remaining: 20, is_paid: true });
    rerender(<MemoryRouter><UsageRing /></MemoryRouter>);
    expect(screen.getByRole('button', { name: '0 of 20 questions used this month' })).toBeInTheDocument();
  });

  it('names the count in full, shows what is left, then warns, then turns red', () => {
    withPlan(free(2));
    const { rerender } = inRouter(<UsageRing />);
    expect(screen.getByRole('button', { name: '2 of 5 questions used this month' })).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="usage-ring-left"]')).toHaveTextContent('3');
    expect(ring()).toHaveAttribute('data-tone', 'purple');

    withPlan(free(4));
    rerender(<MemoryRouter><UsageRing /></MemoryRouter>);
    expect(ring()).toHaveAttribute('data-tone', 'amber');
    expect(screen.getByText('1 question left')).toBeInTheDocument();

    withPlan(free(5));
    rerender(<MemoryRouter><UsageRing /></MemoryRouter>);
    expect(ring()).toHaveAttribute('data-tone', 'red');
    expect(document.querySelector('[data-test-id="usage-ring-left"]')).toHaveTextContent('0');
  });

  it('opens on focus with the renewal date and an upgrade for Free, and closes on Escape', async () => {
    withPlan({ ...free(3), resets_at: '2026-12-01T00:00:00.000Z' });
    inRouter(<UsageRing />);
    const button = screen.getByRole('button', { name: '3 of 5 questions used this month' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', panel()!.id);
    expect(panel()).not.toBeVisible();

    const u = userEvent.setup();
    await u.tab();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel()).toBeVisible();
    expect(within(panel() as HTMLElement).getByText('Renews 1 Dec 2026')).toBeInTheDocument();
    expect(within(panel() as HTMLElement).getByRole('link', { name: 'Upgrade' })).toHaveAttribute('href', '/pricing');
    await waitFor(() => expect(fetchPlanBreakdown).toHaveBeenCalled());
    expect(document.querySelector('[data-test-id="usage-ring-breakdown"]')).not.toBeInTheDocument();

    await u.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).not.toBeVisible();
    expect(button).toHaveFocus();
  });

  it('lists the kinds that spent questions, always chat, and offers no upgrade on Plus', async () => {
    vi.mocked(fetchPlanBreakdown).mockResolvedValueOnce({ chat: 0, cardchat: 1, board_refresh: 2, other: 0 });
    withPlan({ ...free(3), code: 'plus', limit: 20, remaining: 17, is_paid: true });
    inRouter(<UsageRing />);
    await userEvent.setup().click(screen.getByRole('button', { name: '3 of 20 questions used this month' }));
    expect(await screen.findByText('Chat answers 0 · Card chats 1 · Fresh readings 2')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Upgrade' })).not.toBeInTheDocument();
  });

  it('closes on a click elsewhere', async () => {
    withPlan(free(1));
    inRouter(<UsageRing />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: '1 of 5 questions used this month' }));
    expect(panel()).toBeVisible();
    fireEvent.mouseDown(document.body);
    expect(panel()).not.toBeVisible();
  });
});

describe('ProfileMenu', () => {
  const user = { name: 'Asha Rao', email: 'asha@example.com' };
  const renderMenu = (onLogout = vi.fn()) =>
    render(
      <MemoryRouter initialEntries={['/dashboard/chat']}>
        <ProfileMenu user={user} onLogout={onLogout} />
        <Routes>
          <Route path="/pricing" element={<h1>pricing page</h1>} />
          <Route path="/profile" element={<h1>profile page</h1>} />
          <Route path="/dashboard/chat" element={<h1>chat page</h1>} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    );

  it('opens with who is signed in, the plan and questions left, and closes on Esc', async () => {
    withPlan(free(3));
    renderMenu();
    const u = userEvent.setup();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Open profile menu' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Asha Rao')).toBeInTheDocument();
    expect(within(menu).getByText('asha@example.com')).toBeInTheDocument();
    expect(within(menu).getByText('Free plan')).toBeInTheDocument();
    expect(within(menu).getByText('2 of 5 questions left this month')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'General Reading' })).toHaveFocus();
    await u.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Upgrade plan' })).toHaveFocus();
    expect(within(menu).getAllByRole('menuitem').map((el) => el.textContent)).toEqual([
      'General Reading',
      'Upgrade plan',
      'Profile',
      'Plan and usage',
      'Locale',
      'Log out',
    ]);
    expect(within(menu).getAllByRole('separator')).toHaveLength(2);
    for (const gone of ['Chat', 'Work', 'Life timeline', 'Close account']) expect(within(menu).queryByRole('menuitem', { name: gone })).not.toBeInTheDocument();
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open profile menu' })).toHaveFocus();
  });

  it('goes to pricing and profile, and logs out', async () => {
    withPlan(free(0));
    const onLogout = vi.fn();
    renderMenu(onLogout);
    const u = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Open profile menu' });
    await u.click(trigger);
    await u.click(screen.getByRole('menuitem', { name: 'Upgrade plan' }));
    expect(screen.getByText('pricing page')).toBeInTheDocument();
    await u.click(trigger);
    await u.click(screen.getByRole('menuitem', { name: 'Profile' }));
    expect(screen.getByText('profile page')).toBeInTheDocument();
    await u.click(trigger);
    await u.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('leaves Happy Hour(s) to the header, and General Reading falls back to the chat route outside its provider', async () => {
    withPlan(free(0));
    renderMenu();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Open profile menu' }));
    expect(screen.queryByTestId('menu-happy-hours')).not.toBeInTheDocument();
    await u.click(screen.getByTestId('menu-general-reading'));
    expect(screen.getByText('chat page')).toBeInTheDocument();
  });

  it('closes on an outside click', async () => {
    withPlan(free(0));
    renderMenu();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Open profile menu' }));
    await u.click(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('offers no upgrade with limits off, on Unlimited, or for exempt staff', async () => {
    const u = userEvent.setup();
    for (const plan of [
      null,
      { ...free(0), code: 'unlimited' as const, is_paid: true, limit: null, remaining: null },
      { ...free(0), exempt: true, limit: null, remaining: null, window: 'none' as const },
    ]) {
      withPlan(plan);
      const { unmount } = renderMenu();
      await u.click(screen.getByRole('button', { name: 'Open profile menu' }));
      expect(screen.queryByRole('menuitem', { name: 'Upgrade plan' })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();
      unmount();
    }
  });
});

describe('RegionSwitch', () => {
  it('shows both flags as SVG, marks the choice and reports a change', async () => {
    const onChange = vi.fn();
    render(<RegionSwitch value="US" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'US' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'India' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelector('svg[data-test-id="flag-us"]')).toBeInTheDocument();
    expect(document.querySelector('svg[data-test-id="flag-in"]')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'India' }));
    expect(onChange).toHaveBeenCalledWith('IN');
  });
});

describe('region storage and prices', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('remembers a valid region and ignores anything else', () => {
    expect(loadRegion()).toBeNull();
    saveRegion('IN');
    expect(loadRegion()).toBe('IN');
    localStorage.setItem('aiastra.region', 'FR');
    expect(loadRegion()).toBeNull();
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadRegion()).toBeNull();
    expect(() => saveRegion('US')).not.toThrow();
  });

  it('formats dollars and groups rupees the Indian way', () => {
    expect(formatPrice(5000, 'USD')).toBe('$50');
    expect(formatPrice(200000, 'USD')).toBe('$2,000');
    expect(formatPrice(249900, 'INR')).toBe('₹2,499');
    expect(formatPrice(10000000, 'INR')).toBe('₹1,00,000');
  });
});

describe('UpgradeCard and isExhausted', () => {
  it('reads a month that ends at midnight UTC as that UTC date in every time zone', () => {
    inRouter(<UpgradeCard plan={{ ...free(5), resets_at: '2026-12-01T00:00:00.000Z' }} />);
    expect(screen.getByText(/They renew on December 1, 2026\./)).toBeInTheDocument();
  });

  it('uses the words for each window', () => {
    const { rerender } = inRouter(<UpgradeCard plan={free(5)} />);
    expect(screen.getByText(/You have used this month's 5 questions\. Choose a plan to keep asking\. Your earlier answers stay here\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a plan' })).toHaveAttribute('href', '/pricing');

    rerender(
      <MemoryRouter>
        <UpgradeCard plan={{ ...free(0), code: 'plus', is_paid: true, used: 100, limit: 100, remaining: 0, window: 'month', resets_at: '2026-12-01T12:00:00.000Z' }} />
      </MemoryRouter>
    );
    expect(screen.getByText(/You have used this month's 100 questions\. They renew on .*2026\./)).toBeInTheDocument();
  });

  it('is exhausted only at zero left, and never for exempt staff or with limits off', () => {
    expect(isExhausted(free(5))).toBe(true);
    expect(isExhausted(free(4))).toBe(false);
    expect(isExhausted(null)).toBe(false);
    expect(isExhausted({ ...free(5), exempt: true, remaining: null, limit: null })).toBe(false);
  });
});

describe('Dashboard page scroll', () => {
  const at = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/dashboard"
            element={<Dashboard user={{ name: 'A', email: 'a@b.c' }} onLogout={() => undefined} />}
          >
            <Route path="chat" element={<div />} />
            <Route path="charts" element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

  it('holds the chat page to the window and leaves other pages to scroll', () => {
    withPlan(null);
    const chat = at('/dashboard/chat');
    expect(document.querySelector('[data-test-id="dashboard-root"]')).toHaveClass('h-dvh', 'overflow-hidden');
    chat.unmount();
    at('/dashboard/charts');
    const root = document.querySelector('[data-test-id="dashboard-root"]');
    expect(root).toHaveClass('min-h-screen');
    expect(root).not.toHaveClass('overflow-hidden');
  });
});
