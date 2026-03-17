/**
 * GraphQL client – single endpoint, no Supabase or internal API details exposed.
 */

function getGraphQLEndpoint(): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const mode = import.meta.env.MODE; // 'development' | 'production' | 'test'

  const hostWithPort = mode === 'local' ? `${host}:3000` : host;
  return `http://${hostWithPort}/graphql`;
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
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const endpoint = getGraphQLEndpoint();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: operation, variables }),
  });

  if (!res.ok) {
    throw new Error('Request failed');
  }

  return res.json();
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
