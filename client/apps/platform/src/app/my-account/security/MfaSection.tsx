'use client';

import React, { useState, useCallback } from 'react';
import * as Icon from 'react-icons/pi';
import { QRCode } from '@/components/QRCode';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type MfaStatus = 'unknown' | 'enabled' | 'disabled';
type SetupStep = 'idle' | 'qr' | 'verify' | 'backup-codes' | 'disabling';

interface MfaSectionProps {
  token: string | null;
  mfaEnabled: boolean;
  onMfaChanged: () => void;
}

export function MfaSection({ token, mfaEnabled, onMfaChanged }: MfaSectionProps) {
  const [status, setStatus] = useState<MfaStatus>(mfaEnabled ? 'enabled' : 'disabled');
  const [step, setStep] = useState<SetupStep>('idle');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCodes, setShowCodes] = useState(false);

  const handleEnable = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${API_URL}/api/users/mfa/enable`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const d = data.data || data;
        setSecret(d.secret);
        setOtpauthUrl(d.otpauthUrl);
        setStep('qr');
      } else {
        setError(data.message || 'Failed to start MFA setup');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleVerifySetup = useCallback(async () => {
    if (!token || !/^\d{6}$/.test(code.trim())) {
      setError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${API_URL}/api/users/mfa/verify-setup`, {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const d = data.data || data;
        setBackupCodes(d.backupCodes || []);
        setStep('backup-codes');
        setStatus('enabled');
        onMfaChanged();
      } else {
        setError(data.message || 'Invalid code. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, code, onMfaChanged]);

  const handleDisable = useCallback(async () => {
    if (!token || !code.trim()) {
      setError('Please provide your verification code to disable MFA.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${API_URL}/api/users/mfa/disable`, {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('disabled');
        setStep('idle');
        setCode('');
        setSecret('');
        setOtpauthUrl('');
        setBackupCodes([]);
        onMfaChanged();
      } else {
        setError(data.message || 'Invalid code. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, code, onMfaChanged]);

  const reset = () => {
    setStep('idle');
    setSecret('');
    setOtpauthUrl('');
    setCode('');
    setError('');
    setBackupCodes([]);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-stone-100">
        <Icon.PiShieldCheckBold size={15} className="text-red-700" />
        <h2 className="font-bold text-stone-900 text-sm">Two-Factor Authentication</h2>
        {status === 'enabled' && (
          <span className="ml-auto bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            ENABLED
          </span>
        )}
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <Icon.PiWarningCircleFill size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {status === 'enabled' && step !== 'disabling' && step !== 'backup-codes' && (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
              <Icon.PiShieldCheckFill size={20} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-stone-900 text-sm mb-1">Authenticator App Active</p>
              <p className="text-xs text-stone-500 leading-relaxed mb-3">
                Your account is protected with TOTP two-factor authentication. You will need a code from your authenticator app each time you log in.
              </p>
              <button
                onClick={() => { setStep('disabling'); setCode(''); setError(''); }}
                className="flex items-center gap-2 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-50 transition-all"
              >
                <Icon.PiXBold size={12} /> Disable 2FA
              </button>
            </div>
          </div>
        )}

        {step === 'backup-codes' && (
          <div>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Icon.PiWarningCircleBold size={20} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-stone-900 text-sm mb-1">Save your backup codes</p>
                <p className="text-xs text-stone-500 leading-relaxed">
                  These one-time codes let you sign in if you lose access to your authenticator app. Store them somewhere safe &mdash; each can only be used once.
                </p>
              </div>
            </div>
            <div className={`grid grid-cols-2 gap-2 p-4 bg-stone-50 rounded-xl ${showCodes ? '' : 'blur-sm select-none'}`}>
              {backupCodes.map((c, i) => (
                <code key={i} className="text-sm font-mono font-bold text-stone-800 text-center tracking-wider">
                  {c}
                </code>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setShowCodes(s => !s)}
                className="text-xs text-red-700 underline hover:no-underline"
              >
                {showCodes ? 'Hide codes' : 'Reveal codes'}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(backupCodes.join('\n')).catch(() => {});
                }}
                className="text-xs text-stone-600 underline hover:no-underline"
              >
                Copy all
              </button>
              <button
                onClick={reset}
                className="ml-auto flex items-center gap-2 bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-800 transition-all"
              >
                <Icon.PiCheckBold size={12} /> Done
              </button>
            </div>
          </div>
        )}

        {step === 'qr' && (
          <div className="text-center">
            <p className="text-sm text-stone-600 mb-4">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code it generates.
            </p>
            <div className="inline-block p-4 bg-white border-2 border-stone-100 rounded-2xl mb-4">
              <QRCode value={otpauthUrl} size={200} />
            </div>
            <details className="mb-4 text-left">
              <summary className="text-xs text-stone-500 cursor-pointer hover:text-stone-700">
                Can&apos;t scan? Enter this key manually
              </summary>
              <div className="mt-2 p-3 bg-stone-50 rounded-lg">
                <code className="text-xs font-mono font-bold text-stone-800 break-all">{secret}</code>
              </div>
            </details>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={reset}
                className="text-xs text-stone-500 underline hover:no-underline"
              >
                Cancel
              </button>
              <button
                onClick={() => { setStep('verify'); setCode(''); setError(''); }}
                className="flex items-center gap-2 bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-800 transition-all"
              >
                <Icon.PiArrowRightBold size={14} /> Continue
              </button>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div>
            <p className="text-sm text-stone-600 mb-4 text-center">
              Enter the 6-digit code shown in your authenticator app.
            </p>
            <div className="max-w-xs mx-auto">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                placeholder="123456"
                className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl text-center text-2xl font-bold tracking-[0.4em] focus:outline-none focus:border-red-500 transition-all"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-3 justify-center mt-4">
              <button
                onClick={() => { setStep('qr'); setCode(''); setError(''); }}
                className="text-xs text-stone-500 underline hover:no-underline"
              >
                Back
              </button>
              <button
                onClick={handleVerifySetup}
                disabled={loading || code.length !== 6}
                className="flex items-center gap-2 bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-800 disabled:opacity-50 transition-all"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying&hellip;</>
                  : <><Icon.PiCheckBold size={14} /> Enable 2FA</>}
              </button>
            </div>
          </div>
        )}

        {step === 'disabling' && (
          <div>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                <Icon.PiWarningBold size={20} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-stone-900 text-sm mb-1">Disable Two-Factor Authentication</p>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Enter your current TOTP code or a backup code to confirm. Your account will be less secure after disabling.
                </p>
              </div>
            </div>
            <div className="max-w-xs mx-auto mb-4">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(''); }}
                placeholder="6-digit code or backup code"
                className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl text-center text-lg font-bold focus:outline-none focus:border-red-500 transition-all"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={() => { setStep('idle'); setCode(''); setError(''); }}
                className="text-xs text-stone-500 underline hover:no-underline"
              >
                Cancel
              </button>
              <button
                onClick={handleDisable}
                disabled={loading || !code.trim()}
                className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Disabling&hellip;</>
                  : <><Icon.PiXBold size={14} /> Disable 2FA</>}
              </button>
            </div>
          </div>
        )}

        {status === 'disabled' && step === 'idle' && (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center flex-shrink-0">
              <Icon.PiDeviceMobileBold size={20} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-stone-900 text-sm mb-1">Authenticator App</p>
              <p className="text-xs text-stone-500 leading-relaxed mb-3">
                Add an extra layer of security. Each time you log in, you will need your password plus a verification code from your phone.
              </p>
              <button
                onClick={handleEnable}
                disabled={loading}
                className="flex items-center gap-2 border border-stone-200 text-stone-700 px-4 py-2 rounded-xl text-xs font-bold hover:border-red-200 hover:text-red-700 disabled:opacity-50 transition-all"
              >
                {loading
                  ? <><div className="w-3.5 h-3.5 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" /> Loading&hellip;</>
                  : <><Icon.PiPlusBold size={12} /> Enable 2FA</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MfaSection;
