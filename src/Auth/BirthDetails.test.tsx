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
import { clearSignupDraft, saveSignupStep } from './signupDraft';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
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

const next = (user: U) => user.click(screen.getByRole('button', { name: /^next$/i }));

/** Step 1: date and time, then Next. */
async function fillWhen(user: U, over: { dob?: string } = {}) {
  await user.type(screen.getByLabelText(/date of birth/i), over.dob ?? '27/04/1990');
  await user.selectOptions(screen.getByLabelText('Hour'), '12');
  await user.selectOptions(screen.getByLabelText('Minute'), '05');
  await user.selectOptions(screen.getByLabelText(/am or pm/i), 'AM');
  await next(user);
}

/** Step 2: country and city, then Next. */
async function fillWhere(user: U) {
  await user.clear(screen.getByLabelText(/country of birth/i));
  await user.type(screen.getByLabelText(/country of birth/i), 'Ind');
  await user.click(await screen.findByRole('option', { name: 'India' }));
  await user.type(screen.getByLabelText(/city of birth/i), 'Pune');
  await next(user);
}

/** All three steps, leaving the last one open with its button. */
async function fillAll(user: U, over: { dob?: string } = {}) {
  await fillWhen(user, over);
  await fillWhere(user);
  await user.selectOptions(screen.getByLabelText('Gender'), 'female');
}

/** Opens the page on the last step, as a refresh there would. */
function renderOnLastStep() {
  saveSignupStep('gender');
  return renderPage();
}

describe('BirthDetails (page 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSignupDraft();
    sessionStorage.clear();
    localStorage.clear();
    vi.mocked(fetchMe).mockResolvedValue(me());
  });

  it('has the required controls, a few per step, the format label and the estimate hint; no notice, age or password', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole('heading', { name: /your birth details/i })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByText(/date of birth \(DD\/MM\/YYYY\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Hour')).toBeInTheDocument();
    expect(screen.getByLabelText('Minute')).toBeInTheDocument();
    expect(screen.getByLabelText(/am or pm/i)).toBeInTheDocument();
    expect(screen.getByText("If you don't know the exact time, use your best estimate.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/country of birth/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
    await fillWhen(user);
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.queryByLabelText(/date of birth/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/country of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city of birth/i)).toHaveAttribute('type', 'text');
    await fillWhere(user);
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Gender')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Male' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Female' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Prefer not to say' })).toBeInTheDocument();
    expect(screen.getByLabelText('Referral code (optional)')).toBeInTheDocument();
    // the 30-minute notice belongs to the "generating your chart" overlay after Create my chart, not to the form
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^age$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create my chart/i })).toBeEnabled();
  });

  it('Next names only that step\'s missing fields and focuses the first; every step is required but the referral', async () => {
    const user = userEvent.setup();
    renderPage();
    await next(user);
    let alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Date of birth');
    expect(alert).toHaveTextContent('Time of birth');
    expect(alert).not.toHaveTextContent('City');
    await waitFor(() => expect(screen.getByLabelText(/date of birth/i)).toHaveFocus());
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();

    await fillWhen(user);
    // the country defaults from the browser locale; clear it to prove it is required
    await user.clear(screen.getByLabelText(/country of birth/i));
    await next(user);
    alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Country');
    expect(alert).toHaveTextContent('City');

    await fillWhere(user);
    await user.click(screen.getByRole('button', { name: /create my chart/i }));
    expect(completeProfile).not.toHaveBeenCalled();
    alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Gender');
    expect(alert).not.toHaveTextContent(/referral/i);
  });

  it('asks one question per step on a short window', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (q: string) => ({ matches: q.includes('max-height'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList
    );
    renderPage();
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Hour')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/date of birth/i), '27/04/1990');
    await next(user);
    expect(screen.getByText('Step 2 of 7')).toBeInTheDocument();
    expect(screen.getByLabelText('Hour')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('Back keeps what was typed', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillWhen(user);
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue('27/04/1990');
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
      language: 'en',
    });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const sent = vi.mocked(completeProfile).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(
      ['city', 'country_code', 'date_of_birth', 'gender', 'language', 'referral_code', 'time_of_birth']
    );
  });

  it('asks for English or Hindi, says Hindi is coming, and sends the choice', async () => {
    const user = userEvent.setup();
    vi.mocked(completeProfile).mockResolvedValueOnce({ success: true, referral_code: 'ABC' });
    renderPage();
    await fillAll(user);
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(screen.queryByText(/Hindi is coming soon/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'हिन्दी (Hindi)' }));
    expect(screen.getByText('Hindi is coming soon. Until then, your readings and the app are in English.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /create my chart/i }));
    await waitFor(() => expect(completeProfile).toHaveBeenCalled());
    expect(vi.mocked(completeProfile).mock.calls[0][0].language).toBe('hi');
  });

  it('defaults to Hindi for a browser set to Hindi', () => {
    const spy = vi.spyOn(navigator, 'language', 'get').mockReturnValue('hi-IN');
    renderOnLastStep();
    expect(screen.getByRole('radio', { name: 'हिन्दी (Hindi)' })).toBeChecked();
    spy.mockRestore();
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
    saveSignupStep('country');
    renderPage();
    expect(screen.getByLabelText(/country of birth/i)).toHaveValue('United States');
  });

  it('keeps entries and the step in memory across leaving and returning to the page, and writes nothing to storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    const first = renderPage();
    await fillWhen(user);
    await user.type(screen.getByLabelText(/city of birth/i), 'Pune');
    first.unmount();

    renderPage();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByLabelText(/city of birth/i)).toHaveValue('Pune');
    expect(setItem).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
    setItem.mockRestore();
  });

  it('forgets the draft and the step once it is cleared (sign-out or a refresh)', async () => {
    const user = userEvent.setup();
    const first = renderPage();
    await fillWhen(user);
    await user.type(screen.getByLabelText(/city of birth/i), 'Pune');
    first.unmount();
    clearSignupDraft();

    renderPage();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue('');
  });

  it('shows the server message and keeps the entries when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(completeProfile).mockResolvedValueOnce({ success: false, message: 'Try later.' });
    renderPage();
    await fillAll(user);
    await user.click(screen.getByRole('button', { name: /create my chart/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try later.');
    expect(screen.getByLabelText('Gender')).toHaveValue('female');
    await user.click(screen.getByRole('button', { name: /back/i }));
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

  it('skips the page for a user whose profile is already complete and chart is ready', async () => {
    vi.mocked(fetchMe).mockResolvedValue(me({ profile_complete: true, kundli_status: 'ready' }));
    renderPage();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('shows the generating overlay on reload/re-login when profile_complete is true and kundli_status is building, then calls onDone when ready', async () => {
    vi.mocked(fetchMe)
      .mockResolvedValueOnce(me({ profile_complete: true, kundli_status: 'building' }))
      .mockResolvedValueOnce(me({ profile_complete: true, kundli_status: 'ready' }));
    renderPage();
    expect(await screen.findByText(/Generating your birth chart/i)).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="birth-chart-generating-overlay"]')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('about 30 minutes after you register');
    await waitFor(() => expect(onDone).toHaveBeenCalled(), { timeout: 5000 });
  });

  it('shows real progress from the build state, and moves on as soon as chat opens', async () => {
    const chart = { stage: 'gate' as const, gate_total: 24, rest_done: 0, rest_total: 89, facts_status: 'pending', reading_mode: 'legacy' as const, last_error: null };
    vi.mocked(fetchMe)
      .mockResolvedValueOnce(me({ profile_complete: true, kundli_status: 'building', chart: { ...chart, status: 'building', gate_done: 7 } }))
      .mockResolvedValueOnce(me({ profile_complete: true, kundli_status: 'building', chart: { ...chart, status: 'chat_ready', stage: 'rest', gate_done: 24 } }));
    renderPage();
    expect(await screen.findByText('7 of 24')).toBeInTheDocument();
    await waitFor(() => expect(onDone).toHaveBeenCalled(), { timeout: 5000 });
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

  it('says when chat is answering from the basic chart only', async () => {
    const chart = { status: 'ready' as const, stage: null, gate_done: 24, gate_total: 24, rest_done: 89, rest_total: 89, facts_status: 'unsupported', reading_mode: 'legacy' as const, last_error: null };
    renderApp(me({ profile_complete: true, kundli_status: 'ready', chart }));
    expect(await screen.findByText('Chat page')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Answers for now use your basic chart');
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
