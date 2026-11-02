import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n';
import LoadError from './LoadError';

describe('LoadError', () => {
  it('shows plain words instead of the raw message, and Retry calls back', async () => {
    const onRetry = vi.fn();
    render(<LoadError detail="Invalid response" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not load this page/i);
    expect(screen.queryByText(/invalid response/i)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
