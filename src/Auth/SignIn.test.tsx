import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, type InitialEntry } from 'react-router-dom';
import SignIn from './SignIn';
import { requestMagicLinkEmail, loginWithMagicLink } from './api';

vi.mock('./api', () => ({
  requestMagicLinkEmail: vi.fn(),
  loginWithMagicLink: vi.fn(),
  LOGIN_FAILED_GENERIC: 'Unable to sign in. Check your code and try again.',
}));

const mockOnSignUp = vi.fn();
const mockOnBack = vi.fn();
const mockHandleSignIn = vi.fn();

function renderSignIn(initialEntry: InitialEntry = '/signin') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SignIn onSignUp={mockOnSignUp} onBack={mockOnBack} handleSignIn={mockHandleSignIn} />
    </MemoryRouter>
  );
}

describe('SignIn (one page, email then code)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the email field and "Send me a code" with no password field and no code field yet', () => {
    renderSignIn();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send me a code/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/sign-in code/i)).not.toBeInTheDocument();
  });

  it('is one screen: a single form whose code field and Verify button appear below the email after sending', async () => {
    const user = userEvent.setup();
    vi.mocked(requestMagicLinkEmail).mockResolvedValueOnce({ success: true });
    const { container } = renderSignIn();

    // before: one form, email only, one submit button
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^verify$/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send me a code/i }));
    const codeField = await screen.findByLabelText(/sign-in code/i);

    // after: still one form, code field is below the email, Verify replaces "Send me a code"
    expect(container.querySelectorAll('form')).toHaveLength(1);
    const emailField = screen.getByLabelText(/email address/i);
    expect(emailField.compareDocumentPosition(codeField) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: /^verify$/i })).toHaveAttribute('type', 'submit');
    expect(screen.queryByRole('button', { name: /send me a code/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send a new code/i })).toHaveAttribute('type', 'button');
    // no verification-email banner when the user came to sign in (it is for the sign-up hand-over only)
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('has no password field, no forgot-password link and no reset link at any step', async () => {
    const user = userEvent.setup();
    vi.mocked(requestMagicLinkEmail).mockResolvedValueOnce({ success: true });
    const { container } = renderSignIn();
    const check = () => {
      expect(container.querySelector('input[type="password"]')).toBeNull();
      expect(container.textContent).not.toMatch(/password|forgot|reset/i);
      expect(screen.queryByRole('link', { name: /forgot|reset/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /forgot|reset/i })).not.toBeInTheDocument();
    };
    check();
    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send me a code/i }));
    await screen.findByLabelText(/sign-in code/i);
    check();
  });

  describe('arriving from sign-up', () => {
    const fromSignUp = { pathname: '/signin', state: { email: 'new@b.co', codeSent: true, fromSignUp: true } };

    it('shows the code field and a clear line that the verification email was sent to that address', () => {
      renderSignIn(fromSignUp);
      expect(screen.getByLabelText(/email address/i)).toHaveValue('new@b.co');
      const code = screen.getByLabelText(/sign-in code/i);
      expect(code).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^verify$/i })).toBeInTheDocument();
      const note = screen.getByRole('status');
      expect(note).toHaveTextContent(/verification email/i);
      expect(note).toHaveTextContent('new@b.co');
      // the note sits between the email and the code field, on the same screen
      const email = screen.getByLabelText(/email address/i);
      expect(email.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(note.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // the 30 second cooldown is already running
      expect(screen.getByRole('button', { name: /send a new code/i })).toBeDisabled();
      expect(screen.getByText(/new code in \d+s/i)).toBeInTheDocument();
    });

    it('does not show the line when only the email is prefilled', () => {
      renderSignIn({ pathname: '/signin', state: { email: 'taken@b.co' } });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('drops the line once the address is edited, because it would no longer be true', async () => {
      const user = userEvent.setup();
      renderSignIn(fromSignUp);
      await user.type(screen.getByLabelText(/email address/i), 'x');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('signs in with the code from the verification email', async () => {
      const user = userEvent.setup();
      vi.mocked(loginWithMagicLink).mockResolvedValueOnce({ success: true, user: 'user-9' });
      renderSignIn(fromSignUp);
      await user.type(screen.getByLabelText(/sign-in code/i), '123456');
      await user.click(screen.getByRole('button', { name: /^verify$/i }));
      await waitFor(() => expect(loginWithMagicLink).toHaveBeenCalledWith('new@b.co', '123456', null));
      expect(mockHandleSignIn).toHaveBeenCalledWith('user-9');
    });
  });

  it('has a back button that calls onBack', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /back to home/i }));
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('has a sign-up button that calls onSignUp', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /^sign up$/i }));
    expect(mockOnSignUp).toHaveBeenCalledTimes(1);
  });

  it('does not send a code for an invalid email', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send me a code/i }));
    expect(requestMagicLinkEmail).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/sign-in code/i)).not.toBeInTheDocument();
  });

  it('after sending, the code field and Verify appear on the same page with the email still editable', async () => {
    const user = userEvent.setup();
    vi.mocked(requestMagicLinkEmail).mockResolvedValueOnce({ success: true });
    renderSignIn();

    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send me a code/i }));

    await waitFor(() => expect(requestMagicLinkEmail).toHaveBeenCalledWith('a@b.co', null));
    expect(await screen.findByLabelText(/sign-in code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^verify$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send a new code/i })).toBeInTheDocument();
    // same page: email field is still there and still editable
    const email = screen.getByLabelText(/email address/i);
    expect(email).toHaveValue('a@b.co');
    expect(email).toBeEnabled();
    expect(mockOnSignUp).not.toHaveBeenCalled();
  });

  it('verifies the code entered and signs in', async () => {
    const user = userEvent.setup();
    vi.mocked(requestMagicLinkEmail).mockResolvedValueOnce({ success: true });
    vi.mocked(loginWithMagicLink).mockResolvedValueOnce({ success: true, user: 'user-1' });
    renderSignIn();

    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send me a code/i }));
    await user.type(await screen.findByLabelText(/sign-in code/i), 'ab-cd 2345');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => expect(loginWithMagicLink).toHaveBeenCalledWith('a@b.co', 'ABCD2345', null));
    expect(mockHandleSignIn).toHaveBeenCalledWith('user-1');
  });

  it('a code shorter than 6 characters is not sent to the server', async () => {
    const user = userEvent.setup();
    vi.mocked(requestMagicLinkEmail).mockResolvedValueOnce({ success: true });
    renderSignIn();
    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send me a code/i }));
    await user.type(await screen.findByLabelText(/sign-in code/i), 'ABC');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(await screen.findByText(/enter the code we emailed you\.$/i)).toBeInTheDocument();
    expect(loginWithMagicLink).not.toHaveBeenCalled();
  });

  it('accepts a 6-digit code (sign-up confirmation)', async () => {
    const user = userEvent.setup();
    vi.mocked(requestMagicLinkEmail).mockResolvedValueOnce({ success: true });
    vi.mocked(loginWithMagicLink).mockResolvedValueOnce({ success: true, user: 'user-1' });
    renderSignIn();
    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send me a code/i }));
    await user.type(await screen.findByLabelText(/sign-in code/i), '123 456');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));
    await waitFor(() => expect(loginWithMagicLink).toHaveBeenCalledWith('a@b.co', '123456', null));
  });

  it('accepts an 8-digit code (sign-in) and stops typing at 8 characters', async () => {
    const user = userEvent.setup();
    vi.mocked(requestMagicLinkEmail).mockResolvedValueOnce({ success: true });
    vi.mocked(loginWithMagicLink).mockResolvedValueOnce({ success: true, user: 'user-1' });
    renderSignIn();
    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send me a code/i }));
    const field = await screen.findByLabelText(/sign-in code/i);
    await user.type(field, '123456789');
    expect(field).toHaveValue('12345678');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));
    await waitFor(() => expect(loginWithMagicLink).toHaveBeenCalledWith('a@b.co', '12345678', null));
  });

  it('shows neutral copy with no code length or exact expiry', async () => {
    renderSignIn({ pathname: '/signin', state: { email: 'a@b.co', codeSent: true } });
    expect(screen.getByText('Enter the code we emailed you. It expires in a few minutes.')).toBeInTheDocument();
    expect(screen.queryByText(/8-character|5 minutes/i)).not.toBeInTheDocument();
  });

  describe('send a new code (30 second cooldown)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('is disabled with a countdown after a code is sent, then asks for another code on the same page', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.mocked(requestMagicLinkEmail).mockResolvedValue({ success: true });
      renderSignIn();
      await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
      await user.click(screen.getByRole('button', { name: /send me a code/i }));

      const link = await screen.findByRole('button', { name: /send a new code/i });
      expect(link).toBeDisabled();
      // the countdown is visible and ticks down (real time also passes while the user types)
      const before = Number(screen.getByText(/new code in \d+s/i).textContent!.match(/(\d+)s/)![1]);
      expect(before).toBeLessThanOrEqual(30);

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      const after = Number(screen.getByText(/new code in \d+s/i).textContent!.match(/(\d+)s/)![1]);
      expect(after).toBeLessThan(before);

      // one tick per render: the countdown re-arms its timer after each update
      for (let i = 0; i < 31; i += 1) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
      expect(screen.queryByText(/new code in/i)).not.toBeInTheDocument();
      expect(link).toBeEnabled();

      await user.click(link);
      await waitFor(() => expect(requestMagicLinkEmail).toHaveBeenCalledTimes(2));
      expect(screen.getByLabelText(/sign-in code/i)).toBeInTheDocument();
      // the cooldown restarts
      expect(screen.getByRole('button', { name: /send a new code/i })).toBeDisabled();
    });

    it('starts the cooldown at once when arriving from sign-up (a code was just sent)', () => {
      renderSignIn({ pathname: '/signin', state: { email: 'new@b.co', codeSent: true } });
      expect(screen.getByRole('button', { name: /send a new code/i })).toBeDisabled();
      expect(screen.getByText(/new code in \d+s/i)).toBeInTheDocument();
    });
  });

  it('shows the generic error when the code is refused', async () => {
    const user = userEvent.setup();
    vi.mocked(loginWithMagicLink).mockResolvedValueOnce({
      success: false,
      message: 'Unable to sign in. Check your code and try again.',
    });
    renderSignIn({ pathname: '/signin', state: { email: 'a@b.co', codeSent: true } });

    await user.type(screen.getByLabelText(/sign-in code/i), 'WRONG123');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(await screen.findByText(/check your code and try again/i)).toBeInTheDocument();
    expect(mockHandleSignIn).not.toHaveBeenCalled();
  });

  it('opens with the code field showing when routed from sign-up, with the email prefilled', () => {
    renderSignIn({ pathname: '/signin', state: { email: 'new@b.co', codeSent: true } });
    expect(screen.getByLabelText(/email address/i)).toHaveValue('new@b.co');
    expect(screen.getByLabelText(/sign-in code/i)).toBeInTheDocument();
  });

  it('prefills the email (without showing the code field) when routed from "email already registered"', () => {
    renderSignIn({ pathname: '/signin', state: { email: 'taken@b.co' } });
    expect(screen.getByLabelText(/email address/i)).toHaveValue('taken@b.co');
    expect(screen.queryByLabelText(/sign-in code/i)).not.toBeInTheDocument();
  });
});
