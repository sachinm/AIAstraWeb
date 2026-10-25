import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
      <SignIn
        onSignUp={mockOnSignUp}
        onBack={mockOnBack}
        handleSignIn={mockHandleSignIn}
      />
    </MemoryRouter>
  );
}

describe('SignIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the email-first form with no password field', () => {
    renderSignIn();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /email me a code/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
  });

  it('has a back button that calls onBack', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /back to home/i }));
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('has a button to sign up that calls onSignUp', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /sign up/i }));
    expect(mockOnSignUp).toHaveBeenCalledTimes(1);
  });

  it('asks for a valid email before sending a code', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /email me a code/i }));

    expect(requestMagicLinkEmail).not.toHaveBeenCalled();
  });

  it('emails a code, then signs in with the code entered', async () => {
    const user = userEvent.setup();
    vi.mocked(requestMagicLinkEmail).mockResolvedValueOnce({ success: true });
    vi.mocked(loginWithMagicLink).mockResolvedValueOnce({ success: true, user: 'user-1' });
    renderSignIn();

    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /email me a code/i }));

    await waitFor(() => expect(requestMagicLinkEmail).toHaveBeenCalledWith('a@b.co', null));
    const codeInput = await screen.findByLabelText(/8-character code/i);
    await user.type(codeInput, 'ab-cd 2345');
    await user.click(screen.getByRole('button', { name: /sign in with code/i }));

    await waitFor(() =>
      expect(loginWithMagicLink).toHaveBeenCalledWith('a@b.co', 'ABCD2345', null)
    );
    expect(mockHandleSignIn).toHaveBeenCalledWith('user-1');
  });

  it('shows the generic error when the code is refused', async () => {
    const user = userEvent.setup();
    vi.mocked(loginWithMagicLink).mockResolvedValueOnce({
      success: false,
      message: 'Unable to sign in. Check your code and try again.',
    });
    renderSignIn({ pathname: '/signin', state: { email: 'a@b.co', codeSent: true } });

    await user.type(screen.getByLabelText(/8-character code/i), 'WRONG123');
    await user.click(screen.getByRole('button', { name: /sign in with code/i }));

    expect(await screen.findByText(/check your code and try again/i)).toBeInTheDocument();
    expect(mockHandleSignIn).not.toHaveBeenCalled();
  });

  it('opens on the code step after sign-up, with the email shown', () => {
    renderSignIn({ pathname: '/signin', state: { email: 'new@b.co', codeSent: true } });
    expect(screen.getByLabelText(/8-character code/i)).toBeInTheDocument();
    expect(screen.getByText('new@b.co')).toBeInTheDocument();
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend code/i })).toBeInTheDocument();
  });
});
