import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import ProfileMenu from './ProfileMenu';
import RegionSwitch from './RegionSwitch';
import UpgradeCard from './UpgradeCard';
import UsageBar from './UsageBar';
import { usePlan } from '../Auth/ProfileGate';
import { formatPrice, loadRegion, saveRegion } from '../lib/region';
import { isExhausted, type PlanStatus } from '../lib/billing';

vi.mock('../Auth/ProfileGate', () => ({ usePlan: vi.fn(), useMe: () => null }));

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

describe('UsageBar', () => {
  it('shows nothing when limits are off, on a paid plan, or for exempt staff', () => {
    withPlan(null);
    const { container, rerender } = inRouter(<UsageBar />);
    expect(container).toBeEmptyDOMElement();
    withPlan({ ...free(0), code: 'plus', limit: 20, remaining: 20, window: 'month', is_paid: true });
    rerender(<MemoryRouter><UsageBar /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
    withPlan({ ...free(0), exempt: true, limit: null, remaining: null, window: 'none' });
    rerender(<MemoryRouter><UsageBar /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts used questions, then warns, then says they are gone', () => {
    withPlan(free(2));
    const { rerender } = inRouter(<UsageBar />);
    expect(screen.getByText('2 of 5 questions used')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');

    withPlan(free(4));
    rerender(<MemoryRouter><UsageBar /></MemoryRouter>);
    expect(screen.getByText('1 question left')).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="usage-bar"]')).toHaveAttribute('data-tone', 'amber');

    withPlan(free(5));
    rerender(<MemoryRouter><UsageBar /></MemoryRouter>);
    expect(screen.getByText('5 of 5 questions used')).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="usage-bar"]')).toHaveAttribute('data-tone', 'red');
    expect(screen.getByRole('link', { name: 'Upgrade' })).toHaveAttribute('href', '/pricing');
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
    expect(within(menu).getByRole('menuitem', { name: 'Upgrade plan' })).toHaveFocus();
    await u.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Chat' })).toHaveFocus();
    for (const name of ['Charts', 'Remedies', 'Mantras/Horoscope', 'Profile']) expect(within(menu).getByRole('menuitem', { name })).toBeInTheDocument();
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
            element={<Dashboard user={{ name: 'A', email: 'a@b.c', dateOfBirth: '', placeOfBirth: '', timeOfBirth: '' }} onLogout={() => undefined} />}
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
