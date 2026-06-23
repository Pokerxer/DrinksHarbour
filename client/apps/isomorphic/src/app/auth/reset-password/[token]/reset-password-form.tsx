'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiArrowRightBold,
  PiEye,
  PiEyeSlash,
  PiWarningCircle,
  PiLockKeyDuotone,
} from 'react-icons/pi';
import { Button } from 'rizzui';
import { Form } from '@core/ui/form';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  resetPasswordTokenSchema,
  ResetPasswordTokenSchema,
} from '@/validators/reset-password-token.schema';
import { SubmitHandler } from 'react-hook-form';

interface TenantInfo {
  name: string;
  primaryColor?: string;
}

const BRAND_RED = '#b20202';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const initialValues: ResetPasswordTokenSchema = {
  newPassword: '',
  confirmPassword: '',
};

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

export default function ResetPasswordForm({
  token,
  tenant,
}: {
  token: string;
  tenant?: TenantInfo | null;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [shake, setShake] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const accent = tenant?.primaryColor || BRAND_RED;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const onSubmit: SubmitHandler<ResetPasswordTokenSchema> = async (data) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/api/users/reset-password/${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword: data.newPassword }),
        }
      );

      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;

      if (res.ok && json?.success) {
        toast.success('Your password has been reset. Please sign in.');
        router.push(routes.signIn);
        return;
      }

      const message = json?.message || 'Unable to reset your password.';
      // An invalid/expired token is the one case where retrying the form is
      // pointless — steer the user back to request a fresh link.
      if (/invalid|expired/i.test(message)) {
        setTokenInvalid(true);
      } else {
        setError(message);
        triggerShake();
      }
    } catch {
      setError(
        "We couldn't reach the server. Please check your connection and try again."
      );
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const inputBase =
    'w-full rounded-xl border bg-white px-4 py-3.5 text-gray-900 transition-colors duration-150 placeholder:text-gray-400 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  // ── Invalid / expired token state ─────────────────────────────────────────
  if (tokenInvalid) {
    return (
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        style={{ '--accent': accent } as React.CSSProperties}
      >
        <motion.div variants={item} className="mb-6 flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <PiWarningCircle className="h-9 w-9 text-red-500" />
          </span>
        </motion.div>
        <motion.h2
          variants={item}
          className="text-center text-2xl font-bold tracking-tight text-gray-900"
        >
          This link has expired
        </motion.h2>
        <motion.p
          variants={item}
          className="mt-2 text-center text-sm leading-relaxed text-gray-500"
        >
          Reset links are valid for one hour. Request a new one and we'll email
          you a fresh link.
        </motion.p>
        <motion.div variants={item} className="mt-8">
          <Link
            href={routes.auth.forgotPassword1}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white transition-transform active:scale-[0.99]"
            style={{ backgroundColor: accent }}
          >
            Request a new link
            <PiArrowRightBold className="h-5 w-5" />
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  // ── Reset form ────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      style={{ '--accent': accent } as React.CSSProperties}
    >
      <motion.div variants={item} className="mb-8">
        <span
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: `${accent}14` }}
        >
          <PiLockKeyDuotone className="h-6 w-6" style={{ color: accent }} />
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Choose a new password
        </h2>
        <p className="mt-1.5 text-sm text-gray-500">
          Use at least 8 characters with a mix of upper &amp; lowercase letters,
          a number, and a symbol.
        </p>
      </motion.div>

      <AnimatePresence>
        {error && (
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
              <p className="text-sm text-red-700">{error}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Form<ResetPasswordTokenSchema>
        validationSchema={resetPasswordTokenSchema}
        onSubmit={onSubmit}
        useFormProps={{ mode: 'onChange', defaultValues: initialValues }}
      >
        {({ register, formState: { errors } }) => (
          <motion.div className="space-y-5" variants={container}>
            {/* New password */}
            <motion.div variants={item} className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                New password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Enter a new password"
                  autoComplete="new-password"
                  className={`${inputBase} pr-11 ${
                    errors.newPassword
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  {...register('newPassword')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? (
                    <PiEyeSlash className="h-5 w-5" />
                  ) : (
                    <PiEye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <PiWarningCircle className="h-4 w-4" />
                  {errors.newPassword.message}
                </p>
              )}
            </motion.div>

            {/* Confirm password */}
            <motion.div variants={item} className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  className={`${inputBase} pr-11 ${
                    errors.confirmPassword
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  {...register('confirmPassword')}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? (
                    <PiEyeSlash className="h-5 w-5" />
                  ) : (
                    <PiEye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <PiWarningCircle className="h-4 w-4" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </motion.div>

            <motion.div variants={item}>
              <Button
                className="h-12 w-full rounded-xl text-base font-semibold text-white transition-transform active:scale-[0.99]"
                style={{ backgroundColor: accent }}
                type="submit"
                size="lg"
                isLoading={isLoading}
                disabled={isLoading}
              >
                <span>Reset password</span>
                {!isLoading && <PiArrowRightBold className="ms-2 h-5 w-5" />}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </Form>

      <motion.div variants={item} className="mt-8 text-center">
        <Link
          href={routes.signIn}
          className="text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ color: accent }}
        >
          Back to sign in
        </Link>
      </motion.div>
    </motion.div>
  );
}
