/**
 * GraphQL client – single endpoint, no Supabase or internal API details exposed.
 */

function getGraphQLEndpoint(): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const mode = import.meta.env.MODE; // 'development' | 'production' | 'test'

  const isLocal = mode === 'local' || mode === 'development';
  const hostWithPort = isLocal ? `${host}:3000` : host;
  const protocol = isLocal ? 'http' : 'https';

  return `${protocol}://${hostWithPort}/graphql`;
}

const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function runGraphQL<T = unknown>(
  operation: string,
  variables?: Record<string, unknown>
): Promise<GraphQLResponse<T>> {
  // 45s timeout to tolerate cold starts / Render restarts on auth flows
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const endpoint = getGraphQLEndpoint();
  let res: Response;
  try {
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
    throw new Error('Empty response from server while processing your request.');
  }

  try {
    return JSON.parse(rawText) as GraphQLResponse<T>;
  } catch {
    throw new Error('Failed to parse server response as JSON.');
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
