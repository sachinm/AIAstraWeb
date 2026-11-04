/**
 * Starts fetching Cloudflare's check script as soon as someone heads for sign-up or sign-in (points at, focuses or touches
 * a link or button that goes there), so the check on that page starts sooner. A prefetch only fills the browser cache; the
 * script runs when the page's widget asks for it. Visitors who never head there make no Cloudflare request.
 */

/** The exact address @marsidev/react-turnstile loads, so the cached copy is the one it uses. */
export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit';

/** Links to the auth pages, and buttons that navigate there in code. */
export const AUTH_INTENT_SELECTOR = 'a[href$="/signup"], a[href$="/signin"], [data-auth-intent]';

let fetched = false;

export function prewarmTurnstile(doc: Document = document): void {
  if (fetched) return;
  fetched = true;
  const link = doc.createElement('link');
  link.rel = 'prefetch';
  link.as = 'script';
  link.href = TURNSTILE_SCRIPT_URL;
  doc.head.appendChild(link);
}

/** Listens once, for the whole app; removes itself after the first prefetch. Returns a remover for tests. */
export function installAuthPrewarm(doc: Document = document): () => void {
  const onIntent = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest(AUTH_INTENT_SELECTOR)) return;
    prewarmTurnstile(doc);
    remove();
  };
  const events = ['pointerover', 'focusin', 'touchstart'] as const;
  const remove = () => events.forEach((type) => doc.removeEventListener(type, onIntent, true));
  events.forEach((type) => doc.addEventListener(type, onIntent, { capture: true, passive: true }));
  return remove;
}

/** For tests only. */
export function resetPrewarmForTests(): void {
  fetched = false;
}
