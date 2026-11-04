import { useEffect, useState } from 'react';
import TurnstileField from './TurnstileField';
import type { useTurnstile } from './useTurnstile';

type TurnstileState = ReturnType<typeof useTurnstile>;

interface TurnstileGateProps {
  turnstile: TurnstileState;
  action: string;
}

/** A submit that has waited this long for the check gets a "Finishing the security check" box. */
const SHOW_AFTER_MS = 1_500;
/** After this long without a token the box says so and offers a retry. */
const SLOW_AFTER_MS = 15_000;

/**
 * The security check, run unseen so the form can be used at once. The widget sits in a 1px box that stays inside the first
 * screen, because Cloudflare does not start checking a widget below the fold. The box opens into an overlay only when
 * Cloudflare wants the person to click, or when a submit has been waiting for the token for a moment (fast autofill).
 */
const TurnstileGate: React.FC<TurnstileGateProps> = ({ turnstile, action }) => {
  const { awaiting, needsInteraction } = turnstile;
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
  const open = needsInteraction || (awaiting && (showWait || failed));

  return (
    <div
      data-test-id="turnstile-gate"
      className={
        open
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm'
          : 'pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0'
      }
    >
      <div className={open ? 'w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/90 p-6 text-center shadow-xl' : ''}>
        {open && (
          <div role="status" aria-live="polite" data-test-id="turnstile-waiting">
            {needsInteraction ? (
              <p className="font-semibold text-white">Please confirm you are a person.</p>
            ) : (
              <>
                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" />
                <p className="font-semibold text-white">Finishing the security check…</p>
                <p className="mt-1 text-sm text-gray-300">Your details are kept. This carries on by itself.</p>
              </>
            )}
            {(failed || slow) && (
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
          onBeforeInteractive={turnstile.onBeforeInteractive}
          onAfterInteractive={turnstile.onAfterInteractive}
          onRegisterReset={turnstile.registerReset}
        />
      </div>
    </div>
  );
};

export default TurnstileGate;
