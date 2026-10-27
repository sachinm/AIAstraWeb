import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BirthDetails, { to24Hour } from './BirthDetails';
import ProfileGate from './ProfileGate';
import KundliNotice from '../components/KundliNotice';
import { completeProfile, fetchMe, type Me } from './api';
import { COUNTRIES } from './fields/countries';
import { todayISO } from './fields/dateUtils';

vi.mock('./api', () => ({
  completeProfile: vi.fn(),
  fetchMe: vi.fn(),
}));

vi.setConfig({ testTimeout: 30000 });
const onDone = vi.fn();
type U = ReturnType<typeof userEvent.setup>;

const me = (over: Partial<Me> = {}): Me => ({
  profile_complete: false,
  email_verified: true,
  kundli_status: 'pending',
  ...over,
});

function renderPage() {
  return render(<BirthDetails onDone={onDone} />);
}

async function fillAll(user: U, over: { dob?: string } = {}) {
  await user.type(screen.getByLabelText(/date of birth/i), over.dob ?? '27/04/1990');
  await user.selectOptions(screen.getByLabelText('Hour'), '12');
  await user.selectOptions(screen.getByLabelText('Minute'), '05');
  await user.selectOptions(screen.getByLabelText(/am or pm/i), 'AM');
  await user.clear(screen.getByLabelText(/country of birth/i));
  await user.type(screen.getByLabelText(/country of birth/i), 'Ind');
  await user.click(await screen.findByRole('option', { name: 'India' }));
  await user.type(screen.getByLabelText(/city of birth/i), 'Pune');
  await user.click(screen.getByLabelText('Female'));
}

describe('BirthDetails (page 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(fetchMe).mockResolvedValue(me());
  });

  it('has the required controls, the format label, the estimate hint and the 30-minute notice; no age or password', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /your birth details/i })).toBeInTheDocument();
    expect(screen.getByText(/date of birth \(DD\/MM\/YYYY\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Hour')).toBeInTheDocument();
    expect(screen.getByLabelText('Minute')).toBeInTheDocument();
    expect(screen.getByLabelText(/am or pm/i)).toBeInTheDocument();
    expect(screen.getByText("If you don't know the exact time, use your best estimate.")).toBeInTheDocument();
    expect(screen.getByLabelText(/country of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city of birth/i)).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Male')).toBeInTheDocument();
    expect(screen.getByLabelText('Female')).toBeInTheDocument();
    expect(screen.getByLabelText('Prefer not to say')).toBeInTheDocument();
    expect(screen.getByLabelText('Referral code (optional)')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('about 30 minutes after you register');
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^age$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create my chart/i })).toBeEnabled();
  });

  it('requires every field except the referral code, names what is missing and focuses the first', async () => {
    const user = userEvent.setup();
    renderPage();
    // the country defaults from the browser locale; clear it to prove it is required
    await user.clear(screen.getByLabelText(/country of birth/i));
    await user.click(screen.getByRole('button', { name: /create my chart/i }));

    expect(completeProfile).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Date of birth');
    expect(alert).toHaveTextContent('Time of birth');
    expect(alert).toHaveTextContent('Country');
    expect(alert).toHaveTextContent('City');
    expect(alert).toHaveTextContent('Gender');
    expect(alert).not.toHaveTextContent(/referral/i);
    expect(screen.getByLabelText(/date of birth/i)).toHaveFocus();
  });

  it('rejects a future date of birth', async () => {
    const user = userEvent.setup();
    renderPage();
    const next = new Date();
    next.setFullYear(next.getFullYear() + 1);
    const typed = `01/01/${next.getFullYear()}`;
    await user.type(screen.getByLabelText(/date of birth/i), typed);
    await user.tab();
    expect(await screen.findByText(/cannot be in the future/i)).toBeInTheDocument();
    expect(todayISO() < `${next.getFullYear()}-01-01`).toBe(true);
  });

  it('validates a malformed date on blur', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/date of birth/i), '31/02/1990');
    await user.tab();
    expect(await screen.findByText(/enter a real date as DD\/MM\/YYYY/i)).toBeInTheDocument();
  });

  it('sends HH:MM in 24-hour time, the alpha-2 country and the gender value', async () => {
    const user = userEvent.setup();
    vi.mocked(completeProfile).mockResolvedValueOnce({ success: true, referral_code: 'ABC' });
    renderPage();
    await fillAll(user);
    await user.type(screen.getByLabelText('Referral code (optional)'), ' FRIEND1 ');
    await user.click(screen.getByRole('button', { name: /create my chart/i }));

    await waitFor(() => expect(completeProfile).toHaveBeenCalled());
    expect(completeProfile).toHaveBeenCalledWith({
      date_of_birth: '1990-04-27',
      time_of_birth: '00:05',
      country_code: 'IN',
      city: 'Pune',
      gender: 'female',
      referral_code: 'FRIEND1',
    });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const sent = vi.mocked(completeProfile).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(
      ['city', 'country_code', 'date_of_birth', 'gender', 'referral_code', 'time_of_birth']
    );
  });

  it('converts 12-hour pieces to 24-hour correctly', () => {
    expect(to24Hour('12', '00', 'AM')).toBe('00:00');
    expect(to24Hour('12', '30', 'PM')).toBe('12:30');
    expect(to24Hour('1', '07', 'PM')).toBe('13:07');
    expect(to24Hour('11', '59', 'PM')).toBe('23:59');
    expect(to24Hour('9', '15', 'AM')).toBe('09:15');
  });

  it('bundles the full ISO country list with alpha-2 codes', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(240);
    expect(COUNTRIES.every((c) => /^[A-Z]{2}$/.test(c.code))).toBe(true);
    expect(COUNTRIES.find((c) => c.code === 'IN')?.name).toBe('India');
  });

  it('defaults the country from the browser locale', () => {
    renderPage();
    expect(screen.getByLabelText(/country of birth/i)).toHaveValue('United States');
  });

  it('autosaves entries to sessionStorage and restores them after a refresh', async () => {
    const user = userEvent.setup();
    const first = renderPage();
    await user.type(screen.getByLabelText(/city of birth/i), 'Pune');
    await user.click(screen.getByLabelText('Male'));
    first.unmount();

    renderPage();
    expect(screen.getByLabelText(/city of birth/i)).toHaveValue('Pune');
    expect(screen.getByLabelText('Male')).toBeChecked();
  });

  it('shows the server message and keeps the entries when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(completeProfile).mockResolvedValueOnce({ success: false, message: 'Try later.' });
    renderPage();
    await fillAll(user);
    await user.click(screen.getByRole('button', { name: /create my chart/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try later.');
    expect(screen.getByLabelText(/city of birth/i)).toHaveValue('Pune');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('the calendar opens on a year grid with decade jumps and picks a date', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /open calendar/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '−10 y' }));
    const years = within(dialog).getAllByRole('button').filter((b) => /^\d{4}$/.test(b.textContent ?? ''));
    expect(years).toHaveLength(12);
    await user.click(within(dialog).getByRole('button', { name: '1985' }));
    await user.click(within(dialog).getByRole('button', { name: 'Mar' }));
    await user.click(within(dialog).getByRole('button', { name: '9 Mar 1985' }));
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue('09/03/1985');
  });

  it('skips the page for a user whose profile is already complete', async () => {
    vi.mocked(fetchMe).mockResolvedValue(me({ profile_complete: true, kundli_status: 'ready' }));
    renderPage();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});

describe('resume and the 30-minute notice', () => {
  afterEach(() => vi.clearAllMocks());

  function renderApp(m: Me | null) {
    vi.mocked(fetchMe).mockResolvedValue(m);
    return render(
      <MemoryRouter initialEntries={['/dashboard/chat']}>
        <Routes>
          <Route path="/signup/details" element={<h1>Your birth details</h1>} />
          <Route element={<ProfileGate />}>
            <Route
              path="/dashboard/chat"
              element={
                <div>
                  <KundliNotice />
                  <p>Chat page</p>
                </div>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  }

  it('sends a signed-in user with profile_complete false straight to page 2', async () => {
    renderApp(me({ profile_complete: false }));
    expect(await screen.findByRole('heading', { name: /your birth details/i })).toBeInTheDocument();
    expect(screen.queryByText('Chat page')).not.toBeInTheDocument();
  });

  it.each(['pending', 'building'] as const)('shows the notice while kundli_status is %s', async (status) => {
    renderApp(me({ profile_complete: true, kundli_status: status }));
    expect(await screen.findByText('Chat page')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('about 30 minutes after you register');
  });

  it('hides the notice when the chart is ready', async () => {
    renderApp(me({ profile_complete: true, kundli_status: 'ready' }));
    expect(await screen.findByText('Chat page')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('opens the app when me cannot be read', async () => {
    renderApp(null);
    expect(await screen.findByText('Chat page')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
