import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PricingPage from './PricingPage';
import { fetchPlanState } from '../../Auth/api';
import { fetchPlans, startCheckout, type PlanCatalog } from '../../lib/billing';

vi.mock('../../Auth/api', () => ({ fetchPlanState: vi.fn() }));
vi.mock('../../lib/billing', async (orig) => ({
  ...(await orig<typeof import('../../lib/billing')>()),
  fetchPlans: vi.fn(),
  startCheckout: vi.fn(),
}));

const catalog = (region: 'US' | 'IN'): PlanCatalog => {
  const inr = region === 'IN';
  const currency = inr ? 'INR' : 'USD';
  const price = (usd: number, rupees: number) => ({ amount_minor: (inr ? rupees : usd) * 100, currency });
  return {
    country: region,
    region,
    currency,
    gateway: null,
    plans: [
      { code: 'free', name: 'Free', limit: 5, window: 'lifetime', prices: null },
      { code: 'plus', name: 'Plus', limit: 20, window: 'month', prices: { month: price(50, 2499), year: price(500, 24999) } },
      { code: 'unlimited', name: 'Unlimited', limit: 50, window: 'day', prices: { month: price(200, 9999), year: price(2000, 99999) } },
    ],
  };
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/pricing']}>
      <Routes>
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/signup" element={<h1>sign up page</h1>} />
      </Routes>
    </MemoryRouter>
  );

describe('PricingPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(fetchPlans).mockReset();
    vi.mocked(startCheckout).mockReset();
    vi.mocked(fetchPlanState).mockReset().mockResolvedValue({ plan: null, language: null });
    vi.mocked(fetchPlans).mockImplementation(async (region) => catalog(region ?? 'US'));
  });
  afterEach(() => localStorage.clear());

  it('shows dollars monthly and annually', async () => {
    renderPage();
    const plus = await screen.findByRole('region', { name: 'Plus' });
    expect(within(plus).getByText('$50 / month')).toBeInTheDocument();
    expect(within(plus).getByText('20 questions a month')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Free' })).getByText('5 questions in total')).toBeInTheDocument();
    const unlimited = screen.getByRole('region', { name: 'Unlimited' });
    expect(within(unlimited).getByText('Unlimited questions')).toBeInTheDocument();
    expect(within(unlimited).getByText('Up to 50 questions a day, to prevent abuse')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Annual' }));
    expect(within(plus).getByText('$500 / year')).toBeInTheDocument();
    expect(within(unlimited).getByText('$2,000 / year')).toBeInTheDocument();
  });

  it('shows rupees for the detected country', async () => {
    vi.mocked(fetchPlans).mockResolvedValue(catalog('IN'));
    renderPage();
    const plus = await screen.findByRole('region', { name: 'Plus' });
    expect(within(plus).getByText('₹2,499 / month')).toBeInTheDocument();
    expect(fetchPlans).toHaveBeenCalledWith(null);
    expect(screen.getByRole('button', { name: 'India' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('the switch changes the currency and is remembered', async () => {
    renderPage();
    await screen.findByText('$50 / month');
    await userEvent.setup().click(screen.getByRole('button', { name: 'India' }));
    expect(await screen.findByText('₹2,499 / month')).toBeInTheDocument();
    expect(fetchPlans).toHaveBeenLastCalledWith('IN');
    expect(localStorage.getItem('aiastra.region')).toBe('IN');
  });

  it('sends a signed-out visitor to sign up', async () => {
    renderPage();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Choose Plus' }));
    expect(screen.getByText('sign up page')).toBeInTheDocument();
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it('saves a signed-in choice and says nothing was charged', async () => {
    localStorage.setItem('token', 't');
    vi.mocked(startCheckout).mockResolvedValue({ status: 'pending_payment', checkout_url: null, plan: null });
    renderPage();
    const u = userEvent.setup();
    await screen.findByText('$50 / month');
    await u.click(screen.getByRole('button', { name: 'Annual' }));
    await u.click(screen.getByRole('button', { name: 'Choose Unlimited' }));
    await waitFor(() => expect(startCheckout).toHaveBeenCalledWith('unlimited', 'year', 'US'));
    expect(
      await screen.findByText('We saved your choice of Unlimited. Payments open soon, and you stay on the free plan until then.')
    ).toBeInTheDocument();
  });

  it('marks the current plan and a choice not paid for yet', async () => {
    localStorage.setItem('token', 't');
    vi.mocked(fetchPlanState).mockResolvedValue({
      language: 'en',
      plan: {
        code: 'free', desired_plan: 'plus', desired_interval: 'month', is_paid: false, interval: null, used: 1, limit: 5,
        remaining: 4, window: 'lifetime', resets_at: null, exempt: false,
      },
    });
    renderPage();
    expect(await screen.findByText('Current plan')).toBeInTheDocument();
    expect(await screen.findByText(/We saved your choice of Plus/)).toBeInTheDocument();
  });

  it('says so when the choice cannot be saved', async () => {
    localStorage.setItem('token', 't');
    vi.mocked(startCheckout).mockRejectedValue(new Error('nope'));
    renderPage();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Choose Plus' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save your choice. Please try again.');
  });

  it('says so when the plans cannot be loaded', async () => {
    vi.mocked(fetchPlans).mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the plans.');
  });
});
