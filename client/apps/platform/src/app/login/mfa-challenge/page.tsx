'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { useAuth } from '@/context/AuthContext';

function MfaChallengeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeMfaLogin } = useAuth();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingMfaToken, setPendingMfaToken] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Read the pending MFA token from URL or sessionStorage (set by the login page)
  useEffect(() => {
    const fromUrl = searchParams.get('token');
    const fromStorage = sessionStorage.getItem('dh_pending_mfa') || localStorage.getItem('dh_pending_mfa');
    const token = fromUrl || fromStorage || '';
    if (!token) {
      setError('MFA session not found. Please log in again.');
      return;
    }
    setPendingMfaToken(token);
    setRememberMe(searchParams.get('remember') === '1' || !!localStorage.getItem('dh_pending_mfa'));
    // Auto-focus the code input
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingMfaToken) {
      setError('MFA session expired. Please log in again.');
      return;
    }
    if (!/^\d{6}$/.test(code.trim()) && code.trim().length < 6) {
      setError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setIsLoading(true);
    setError('');

    const result = await completeMfaLogin(pendingMfaToken, code.trim(), rememberMe);
    setIsLoading(false);

    if (result.success) {
      // Clean up the pending MFA token from storage
      [sessionStorage, localStorage].forEach((s) => s.removeItem('dh_pending_mfa'));
      router.push('/my-account');
    } else {
      setError(result.error || 'MFA verification failed. Please try again.');
    }
  };

  const inputBase =
    'w-full px-4 py-4 rounded-lg border-2 outline-none transition-all text-center text-3xl font-bold tracking-[0.5em] text-gray-900 placeholder:text-gray-300 placeholder:text-base placeholder:tracking-normal';
  const inputCls = error
    ? `${inputBase} border-red-300 focus:border-red-500 bg-red-50/30`
    : `${inputBase} border-gray-200 focus:border-[#b20202]`;

  return (
    <>
      {/* Hero breadcrumb */}
      <div className="bg-white border-b border-gray-100 py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-black text-gray-900 mb-1">MFA Verification</h1>
          <p className="text-sm text-gray-500">
            <Link href="/" className="hover:text-[#b20202] transition-colors">Home</Link>
            <span className="mx-1.5 text-gray-300">/</span>
            <Link href="/login" className="hover:text-[#b20202] transition-colors">Login</Link>
            <span className="mx-1.5 text-gray-300">/</span>
            MFA
          </p>
        </div>
      </div>

      <div className="min-h-[70vh] bg-gray-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            {/* Brand stripe */}
            <div className="h-1 bg-gradient-to-r from-[#b20202] via-[#ff3232] to-[#b20202] rounded-full mb-7 -mx-8 mt-[-32px] rounded-t-2xl" />

            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
                <Icon.PiShieldCheckBold size={26} className="text-[#b20202]" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Two-Factor Authentication</h2>
              <p className="text-sm text-gray-500">
                Enter the 6-digit code from your authenticator app to complete sign-in.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                <Icon.PiWarningCircleFill size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="mfa-code" className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Authentication Code
                </label>
                <input
                  ref={inputRef}
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                  placeholder="123456"
                  className={inputCls}
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-br from-[#b20202] to-[#8b0000] hover:from-[#8b0000] hover:to-[#6b0000] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <Icon.PiShieldCheckBold size={16} />
                    Verify & Sign In
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500 mb-3">
                Lost your device? Use a backup code (8-character hex from when you enabled MFA).
              </p>
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:text-[#b20202] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Icon.PiArrowLeftBold size={13} />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-[#b20202] rounded-full" />
        </div>
      }
    >
      <MfaChallengeContent />
    </Suspense>
  );
}