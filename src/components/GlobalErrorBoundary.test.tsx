import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalErrorBoundary from './GlobalErrorBoundary';
import { resetErrorTelemetryForTests } from '../lib/errorTelemetry';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new TypeError('Crash for alice@example.com with Bearer secret-token-999');
  }
  return <div data-testid="healthy-child">App rendered cleanly</div>;
}

describe('GlobalErrorBoundary', () => {
  beforeEach(() => {
    (globalThis as { __ASTRA_ENABLE_TEST_TELEMETRY__?: boolean }).__ASTRA_ENABLE_TEST_TELEMETRY__ = true;
    resetErrorTelemetryForTests();
    window.history.pushState({}, '', '/dashboard/love');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true, recorded: 1 }), { status: 200 }))
    );
  });

  afterEach(() => {
    resetErrorTelemetryForTests();
    delete (globalThis as { __ASTRA_ENABLE_TEST_TELEMETRY__?: boolean }).__ASTRA_ENABLE_TEST_TELEMETRY__;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders children normally when no error occurs', () => {
    render(
      <GlobalErrorBoundary>
        <Bomb shouldThrow={false} />
      </GlobalErrorBoundary>
    );
    expect(screen.getByTestId('healthy-child')).toBeInTheDocument();
  });

  it('renders calm fallback without raw stack traces and flushes scrubbed web_react telemetry', async () => {
    render(
      <GlobalErrorBoundary name="LoveBoard">
        <Bomb shouldThrow={true} />
      </GlobalErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong on this screen');
    expect(screen.getByTestId('error-boundary-ref')).toHaveTextContent(/Reference ID:/i);

    // Must not leak raw error message, PII, or stack frames into the user-visible DOM
    expect(alert.textContent).not.toContain('alice@example.com');
    expect(alert.textContent).not.toContain('secret-token-999');
    expect(alert.textContent).not.toContain('TypeError');

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/telemetry/client-errors');
    const body = JSON.parse(String(init.body)) as {
      events: Array<{
        source: string;
        severity: string;
        category: string;
        errorCode?: string;
        operation?: string;
        message: string;
        stack?: string;
        meta?: Record<string, unknown>;
      }>;
    };
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      source: 'web_react',
      severity: 'critical',
      category: 'react_boundary',
      errorCode: 'TypeError',
    });
    expect(body.events[0]?.message).not.toContain('alice@example.com');
    expect(body.events[0]?.message).not.toContain('secret-token-999');
    expect(body.events[0]?.meta?.componentStack).toBeTruthy();
  });

  it('supports Retry, Reload page, and Return home actions', () => {
    const onGoHome = vi.fn();
    let shouldThrow = true;
    const Controlled = () => <Bomb shouldThrow={shouldThrow} />;

    const { rerender } = render(
      <GlobalErrorBoundary onGoHome={onGoHome}>
        <Controlled />
      </GlobalErrorBoundary>
    );

    expect(screen.getByTestId('global-error-boundary')).toBeInTheDocument();

    // Fix child before clicking Retry
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    rerender(
      <GlobalErrorBoundary onGoHome={onGoHome}>
        <Controlled />
      </GlobalErrorBoundary>
    );
    expect(screen.getByTestId('healthy-child')).toBeInTheDocument();

    // Trigger crash again to test Reload page & Return home
    shouldThrow = true;
    rerender(
      <GlobalErrorBoundary onGoHome={onGoHome}>
        <Controlled />
      </GlobalErrorBoundary>
    );
    expect(screen.getByTestId('global-error-boundary')).toBeInTheDocument();

    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
    try {
      fireEvent.click(screen.getByRole('button', { name: /reload page/i }));
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }

    fireEvent.click(screen.getByRole('button', { name: /return home/i }));
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});
