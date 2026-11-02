import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { requestMagicLinkEmail, loginWithMagicLink, LOGIN_FAILED_GENERIC } from './api';
import { useTurnstile } from './useTurnstile';
import TurnstileGate from './TurnstileGate';

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
      const turnstileToken = turnstile.requireToken();
      if (turnstile.isEnabled && !turnstileToken) {
        setError('Please complete the security check before continuing.');
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

    setLoading(true);
    try {
      const turnstileToken = turnstile.requireToken();
      if (turnstile.isEnabled && !turnstileToken) {
        setError('Please complete the security check before signing in.');
        return;
      }
      const result = await loginWithMagicLink(email.trim(), codeNorm, turnstileToken);
      if (result.success) {
        localStorage.setItem('isAuthenticated', 'true');
        handleSignIn(result.user);
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
        disabled={loading}
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
    // Centred on the screen by default (Sachin, 2026-11-02). The card grows a little when the code field appears.
    <div className="min-h-full flex items-center justify-center px-6 py-6">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
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

        <div className="bg-slate-950/60 backdrop-blur-md rounded-2xl p-5 sm:p-6 border border-white/20 shadow-2xl">
          <h2 className="sr-only">Sign in</h2>

          {idleNotice && (
            <div className="bg-amber-500/20 border border-amber-500/30 text-amber-200 px-4 py-3 rounded-lg mb-6">
              {idleNotice}
            </div>
          )}

          <form onSubmit={codeSent ? verifyCode : sendCode} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
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
                  placeholder="you@example.com"
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
                  Enter the code we emailed you. It expires in a few minutes.
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

            {turnstile.isEnabled && <span className="sr-only" />}

            {(error || turnstile.error) && (
              <div role="alert" className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error || turnstile.error}
              </div>
            )}

            {codeSent && renderSubmit(false)}
          </form>

          <TurnstileGate turnstile={turnstile} action="login" />
        </div>
      </div>
    </div>
  );
};

export default SignIn;
