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

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/** Default for normal queries (me, login). LLM `ask` needs a much higher limit — see sendChatMessage. */
const DEFAULT_GRAPHQL_TIMEOUT_MS = 45_000;

export interface RunGraphQLOptions {
  /** Abort fetch after this many ms (browser-side). Omit for default 45s. */
  timeoutMs?: number;
}

export async function runGraphQL<T = unknown>(
  operation: string,
  variables?: Record<string, unknown>,
  options?: RunGraphQLOptions
): Promise<GraphQLResponse<T>> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_GRAPHQL_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const endpoint = getGraphQLEndpoint();
  let res: Response;
  try {
    console.log('[GraphQL] request', {
      endpoint,
      hasToken: Boolean(token),
      variablesKeys: variables ? Object.keys(variables) : [],
    });
    res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: operation, variables }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const rawText = await res.text();
  console.log('[GraphQL] response meta', {
    ok: res.ok,
    status: res.status,
    contentLength: rawText.length,
  });

  if (!res.ok) {
    // Try to surface GraphQL-style error message if present
    try {
      const parsed = rawText ? (JSON.parse(rawText) as GraphQLResponse<T>) : undefined;
      const message = parsed?.errors?.[0]?.message;
      throw new Error(message || `Request failed with status ${res.status}`);
    } catch {
      throw new Error(`Request failed with status ${res.status}`);
    }
  }

  if (!rawText) {
    console.error('[GraphQL] empty response body');
    throw new Error('Empty response from server while processing your request.');
  }

  try {
    return JSON.parse(rawText) as GraphQLResponse<T>;
  } catch {
    console.error('[GraphQL] JSON parse failed, rawText snippet:', rawText.slice(0, 200));
    throw new Error('Failed to parse server response as JSON.');
  }
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
