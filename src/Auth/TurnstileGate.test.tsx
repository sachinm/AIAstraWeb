import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TurnstileGate from './TurnstileGate';

vi.mock('./TurnstileField', () => ({ default: () => <div data-test-id="turnstile-field" /> }));

const state = (over: Record<string, unknown> = {}) =>
  ({
    isEnabled: true,
    siteKey: 'site',
    token: null,
    error: null,
    onSuccess: vi.fn(),
    onExpire: vi.fn(),
    onError: vi.fn(),
    registerReset: vi.fn(),
    reset: vi.fn(),
    requireToken: vi.fn(),
    ...over,
  }) as never;

describe('TurnstileGate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders nothing when the check is not configured', () => {
    const { container } = render(<TurnstileGate turnstile={state({ isEnabled: false })} action="login" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Getting things ready" until there is a token, then hides the overlay but keeps the widget mounted', () => {
    const { rerender } = render(<TurnstileGate turnstile={state()} action="login" />);
    expect(screen.getByText('Getting things ready…')).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="turnstile-field"]')).not.toBeNull();
    rerender(<TurnstileGate turnstile={state({ token: 'abc' })} action="login" />);
    expect(screen.queryByText('Getting things ready…')).not.toBeInTheDocument();
    expect(document.querySelector('[data-test-id="turnstile-field"]')).not.toBeNull();
  });

  it('does not bring the overlay back when the token is used up and the widget resets', () => {
    const { rerender } = render(<TurnstileGate turnstile={state({ token: 'abc' })} action="register" />);
    rerender(<TurnstileGate turnstile={state({ token: null })} action="register" />);
    expect(screen.queryByText('Getting things ready…')).not.toBeInTheDocument();
    expect(document.querySelector('[data-test-id="turnstile-field"]')).not.toBeNull();
  });

  it('offers a retry after a failed or slow check', () => {
    const reset = vi.fn();
    render(<TurnstileGate turnstile={state({ error: 'Security check failed. Please try again.', reset })} action="register" />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalled();
  });

  it('says it is slow after 15 seconds', () => {
    render(<TurnstileGate turnstile={state()} action="register" />);
    expect(screen.queryByText('This is taking longer than usual.')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(screen.getByText('This is taking longer than usual.')).toBeInTheDocument();
  });
});
