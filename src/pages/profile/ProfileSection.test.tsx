import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProfileSection, { REBUILD_WARNING } from './ProfileSection';
import { fetchProfile, updateProfile } from '../../Auth/api';
import { resetLedgerMetaCache } from '../timeline/useLedgerMeta';
import * as ledger from '../../lib/ledgerApi';

vi.mock('../../Auth/api', () => ({
  fetchProfile: vi.fn(),
  updateProfile: vi.fn(),
  fetchMe: vi.fn(),
  fetchPlanState: vi.fn().mockResolvedValue({ plan: null, language: null }),
}));
vi.mock('../../lib/ledgerApi', async (orig) => ({
  ...(await orig<typeof import('../../lib/ledgerApi')>()),
  fetchLedgerMeta: vi.fn(),
  fetchLedgerEvents: vi.fn(),
}));

vi.setConfig({ testTimeout: 30000 });

const profile = {
  name: 'Asha Rao',
  gender: 'female' as const,
  date_of_birth: '1990-04-27',
  time_of_birth: '13:05:00',
  country_code: 'IN',
  city: 'Pune',
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ProfileSection />
    </MemoryRouter>
  );

describe('ProfileSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLedgerMetaCache();
    vi.mocked(fetchProfile).mockResolvedValue(profile);
    vi.mocked(ledger.fetchLedgerMeta).mockResolvedValue(null as never);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('loads the saved details into the same controls as registration', async () => {
    renderPage();
    expect(await screen.findByLabelText('Name')).toHaveValue('Asha Rao');
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue('27/04/1990');
    expect(screen.getByLabelText('Hour')).toHaveValue('1');
    expect(screen.getByLabelText('Minute')).toHaveValue('05');
    expect(screen.getByLabelText(/am or pm/i)).toHaveValue('PM');
    expect(screen.getByLabelText(/country of birth/i)).toHaveValue('India');
    expect(screen.getByLabelText(/city of birth/i)).toHaveValue('Pune');
    expect(screen.getByLabelText('Gender')).toHaveValue('female');
  });

  it('a name-only change saves at once, with no rebuild warning or notice', async () => {
    const user = userEvent.setup();
    vi.mocked(updateProfile).mockResolvedValueOnce({ success: true });
    renderPage();
    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Asha R');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile).toHaveBeenCalledWith({
      name: 'Asha R',
      gender: 'female',
      date_of_birth: '1990-04-27',
      time_of_birth: '13:05',
      country_code: 'IN',
      city: 'Pune',
    });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(screen.queryByText(REBUILD_WARNING)).not.toBeInTheDocument();
    expect(screen.queryByText(/about 30 minutes after you register/i)).not.toBeInTheDocument();
  });

  it('a birth-detail change warns first, saves only after confirming, then shows the notice', async () => {
    const user = userEvent.setup();
    vi.mocked(updateProfile).mockResolvedValueOnce({ success: true });
    renderPage();
    const city = await screen.findByLabelText(/city of birth/i);
    await user.clear(city);
    await user.type(city, 'Mumbai');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(REBUILD_WARNING)).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /save and rebuild chart/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateProfile).mock.calls[0][0].city).toBe('Mumbai');
    expect(await screen.findByRole('status')).toHaveTextContent('about 30 minutes after you register');
  });

  it('"Keep editing" dismisses the warning without saving', async () => {
    const user = userEvent.setup();
    renderPage();
    const city = await screen.findByLabelText(/city of birth/i);
    await user.type(city, 'x');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await user.click(await screen.findByRole('button', { name: /keep editing/i }));
    expect(screen.queryByText(REBUILD_WARNING)).not.toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
