import { apiUrl } from './apiBase';
import { buildApiHeaders } from './apiHeaders';
import { getCurrentPagePath, getTelemetrySessionId } from './pageTelemetry';

export type ClientErrorSource = 'web_js' | 'web_react' | 'web_network' | 'web_csp';
export type ClientErrorSeverity = 'warn' | 'error' | 'critical';

export interface ClientErrorEvent {
  source: ClientErrorSource;
  severity: ClientErrorSeverity;
  category: string;
  errorCode?: string;
  statusCode?: number;
  page: string;
  operation?: string;
  message: string;
  stack?: string;
  requestId?: string;
  sessionId: string;
  meta?: Record<string, unknown>;
}

export interface ReportClientErrorInput {
  source: ClientErrorSource;
  severity?: ClientErrorSeverity;
  category: string;
  errorCode?: string;
  statusCode?: number;
  page?: string;
  operation?: string;
  message: string;
  stack?: string;
  requestId?: string;
  sessionId?: string;
  meta?: Record<string, unknown>;
}

const TOKEN_BUCKET_CAPACITY = 20;
const TOKEN_BUCKET_WINDOW_MS = 60_000;
const DEDUP_WINDOW_MS = 60_000;
const MAX_BATCH_SIZE = 20;
const MAX_QUEUE_SIZE = 50;
const FLUSH_DELAY_MS = 1_000;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]*)?/g;
const JWT_TRUNCATED_RE = /\beyJ[A-Za-z0-9_-]{14,}/g;
const SECRET_KV_RE =
  /\b(api_?key|key|token|access_token|refresh_token|id_token|secret|password|authorization|x-goog-api-key)\s*([=:])\s*[^\s&;"',)}\]]+/gi;
const URL_QUERY_RE =
  /(https?:\/\/[^\s?#"'`<>]+|\/[^\s?#"'`<>]+|\b[A-Za-z0-9_.-]+\.(?:[jt]sx?|mjs|cjs|html|css|json))\?[^\s)"'\]<>#]*?(?=:\d+:\d+|[\s)"'\]<>#]|$)/gi;
const HASH_TOKEN_RE = /#(?:access_token|id_token|token|code|state)=[^\s)"'\]<>]*/gi;
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?\b/g;
const COORD_RE = /-?\b\d{1,3}\.\d{4,}\b/g;
const SENSITIVE_META_KEY_RE =
  /(?:email|token|secret|password|auth|birth|dob|place|coord|phone|address)|(?:^|_)(?:lat|lon)$|^(?:user|first|last|full|person|display)?_?name$/i;
const SAFE_CSP_KEYWORDS = new Set([
  'inline',
  'eval',
  'wasm-eval',
  'self',
  'none',
  'data',
  'blob',
  'filesystem',
  'about',
  'trusted-types-sink',
  'script',
]);

let pendingQueue: ClientErrorEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let bucketTokens = TOKEN_BUCKET_CAPACITY;
let bucketLastRefillAt = Date.now();
const dedupSeenAt = new Map<string, number>();

function isTelemetryNetworkEnabled(): boolean {
  if (import.meta.env.MODE !== 'test') return true;
  return Boolean((globalThis as { __ASTRA_ENABLE_TEST_TELEMETRY__?: boolean }).__ASTRA_ENABLE_TEST_TELEMETRY__);
}

function normalizePagePath(raw?: string): string {
  const base = (raw || getCurrentPagePath() || '/').split(/[?#]/)[0] || '/';
  const normalized = base.length > 1 ? base.replace(/\/+$/, '') : base;
  return (normalized || '/').slice(0, 120);
}

/**
 * Strips emails, Bearer headers, JWTs, API keys/tokens, URL query strings, ISO dates,
 * and geographic coordinates before any client error text leaves the browser.
 */
export function redactClientErrorText(input: unknown, maxLen = 500): string {
  const raw =
    typeof input === 'string'
      ? input
      : input instanceof Error
        ? input.message || input.name
        : input == null
          ? ''
          : String(input);
  if (!raw) return '';
  const cleaned = raw
    .replace(URL_QUERY_RE, '$1')
    .replace(HASH_TOKEN_RE, '')
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(BEARER_RE, 'Bearer [redacted]')
    .replace(JWT_RE, '[redacted-jwt]')
    .replace(JWT_TRUNCATED_RE, '[redacted-jwt]')
    .replace(SECRET_KV_RE, '$1$2[redacted]')
    .replace(ISO_DATE_RE, '[redacted-date]')
    .replace(COORD_RE, '[redacted-coord]')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, maxLen);
}

function redactStack(stack?: string | null): string | undefined {
  if (!stack || typeof stack !== 'string') return undefined;
  const lines = stack
    .split(/\r?\n/)
    .map((line) => redactClientErrorText(line, 300))
    .filter(Boolean)
    .slice(0, 12);
  if (lines.length === 0) return undefined;
  return lines.join('\n').slice(0, 1500);
}

function sanitizeCspUri(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (SAFE_CSP_KEYWORDS.has(lower)) return lower;
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 0 && !trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
    const scheme = lower.slice(0, colonIdx);
    if (SAFE_CSP_KEYWORDS.has(scheme)) return scheme;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const u = new URL(trimmed);
      return `${u.origin}${u.pathname}`.slice(0, 200);
    } catch {
      /* fall through */
    }
  }
  if (trimmed.startsWith('/')) {
    return trimmed.split(/[?#]/)[0]?.slice(0, 200) || '/';
  }
  return redactClientErrorText(trimmed.split(/[?#]/)[0], 200) || undefined;
}

function sanitizeMetaValue(val: unknown, depth = 0): unknown {
  if (val == null) return undefined;
  if (typeof val === 'string') return redactClientErrorText(val, 200);
  if (typeof val === 'number') return Number.isFinite(val) ? val : undefined;
  if (typeof val === 'boolean') return val;
  if (depth >= 1) return undefined;
  if (Array.isArray(val)) {
    return val.slice(0, 5).map((item) => sanitizeMetaValue(item, depth + 1)).filter((v) => v !== undefined);
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>).slice(0, 10)) {
      if (SENSITIVE_META_KEY_RE.test(k)) continue;
      const clean = sanitizeMetaValue(v, depth + 1);
      if (clean !== undefined) out[k] = clean;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return undefined;
}

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta).slice(0, 12)) {
    if (SENSITIVE_META_KEY_RE.test(k)) continue;
    const clean = sanitizeMetaValue(v, 0);
    if (clean !== undefined) out[k] = clean;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function pruneDedupCache(now: number): void {
  if (dedupSeenAt.size <= 200) return;
  for (const [fp, ts] of dedupSeenAt.entries()) {
    if (now - ts >= DEDUP_WINDOW_MS) {
      dedupSeenAt.delete(fp);
    }
  }
}

function consumeToken(now: number): boolean {
  const elapsed = Math.max(0, now - bucketLastRefillAt);
  bucketTokens = Math.min(
    TOKEN_BUCKET_CAPACITY,
    bucketTokens + (elapsed * TOKEN_BUCKET_CAPACITY) / TOKEN_BUCKET_WINDOW_MS
  );
  bucketLastRefillAt = now;
  if (bucketTokens < 1) return false;
  bucketTokens -= 1;
  return true;
}

function isSameOriginUrl(url: string): boolean {
  if (url.startsWith('/')) return true;
  if (typeof window === 'undefined' || !window.location?.origin) return false;
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

function scheduleFlush(): void {
  if (flushTimer || !isTelemetryNetworkEnabled()) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushClientErrors();
  }, FLUSH_DELAY_MS);
}

/**
 * Records a client-side runtime, React boundary, network, or CSP error after PII redaction,
 * 60-second fingerprinting deduplication, and 20-event/minute token-bucket rate limiting.
 */
export function reportClientError(input: ReportClientErrorInput): boolean {
  try {
    const cleanMessage = redactClientErrorText(input.message || input.errorCode || 'Unknown client error', 500);
    if (!cleanMessage) return false;
    if (cleanMessage.includes('/api/telemetry/client-errors')) return false;

    const category = String(input.category || 'unknown').slice(0, 64);
    const errorCode = input.errorCode ? String(input.errorCode).slice(0, 80) : undefined;
    const now = Date.now();
    const fingerprint = `${input.source}:${category}:${errorCode ?? ''}:${cleanMessage.slice(0, 80)}`;

    const lastSeen = dedupSeenAt.get(fingerprint);
    if (lastSeen !== undefined && now - lastSeen < DEDUP_WINDOW_MS) {
      return false;
    }
    if (!consumeToken(now)) {
      return false;
    }
    dedupSeenAt.set(fingerprint, now);
    pruneDedupCache(now);

    const event: ClientErrorEvent = {
      source: input.source,
      severity: input.severity ?? 'error',
      category,
      ...(errorCode ? { errorCode } : {}),
      ...(typeof input.statusCode === 'number' && Number.isFinite(input.statusCode)
        ? { statusCode: Math.trunc(input.statusCode) }
        : {}),
      page: normalizePagePath(input.page),
      ...(input.operation ? { operation: redactClientErrorText(input.operation, 160) } : {}),
      message: cleanMessage,
      ...(input.stack ? { stack: redactStack(input.stack) } : {}),
      ...(input.requestId ? { requestId: String(input.requestId).trim().slice(0, 64) } : {}),
      sessionId: (input.sessionId || getTelemetrySessionId()).slice(0, 64),
      ...(input.meta ? { meta: sanitizeMeta(input.meta) } : {}),
    };

    if (pendingQueue.length >= MAX_QUEUE_SIZE) {
      pendingQueue.shift();
    }
    pendingQueue.push(event);

    if (!isTelemetryNetworkEnabled()) return true;

    if (event.severity === 'critical' || pendingQueue.length >= MAX_BATCH_SIZE) {
      void flushClientErrors();
    } else {
      scheduleFlush();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Flushes queued client error events to `/api/telemetry/client-errors`. Never throws.
 */
export async function flushClientErrors(options?: { preferBeacon?: boolean }): Promise<number> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!isTelemetryNetworkEnabled()) {
    pendingQueue = [];
    return 0;
  }
  if (pendingQueue.length === 0) return 0;

  const batch = pendingQueue.splice(0, MAX_BATCH_SIZE);
  const body = JSON.stringify({ events: batch });
  const url = apiUrl('/api/telemetry/client-errors');

  try {
    if (
      options?.preferBeacon &&
      isSameOriginUrl(url) &&
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function'
    ) {
      const sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      if (sent) {
        if (pendingQueue.length > 0) scheduleFlush();
        return batch.length;
      }
    }

    const token = typeof window !== 'undefined' ? window.localStorage?.getItem('token') : null;
    const headers = await buildApiHeaders({
      token,
      body,
      method: 'POST',
      extra: {
        'X-Astra-Session': getTelemetrySessionId(),
        'X-Astra-Page': getCurrentPagePath(),
      },
    });
    await fetch(url, {
      method: 'POST',
      headers,
      body,
      keepalive: true,
    });
    if (pendingQueue.length > 0) scheduleFlush();
    return batch.length;
  } catch {
    return 0;
  }
}

function describeRejectionReason(reason: unknown): {
  errorCode: string;
  message: string;
  stack?: string;
} {
  if (reason instanceof Error) {
    return {
      errorCode: reason.name || 'UNHANDLED_REJECTION',
      message: reason.message || reason.name || 'Unhandled promise rejection',
      stack: reason.stack,
    };
  }
  if (typeof reason === 'string') {
    return {
      errorCode: 'UNHANDLED_REJECTION',
      message: reason || 'Unhandled promise rejection',
    };
  }
  if (reason && typeof reason === 'object') {
    const r = reason as { name?: unknown; code?: unknown; message?: unknown };
    const code =
      typeof r.code === 'string' && r.code.trim()
        ? r.code.trim()
        : typeof r.name === 'string' && r.name.trim()
          ? r.name.trim()
          : 'UNHANDLED_REJECTION';
    const msg =
      typeof r.message === 'string' && r.message.trim()
        ? r.message.trim()
        : 'Unhandled promise rejection';
    return { errorCode: code, message: msg };
  }
  return {
    errorCode: 'UNHANDLED_REJECTION',
    message: 'Unhandled promise rejection',
  };
}

/**
 * Installs global `window` (`error`, `unhandledrejection`, `pagehide`) and `document`
 * (`securitypolicyviolation`, `visibilitychange`) listeners. Returns a cleanup function.
 */
export function installGlobalErrorListeners(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const onWindowError = (event: ErrorEvent) => {
    const err = event.error;
    const message =
      (err instanceof Error && err.message) || event.message || 'Uncaught runtime error';
    const filename = sanitizeCspUri(event.filename);
    reportClientError({
      source: 'web_js',
      severity: 'error',
      category: 'js_runtime',
      errorCode: err instanceof Error && err.name ? err.name : 'JS_RUNTIME_ERROR',
      message,
      stack: err instanceof Error ? err.stack : undefined,
      meta: {
        ...(filename ? { filename } : {}),
        ...(typeof event.lineno === 'number' && event.lineno > 0 ? { lineno: event.lineno } : {}),
        ...(typeof event.colno === 'number' && event.colno > 0 ? { colno: event.colno } : {}),
      },
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const { errorCode, message, stack } = describeRejectionReason(event.reason);
    reportClientError({
      source: 'web_js',
      severity: 'error',
      category: 'unhandled_rejection',
      errorCode,
      message,
      stack,
    });
  };

  const onSecurityPolicyViolation = (event: SecurityPolicyViolationEvent) => {
    const violatedDirective = event.violatedDirective || undefined;
    const effectiveDirective = event.effectiveDirective || undefined;
    const blockedURI = sanitizeCspUri(event.blockedURI);
    const sourceFile = sanitizeCspUri(event.sourceFile);
    const directive = effectiveDirective || violatedDirective || 'CSP_VIOLATION';
    const disposition = event.disposition === 'report' ? 'report' : 'enforce';

    reportClientError({
      source: 'web_csp',
      severity: disposition === 'report' ? 'warn' : 'error',
      category: 'csp_violation',
      errorCode: directive,
      message: `CSP blocked ${directive}${blockedURI ? ` (${blockedURI})` : ''}`,
      meta: {
        ...(violatedDirective ? { violatedDirective } : {}),
        ...(effectiveDirective ? { effectiveDirective } : {}),
        ...(blockedURI ? { blockedURI } : {}),
        ...(sourceFile ? { sourceFile } : {}),
        ...(typeof event.lineNumber === 'number' && event.lineNumber > 0
          ? { lineNumber: event.lineNumber }
          : {}),
        disposition,
      },
    });
  };

  const onPageHide = () => {
    if (pendingQueue.length > 0) {
      void flushClientErrors({ preferBeacon: true });
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && pendingQueue.length > 0) {
      void flushClientErrors({ preferBeacon: true });
    }
  };

  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  document.addEventListener('securitypolicyviolation', onSecurityPolicyViolation);
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    window.removeEventListener('error', onWindowError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    document.removeEventListener('securitypolicyviolation', onSecurityPolicyViolation);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

/** Tests only: resets queue, timers, token bucket, and 60s dedup map. */
export function resetErrorTelemetryForTests(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  pendingQueue = [];
  bucketTokens = TOKEN_BUCKET_CAPACITY;
  bucketLastRefillAt = Date.now();
  dedupSeenAt.clear();
}
