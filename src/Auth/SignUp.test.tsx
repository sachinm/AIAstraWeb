import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SignUp from './SignUp';
import { signup } from './api';

vi.mock('./api', () => ({
  signup: vi.fn(),
}));

const mockOnCodeSent = vi.fn();

function renderSignUp() {
  return render(
    <MemoryRouter>
      <SignUp onCodeSent={mockOnCodeSent} onSignIn={vi.fn()} onBack={vi.fn()} />
    </MemoryRouter>
  );
}

/** Fills the birth-details step and moves to the account step. */
async function goToAccountStep(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Asha Rao' } });
  fireEvent.change(screen.getByLabelText(/^age$/i), { target: { value: '34' } });
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1990-01-15' } });
  fireEvent.change(screen.getByLabelText(/place of birth/i), { target: { value: 'Pune, India' } });
  fireEvent.change(screen.getByLabelText(/time of birth/i), { target: { value: '10:30' } });
  await user.click(screen.getByRole('button', { name: /continue/i }));
}

describe('SignUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('account step asks only for email (no password or confirm password)', async () => {
    const user = userEvent.setup();
    renderSignUp();
    await goToAccountStep(user);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
  }, 20000);

  it('submits email and profile fields only, then hands over to the code step', async () => {
    const user = userEvent.setup();
    vi.mocked(signup).mockResolvedValueOnce({ success: true });
    renderSignUp();
    await goToAccountStep(user);

    await user.type(screen.getByLabelText(/email address/i), 'asha@example.com');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(mockOnCodeSent).toHaveBeenCalledWith('asha@example.com'));
    const sent = vi.mocked(signup).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(sent).not.toHaveProperty('password');
    expect(sent).toMatchObject({
      username: 'asharao',
      email: 'asha@example.com',
      date_of_birth: '1990-01-15',
      place_of_birth: 'Pune, India',
    });
  }, 20000);

  it('shows the server message when signup is refused', async () => {
    const user = userEvent.setup();
    vi.mocked(signup).mockResolvedValueOnce({ success: false, message: 'Username or email already exists' });
    renderSignUp();
    await goToAccountStep(user);

    await user.type(screen.getByLabelText(/email address/i), 'taken@example.com');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Username or email already exists')).toBeInTheDocument();
    expect(mockOnCodeSent).not.toHaveBeenCalled();
  }, 20000);
});
