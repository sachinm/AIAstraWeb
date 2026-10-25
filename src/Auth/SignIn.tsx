import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Star, Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { requestMagicLinkEmail, loginWithMagicLink, LOGIN_FAILED_GENERIC } from './api';
import { useTurnstile } from './useTurnstile';
import TurnstileField from './TurnstileField';

interface SignInProps {
  onSignUp: () => void;
  onBack: () => void;
  handleSignIn: (userData?: any) => void;
}

/**
 * Optional route state. Sign-up passes the email (and codeSent) so this page opens with the code field
 * already showing; the sign-up link after "email already registered" passes only the email.
 */
interface SignInRouteState {
  email?: string;
  codeSent?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 8; // server contract: 8-character code, 5 minute TTL

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
      setIdleNotice('You were signed out after 10 minutes of inactivity.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [email, setEmail] = useState(routeState?.email ?? '');
  const [codeSent, setCodeSent] = useState(Boolean(routeState?.codeSent && routeState?.email));
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile();

  /** Emails a code to the address in the field. Used by "Send me a code" and by "Resend code". */
  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
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
        setCodeSent(true);
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
    if (codeNorm.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-character code from your email.`);
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

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <button
          onClick={onBack}
          className="flex items-center text-purple-300 hover:text-white mb-8 transition-colors duration-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </button>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Star className="w-12 h-12 text-purple-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-gray-300">Sign in to continue your cosmic journey</p>
          </div>

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
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {codeSent && (
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">
                  Sign-in code
                </label>
                <input
                  type="text"
                  id="code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))
                  }
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-center text-xl tracking-[0.35em] font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="XXXXXXXX"
                  maxLength={CODE_LENGTH}
                  autoComplete="one-time-code"
                />
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span className="text-gray-400">Expires in 5 minutes.</span>
                  <button
                    type="button"
                    onClick={() => sendCode()}
                    disabled={loading}
                    className="text-purple-400 hover:text-purple-300 font-medium transition-colors disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </div>
              </div>
            )}

            {turnstile.isEnabled && (
              <TurnstileField
                siteKey={turnstile.siteKey}
                action="magic_link"
                onSuccess={turnstile.onSuccess}
                onExpire={turnstile.onExpire}
                onError={turnstile.onError}
                onRegisterReset={turnstile.registerReset}
                className="flex justify-center"
              />
            )}

            {(error || turnstile.error) && (
              <div role="alert" className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error || turnstile.error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex justify-center items-center"
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
          </form>

          <div className="text-center mt-6">
            <p className="text-gray-300">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={onSignUp}
                className="text-purple-400 hover:text-purple-300 font-semibold transition-colors duration-300"
              >
                Sign up
              </button>
            </p>
          </div>

          {turnstile.isEnabled && (
            <p className="text-center text-xs text-gray-500 mt-4">Protected by Cloudflare Turnstile.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignIn;
