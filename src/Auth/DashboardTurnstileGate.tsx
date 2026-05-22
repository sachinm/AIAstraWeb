import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import TurnstileField from './TurnstileField';
import { useTurnstile } from './useTurnstile';
import {
  isTurnstileVerificationValid,
  markTurnstileVerified,
} from './turnstileSession';

interface DashboardTurnstileGateProps {
  children: React.ReactNode;
}

const DashboardTurnstileGate: React.FC<DashboardTurnstileGateProps> = ({ children }) => {
  const turnstile = useTurnstile();
  const [verified, setVerified] = useState(() =>
    !turnstile.isEnabled || isTurnstileVerificationValid()
  );
  const [error, setError] = useState('');

  if (!turnstile.isEnabled || verified) {
    return <>{children}</>;
  }

  const handleContinue = () => {
    const token = turnstile.requireToken();
    if (!token) {
      setError('Please complete the security check to continue.');
      return;
    }
    markTurnstileVerified();
    setVerified(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl text-center">
        <div className="flex justify-center mb-4">
          <Shield className="w-12 h-12 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Verify you&apos;re human</h2>
        <p className="text-gray-300 text-sm mb-6">
          Complete the check below to access your dashboard.
        </p>

        <TurnstileField
          siteKey={turnstile.siteKey}
          action="dashboard"
          onSuccess={turnstile.onSuccess}
          onExpire={turnstile.onExpire}
          onError={turnstile.onError}
          onRegisterReset={turnstile.registerReset}
          className="flex justify-center mb-4"
        />

        {(error || turnstile.error) && (
          <p className="text-red-300 text-sm mb-4">{error || turnstile.error}</p>
        )}

        <button
          type="button"
          onClick={handleContinue}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-300"
        >
          Continue to dashboard
        </button>

        <p className="text-center text-xs text-gray-500 mt-4">
          Protected by Cloudflare Turnstile.
        </p>
      </div>
    </div>
  );
};

export default DashboardTurnstileGate;
