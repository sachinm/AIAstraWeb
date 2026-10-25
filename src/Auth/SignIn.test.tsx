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
    expect(screen.getByRole('button', { name: /resend code/i })).toBeInTheDocument();
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

  it('a code shorter than 8 characters is not sent to the server', async () => {
    const user = userEvent.setup();
    vi.mocked(requestMagicLinkEmail).mockResolvedValueOnce({ success: true });
    renderSignIn();
    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send me a code/i }));
    await user.type(await screen.findByLabelText(/sign-in code/i), 'ABC');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(await screen.findByText(/8-character code/i)).toBeInTheDocument();
    expect(loginWithMagicLink).not.toHaveBeenCalled();
  });

  it('resend asks for another code on the same page', async () => {
    const user = userEvent.setup();
    vi.mocked(requestMagicLinkEmail).mockResolvedValue({ success: true });
    renderSignIn();
    await user.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send me a code/i }));
    await user.click(await screen.findByRole('button', { name: /resend code/i }));

    await waitFor(() => expect(requestMagicLinkEmail).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText(/sign-in code/i)).toBeInTheDocument();
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
