import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushClientErrors,
  installGlobalErrorListeners,
  redactClientErrorText,
  reportClientError,
  resetErrorTelemetryForTests,
} from './errorTelemetry';
import { clearAuth, runGraphQL, setAuth } from './graphql';

describe('errorTelemetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T08:00:00.000Z'));
    (globalThis as { __ASTRA_ENABLE_TEST_TELEMETRY__?: boolean }).__ASTRA_ENABLE_TEST_TELEMETRY__ = true;
    resetErrorTelemetryForTests();
    clearAuth();
    window.history.pushState({}, '', '/dashboard/you');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true, recorded: 1 }), { status: 200 }))
    );
  });

  afterEach(() => {
    resetErrorTelemetryForTests();
    clearAuth();
    delete (globalThis as { __ASTRA_ENABLE_TEST_TELEMETRY__?: boolean }).__ASTRA_ENABLE_TEST_TELEMETRY__;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('redacts emails, Bearer tokens, JWTs, API keys, and query strings while preserving stack line:col', () => {
    const raw =
      'Failed for alice@example.com with Bearer secret-abc-123 and eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig456 at https://api.example.com/chart?key=AIzaSySecret123&dob=1990-04-27';
    const clean = redactClientErrorText(raw);
    expect(clean).not.toContain('alice@example.com');
    expect(clean).not.toContain('secret-abc-123');
    expect(clean).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(clean).not.toContain('AIzaSySecret123');
    expect(clean).not.toContain('dob=1990-04-27');
    expect(clean).toContain('https://api.example.com/chart');

    const stackLine = 'at YouPage (http://localhost:5173/src/pages/YouPage.tsx?t=170000:42:9)';
    const cleanStack = redactClientErrorText(stackLine);
    expect(cleanStack).toBe('at YouPage (http://localhost:5173/src/pages/YouPage.tsx:42:9)');
  });

  it('captures window error, unhandledrejection, and sanitized securitypolicyviolation events', async () => {
    setAuth('jwt-test-token', 'user-1');
    const cleanup = installGlobalErrorListeners();

    try {
      window.dispatchEvent(
        new ErrorEvent('error', {
          message: 'Uncaught crash for bob@example.com',
          filename: 'https://vedic-astrology.app/assets/app.js?token=secret',
          lineno: 18,
          colno: 4,
          error: new TypeError('Cannot read properties of undefined for bob@example.com'),
        })
      );

      const rejEvent = Object.assign(new Event('unhandledrejection'), {
        reason: new Error('Promise failed with Bearer tok_999'),
      });
      window.dispatchEvent(rejEvent);

      const cspEvent = Object.assign(new Event('securitypolicyviolation'), {
        violatedDirective: 'script-src-elem',
        effectiveDirective: 'script-src',
        blockedURI: 'https://evil.example.com/inject.js?secret=123#frag',
        sourceFile: 'https://vedic-astrology.app/signin?email=bob@example.com',
        lineNumber: 77,
        disposition: 'enforce',
      });
      document.dispatchEvent(cspEvent);
    } finally {
      cleanup();
    }

    const flushed = await flushClientErrors();
    expect(flushed).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/telemetry/client-errors');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer jwt-test-token');
    expect(headers['X-Astra-Page']).toBe('/dashboard/you');
    expect(headers['X-Astra-Session']).toBeTruthy();

    const parsed = JSON.parse(String(init.body)) as {
      events: Array<{
        source: string;
        severity: string;
        category: string;
        errorCode?: string;
        message: string;
        meta?: Record<string, unknown>;
      }>;
    };
    expect(parsed.events).toHaveLength(3);

    expect(parsed.events[0]).toMatchObject({
      source: 'web_js',
      severity: 'error',
      category: 'js_runtime',
      errorCode: 'TypeError',
    });
    expect(parsed.events[0]?.message).not.toContain('bob@example.com');
    expect(parsed.events[0]?.meta?.filename).toBe('https://vedic-astrology.app/assets/app.js');

    expect(parsed.events[1]).toMatchObject({
      source: 'web_js',
      severity: 'error',
      category: 'unhandled_rejection',
    });
    expect(parsed.events[1]?.message).not.toContain('tok_999');

    expect(parsed.events[2]).toMatchObject({
      source: 'web_csp',
      severity: 'error',
      category: 'csp_violation',
      errorCode: 'script-src',
      meta: {
        violatedDirective: 'script-src-elem',
        effectiveDirective: 'script-src',
        blockedURI: 'https://evil.example.com/inject.js',
        sourceFile: 'https://vedic-astrology.app/signin',
        lineNumber: 77,
        disposition: 'enforce',
      },
    });
  });

  it('removes listeners cleanly on cleanup and flushes via sendBeacon on pagehide when same-origin', async () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });

    const cleanup = installGlobalErrorListeners();
    reportClientError({
      source: 'web_js',
      category: 'js_runtime',
      errorCode: 'ERR_1',
      message: 'Before pagehide',
    });

    window.dispatchEvent(new Event('pagehide'));
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect((sendBeacon.mock.calls[0] as unknown[])[0]).toContain('/api/telemetry/client-errors');

    cleanup();
    // Keep a dummy listener while dispatching ErrorEvent so Vitest's catchWindowErrors does not re-emit as uncaughtException.
    const noop = () => {};
    window.addEventListener('error', noop);
    try {
      window.dispatchEvent(
        new ErrorEvent('error', { message: 'Ignored after cleanup', error: new Error('Ignored after cleanup') })
      );
    } finally {
      window.removeEventListener('error', noop);
    }
    expect(await flushClientErrors()).toBe(0);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('deduplicates identical fingerprints for 60 seconds and enforces 20 events/min token bucket', async () => {
    const first = reportClientError({
      source: 'web_js',
      category: 'js_runtime',
      errorCode: 'DUP_ERR',
      message: 'Duplicate boom',
    });
    const dup = reportClientError({
      source: 'web_js',
      category: 'js_runtime',
      errorCode: 'DUP_ERR',
      message: 'Duplicate boom',
    });
    expect(first).toBe(true);
    expect(dup).toBe(false);

    vi.advanceTimersByTime(60_001);
    const afterDedupWindow = reportClientError({
      source: 'web_js',
      category: 'js_runtime',
      errorCode: 'DUP_ERR',
      message: 'Duplicate boom',
    });
    expect(afterDedupWindow).toBe(true);

    // Drain any events and reset bucket cleanly, then test 20/min capacity
    await flushClientErrors();
    resetErrorTelemetryForTests();

    let accepted = 0;
    for (let i = 0; i < 25; i++) {
      if (
        reportClientError({
          source: 'web_js',
          category: 'js_runtime',
          errorCode: `ERR_${i}`,
          message: `Unique error ${i}`,
        })
      ) {
        accepted++;
      }
    }
    expect(accepted).toBe(20);

    // After 60 seconds the bucket refills back to 20
    vi.advanceTimersByTime(60_000);
    expect(
      reportClientError({
        source: 'web_js',
        category: 'js_runtime',
        errorCode: 'ERR_REFILL',
        message: 'Accepted after refill',
      })
    ).toBe(true);
  });

  it('never throws if telemetry flush fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network offline');
      })
    );
    reportClientError({
      source: 'web_js',
      category: 'js_runtime',
      message: 'Local issue',
    });
    await expect(flushClientErrors()).resolves.toBe(0);
  });

  it('reports GraphQL HTTP 500, tracked extension codes with requestId, and network failures without breaking auth', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async (input) => {
      const url = String(input);
      if (url.includes('/api/telemetry/client-errors')) {
        return new Response(JSON.stringify({ ok: true, recorded: 1 }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          errors: [
            {
              message: 'Something went wrong while processing your request.',
              extensions: { code: 'INTERNAL_SERVER_ERROR', requestId: 'req-ext-500' },
            },
          ],
        }),
        { status: 500, headers: { 'X-Request-Id': 'req-hdr-500' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(runGraphQL('query MeProfile { me { id } }')).rejects.toThrow(
      'Something went wrong while processing your request.'
    );

    // Also test HTTP 200 with tracked GraphQL error falling back to X-Request-Id header
    fetchMock.mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          errors: [{ message: 'Query too deep', extensions: { code: 'DEPTH_LIMIT_EXCEEDED' } }],
        }),
        { status: 200, headers: { 'X-Request-Id': 'req-hdr-depth' } }
      );
    });
    const depthRes = await runGraphQL('query DeepQuery { me { id } }');
    expect(depthRes.errors?.[0]?.extensions?.code).toBe('DEPTH_LIMIT_EXCEEDED');

    // Also test fetch throwing a network error
    fetchMock.mockImplementationOnce(async () => {
      throw new Error('Failed to fetch');
    });
    await expect(runGraphQL('query Ping { __typename }')).rejects.toThrow('Failed to fetch');

    // Verify 401 still dispatches auth:session-expired and throws Not authenticated
    const expiredListener = vi.fn();
    window.addEventListener('auth:session-expired', expiredListener);
    fetchMock.mockImplementationOnce(async () => new Response('Unauthorized', { status: 401 }));
    await expect(runGraphQL('query MeAuth { me { id } }')).rejects.toThrow('Not authenticated');
    expect(expiredListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:session-expired', expiredListener);

    const flushed = await flushClientErrors();
    expect(flushed).toBe(3);

    const telemetryCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/telemetry/client-errors'));
    expect(telemetryCall).toBeTruthy();
    const payload = JSON.parse(String(telemetryCall?.[1]?.body)) as {
      events: Array<{
        source: string;
        category: string;
        errorCode?: string;
        statusCode?: number;
        operation?: string;
        requestId?: string;
      }>;
    };
    expect(payload.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'web_network',
          category: 'graphql_client',
          errorCode: 'INTERNAL_SERVER_ERROR',
          statusCode: 500,
          operation: 'MeProfile',
          requestId: 'req-ext-500',
        }),
        expect.objectContaining({
          source: 'web_network',
          category: 'graphql_client',
          errorCode: 'DEPTH_LIMIT_EXCEEDED',
          statusCode: 200,
          operation: 'DeepQuery',
          requestId: 'req-hdr-depth',
        }),
        expect.objectContaining({
          source: 'web_network',
          category: 'graphql_client',
          errorCode: 'GRAPHQL_NETWORK_ERROR',
          operation: 'Ping',
        }),
      ])
    );
  });

  it('ships complete security headers and valid inline script SHA-256 hashes in customHttp.yml', () => {
    const customHttp = readFileSync(resolve(__dirname, '../../customHttp.yml'), 'utf8');
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

    expect(customHttp).toContain("value: 'nosniff'");
    expect(customHttp).toContain("value: 'strict-origin-when-cross-origin'");
    expect(customHttp).toContain("value: 'max-age=31536000; includeSubDomains'");
    expect(customHttp).toContain("value: 'DENY'");
    expect(customHttp).toContain("value: 'camera=(), microphone=(), geolocation=(), payment=()'");
    expect(customHttp).toContain('Content-Security-Policy');
    expect(customHttp).toContain("object-src 'none'");
    expect(customHttp).toContain("base-uri 'self'");
    expect(customHttp).toContain("frame-ancestors 'none'");
    expect(customHttp).toContain('report-uri /api/telemetry/csp-report');
    expect(customHttp).toContain('https://challenges.cloudflare.com');

    const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
    expect(inlineScripts.length).toBeGreaterThan(0);
    for (const match of inlineScripts) {
      const lfBody = match[1]!.replace(/\r\n/g, '\n');
      const hash = `'sha256-${createHash('sha256').update(lfBody).digest('base64')}'`;
      expect(customHttp).toContain(hash);
    }
  });
});
