import { useEffect, useState } from 'react';
import TurnstileField from './TurnstileField';
import type { useTurnstile } from './useTurnstile';

type TurnstileState = ReturnType<typeof useTurnstile>;

interface TurnstileGateProps {
  turnstile: TurnstileState;
  action: string;
}

/** After this long without a token the overlay says so and offers a retry. */
const SLOW_AFTER_MS = 15_000;

/**
 * The security check, kept inside the first screen. Cloudflare does not start checking a widget that sits below the fold, so
 * the widget lives in a full-screen "Getting things ready" overlay until it has a token, then shrinks to an unseen 1px box
 * that stays in view so the next check (a token is single use) runs by itself.
 */
const TurnstileGate: React.FC<TurnstileGateProps> = ({ turnstile, action }) => {
  const waiting = turnstile.isEnabled && !turnstile.token;
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return undefined;
    }
    const id = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [waiting]);

  if (!turnstile.isEnabled) return null;

  return (
    <div
      data-test-id="turnstile-gate"
      className={
        waiting
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm'
          : 'pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0'
      }
    >
      <div className={waiting ? 'w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/90 p-6 text-center shadow-xl' : ''}>
        {waiting && (
          <div role="status" aria-live="polite" data-test-id="turnstile-waiting">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" />
            <p className="font-semibold text-white">Getting things ready…</p>
            <p className="mt-1 text-sm text-gray-300">We are checking that you are a person. This takes a moment, and the page opens by itself.</p>
            {(turnstile.error || slow) && (
              <div className="mt-3">
                <p role="alert" className="text-sm text-red-300">
                  {turnstile.error || 'This is taking longer than usual.'}
                </p>
                <button
                  type="button"
                  onClick={() => turnstile.reset()}
                  className="mt-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
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
          className="mt-3 flex justify-center"
          onSuccess={turnstile.onSuccess}
          onExpire={turnstile.onExpire}
          onError={turnstile.onError}
          onRegisterReset={turnstile.registerReset}
        />
      </div>
    </div>
  );
};

export default TurnstileGate;
