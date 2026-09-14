/**
 * Shared API request headers for CloudFront OAC + App Runner compatibility.
 * - JWT on both Authorization and X-Astra-Authorization (same Bearer token).
 * - x-amz-content-sha256 = hex SHA-256 of exact body for POST/PUT/PATCH with a body.
 * Do not change VITE_GRAPHQL_ENDPOINT / Amplify env values.
 */

export async function sha256Hex(body: string | ArrayBuffer | Uint8Array): Promise<string> {
  const data =
    typeof body === 'string'
      ? new TextEncoder().encode(body)
      : body instanceof Uint8Array
        ? body
        : new Uint8Array(body);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type BuildApiHeadersOptions = {
  token?: string | null;
  /** Exact body string/bytes that will be sent. Required for POST/PUT/PATCH with a body. */
  body?: string | ArrayBuffer | Uint8Array | null;
  method?: string;
  extra?: Record<string, string>;
};

export async function buildApiHeaders(
  options: BuildApiHeadersOptions = {}
): Promise<Record<string, string>> {
  const method = (options.method ?? 'POST').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.extra ?? {}),
  };
  const token = options.token;
  if (token) {
    const bearer = `Bearer ${token}`;
    headers['Authorization'] = bearer;
    headers['X-Astra-Authorization'] = bearer;
  }
  const needsHash =
    options.body != null &&
    options.body !== '' &&
    (method === 'POST' || method === 'PUT' || method === 'PATCH');
  if (needsHash) {
    headers['x-amz-content-sha256'] = await sha256Hex(options.body as string | ArrayBuffer | Uint8Array);
  }
  return headers;
}
