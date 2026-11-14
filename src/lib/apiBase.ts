/**
 * Shared API base-URL resolution matching GraphQL and REST clients
 * (`VITE_API_BASE`, then `VITE_GRAPHQL_BASE`, then `VITE_GRAPHQL_ENDPOINT` origin, else same-origin).
 */
export function getApiBase(): string {
  const apiBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_GRAPHQL_BASE;
  if (apiBase) return String(apiBase).replace(/\/+$/, '');
  const endpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT || '/graphql';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    try {
      return new URL(endpoint).origin;
    } catch {
      return '';
    }
  }
  return '';
}

/** Resolves a server API path against the configured API base URL (or same-origin when unset). */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBase();
  return base ? `${base}${normalized}` : normalized;
}
