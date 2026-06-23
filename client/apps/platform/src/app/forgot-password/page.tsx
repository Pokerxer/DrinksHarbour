'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (data.success) {
        setSent(true);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to send reset instructions. Please try again.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-green-50 flex items-center justify-center">
            <Icon.PiEnvelopeBold size={28} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Check your inbox</h2>
          <p className="text-gray-500 text-sm mb-1">We sent a password reset link to</p>
          <p className="font-semibold text-gray-800 mb-6 break-all">{email}</p>
          <p className="text-xs text-gray-400 mb-8">
            Didn&apos;t get it? Check your spam folder, or{' '}
            <button
              onClick={() => { setSent(false); }}
              className="text-[#b20202] underline hover:no-underline"
            >
              try again
            </button>
            .
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <Icon.PiArrowLeftBold size={14} />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="h-1 bg-gradient-to-r from-[#b20202] via-[#ff3232] to-[#b20202] rounded-full -mx-8 mt-[-32px] mb-7 rounded-t-2xl" />

          <div className="text-center mb-7">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-50 flex items-center justify-center">
              <Icon.PiLockKeyBold size={22} className="text-[#b20202]" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Forgot your password?</h2>
            <p className="mt-2 text-sm text-gray-500">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {message?.type === 'error' && (
            <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <Icon.PiWarningCircleFill size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setMessage(null); }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:border-[#b20202] transition-all placeholder:text-gray-400 text-sm"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-br from-[#b20202] to-[#8b0000] hover:from-[#8b0000] hover:to-[#6b0000] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Icon.PiPaperPlaneTiltBold size={16} />
                  Send Reset Link
                </>
              )}
            </button>

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
    </div>
  );
}