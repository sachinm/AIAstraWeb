import type { StoredUser, User } from '../App';

/**
 * `astroUser` in localStorage holds the display name and nothing else (server docs/privacy/02 §4.3, B0.3). Birth
 * details and the email are never written here; older builds wrote birth fields and the reader drops them.
 */
export const ASTRO_USER_KEY = 'astroUser';

/** A user object from any source (sign-in result, legacy storage) reduced to what the app keeps in memory. */
export function toUser(value: unknown): User | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as { name?: unknown; email?: unknown };
  if (typeof v.name !== 'string') return null;
  return typeof v.email === 'string' && v.email ? { name: v.name, email: v.email } : { name: v.name };
}

export function writeStoredUser(user: StoredUser): void {
  try {
    localStorage.setItem(ASTRO_USER_KEY, JSON.stringify({ name: user.name }));
  } catch {
    /* storage unavailable: the name lasts for this page only */
  }
}

/**
 * The stored name, or null. A value with extra fields (birth details, email from an older build) is rewritten as
 * `{ name }`; a value that is not a user object at all is removed.
 */
export function readStoredUser(): StoredUser | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(ASTRO_USER_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* not JSON: removed below */
  }
  const user = toUser(parsed);
  if (!user) {
    try {
      localStorage.removeItem(ASTRO_USER_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
  const stored: StoredUser = { name: user.name };
  if (raw !== JSON.stringify(stored)) writeStoredUser(stored);
  return stored;
}
