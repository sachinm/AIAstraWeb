import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { buildApiHeaders } from './apiHeaders';

export interface ClientPageTimingEntry {
  pagePath: string;
  routePattern?: string;
  source?: 'client_render' | 'section_stream';
  operation?: string;
  sectionKey?: string;
  statusCode?: number;
  durationMs: number;
  ttfbMs?: number;
  serverMs?: number;
  renderMs?: number;
  drawMs?: number;
  bodyBytes?: number;
  sessionId?: string;
  cacheHit?: boolean;
  errorCode?: string;
}

export type DashboardSectionKey = 'profile' | 'chart_status' | 'biodata' | 'content' | 'timeline';

export interface DashboardSectionChunk<T = unknown> {
  section: DashboardSectionKey;
  ok: boolean;
  durationMs: number;
  data: T;
}

const SESSION_STORAGE_KEY = 'astra_telemetry_session';

let memorySessionId: string | null = null;

export function getTelemetrySessionId(): string {
  if (memorySessionId) return memorySessionId;
  if (typeof window !== 'undefined') {
    try {
      const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) {
        memorySessionId = existing;
        return existing;
      }
      const created =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
      memorySessionId = created;
      return created;
    } catch {
      /* sessionStorage unavailable */
    }
  }
  memorySessionId = `sess-${Date.now().toString(36)}`;
  return memorySessionId;
}

export function getCurrentPagePath(): string {
  if (typeof window === 'undefined' || !window.location?.pathname) return '/';
  return window.location.pathname || '/';
}

function getApiBase(): string {
  const base = import.meta.env.VITE_API_BASE || import.meta.env.VITE_GRAPHQL_BASE || '';
  return base ? String(base).replace(/\/+$/, '') : '';
}

const pendingQueue: ClientPageTimingEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export async function flushPageTimings(): Promise<number> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingQueue.length === 0) return 0;

  const batch = pendingQueue.splice(0, 25);
  const body = JSON.stringify({ entries: batch });
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('token') : null;
  const sessionId = getTelemetrySessionId();

  try {
    const headers = await buildApiHeaders({
      token,
      body,
      method: 'POST',
      extra: {
        'X-Astra-Session': sessionId,
        'X-Astra-Page': getCurrentPagePath(),
      },
    });
    const url = `${getApiBase()}/api/telemetry/page-timings`;
    await fetch(url, {
      method: 'POST',
      headers,
      body,
      keepalive: true,
    });
    return batch.length;
  } catch {
    return 0;
  }
}

export function recordClientPageTiming(entry: ClientPageTimingEntry): void {
  if (import.meta.env.MODE === 'test' && !(globalThis as { __ASTRA_ENABLE_TEST_TELEMETRY__?: boolean }).__ASTRA_ENABLE_TEST_TELEMETRY__) {
    return;
  }
  pendingQueue.push({
    ...entry,
    sessionId: entry.sessionId ?? getTelemetrySessionId(),
  });
  if (pendingQueue.length >= 10) {
    void flushPageTimings();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      void flushPageTimings();
    }, 1200);
  }
}

/**
 * Measures client route transition, React commit (`renderMs`), and next-frame paint (`drawMs`)
 * for every route visit in the web app.
 */
export const PageTimingTracker: React.FC = () => {
  const location = useLocation();
  const navStartRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);

  useEffect(() => {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    navStartRef.current = start;
    const pagePath = location.pathname || '/';
    let raf1 = 0;
    let raf2 = 0;
    let cancelled = false;

    const scheduleFrame =
      typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16);

    raf1 = scheduleFrame(() => {
      if (cancelled) return;
      const afterRender = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const renderMs = Math.max(1, Math.round(afterRender - start));

      raf2 = scheduleFrame(() => {
        if (cancelled) return;
        const afterDraw = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const totalMs = Math.max(renderMs, Math.round(afterDraw - start));
        const drawMs = Math.max(0, totalMs - renderMs);

        recordClientPageTiming({
          pagePath,
          routePattern: pagePath,
          source: 'client_render',
          operation: 'routeTransition',
          durationMs: totalMs,
          renderMs,
          drawMs,
        });
      });
    });

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        if (raf1) window.cancelAnimationFrame(raf1);
        if (raf2) window.cancelAnimationFrame(raf2);
      }
    };
  }, [location.pathname]);

  return null;
};

/**
 * Streams dashboard sections (`profile`, `chart_status`, `biodata`, `content`, `timeline`)
 * progressively as NDJSON lines (`GET /api/dashboard/sections-stream`) and invokes `onSection`
 * as each section finishes so UI cards draw without waiting on slower sections.
 */
export async function streamDashboardSections(
  sections: readonly DashboardSectionKey[],
  onSection: (chunk: DashboardSectionChunk) => void,
  signal?: AbortSignal
): Promise<void> {
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('token') : null;
  const headers = await buildApiHeaders({
    token,
    method: 'GET',
    extra: {
      'X-Astra-Page': getCurrentPagePath(),
      'X-Astra-Session': getTelemetrySessionId(),
    },
  });
  const query = sections.length > 0 ? `?sections=${encodeURIComponent(sections.join(','))}` : '';
  const pagePath = getCurrentPagePath();
  const streamStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const handleChunk = (chunk: DashboardSectionChunk) => {
    const renderStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
    onSection(chunk);
    const afterRender = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const renderMs = Math.max(1, Math.round(afterRender - renderStart));
    const totalMs = Math.max(renderMs, Math.round(afterRender - streamStart));
    recordClientPageTiming({
      pagePath,
      routePattern: pagePath,
      source: 'section_stream',
      operation: `clientSection:${chunk.section}`,
      sectionKey: chunk.section,
      statusCode: chunk.ok ? 200 : 500,
      durationMs: totalMs,
      ttfbMs: typeof chunk.durationMs === 'number' ? chunk.durationMs : undefined,
      renderMs,
      drawMs: Math.max(1, renderMs),
      ...(chunk.ok ? {} : { errorCode: 'SECTION_ERROR' }),
    });
  };

  const url = `${getApiBase()}/api/dashboard/sections-stream${query}`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
    ...(signal ? { signal } : {}),
  });

  if (!res.ok) {
    throw new Error(`Dashboard section stream failed (${res.status})`);
  }

  if (!res.body) {
    const text = await res.text();
    for (const rawLine of text.split('\n')) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      handleChunk(JSON.parse(trimmed) as DashboardSectionChunk);
    }
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIdx = buffer.indexOf('\n');
    while (newlineIdx >= 0) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (line) {
        handleChunk(JSON.parse(line) as DashboardSectionChunk);
      }
      newlineIdx = buffer.indexOf('\n');
    }
  }

  const tail = buffer.trim();
  if (tail) {
    handleChunk(JSON.parse(tail) as DashboardSectionChunk);
  }
}
