import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignIn from './SignIn';

const mockOnSignUp = vi.fn();
const mockOnBack = vi.fn();
const mockHandleSignIn = vi.fn();

function renderSignIn() {
  return render(
    <SignIn
      onSignUp={mockOnSignUp}
      onBack={mockOnBack}
      handleSignIn={mockHandleSignIn}
    />
  );
}

describe('SignIn', () => {
  it('renders sign in form with heading and inputs', () => {
    renderSignIn();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('has a back button that calls onBack', async () => {
    const user = userEvent.setup();
    renderSignIn();
    const backButton = screen.getByRole('button', { name: /back to home/i });
    await user.click(backButton);
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('has a button to sign up that calls onSignUp', async () => {
    const user = userEvent.setup();
    renderSignIn();
    const signUpButton = screen.getByRole('button', { name: /sign up/i });
    await user.click(signUpButton);
    expect(mockOnSignUp).toHaveBeenCalledTimes(1);
  });
});
