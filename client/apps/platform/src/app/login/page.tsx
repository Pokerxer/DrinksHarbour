'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import * as Icon from 'react-icons/pi';
import { useAuth } from '@/context/AuthContext';
import { validateEmail } from '@/lib/validation';

// ─── Password strength ────────────────────────────────────────────────────────

interface FormErrors {
  email?: string;
  password?: string;
}

function validateForm(email: string, password: string): FormErrors {
  const errors: FormErrors = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  return errors;
}

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function LoginForm() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [rememberMe,   setRememberMe]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors,       setErrors]       = useState<FormErrors>({});
  const [isLoading,    setIsLoading]    = useState(false);
  const [serverError,  setServerError]  = useState('');
  const [needsVerify,  setNeedsVerify]  = useState(false);

  const redirectTo = searchParams.get('redirect') || '/';
  const expiredReason = searchParams.get('reason');

  // Surface a "session expired" banner if redirected from a 401 refresh failure
  // or an MFA-expired 403 from an admin route
  useEffect(() => {
    if (expiredReason === 'expired') {
      setServerError('Your session has expired. Please sign in again to continue.');
    } else if (expiredReason === 'mfa_expired') {
      setServerError('Your MFA verification has expired. Please sign in again to re-verify.');
    }
  }, [expiredReason]);

  // Already logged in — redirect immediately
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, authLoading, router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    setNeedsVerify(false);

    const fieldErrors = validateForm(email, password);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setIsLoading(true);
    const result = await login(email, password, rememberMe);
    setIsLoading(false);

    if (result.success) {
      router.push(redirectTo);
    } else if (result.mfaRequired && result.pendingMfaToken) {
      // Store the pending MFA token so the challenge page can read it,
      // then redirect to the MFA challenge screen.
      const store = rememberMe ? localStorage : sessionStorage;
      store.setItem('dh_pending_mfa', result.pendingMfaToken);
      router.push(`/login/mfa-challenge?remember=${rememberMe ? '1' : '0'}`);
    } else if (result.requiresEmailVerification) {
      setNeedsVerify(true);
      setServerError(result.error || 'Please verify your email before logging in.');
    } else {
      setServerError(result.error || 'Login failed. Please try again.');
    }
  };

  const inputBase =
    'w-full px-4 py-3 rounded-lg border-2 outline-none transition-all placeholder:text-gray-400 text-sm';
  const inputOk  = `${inputBase} border-gray-200 focus:border-[#b20202]`;
  const inputErr = `${inputBase} border-red-300 focus:border-red-500 bg-red-50/30`;

  return (
    <>
      {/* Hero breadcrumb */}
      <div className="bg-white border-b border-gray-100 py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-black text-gray-900 mb-1">Sign In</h1>
          <p className="text-sm text-gray-500">
            <Link href="/" className="hover:text-[#b20202] transition-colors">Home</Link>
            <span className="mx-1.5 text-gray-300">/</span>
            Login
          </p>
        </div>
      </div>

      <div className="min-h-[70vh] bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">

          {/* ── Login form ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            {/* Brand stripe */}
            <div className="h-1 bg-gradient-to-r from-[#b20202] via-[#ff3232] to-[#b20202] rounded-full mb-7 -mx-8 mt-[-32px] rounded-t-2xl" />

            <h2 className="text-xl font-black text-gray-900 mb-6">Welcome back</h2>

            {/* Server error */}
            {serverError && (
              <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                <Icon.PiWarningCircleFill size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm text-red-700">
                  {serverError}
                  {needsVerify && (
                    <Link
                      href={`/verify-email?email=${encodeURIComponent(email)}`}
                      className="block mt-1 font-semibold underline hover:text-red-900"
                    >
                      Resend verification email →
                    </Link>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                  placeholder="you@example.com"
                  className={errors.email ? inputErr : inputOk}
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-xs text-[#b20202] hover:underline font-medium">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                    placeholder="Enter your password"
                    className={`${errors.password ? inputErr : inputOk} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <Icon.PiEyeSlash size={19} /> : <Icon.PiEye size={19} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-[#b20202] cursor-pointer"
                />
                <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer select-none">
                  Keep me signed in for 7 days
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 bg-gradient-to-br from-[#b20202] to-[#8b0000] text-white font-bold rounded-xl hover:from-[#8b0000] hover:to-[#6b0000] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <Icon.PiSignIn size={18} />
                    Sign In
                  </>
                )}
              </button>

              <p className="text-center text-sm text-gray-500">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="font-semibold text-[#b20202] hover:underline">
                  Create one free
                </Link>
              </p>
            </form>
          </div>

          {/* ── New customer panel ── */}
          <div className="flex flex-col justify-center">
            <div className="bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 rounded-2xl p-8 text-white">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-5">
                <Icon.PiWineBold size={24} />
              </div>
              <h2 className="text-xl font-black mb-3">New to DrinksHarbour?</h2>
              <p className="text-red-100 text-sm leading-relaxed mb-6">
                Join thousands of Nigerians who shop premium wines, spirits, and beers
                with fast, nationwide delivery.
              </p>
              <ul className="space-y-2.5 mb-7">
                {[
                  '10% off your first order',
                  'Access to exclusive products',
                  'Early access to flash sales',
                  'VIP membership rewards',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-red-100">
                    <Icon.PiCheckCircleFill size={16} className="text-green-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-white text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-red-50 transition-colors text-sm"
              >
                Create Free Account
                <Icon.PiArrowRight size={16} />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Page (Suspense wrapper required for useSearchParams) ─────────────────────

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#b20202] rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
