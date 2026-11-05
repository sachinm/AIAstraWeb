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
    awaiting: false,
    needsInteraction: false,
    onSuccess: vi.fn(),
    onExpire: vi.fn(),
    onError: vi.fn(),
    onBeforeInteractive: vi.fn(),
    onAfterInteractive: vi.fn(),
    registerReset: vi.fn(),
    reset: vi.fn(),
    waitForToken: vi.fn(),
    ...over,
  }) as never;

const overlay = () => document.querySelector('[data-test-id="turnstile-waiting"]');

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

  it('shows the Cloudflare box in view, with no wait message, while the person types', () => {
    render(<TurnstileGate turnstile={state()} action="login" />);
    expect(overlay()).toBeNull();
    expect(document.querySelector('[data-test-id="turnstile-field"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="turnstile-gate"]')!.className).not.toMatch(/opacity-0|h-px/);
  });

  it('a submit waiting on the check says so only after a moment', () => {
    render(<TurnstileGate turnstile={state({ awaiting: true })} action="register" />);
    expect(overlay()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(screen.getByText(/Finishing the security check/)).toBeInTheDocument();
  });

  it('drops the wait message when the token arrives', () => {
    const { rerender } = render(<TurnstileGate turnstile={state({ awaiting: true })} action="register" />);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    rerender(<TurnstileGate turnstile={state({ awaiting: false, token: 'abc' })} action="register" />);
    expect(overlay()).toBeNull();
  });

  it('offers a retry when the check fails while a submit waits', () => {
    const reset = vi.fn();
    render(<TurnstileGate turnstile={state({ awaiting: true, error: 'Security check failed. Please try again.', reset })} action="register" />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalled();
  });

  it('says it is slow after 15 seconds of waiting', () => {
    render(<TurnstileGate turnstile={state({ awaiting: true })} action="register" />);
    act(() => {
      vi.advanceTimersByTime(14_000);
    });
    expect(screen.queryByText('This is taking longer than usual.')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText('This is taking longer than usual.')).toBeInTheDocument();
  });
});
