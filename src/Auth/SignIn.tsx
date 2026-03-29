import React, { useState } from 'react';
import { Star, Mail, Lock, ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';
import {
  login,
  requestMagicLinkEmail,
  loginWithMagicLink,
  LOGIN_FAILED_GENERIC,
} from './api';
import { useRecaptcha } from './useRecaptcha';

interface SignInProps {
  onSignUp: () => void;
  onBack: () => void;
  handleSignIn: (userData?: any) => void;
}

type SignInMode = 'password' | 'magic';

const SignIn: React.FC<SignInProps> = ({ onSignUp, onBack, handleSignIn }) => {
  const [mode, setMode] = useState<SignInMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getToken, isEnabled } = useRecaptcha();

  const [magicEmail, setMagicEmail] = useState('');
  const [magicCode, setMagicCode] = useState('');
  const [magicInfo, setMagicInfo] = useState('');
  const [magicError, setMagicError] = useState('');
  const [magicCodeSent, setMagicCodeSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  const switchMode = (m: SignInMode) => {
    setMode(m);
    setError('');
    setMagicError('');
    setMagicInfo('');
    if (m === 'password') {
      setMagicCodeSent(false);
      setMagicCode('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!email || !password) {
        setError('Please enter both email and password.');
        setIsLoading(false);
        return;
      }

      const recaptchaToken = isEnabled ? await getToken('login') : null;
      if (isEnabled && !recaptchaToken) {
        setError('Security check failed to load. Please refresh the page and try again.');
        setIsLoading(false);
        return;
      }

      const result = await login(email, password, recaptchaToken);

      if (result.success) {
        localStorage.setItem('isAuthenticated', 'true');
        handleSignIn(result.user);
      } else {
        setError(result.message || LOGIN_FAILED_GENERIC);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(LOGIN_FAILED_GENERIC);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicError('');
    setMagicInfo('');
    const trimmed = magicEmail.trim();
    if (!trimmed) {
      setMagicError('Please enter your email address.');
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!emailOk) {
      setMagicError('Please enter a valid email address.');
      return;
    }

    setMagicLoading(true);
    try {
      const recaptchaToken = isEnabled ? await getToken('magic_link_request') : null;
      if (isEnabled && !recaptchaToken) {
        setMagicError('Security check failed to load. Please refresh the page and try again.');
        return;
      }
      const r = await requestMagicLinkEmail(trimmed, recaptchaToken);
      if (r.success) {
        setMagicInfo(
          r.message ||
            "If that email is registered, you'll receive a message with an 8-character code. The code expires in 5 minutes."
        );
        setMagicCodeSent(true);
      } else {
        setMagicError(r.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Magic link request:', err);
      setMagicError('Something went wrong. Please try again.');
    } finally {
      setMagicLoading(false);
    }
  };

  const handleMagicSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicError('');
    const trimmed = magicEmail.trim();
    const codeNorm = magicCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!trimmed || codeNorm.length !== 8) {
      setMagicError('Enter the 8-character code from your email.');
      return;
    }

    setMagicLoading(true);
    try {
      const recaptchaToken = isEnabled ? await getToken('magic_link_login') : null;
      if (isEnabled && !recaptchaToken) {
        setMagicError('Security check failed to load. Please refresh the page and try again.');
        return;
      }
      const result = await loginWithMagicLink(trimmed, codeNorm, recaptchaToken);
      if (result.success) {
        localStorage.setItem('isAuthenticated', 'true');
        handleSignIn(result.user);
      } else {
        setMagicError(result.message || 'Unable to sign in. Check your code and try again.');
      }
    } catch (err) {
      console.error('Magic link login:', err);
      setMagicError('Unable to sign in. Check your code and try again.');
    } finally {
      setMagicLoading(false);
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

          <div className="flex rounded-lg overflow-hidden border border-white/20 mb-6">
            <button
              type="button"
              onClick={() => switchMode('password')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === 'password'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => switchMode('magic')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'magic'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              Email code
            </button>
          </div>

          {mode === 'password' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                    placeholder="Enter your email or username"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-11 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <Eye className="w-5 h-5" />
                    ) : (
                      <EyeOff className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex justify-center items-center"
              >
                {isLoading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="text-center">
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

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => switchMode('magic')}
                  className="text-gray-400 hover:text-gray-300 text-sm transition-colors duration-300"
                >
                  Sign in with email code instead
                </button>
              </div>

              {isEnabled && (
                <p className="text-center text-xs text-gray-500">
                  Protected by reCAPTCHA v3 (invisible). This site is protected by reCAPTCHA and the Google{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400/90 hover:text-purple-300 underline"
                  >
                    Privacy Policy
                  </a>{' '}
                  and{' '}
                  <a
                    href="https://policies.google.com/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400/90 hover:text-purple-300 underline"
                  >
                    Terms of Service
                  </a>{' '}
                  apply.
                </p>
              )}
            </form>
          )}

          {mode === 'magic' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-400 text-center">
                We&apos;ll email you a one-time 8-character code (expires in 5 minutes). When the site uses
                Google reCAPTCHA, it runs invisibly in the background — there is no separate checkbox.
              </p>

              <form onSubmit={handleMagicSendCode} className="space-y-4">
                <div>
                  <label htmlFor="magic-email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      id="magic-email"
                      value={magicEmail}
                      onChange={(e) => setMagicEmail(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-10 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={magicLoading}
                  className="w-full bg-white/15 border border-white/25 text-white py-3 rounded-lg font-semibold hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 flex justify-center items-center"
                >
                  {magicLoading && !magicCodeSent ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Sending…
                    </>
                  ) : (
                    'Email me a code'
                  )}
                </button>
              </form>

              {magicInfo && (
                <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-200/90 px-4 py-3 rounded-lg text-sm">
                  {magicInfo}
                </div>
              )}

              {magicError && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {magicError}
                </div>
              )}

              {magicCodeSent && (
                <form onSubmit={handleMagicSignIn} className="space-y-4 pt-2 border-t border-white/10">
                  <div>
                    <label htmlFor="magic-code" className="block text-sm font-medium text-gray-300 mb-2">
                      8-character code
                    </label>
                    <input
                      type="text"
                      id="magic-code"
                      value={magicCode}
                      onChange={(e) => setMagicCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-center text-xl tracking-[0.35em] font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="XXXXXXXX"
                      maxLength={8}
                      autoComplete="one-time-code"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={magicLoading}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 flex justify-center items-center"
                  >
                    {magicLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Signing in…
                      </>
                    ) : (
                      'Sign in with code'
                    )}
                  </button>
                </form>
              )}

              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={() => switchMode('password')}
                  className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                >
                  Use password instead
                </button>
                <p className="text-gray-300 text-sm">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={onSignUp}
                    className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                  >
                    Sign up
                  </button>
                </p>
              </div>

              {isEnabled && (
                <p className="text-center text-xs text-gray-500">
                  Protected by reCAPTCHA v3 (invisible). Google{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400/90 hover:text-purple-300 underline"
                  >
                    Privacy Policy
                  </a>{' '}
                  and{' '}
                  <a
                    href="https://policies.google.com/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400/90 hover:text-purple-300 underline"
                  >
                    Terms
                  </a>
                  .
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignIn;
