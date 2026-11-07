import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApiHeaders } from './apiHeaders';
import {
  flushPageTimings,
  PageTimingTracker,
  recordClientPageTiming,
  streamDashboardSections,
  type DashboardSectionChunk,
} from './pageTelemetry';

describe('pageTelemetry & apiHeaders', () => {
  beforeEach(() => {
    (globalThis as { __ASTRA_ENABLE_TEST_TELEMETRY__?: boolean }).__ASTRA_ENABLE_TEST_TELEMETRY__ = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true, recorded: 1 }), { status: 200 }))
    );
  });

  afterEach(async () => {
    await flushPageTimings();
    delete (globalThis as { __ASTRA_ENABLE_TEST_TELEMETRY__?: boolean }).__ASTRA_ENABLE_TEST_TELEMETRY__;
    vi.unstubAllGlobals();
  });

  it('attaches X-Astra-Page header in buildApiHeaders', async () => {
    window.history.pushState({}, '', '/dashboard/charts');
    const headers = await buildApiHeaders({ token: 'jwt-123', body: '{"query":"{ me { id } }"}', method: 'POST' });
    expect(headers['X-Astra-Page']).toBe('/dashboard/charts');
    expect(headers['Authorization']).toBe('Bearer jwt-123');
    expect(headers['x-amz-content-sha256']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('queues and flushes client page timing entries to /api/telemetry/page-timings', async () => {
    recordClientPageTiming({
      pagePath: '/dashboard/mantras',
      source: 'client_render',
      operation: 'routeTransition',
      durationMs: 210,
      renderMs: 80,
      drawMs: 130,
    });
    const count = await flushPageTimings();
    expect(count).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/telemetry/page-timings');
    const parsed = JSON.parse(String(init.body)) as { entries: Array<{ pagePath: string; durationMs: number }> };
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.pagePath).toBe('/dashboard/mantras');
    expect(parsed.entries[0]?.durationMs).toBe(210);
  });

  it('PageTimingTracker measures route render and draw frames', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now() + 12);
      return 1;
    });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/dashboard/remedies']}>
          <PageTimingTracker />
        </MemoryRouter>
      );
    });

    const flushed = await flushPageTimings();
    expect(flushed).toBe(1);
  });

  it('streamDashboardSections parses progressive NDJSON lines in order', async () => {
    const ndjson =
      [
        JSON.stringify({ section: 'profile', ok: true, durationMs: 18, data: { id: 'u1' } }),
        JSON.stringify({ section: 'biodata', ok: true, durationMs: 42, data: { asc: 'Leo' } }),
        JSON.stringify({ section: 'content', ok: true, durationMs: 95, data: { mantras: [] } }),
      ].join('\n') + '\n';

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(ndjson.slice(0, 45)));
        controller.enqueue(encoder.encode(ndjson.slice(45)));
        controller.close();
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(stream, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } }))
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, recorded: 3 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const received: DashboardSectionChunk[] = [];
    await streamDashboardSections(['profile', 'biodata', 'content'], (chunk) => {
      received.push(chunk);
    });

    expect(received.map((c) => c.section)).toEqual(['profile', 'biodata', 'content']);
    expect(received[1]?.data).toEqual({ asc: 'Leo' });

    const flushed = await flushPageTimings();
    expect(flushed).toBe(3);
  });

  it('streamDashboardSections handles partial section failure and records SECTION_ERROR telemetry', async () => {
    const ndjson =
      [
        JSON.stringify({ section: 'profile', ok: true, durationMs: 12, data: { id: 'u1' } }),
        JSON.stringify({ section: 'biodata', ok: false, durationMs: 500, data: { error: 'Section temporarily unavailable' } }),
      ].join('\n') + '\n';

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(ndjson, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } }))
    );

    const received: DashboardSectionChunk[] = [];
    await streamDashboardSections(['profile', 'biodata'], (chunk) => {
      received.push(chunk);
    });

    expect(received).toHaveLength(2);
    expect(received[0]?.ok).toBe(true);
    expect(received[1]?.ok).toBe(false);

    const flushed = await flushPageTimings();
    expect(flushed).toBe(2);
    const [, beaconInit] = (fetch as ReturnType<typeof vi.fn>).mock.calls[1] as [string, RequestInit];
    const parsed = JSON.parse(String(beaconInit.body)) as {
      entries: Array<{ sectionKey?: string; statusCode?: number; errorCode?: string; source?: string }>;
    };
    expect(parsed.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sectionKey: 'profile', statusCode: 200, source: 'section_stream' }),
        expect.objectContaining({
          sectionKey: 'biodata',
          statusCode: 500,
          errorCode: 'SECTION_ERROR',
          source: 'section_stream',
        }),
      ])
    );
  });
});
