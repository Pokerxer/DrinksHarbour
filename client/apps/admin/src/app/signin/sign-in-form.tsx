'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiArrowRightBold,
  PiEye,
  PiEyeSlash,
  PiWarningCircle,
  PiShieldCheckDuotone,
} from 'react-icons/pi';
import { Button, Text } from 'rizzui';
import { Form } from '@core/ui/form';
import { routes } from '@/config/routes';
import { loginSchema, LoginSchema } from '@/validators/login.schema';
import toast from 'react-hot-toast';
import { SubmitHandler } from 'react-hook-form';

interface TenantInfo {
  name: string;
  slug?: string;
  logo?: { url: string; alt?: string };
  primaryColor?: string;
  plan?: string;
  contactEmail?: string;
}

const BRAND_RED = '#b20202';

const initialValues: LoginSchema = {
  email: '',
  password: '',
  rememberMe: false,
};

// Restrained, intentional motion: one staggered entrance, nothing perpetual.
const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 260, damping: 26 },
  },
};

export default function SignInForm({ tenant }: { tenant?: TenantInfo | null }) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [reset, setReset] = useState({});
  const accent = tenant?.primaryColor || BRAND_RED;
  const isDev = process.env.NODE_ENV === 'development';

  const onSubmit: SubmitHandler<LoginSchema> = async (data) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        // Passed through to `authorize`; controls the JWT session lifetime.
        rememberMe: data.rememberMe ? 'true' : 'false',
        redirect: false,
        // Must be an absolute URL — new URL('/relative') throws in some browsers
        callbackUrl:
          typeof window !== 'undefined'
            ? `${window.location.origin}${routes.dashboard}`
            : routes.dashboard,
      });

      if (result?.error) {
        setIsLoading(false);
        setShake(true);
        setTimeout(() => setShake(false), 400);

        if (result.error === 'CredentialsSignin') {
          setAuthError(
            'Invalid email or password. Please check your credentials and try again.'
          );
        } else if (result.error.includes('locked')) {
          setAuthError(
            'Your account has been temporarily locked due to multiple failed attempts. Please try again later.'
          );
        } else if (result.error.includes('suspended')) {
          setAuthError(
            'Your account has been suspended. Please contact support.'
          );
        } else if (result.error.includes('inactive')) {
          setAuthError(
            'Your account is inactive. Please contact support to reactivate.'
          );
        } else {
          setAuthError(
            result.error || 'Authentication failed. Please try again.'
          );
        }
      } else if (result?.ok) {
        toast.success('Welcome back!');
        // Hard redirect ensures the session cookie is picked up correctly
        // by the middleware on the next full request
        window.location.href = routes.dashboard;
      }
    } catch (error) {
      setIsLoading(false);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setAuthError('An unexpected error occurred. Please try again.');
      console.error('Sign in error:', error);
    }
  };

  const inputBase =
    'w-full rounded-xl border bg-white px-4 py-3.5 text-gray-900 transition-colors duration-150 placeholder:text-gray-400 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      style={{ '--accent': accent } as React.CSSProperties}
    >
      {/* Heading */}
      <motion.div variants={item} className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          {tenant ? `Welcome to ${tenant.name}` : 'Welcome back'}
        </h2>
        <p className="mt-1.5 text-sm text-gray-500">
          {tenant
            ? `Sign in to manage ${tenant.name}.`
            : 'Sign in to access your admin dashboard.'}
        </p>
      </motion.div>

      {/* Error Alert */}
      <AnimatePresence>
        {authError && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-5 overflow-hidden"
          >
            <motion.div
              animate={shake ? { x: [-5, 5, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
            >
              <PiWarningCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  Authentication error
                </p>
                <p className="mt-0.5 text-sm text-red-600">{authError}</p>
              </div>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                className="text-red-400 transition-colors hover:text-red-600"
              >
                <span className="sr-only">Dismiss</span>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Form<LoginSchema>
        validationSchema={loginSchema}
        resetValues={reset}
        onSubmit={onSubmit}
        useFormProps={{ defaultValues: initialValues }}
      >
        {({ register, formState: { errors } }) => (
          <motion.div className="space-y-5" variants={container}>
            {/* Email */}
            <motion.div variants={item} className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                className={`${inputBase} ${
                  errors.email
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                {...register('email')}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <PiWarningCircle className="h-4 w-4" />
                  {errors.email.message}
                </p>
              )}
            </motion.div>

            {/* Password */}
            <motion.div variants={item} className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={`${inputBase} pr-11 ${
                    errors.password
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  {...register('password')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <PiEyeSlash className="h-5 w-5" />
                  ) : (
                    <PiEye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <PiWarningCircle className="h-4 w-4" />
                  {errors.password.message}
                </p>
              )}
            </motion.div>

            {/* Remember + forgot */}
            <motion.div
              variants={item}
              className="flex items-center justify-between"
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  {...register('rememberMe')}
                  disabled={isLoading}
                />
                <span className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-gray-300 transition-colors peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] peer-checked:[&>svg]:opacity-100">
                  <svg
                    className="h-3 w-3 text-white opacity-0 transition-opacity"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </span>
                <span className="text-sm font-medium text-gray-600">
                  Remember me
                </span>
              </label>
              <Link
                href={routes.auth.forgotPassword1}
                className="text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: accent }}
              >
                Forgot password?
              </Link>
            </motion.div>

            {/* Submit */}
            <motion.div variants={item}>
              <Button
                className="h-12 w-full rounded-xl text-base font-semibold text-white transition-transform active:scale-[0.99]"
                style={{ backgroundColor: accent }}
                type="submit"
                size="lg"
                isLoading={isLoading}
                disabled={isLoading}
              >
                <span>{tenant ? `Sign in to ${tenant.name}` : 'Sign in'}</span>
                {!isLoading && <PiArrowRightBold className="ms-2 h-5 w-5" />}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </Form>

      {/* Security notice */}
      <motion.div
        variants={item}
        className="mt-6 flex items-start gap-3 rounded-xl border p-4"
        style={{ background: `${accent}0a`, borderColor: `${accent}26` }}
      >
        <PiShieldCheckDuotone
          className="mt-0.5 h-5 w-5 flex-shrink-0"
          style={{ color: accent }}
        />
        <p className="text-sm text-gray-600">
          {tenant
            ? `Secure access to ${tenant.name}. Only authorized accounts can sign in.`
            : 'Secure area. Only authorized administrators can access this dashboard.'}
        </p>
      </motion.div>

      {/* Footer */}
      <motion.div
        variants={item}
        className="mt-6 border-t border-gray-100 pt-6"
      >
        <Text className="text-center text-sm text-gray-500">
          Need help?{' '}
          <Link
            href={`mailto:${tenant?.contactEmail || 'support@drinksharbour.com'}`}
            className="font-semibold transition-opacity hover:opacity-80"
            style={{ color: accent }}
          >
            Contact support
          </Link>
        </Text>
      </motion.div>

      {/* Demo credentials — development only, platform login only */}
      {isDev && !tenant && (
        <motion.div
          variants={item}
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3"
        >
          <p className="text-center text-xs text-amber-800">
            <strong>Dev only:</strong> testadmin@drinksharbour.com / Admin@123!
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
