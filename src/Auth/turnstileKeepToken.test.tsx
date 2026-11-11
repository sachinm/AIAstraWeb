import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SignIn from './SignIn';
import SignUp from './SignUp';
import { requestMagicLinkEmail, loginWithMagicLink, startSignup, fetchCurrentTermsVersion } from './api';

vi.mock('./api', () => ({
  requestMagicLinkEmail: vi.fn(),
  loginWithMagicLink: vi.fn(),
  startSignup: vi.fn(),
  verifySignupCode: vi.fn(),
  fetchCurrentTermsVersion: vi.fn(),
  LOGIN_FAILED_GENERIC: 'That code did not work.',
  EMAIL_EXISTS_CODE: 'EMAIL_EXISTS',
  TERMS_REQUIRED_CODE: 'terms_required',
  TERMS_OUTDATED_CODE: 'terms_outdated',
  TERMS_OUTDATED_MESSAGE: 'Terms changed.',
}));

const tsReset = vi.hoisted(() => vi.fn());
const tsWait = vi.hoisted(() => vi.fn());

vi.mock('./useTurnstile', () => ({
  useTurnstile: () => ({
    isEnabled: true,
    siteKey: 'k',
    token: 'tok',
    error: null,
    awaiting: false,
    needsInteraction: false,
    waitForToken: tsWait,
    reset: tsReset,
    registerReset: vi.fn(),
    onSuccess: vi.fn(),
    onExpire: vi.fn(),
    onError: vi.fn(),
    onBeforeInteractive: vi.fn(),
    onAfterInteractive: vi.fn(),
  }),
}));
vi.mock('./TurnstileGate', () => ({ default: () => null }));

describe('Turnstile token handling on sign-in and sign-up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tsWait.mockResolvedValue('token-value');
    vi.mocked(fetchCurrentTermsVersion).mockResolvedValue(null);
  });

  describe('SignIn', () => {
    const renderSignIn = (state?: object) =>
      render(
        <MemoryRouter initialEntries={[{ pathname: '/signin', state }]}>
          <SignIn onSignUp={vi.fn()} onBack={vi.fn()} handleSignIn={vi.fn()} />
        </MemoryRouter>
      );

    it('a malformed email never waits for or spends the token', async () => {
      const user = userEvent.setup();
      renderSignIn();
      await user.type(screen.getByLabelText(/email address/i), 'a@b');
      await user.click(screen.getByRole('button', { name: /send me a code/i }));
      expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
      expect(tsWait).not.toHaveBeenCalled();
      expect(requestMagicLinkEmail).not.toHaveBeenCalled();
      expect(tsReset).not.toHaveBeenCalled();
    });

    it('keeps the token when the server refused before checking it', async () => {
      const user = userEvent.setup();
      vi.mocked(requestMagicLinkEmail).mockResolvedValueOnce({ success: false, message: 'Bad email', turnstileConsumed: false });
      renderSignIn();
      await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
      await user.click(screen.getByRole('button', { name: /send me a code/i }));
      await waitFor(() => expect(requestMagicLinkEmail).toHaveBeenCalledTimes(1));
      await screen.findByText('Bad email');
      expect(tsReset).not.toHaveBeenCalled();
    });

    it('resets the widget when the server refused after spending the token', async () => {
      const user = userEvent.setup();
      vi.mocked(requestMagicLinkEmail).mockResolvedValueOnce({ success: false, message: 'Verification failed.' });
      renderSignIn();
      await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
      await user.click(screen.getByRole('button', { name: /send me a code/i }));
      await screen.findByText('Verification failed.');
      expect(tsReset).toHaveBeenCalledTimes(1);
    });

    it('keeps the token on a code refused early, and resets on a wrong code that reached the check', async () => {
      const user = userEvent.setup();
      const atCode = { email: 'a@b.co', codeSent: true };
      vi.mocked(loginWithMagicLink)
        .mockResolvedValueOnce({ success: false, message: 'Early', turnstileConsumed: false })
        .mockResolvedValueOnce({ success: false, message: 'Wrong code' });
      renderSignIn(atCode);
      await user.type(screen.getByLabelText(/sign-in code/i), '12345678');
      await user.click(screen.getByRole('checkbox', { name: /18 or older/i }));
      await user.click(screen.getByRole('button', { name: /^verify$/i }));
      await screen.findByText('Early');
      expect(tsReset).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: /^verify$/i }));
      await screen.findByText('Wrong code');
      expect(tsReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('SignUp', () => {
    const renderSignUp = () =>
      render(
        <MemoryRouter>
          <SignUp onVerified={vi.fn()} onSignIn={vi.fn()} onBack={vi.fn()} />
        </MemoryRouter>
      );
    async function fill(user: ReturnType<typeof userEvent.setup>, email = 'asha@example.com') {
      await user.type(screen.getByLabelText(/^name$/i), 'Asha Rao');
      await user.type(screen.getByLabelText(/email address/i), email);
      await user.click(screen.getByRole('checkbox', { name: /accept the terms/i }));
      await user.click(screen.getByRole('button', { name: /^next$/i }));
    }

    it('a malformed email never waits for or spends the token', async () => {
      const user = userEvent.setup();
      renderSignUp();
      await fill(user, 'nope');
      expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
      expect(tsWait).not.toHaveBeenCalled();
      expect(startSignup).not.toHaveBeenCalled();
    });

    it('keeps the token when the server refused before checking it, resets when it did not', async () => {
      const user = userEvent.setup();
      vi.mocked(startSignup)
        .mockResolvedValueOnce({ success: false, message: 'Early refusal', turnstileConsumed: false })
        .mockResolvedValueOnce({ success: false, message: 'Late refusal' });
      renderSignUp();
      await fill(user);
      await screen.findByText('Early refusal');
      expect(tsReset).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: /^next$/i }));
      await screen.findByText('Late refusal');
      expect(tsReset).toHaveBeenCalledTimes(1);
    });
  });
});
