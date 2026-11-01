import React, { useEffect, useRef, useState } from 'react';
import { Star, UserIcon, Mail, ArrowLeft } from 'lucide-react';
import { startSignup, verifySignupCode, EMAIL_EXISTS_CODE } from './api';
import { useTurnstile } from './useTurnstile';
import TurnstileField from './TurnstileField';

interface SignUpProps {
  /** Called when the emailed code is confirmed and the user is signed in; the next page is birth details. */
  onVerified: (info: { email: string; name: string; userId?: string }) => void;
  /** Opens sign-in; the email is passed when the account already exists, to prefill that screen. */
  onSignIn: (email?: string) => void;
  onBack: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_MIN_LENGTH = 6;
const CODE_MAX_LENGTH = 8;
/** Seconds before another code can be requested. */
export const RESEND_COOLDOWN_SECONDS = 30;
export const EMAIL_EXISTS_MESSAGE = 'This email is already registered. Please sign in instead.';

const inputCls =
  'w-full bg-white/10 border rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 read-only:opacity-70';

/**
 * Page 1 of registration, "Create your account": name and email, then Next. After Next the code field
 * appears below the email on this same page; a correct code signs the user in and hands over to page 2.
 */
const SignUp: React.FC<SignUpProps> = ({ onVerified, onSignIn, onBack }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [error, setError] = useState('');
  const [emailExists, setEmailExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (codeSent) codeRef.current?.focus();
  }, [codeSent]);

  const validate = () => {
    const errs: { name?: string; email?: string } = {};
    if (name.trim().length < 2) errs.name = 'Enter your name.';
    if (!email.trim()) errs.email = 'Enter your email address.';
    else if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    setFieldErrors(errs);
    if (errs.name) nameRef.current?.focus();
    else if (errs.email) emailRef.current?.focus();
    return !errs.name && !errs.email;
  };

  /** Sends the code. Used by Next and by Resend. */
  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setEmailExists(false);
    if (codeSent && cooldown > 0) return;
    if (!validate()) return;

    setLoading(true);
    try {
      const turnstileToken = turnstile.requireToken();
      if (turnstile.isEnabled && !turnstileToken) {
        setError('Please complete the security check before continuing.');
        return;
      }
      const r = await startSignup({ name, email, turnstileToken });
      if (r.success) {
        turnstile.reset();
        setCode('');
        setCodeSent(true);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else if (r.code === EMAIL_EXISTS_CODE) {
        setEmailExists(true);
        turnstile.reset();
      } else {
        setError(r.message || 'Something went wrong. Please try again.');
        turnstile.reset();
      }
    } catch (err) {
      console.error('Start signup:', err);
      setError('Something went wrong. Please try again.');
      turnstile.reset();
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const codeNorm = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (codeNorm.length < CODE_MIN_LENGTH || codeNorm.length > CODE_MAX_LENGTH) {
      setError('Enter the code we emailed you.');
      codeRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const result = await verifySignupCode(email.trim(), codeNorm);
      if (result.success) {
        localStorage.setItem('isAuthenticated', 'true');
        onVerified({ email: email.trim(), name: name.trim(), userId: result.user });
      } else {
        setError(result.message || 'That code did not match. Check the latest email or request a new code.');
      }
    } catch (err) {
      console.error('Verify signup code:', err);
      setError('That code did not match. Check the latest email or request a new code.');
    } finally {
      setLoading(false);
    }
  };

  const useDifferentEmail = () => {
    setCodeSent(false);
    setCode('');
    setCooldown(0);
    setError('');
    setEmailExists(false);
    emailRef.current?.focus();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center text-purple-300 hover:text-white mb-8 transition-colors duration-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </button>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/20 shadow-2xl">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Star className="w-12 h-12 text-purple-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Create your account</h2>
            <p className="text-gray-300">Your name and email. Birth details come next.</p>
          </div>

          <form onSubmit={codeSent ? verify : sendCode} noValidate className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={nameRef}
                  type="text"
                  id="name"
                  value={name}
                  readOnly={codeSent}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Your name"
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={`${inputCls} ${fieldErrors.name ? 'border-red-500' : 'border-white/20'}`}
                />
              </div>
              {fieldErrors.name && <p className="text-red-300 text-sm mt-1">{fieldErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={emailRef}
                  type="email"
                  id="email"
                  value={email}
                  readOnly={codeSent}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailExists(false);
                  }}
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  className={`${inputCls} ${fieldErrors.email ? 'border-red-500' : 'border-white/20'}`}
                />
              </div>
              {fieldErrors.email && <p className="text-red-300 text-sm mt-1">{fieldErrors.email}</p>}
              {codeSent && (
                <button
                  type="button"
                  onClick={useDifferentEmail}
                  className="mt-2 text-sm text-purple-400 hover:text-purple-300 underline underline-offset-2"
                >
                  Use a different email
                </button>
              )}
            </div>

            {emailExists && (
              <div role="alert" className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                <p>{EMAIL_EXISTS_MESSAGE}</p>
                <button
                  type="button"
                  onClick={() => onSignIn(email.trim())}
                  className="mt-2 text-purple-300 hover:text-white font-semibold underline underline-offset-2"
                >
                  Sign in
                </button>
              </div>
            )}

            {codeSent && (
              <div>
                <div
                  role="status"
                  className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 px-4 py-3 rounded-lg mb-4 text-sm"
                >
                  We sent a verification code to <strong>{email.trim()}</strong>.
                </div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">
                  Verification code
                </label>
                <input
                  ref={codeRef}
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
                    Resend code
                  </button>
                </div>
              </div>
            )}

            {turnstile.isEnabled && (
              <TurnstileField
                siteKey={turnstile.siteKey}
                action="signup"
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
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {codeSent ? 'Verifying…' : 'Sending…'}
                </>
              ) : codeSent ? (
                'Verify'
              ) : (
                'Next'
              )}
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="text-gray-300">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => onSignIn()}
                className="text-purple-400 hover:text-purple-300 font-semibold transition-colors duration-300"
              >
                Sign in
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

export default SignUp;
