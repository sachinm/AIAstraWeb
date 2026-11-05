import { useEffect, useState } from 'react';
import TurnstileField from './TurnstileField';
import type { useTurnstile } from './useTurnstile';

type TurnstileState = ReturnType<typeof useTurnstile>;

interface TurnstileGateProps {
  turnstile: TurnstileState;
  action: string;
}

/** A submit that has waited this long for the check says so. */
const SHOW_AFTER_MS = 1_500;
/** After this long without a token it says so and offers a retry. */
const SLOW_AFTER_MS = 15_000;

/**
 * The security check, run while the person types, so it never blocks the form. Cloudflare draws its box only when it wants
 * a click, so it takes no room otherwise. It sits in the page's normal flow on purpose: hidden in a fixed 1px box
 * (2026-11-04) the check stalled and sign-in hung on "Finishing the security check". A submit that comes before the token
 * (fast autofill) waits for it and carries on.
 */
const TurnstileGate: React.FC<TurnstileGateProps> = ({ turnstile, action }) => {
  const { awaiting } = turnstile;
  const [showWait, setShowWait] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!awaiting) {
      setShowWait(false);
      setSlow(false);
      return undefined;
    }
    const show = window.setTimeout(() => setShowWait(true), SHOW_AFTER_MS);
    const late = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(late);
    };
  }, [awaiting]);

  if (!turnstile.isEnabled) return null;

  const failed = awaiting && Boolean(turnstile.error);
  // Cloudflare wants a click: the whole page waits on it. The wrappers are always there and only their classes change,
  // so the widget is never remounted (that would restart the check).
  const open = turnstile.needsInteraction;

  return (
    <div
      data-test-id="turnstile-gate"
      className={open ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm' : ''}
    >
      <div className={open ? 'w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-center shadow-xl' : ''}>
      {open && (
        <p role="status" data-test-id="turnstile-click" className="mb-3 font-semibold text-white">
          Please confirm you are a person.
        </p>
      )}
      {!open && awaiting && (showWait || failed) && (
        <div role="status" aria-live="polite" data-test-id="turnstile-waiting" className="mt-4 text-center text-sm">
          <p className="text-gray-300">Finishing the security check… your request goes on by itself.</p>
          {(failed || slow) && (
            <div className="mt-2">
              <p role="alert" className="text-red-300">
                {turnstile.error || 'This is taking longer than usual.'}
              </p>
              <button
                type="button"
                onClick={() => turnstile.reset()}
                className="mt-2 rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
      <TurnstileField
        siteKey={turnstile.siteKey}
        action={action}
        quiet
        className="flex justify-center"
        onSuccess={turnstile.onSuccess}
        onExpire={turnstile.onExpire}
        onError={turnstile.onError}
        onBeforeInteractive={turnstile.onBeforeInteractive}
        onAfterInteractive={turnstile.onAfterInteractive}
        onRegisterReset={turnstile.registerReset}
      />
      </div>
    </div>
  );
};

export default TurnstileGate;
