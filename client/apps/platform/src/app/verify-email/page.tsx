'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { validateEmail } from '@/lib/validation';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const didInit = useRef(false);

  useEffect(() => {
    const prefillEmail = searchParams.get('email') || '';
    if (prefillEmail) setEmail(decodeURIComponent(prefillEmail));
    // Always land in the "enter your code" state — the 6-digit form is the
    // canonical verification flow now (token-link path was retired in Phase 1.5).
    if (!didInit.current) {
      didInit.current = true;
      setStatus('idle');
      setMessage('Enter the 6-digit code we sent to your email to verify your account.');
    }
  }, [searchParams]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) { setMessage(emailError); setStatus('error'); return; }
    if (!/^\d{6}$/.test(code.trim())) {
      setMessage('Please enter the 6-digit verification code.');
      setStatus('error');
      return;
    }

    setStatus('verifying');
    setIsVerifying(true);
    try {
      const response = await fetch(`${API_URL}/api/users/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setMessage(data.message || 'Your email has been verified successfully!');
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setStatus('error');
        setMessage(data.message || 'Failed to verify email. The code may be expired or invalid.');
      }
    } catch {
      setStatus('error');
      setMessage('An error occurred while verifying your email. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) { setResendMessage(emailError); return; }

    setResending(true);
    setResendMessage('');

    try {
      const response = await fetch(`${API_URL}/api/users/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResendMessage('A new verification code has been sent! Please check your inbox.');
      } else {
        setResendMessage(data.message || 'Failed to send verification code. Please try again.');
      }
    } catch {
      setResendMessage('An error occurred. Please check your connection and try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="verify-email md:py-20 py-10 bg-gray-50 min-h-screen">
      <div className="container">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            {status === 'verifying' && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center">
                  <Icon.PiSpinner className="animate-spin text-4xl text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying…</h1>
                <p className="text-gray-500">Confirming your code with the server.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
                  <Icon.PiCheckCircle className="text-4xl text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
                <p className="text-gray-500 mb-2">{message}</p>
                <p className="text-xs text-gray-400 mb-6">Redirecting you to login…</p>
                <div className="flex flex-col gap-3">
                  <Link href="/login" className="px-6 py-3 bg-gradient-to-br from-[#b20202] to-[#8b0000] text-white rounded-xl hover:opacity-90 transition-opacity">
                    Sign In Now
                  </Link>
                  <Link href="/" className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
                    Return to Home
                  </Link>
                </div>
              </>
            )}

            {(status === 'idle' || status === 'error') && (
              <>
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                  <Icon.PiEnvelopeSimpleOpen className="text-4xl text-[#b20202]" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify your email</h1>
                <p className={`text-sm mb-6 ${status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                  {message}
                </p>

                {resendMessage && (
                  <div className={`mb-4 p-3 rounded-lg text-sm ${resendMessage.includes('sent') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {resendMessage}
                  </div>
                )}

                <form onSubmit={handleVerify} className="text-left space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setStatus('idle'); setMessage('Enter the 6-digit code we sent to your email to verify your account.'); }}
                      placeholder="your@email.com"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#b20202] transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setStatus('idle'); }}
                      placeholder="123456"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#b20202] transition-all text-center text-2xl font-bold tracking-[0.5em] text-gray-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full py-3 bg-gradient-to-br from-[#b20202] to-[#8b0000] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 font-bold text-sm flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying…</>
                    ) : 'Verify Email'}
                  </button>
                </form>

                <div className="mt-5 pt-5 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-3">Didn&apos;t receive a code?</p>
                  <button
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="text-sm text-[#b20202] underline hover:no-underline disabled:opacity-50"
                  >
                    {resending ? 'Sending…' : 'Resend code'}
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <Link href="/login" className="text-gray-600 hover:text-gray-900 text-sm flex items-center justify-center gap-2">
                    <Icon.PiArrowLeft /> Back to Login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
