'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const prefillEmail = searchParams.get('email') || '';
    if (prefillEmail) setEmail(decodeURIComponent(prefillEmail));

    if (token) {
      verifyEmail(token);
    } else {
      // Arrived here without a token (e.g. after registration redirect)
      setStatus('error');
      setMessage('Check your inbox — we sent you a verification link. Click it to activate your account.');
    }
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/users/verify-email/${token}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setMessage(data.message || 'Your email has been verified successfully!');
        // Auto-redirect to login after 3 s
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setStatus('error');
        setMessage(data.message || 'Failed to verify email. The link may be expired or invalid.');
      }
    } catch {
      setStatus('error');
      setMessage('An error occurred while verifying your email. Please try again.');
    }
  };

  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setResendMessage('Please enter your email address');
      return;
    }

    setResending(true);
    setResendMessage('');

    try {
      const response = await fetch(`${API_URL}/api/users/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResendMessage('Verification email sent! Please check your inbox.');
      } else {
        setResendMessage(data.message || 'Failed to send verification email. Please try again.');
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
        <div className="container">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              {status === 'loading' && (
                <>
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center">
                    <Icon.PiSpinner className="animate-spin text-4xl text-blue-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying Email</h1>
                  <p className="text-gray-500">Please wait while we verify your email address...</p>
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

              {status === 'error' && (
                <>
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                    <Icon.PiXCircle className="text-4xl text-red-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
                  <p className="text-gray-500 mb-6">{message}</p>

                  {resendMessage && (
                    <div className={`mb-4 p-4 rounded-lg text-sm ${resendMessage.includes('sent') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {resendMessage}
                    </div>
                  )}

                  <form onSubmit={handleResendVerification} className="text-left">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Enter your email to resend verification</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                      <button
                        type="submit"
                        disabled={resending}
                        className="px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        {resending ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </form>

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
    </div>
  );
};

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
