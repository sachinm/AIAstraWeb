import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfileLayout from './ProfileLayout';
import ProfilePlan from './ProfilePlan';
import ProfileSettings from './ProfileSettings';
import ProfileTimeline from './ProfileTimeline';
import { usePlan } from '../../Auth/ProfileGate';
import { fetchPlanState, fetchProfile, updateProfile } from '../../Auth/api';
import * as ledger from '../../lib/ledgerApi';
import type { PlanStatus } from '../../lib/billing';

vi.mock('../../Auth/ProfileGate', () => ({ usePlan: vi.fn() }));
vi.mock('../../Auth/api', () => ({
  fetchProfile: vi.fn(),
  fetchPlanState: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock('../../lib/ledgerApi', async (orig) => ({
  ...(await orig<typeof ledger>()),
  fetchLedgerMeta: vi.fn().mockResolvedValue(null),
  fetchLedgerEvents: vi.fn().mockResolvedValue([]),
}));

const free: PlanStatus = {
  code: 'free',
  desired_plan: 'plus',
  desired_interval: 'month',
  is_paid: false,
  interval: null,
  used: 3,
  limit: 20,
  remaining: 17,
  window: 'month',
  resets_at: '2026-12-01T00:00:00.000Z',
  exempt: false,
};

const showPlan = (plan: PlanStatus | null) => {
  vi.mocked(usePlan).mockReturnValue({ plan, setPlan: vi.fn(), refreshPlan: vi.fn() });
  render(
    <MemoryRouter>
      <ProfilePlan />
    </MemoryRouter>
  );
};

describe('profile tabs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links the four pages and marks the open one', () => {
    render(
      <MemoryRouter initialEntries={['/profile/plan']}>
        <Routes>
          <Route path="/profile/*" element={<ProfileLayout />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Details' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Life timeline' })).toHaveAttribute('href', '/profile/timeline');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/profile/settings');
  });

  it('Plan shows usage, the reset date and a choice that is not active yet', () => {
    showPlan(free);
    expect(screen.getByText('Free plan')).toBeInTheDocument();
    expect(screen.getByText('3 of 20 questions used')).toBeInTheDocument();
    expect(screen.getByText(/1 December 2026/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Plus plan/);
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/pricing');
  });

  it('Plan says so when limits are off or the account has none', () => {
    showPlan(null);
    expect(screen.getByText(/not available right now/i)).toBeInTheDocument();
  });

  it('Plan says an exempt account has no limit', () => {
    showPlan({ ...free, exempt: true, limit: null, remaining: null });
    expect(screen.getByText(/no question limit/i)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('Settings saves the language alone, so no birth detail is sent', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({ name: 'A', email: 'a@example.com' } as never);
    vi.mocked(fetchPlanState).mockResolvedValue({ plan: null, language: 'en' });
    vi.mocked(updateProfile).mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<MemoryRouter><ProfileSettings /></MemoryRouter>);
    expect(await screen.findByText('a@example.com')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Save language' }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ language: 'en' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('Settings shows the server message when the save fails', async () => {
    vi.mocked(fetchProfile).mockResolvedValue(null);
    vi.mocked(fetchPlanState).mockResolvedValue({ plan: null, language: 'en' });
    vi.mocked(updateProfile).mockResolvedValue({ success: false, message: 'Complete your profile first.' });
    const user = userEvent.setup();
    render(<MemoryRouter><ProfileSettings /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Save language' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Complete your profile first.');
  });

  it('Life timeline holds the reading with the flag on, and says coming soon with it off', async () => {
    vi.stubEnv('VITE_TIMELINE_ENABLED', 'false');
    const { unmount } = render(<MemoryRouter><ProfileTimeline /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Your life timeline' })).toBeInTheDocument();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    unmount();
    vi.stubEnv('VITE_TIMELINE_ENABLED', 'true');
    render(<MemoryRouter><ProfileTimeline /></MemoryRouter>);
    expect(await screen.findByText(/Coming soon — we're researching this/)).toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
