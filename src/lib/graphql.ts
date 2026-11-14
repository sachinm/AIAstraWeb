import { buildApiHeaders } from './apiHeaders';
import { reportClientError } from './errorTelemetry';
import { getTelemetrySessionId } from './pageTelemetry';

/**
 * GraphQL client – single endpoint, no Supabase or internal API details exposed.
 */

function getGraphQLEndpoint(): string {
  const apiBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_GRAPHQL_BASE;
  const graphqlEndpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT || '/graphql';

  if (apiBase) {
    const normalizedBase = apiBase.replace(/\/+$/, '');
    const normalizedEndpoint = graphqlEndpoint.startsWith('/') ? graphqlEndpoint : `/${graphqlEndpoint}`;
    return `${normalizedBase}${normalizedEndpoint}`;
  }

  return graphqlEndpoint;
}

const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export interface GraphQLErrorExtensions {
  code?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface GraphQLErrorItem {
  message: string;
  extensions?: GraphQLErrorExtensions;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLErrorItem[];
}

const TRACKED_GRAPHQL_ERROR_CODES = new Set([
  'INTERNAL_SERVER_ERROR',
  'FORBIDDEN',
  'AUTH_UNAVAILABLE',
  'DEPTH_LIMIT_EXCEEDED',
  'ALIAS_LIMIT_EXCEEDED',
  'SELECTION_LIMIT_EXCEEDED',
  'INTROSPECTION_DISABLED',
]);

function extractGraphQLOperationName(operation: string): string {
  const named = /\b(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(operation);
  if (named?.[1]) return named[1].slice(0, 80);
  const field = /\{\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(operation);
  return field?.[1]?.slice(0, 80) ?? 'graphql_operation';
}

function readRequestIdHeader(headers?: Headers | null): string | undefined {
  if (!headers || typeof headers.get !== 'function') return undefined;
  const val = headers.get('x-request-id') || headers.get('X-Request-Id');
  return typeof val === 'string' && val.trim() ? val.trim().slice(0, 64) : undefined;
}

function resolveErrorRequestId(err: GraphQLErrorItem | undefined, headerRequestId?: string): string | undefined {
  const extReqId = err?.extensions?.requestId;
  if (typeof extReqId === 'string' && extReqId.trim()) return extReqId.trim().slice(0, 64);
  return headerRequestId;
}

/** Default for normal queries (me, login). Chat `ask` passes a longer timeout via `sendChatMessage`. */
const DEFAULT_GRAPHQL_TIMEOUT_MS = 45_000;

export interface RunGraphQLOptions {
  /**
   * Browser-side fetch timeout (ms).
   * - Omit: 45s (default).
   * - `0`: no client timeout (no AbortSignal); still subject to browser / CDN / host limits.
   */
  timeoutMs?: number;
  /** Pass `keepalive` to fetch so the request can finish after page navigation (small bodies only). */
  keepalive?: boolean;
}

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /aborted|AbortError|signal is aborted/i.test(msg);
}

export async function runGraphQL<T = unknown>(
  operation: string,
  variables?: Record<string, unknown>,
  options?: RunGraphQLOptions
): Promise<GraphQLResponse<T>> {
  const explicit = options?.timeoutMs;
  const timeoutMs =
    explicit === undefined
      ? DEFAULT_GRAPHQL_TIMEOUT_MS
      : explicit === 0
        ? 0
        : explicit;

  const useClientTimeout = timeoutMs > 0 && Number.isFinite(timeoutMs);
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (useClientTimeout) {
    timeoutId = setTimeout(() => {
      try {
        controller.abort(
          new DOMException(`GraphQL request timed out after ${timeoutMs}ms`, 'TimeoutError')
        );
      } catch {
        controller.abort();
      }
    }, timeoutMs);
  }

  const token = getToken();
  const operationName = extractGraphQLOperationName(operation);
  const body = JSON.stringify({ query: operation, variables });
  const headers = await buildApiHeaders({
    token,
    body,
    method: 'POST',
    extra: { 'X-Astra-Session': getTelemetrySessionId() },
  });

  const endpoint = getGraphQLEndpoint();
  let res: Response;
  try {
    console.log('[GraphQL] request', {
      endpoint,
      hasToken: Boolean(token),
      variablesKeys: variables ? Object.keys(variables) : [],
      clientTimeoutMs: useClientTimeout ? timeoutMs : null,
    });
    res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
      ...(useClientTimeout ? { signal: controller.signal } : {}),
      ...(options?.keepalive ? { keepalive: true } : {}),
    });
  } catch (e) {
    const abort = isAbortError(e);
    reportClientError({
      source: 'web_network',
      severity: 'error',
      category: 'graphql_client',
      errorCode: abort ? 'GRAPHQL_TIMEOUT' : 'GRAPHQL_NETWORK_ERROR',
      operation: operationName,
      message: e instanceof Error ? e.message : String(e),
    });
    if (abort) {
      const detail =
        e instanceof DOMException && e.message
          ? e.message
          : 'The request was aborted before the server finished.';
      throw new Error(
        `${detail} For long chat answers, raise VITE_GRAPHQL_ASK_TIMEOUT_MS (ms) or set it to 0 to disable this browser timeout.`
      );
    }
    throw e;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  const headerRequestId = readRequestIdHeader(res.headers);
  const rawText = await res.text();
  console.log('[GraphQL] response meta', {
    ok: res.ok,
    status: res.status,
    contentLength: rawText.length,
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      throw new Error('Not authenticated');
    }
    // Try to surface GraphQL-style error message if present
    let parsed: GraphQLResponse<T> | undefined;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText) as GraphQLResponse<T>;
      } catch {
        parsed = undefined;
      }
    }
    const firstErr = parsed?.errors?.[0];
    const message = firstErr?.message;
    const extCode = typeof firstErr?.extensions?.code === 'string' ? firstErr.extensions.code : undefined;
    const requestId = resolveErrorRequestId(firstErr, headerRequestId);
    if (res.status >= 500 || (extCode !== undefined && TRACKED_GRAPHQL_ERROR_CODES.has(extCode))) {
      reportClientError({
        source: 'web_network',
        severity: res.status >= 500 || extCode === 'INTERNAL_SERVER_ERROR' || extCode === 'AUTH_UNAVAILABLE' ? 'error' : 'warn',
        category: 'graphql_client',
        errorCode: extCode || `HTTP_${res.status}`,
        statusCode: res.status,
        operation: operationName,
        requestId,
        message: message || `Request failed with status ${res.status}`,
      });
    }
    throw new Error(message || `Request failed with status ${res.status}`);
  }

  if (!rawText) {
    console.error('[GraphQL] empty response body');
    reportClientError({
      source: 'web_network',
      severity: 'error',
      category: 'graphql_client',
      errorCode: 'GRAPHQL_EMPTY_RESPONSE',
      statusCode: res.status,
      operation: operationName,
      requestId: headerRequestId,
      message: 'Empty response from server while processing your request.',
    });
    throw new Error('Empty response from server while processing your request.');
  }

  let parsed: GraphQLResponse<T>;
  try {
    parsed = JSON.parse(rawText) as GraphQLResponse<T>;
  } catch {
    console.error('[GraphQL] JSON parse failed, rawText snippet:', rawText.slice(0, 200));
    reportClientError({
      source: 'web_network',
      severity: 'error',
      category: 'graphql_client',
      errorCode: 'GRAPHQL_INVALID_JSON',
      statusCode: res.status,
      operation: operationName,
      requestId: headerRequestId,
      message: 'Failed to parse server response as JSON.',
    });
    throw new Error('Failed to parse server response as JSON.');
  }

  if (Array.isArray(parsed.errors)) {
    for (const err of parsed.errors) {
      const code = typeof err?.extensions?.code === 'string' ? err.extensions.code : undefined;
      if (code && TRACKED_GRAPHQL_ERROR_CODES.has(code)) {
        reportClientError({
          source: 'web_network',
          severity: code === 'INTERNAL_SERVER_ERROR' || code === 'AUTH_UNAVAILABLE' ? 'error' : 'warn',
          category: 'graphql_client',
          errorCode: code,
          statusCode: res.status,
          operation: operationName,
          requestId: resolveErrorRequestId(err, headerRequestId),
          message: err.message || code,
        });
      }
    }
  }

  return parsed;
}

export async function checkGraphQLStartupHealth(): Promise<void> {
  if (import.meta.env.MODE === 'test') return;

  const endpoint = getGraphQLEndpoint();
  console.info('[GraphQL] startup health check started', { endpoint });

  try {
    const result = await runGraphQL<{ __typename?: string }>(
      `
      query StartupHealthCheck {
        __typename
      }
      `
    );

    const firstError = result.errors?.[0]?.message;
    if (firstError) {
      throw new Error(firstError);
    }

    console.info('[GraphQL] startup health check passed', {
      endpoint,
      typename: result.data?.__typename ?? 'unknown',
    });
  } catch (err) {
    console.error('[GraphQL] startup health check failed', {
      endpoint,
      error: (err as Error)?.message || String(err),
      apiBase: import.meta.env.VITE_API_BASE,
      graphqlEndpointEnv: import.meta.env.VITE_GRAPHQL_ENDPOINT,
    });
  }
}

export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userId');
}

export function setAuth(token: string, userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
  localStorage.setItem('userId', userId);
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
}
