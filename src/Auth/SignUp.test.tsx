import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SignUp from './SignUp';
import { startSignup, verifySignupCode } from './api';

vi.mock('./api', () => ({
  startSignup: vi.fn(),
  verifySignupCode: vi.fn(),
  EMAIL_EXISTS_CODE: 'EMAIL_EXISTS',
}));

const onVerified = vi.fn();
const onSignIn = vi.fn();

function renderPage() {
  return render(
    <MemoryRouter>
      <SignUp onVerified={onVerified} onSignIn={onSignIn} onBack={vi.fn()} />
    </MemoryRouter>
  );
}

async function fillAndNext(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^name$/i), 'Asha Rao');
  await user.type(screen.getByLabelText(/email address/i), 'asha@example.com');
  await user.click(screen.getByRole('button', { name: /^next$/i }));
}

/** One second at a time: the countdown re-arms its timer after each render. */
async function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  }
}

describe('SignUp page 1 (Create your account)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('asks only for name and email, with a Next button and no password or age', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^age$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
  });

  it('Next calls startSignup and reveals the code field below the email on the same page', async () => {
    const user = userEvent.setup();
    vi.mocked(startSignup).mockResolvedValueOnce({ success: true });
    const { container } = renderPage();
    await fillAndNext(user);

    expect(startSignup).toHaveBeenCalledWith({ name: 'Asha Rao', email: 'asha@example.com', turnstileToken: null });
    const code = await screen.findByLabelText(/verification code/i);
    const email = screen.getByLabelText(/email address/i);
    expect(email.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^verify$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use a different email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend code/i })).toBeDisabled();
  });

  it('shows the duplicate-email message with a Sign in button that carries the email', async () => {
    const user = userEvent.setup();
    vi.mocked(startSignup).mockResolvedValueOnce({ success: false, code: 'EMAIL_EXISTS', message: 'x' });
    renderPage();
    await fillAndNext(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This email is already registered. Please sign in instead.');
    await user.click(within(alert).getByRole('button', { name: /sign in/i }));
    expect(onSignIn).toHaveBeenCalledWith('asha@example.com');
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
  });

  it('validates name and email before calling the server', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(startSignup).not.toHaveBeenCalled();
    expect(screen.getByText(/enter your name/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toHaveFocus();
  });

  describe('resend cooldown', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('counts down 30 seconds, then Resend sends another code', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.mocked(startSignup).mockResolvedValue({ success: true });
      renderPage();
      await fillAndNext(user);

      await screen.findByLabelText(/verification code/i);
      expect(screen.getByText(/new code in 30s/i)).toBeInTheDocument();
      const resend = screen.getByRole('button', { name: /resend code/i });
      expect(resend).toBeDisabled();

      await tick(10);
      expect(screen.getByText(/new code in 20s/i)).toBeInTheDocument();

      await tick(20);
      await waitFor(() => expect(resend).toBeEnabled());
      await user.click(resend);
      await waitFor(() => expect(startSignup).toHaveBeenCalledTimes(2));
      expect(screen.getByText(/new code in 30s/i)).toBeInTheDocument();
    });
  });

  it('a correct code signs the user in and moves on to page 2', async () => {
    const user = userEvent.setup();
    vi.mocked(startSignup).mockResolvedValueOnce({ success: true });
    vi.mocked(verifySignupCode).mockResolvedValueOnce({ success: true, user: 'u1' });
    renderPage();
    await fillAndNext(user);

    await user.type(await screen.findByLabelText(/verification code/i), 'ab12cd');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(verifySignupCode).toHaveBeenCalledWith('asha@example.com', 'AB12CD');
    expect(onVerified).toHaveBeenCalledWith({ email: 'asha@example.com', name: 'Asha Rao', userId: 'u1' });
  });

  it('a wrong code shows the error and stays on the page', async () => {
    const user = userEvent.setup();
    vi.mocked(startSignup).mockResolvedValueOnce({ success: true });
    vi.mocked(verifySignupCode).mockResolvedValueOnce({ success: false, message: 'Wrong code.' });
    renderPage();
    await fillAndNext(user);
    await user.type(await screen.findByLabelText(/verification code/i), '123456');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong code.');
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('"Use a different email" returns to the form and clears the code', async () => {
    const user = userEvent.setup();
    vi.mocked(startSignup).mockResolvedValueOnce({ success: true });
    renderPage();
    await fillAndNext(user);
    await user.click(await screen.findByRole('button', { name: /use a different email/i }));
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).not.toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
  });
});
