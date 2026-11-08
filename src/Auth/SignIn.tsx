import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound, X } from 'lucide-react';
import {
  requestMagicLinkEmail,
  loginWithMagicLink,
  LOGIN_FAILED_GENERIC,
  TERMS_REQUIRED_CODE,
  TERMS_OUTDATED_CODE,
  TERMS_OUTDATED_MESSAGE,
} from './api';
import { useTurnstile } from './useTurnstile';
import TurnstileGate from './TurnstileGate';
import { useTermsVersion } from './useTermsVersion';

/** Shown when the box is not ticked, or when the server refuses the code with `terms_required`. */
export const SIGNIN_TERMS_REQUIRED_MESSAGE = 'Please confirm you are 18 or older and agree to the Terms of Use.';

interface SignInProps {
  onSignUp: () => void;
  onBack: () => void;
  handleSignIn: (userData?: any) => void;
}

/**
 * Optional route state. Sign-up passes the email (with codeSent and fromSignUp) so this page opens with the
 * code field already showing and a line saying the verification email was sent; the sign-up link after "email already registered" passes only the email.
 */
interface SignInRouteState {
  email?: string;
  codeSent?: boolean;
  /** True only when arriving straight from a successful sign-up (shows the verification-email line). */
  fromSignUp?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Codes differ by sign-in method (digits or letters and digits, 6 to 8 long); the server decides what is valid. */
const CODE_MIN_LENGTH = 6;
const CODE_MAX_LENGTH = 8;
/** Seconds the user must wait before asking for another code. */
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * One page, no step change: email field, "Send me a code". Once a code is sent, the code field appears
 * below the email on the same page, with "Verify" and a resend link. The email stays editable.
 * There is no password login on this screen.
 */
const SignIn: React.FC<SignInProps> = ({ onSignUp, onBack, handleSignIn }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const routeState = (location.state as SignInRouteState | null) ?? null;

  const [idleNotice, setIdleNotice] = useState('');

  useEffect(() => {
    if (searchParams.get('reason') === 'idle') {
      setIdleNotice('You were signed out after 30 minutes of inactivity.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [email, setEmail] = useState(routeState?.email ?? '');
  // Shown once, until the user asks for another code or edits the address (then the line would be stale).
  const [verificationNotice, setVerificationNotice] = useState(
    Boolean(routeState?.fromSignUp && routeState?.codeSent && routeState?.email)
  );
  const sentTo = routeState?.email ?? '';
  const [codeSent, setCodeSent] = useState(Boolean(routeState?.codeSent && routeState?.email));
  const [code, setCode] = useState('');
  // A code is already on its way when we arrive from sign-up, so the cooldown starts right away.
  const [cooldown, setCooldown] = useState(
    routeState?.codeSent && routeState?.email ? RESEND_COOLDOWN_SECONDS : 0
  );
  const [error, setError] = useState('');
  // The 18+ and Terms of Use box on the code step. Verify waits for it, every sign-in.
  const [accepted, setAccepted] = useState(false);
  const terms = useTermsVersion();
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  /** Emails a code to the address in the field. Used by "Send me a code" and by "Resend code". */
  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (codeSent && cooldown > 0) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      // a fast autofill submit can come before the check has finished: wait for it, then carry on
      const turnstileToken = await turnstile.waitForToken();
      if (turnstile.isEnabled && !turnstileToken) {
        setError('The security check did not finish. Please try again.');
        return;
      }
      const r = await requestMagicLinkEmail(trimmed, turnstileToken);
      if (r.success) {
        // Turnstile tokens are single use: the next request needs a fresh check.
        turnstile.reset();
        setCode('');
        setVerificationNotice(false);
        setCodeSent(true);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setError(r.message || 'Something went wrong. Please try again.');
        turnstile.reset();
      }
    } catch (err) {
      console.error('Code request:', err);
      setError('Something went wrong. Please try again.');
      turnstile.reset();
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const codeNorm = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (codeNorm.length < CODE_MIN_LENGTH || codeNorm.length > CODE_MAX_LENGTH) {
      setError('Enter the code we emailed you.');
      return;
    }
    if (!accepted) {
      setError(SIGNIN_TERMS_REQUIRED_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      const turnstileToken = await turnstile.waitForToken();
      if (turnstile.isEnabled && !turnstileToken) {
        setError('The security check did not finish. Please try again.');
        return;
      }
      const result = await loginWithMagicLink(email.trim(), codeNorm, turnstileToken, {
        termsAccepted: true,
        termsVersion: terms.version,
      });
      if (result.success) {
        localStorage.setItem('isAuthenticated', 'true');
        handleSignIn(result.user);
      } else if (result.code === TERMS_REQUIRED_CODE || result.code === TERMS_OUTDATED_CODE) {
        // the server checks the box before the code, so the same code still works once the box is ticked again
        setAccepted(false);
        if (result.code === TERMS_OUTDATED_CODE) {
          setError(result.message || TERMS_OUTDATED_MESSAGE);
          void terms.refresh();
        } else {
          setError(SIGNIN_TERMS_REQUIRED_MESSAGE);
        }
        turnstile.reset();
      } else {
        setError(result.message || LOGIN_FAILED_GENERIC);
        turnstile.reset();
      }
    } catch (err) {
      console.error('Code sign-in:', err);
      setError(LOGIN_FAILED_GENERIC);
      turnstile.reset();
    } finally {
      setLoading(false);
    }
  };

  const renderSubmit = (inline: boolean) => (
      <button
        type="submit"
        // Verify waits for the 18+ and Terms of Use box; "Send me a code" does not need it
        disabled={loading || (codeSent && !accepted)}
        className={`${inline ? 'sm:w-auto sm:shrink-0 sm:px-8 ' : ''}w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex justify-center items-center`}
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            {codeSent ? 'Verifying…' : 'Sending…'}
          </>
        ) : codeSent ? (
          'Verify'
        ) : (
          <>
            <KeyRound className="w-4 h-4 mr-2" />
            Send me a code
          </>
        )}
      </button>
  );

  return (
    // The same place as sign-up and the details form, so moving between them never shifts the card (auth-shell in
    // index.css; Sachin, 2026-11-05). The card grows a little when the code field appears.
    <div className="auth-shell min-h-full flex items-start justify-center px-4 pb-3 sm:px-6 [@media(max-height:480px)]:pb-1">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-2 [@media(max-height:480px)]:mb-1 [@media(max-height:480px)]:text-sm">
        <button
          onClick={onBack}
          className="flex items-center text-purple-300 hover:text-white transition-colors duration-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </button>
          <button
            type="button"
            onClick={onSignUp}
            className="text-purple-300 hover:text-white font-semibold transition-colors duration-300"
            data-test-id="switch-auth-page"
          >
            Sign up
          </button>
        </div>

        <div className="bg-slate-950/35 backdrop-blur-[3px] rounded-2xl p-5 sm:p-6 border border-white/20 shadow-2xl">
          <div className="text-center mb-4">
            <h2 className="text-3xl font-bold text-white">Sign in</h2>
          </div>

          {/* a toast at the top centre of the header, not in the form; it stays until dismissed. Portalled to the body:
              the card's backdrop blur would otherwise hold a fixed element inside the card. */}
          {idleNotice && createPortal(
            <div
              role="status"
              data-test-id="idle-toast"
              className="fixed left-1/2 top-3 z-50 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 items-start gap-3 rounded-lg border border-amber-500/40 bg-slate-900/95 px-4 py-2.5 text-sm text-amber-200 shadow-xl"
            >
              <span className="flex-1">{idleNotice}</span>
              <button
                type="button"
                onClick={() => setIdleNotice('')}
                aria-label="Dismiss"
                className="shrink-0 text-amber-200/80 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>,
            document.body
          )}

          <form onSubmit={codeSent ? verifyCode : sendCode} className="space-y-6">
            <div>
              {/* the words sit in the box; the label stays for screen readers */}
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (e.target.value.trim() !== sentTo) setVerificationNotice(false);
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                  placeholder="Email address"
                  autoComplete="email"
                  required
                />
              </div>
              {!codeSent && renderSubmit(true)}
              </div>
            </div>

            {codeSent && (
              <div>
                {verificationNotice && (
                  <div
                    role="status"
                    className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 px-4 py-3 rounded-lg mb-4 text-sm"
                  >
                    Your account is created. We sent a verification email to <strong>{sentTo}</strong>. Enter the
                    code from it below to finish signing up.
                  </div>
                )}
                <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">
                  Sign-in code
                </label>
                <input
                  type="text"
                  id="code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_MAX_LENGTH))
                  }
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-center text-xl tracking-[0.35em] font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter code"
                  maxLength={CODE_MAX_LENGTH}
                  autoComplete="one-time-code"
                />
                <p className="mt-2 text-sm text-gray-400">
                  Enter the code we emailed you. It works for 3 minutes.
                </p>
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span className="text-gray-400" aria-live="polite">
                    {cooldown > 0 ? `You can ask for a new code in ${cooldown}s.` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => sendCode()}
                    disabled={loading || cooldown > 0}
                    className="text-purple-400 hover:text-purple-300 underline underline-offset-2 font-medium transition-colors disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    Send a new code
                  </button>
                </div>
              </div>
            )}

            {/* styled as the sign-up box (SignUp.tsx) */}
            {codeSent && (
              <label className="flex items-start gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => {
                    setAccepted(e.target.checked);
                    if (e.target.checked) setError('');
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-purple-500"
                />
                <span>
                  I am 18 or older and agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-purple-300 underline underline-offset-2 hover:text-white">
                    Terms of Use
                  </a>
                  , including that I won&apos;t copy, record, or reproduce anything I see in the app.
                </span>
              </label>
            )}

            {turnstile.isEnabled && <span className="sr-only" />}

            {error && (
              <div role="alert" className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {codeSent && renderSubmit(false)}
          </form>
        </div>

        {/* outside the card: its backdrop blur would hold the full-page click overlay inside the card */}
        <TurnstileGate turnstile={turnstile} action="login" />
      </div>
    </div>
  );
};

export default SignIn;
