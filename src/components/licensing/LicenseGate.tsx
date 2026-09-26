import React, { useState, useEffect } from 'react';
import { Shield, Key, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { getActivationStatus, activateLicense, startTrial, LicenseStatus } from '../../licensing/license-validator';

interface LicenseGateProps {
  children: React.ReactNode;
}

export const LicenseGate: React.FC<LicenseGateProps> = ({ children }) => {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    setStatus(getActivationStatus());
  }, []);

  if (status === null) return null;

  // Licensed or valid trial — render the app
  if (status.valid) {
    return (
      <>
        {status.type === 'trial' && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600/90 text-white text-center py-1 text-xs font-medium">
            <Clock className="w-3 h-3 inline mr-1" />
            Free Trial: {status.daysRemaining} day{status.daysRemaining !== 1 ? 's' : ''} remaining
          </div>
        )}
        {children}
      </>
    );
  }

  // License gate screen
  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key.');
      return;
    }
    setIsActivating(true);
    setError(null);
    const result = await activateLicense(licenseKey);
    setIsActivating(false);
    setStatus(result);
    if (!result.valid && result.type === 'invalid_key') {
      setError(result.reason);
    }
  };

  const handleStartTrial = () => {
    const result = startTrial();
    setStatus(result);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Janki Desktop Assistant</h1>
          <p className="text-sm text-slate-400">
            {status.type === 'expired_trial'
              ? 'Your free trial has expired. Enter a license key to continue.'
              : 'Activate your license or start a free 7-day trial.'}
          </p>
        </div>

        {/* Expired trial warning */}
        {status.type === 'expired_trial' && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-300">Trial expired. Please activate a license to continue using Janki.</p>
          </div>
        )}

        {/* License key input */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-300">License Key</label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => {
                setLicenseKey(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="JANKI-XXXX-XXXX-XXXX-XXXX"
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
            />
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <button
            onClick={handleActivate}
            disabled={isActivating}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isActivating ? (
              <span className="animate-pulse">Verifying...</span>
            ) : (
              <><CheckCircle className="w-4 h-4" /> Activate License</>
            )}
          </button>
        </div>

        {/* Trial option (only if not expired) */}
        {status.type !== 'expired_trial' && (
          <div className="border-t border-slate-700/50 pt-4">
            <button
              onClick={handleStartTrial}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Start Free 7-Day Trial
            </button>
            <p className="text-center text-xs text-slate-500 mt-2">No credit card required</p>
          </div>
        )}

        {/* Purchase link */}
        <div className="text-center">
          <a
            href="https://orbit-assistant.gumroad.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Purchase a license
          </a>
        </div>
      </div>
    </div>
  );
};
