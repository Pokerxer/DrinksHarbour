'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setIsValidToken(false);
      setMessage({ type: 'error', text: 'Invalid or missing reset token. Please request a new password reset.' });
    } else {
      setIsValidToken(true);
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setMessage({ type: 'error', text: 'Invalid reset token.' });
      return;
    }

    // Validate password to match server requirements
    if (!password) {
      setMessage({ type: 'error', text: 'Please enter a new password.' });
      return;
    }
    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[@$!%*?&]/.test(password)) {
      setMessage({ type: 'error', text: 'Password must contain uppercase, lowercase, a number, and a special character (@$!%*?&).' });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/users/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Password reset successfully! Redirecting to login…' });
        setTimeout(() => router.push('/login'), 2500);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to reset password. The link may have expired.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="h-1 bg-gradient-to-r from-[#b20202] via-[#ff3232] to-[#b20202] rounded-full -mx-8 mt-[-32px] mb-7 rounded-t-2xl" />

        <div className="text-center mb-7">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-50 flex items-center justify-center">
            <Icon.PiLockKeyOpenBold size={22} className="text-[#b20202]" />
          </div>
          <h2 className="text-xl font-black text-gray-900">Set a new password</h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Must be 8+ characters with uppercase, lowercase, number & special character.
          </p>
        </div>

        {message && (
          <div className={`mb-5 flex items-start gap-3 p-4 rounded-xl border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {message.type === 'success'
              ? <Icon.PiCheckCircleFill size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
              : <Icon.PiWarningCircleFill size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            }
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {isValidToken && (
            <>
              <div>
                <label htmlFor="password" className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setMessage(null); }}
                    className="w-full px-4 py-3 pr-11 border-2 border-gray-200 rounded-xl outline-none focus:border-[#b20202] transition-all placeholder:text-gray-400 text-sm"
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <Icon.PiEyeSlash size={19} /> : <Icon.PiEye size={19} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setMessage(null); }}
                    className="w-full px-4 py-3 pr-11 border-2 border-gray-200 rounded-xl outline-none focus:border-[#b20202] transition-all placeholder:text-gray-400 text-sm"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <Icon.PiEyeSlash size={19} /> : <Icon.PiEye size={19} />}
                  </button>
                </div>
                {confirmPassword && password && confirmPassword === password && (
                  <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <Icon.PiCheckCircleFill size={12} /> Passwords match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-br from-[#b20202] to-[#8b0000] hover:from-[#8b0000] hover:to-[#6b0000] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Resetting…
                  </>
                ) : (
                  <>
                    <Icon.PiLockKeyBold size={16} />
                    Reset Password
                  </>
                )}
              </button>
            </>
          )}

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-800 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Icon.PiArrowLeftBold size={13} />
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordWithSuspense() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

export default ResetPasswordWithSuspense;