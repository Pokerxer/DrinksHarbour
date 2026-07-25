'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiArrowRightBold,
  PiArrowLeftBold,
  PiWarningCircle,
  PiEnvelopeSimpleDuotone,
  PiCheckCircleDuotone,
} from 'react-icons/pi';
import { Button, Text } from 'rizzui';
import { Form } from '@core/ui/form';
import { routes } from '@/config/routes';
import {
  forgotPasswordSchema,
  ForgotPasswordSchema,
} from '@/validators/forgot-password.schema';
import { SubmitHandler } from 'react-hook-form';

interface TenantInfo {
  name: string;
  primaryColor?: string;
}

const BRAND_RED = '#b20202';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const initialValues: ForgotPasswordSchema = {
  email: '',
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

export default function ForgetPasswordForm({
  tenant,
}: {
  tenant?: TenantInfo | null;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const accent = tenant?.primaryColor || BRAND_RED;

  const onSubmit: SubmitHandler<ForgotPasswordSchema> = async (data) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      // The endpoint always responds success-ish so we never leak whether an
      // account exists. Only network/5xx failures should surface an error.
      if (!res.ok && res.status >= 500) {
        throw new Error('server');
      }

      setSentTo(data.email);
    } catch {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setError(
        "We couldn't send the reset link right now. Please try again in a moment."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const inputBase =
    'w-full rounded-xl border bg-white px-4 py-3.5 text-gray-900 transition-colors duration-150 placeholder:text-gray-400 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  // ── Success / confirmation state ──────────────────────────────────────────
  if (sentTo) {
    return (
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        style={{ '--accent': accent } as React.CSSProperties}
      >
        <motion.div variants={item} className="mb-6 flex justify-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: `${accent}14` }}
          >
            <PiCheckCircleDuotone
              className="h-9 w-9"
              style={{ color: accent }}
            />
          </span>
        </motion.div>
        <motion.h2
          variants={item}
          className="text-center text-2xl font-bold tracking-tight text-gray-900"
        >
          Check your inbox
        </motion.h2>
        <motion.p
          variants={item}
          className="mt-2 text-center text-sm leading-relaxed text-gray-500"
        >
          If an account exists for{' '}
          <span className="font-semibold text-gray-700">{sentTo}</span>, we've
          sent reset instructions. The link expires in one hour.
        </motion.p>

        <motion.div variants={item} className="mt-8 space-y-3">
          <Button
            type="button"
            onClick={() => {
              setSentTo(null);
              setError(null);
            }}
            variant="outline"
            className="h-12 w-full rounded-xl text-base font-semibold"
          >
            Use a different email
          </Button>
          <Link
            href={routes.signIn}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white transition-transform active:scale-[0.99]"
            style={{ backgroundColor: accent }}
          >
            Back to sign in
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  // ── Request form ──────────────────────────────────────────────────────────
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
          <PiEnvelopeSimpleDuotone
            className="h-6 w-6"
            style={{ color: accent }}
          />
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Reset your password
        </h2>
        <p className="mt-1.5 text-sm text-gray-500">
          Enter the email tied to your account and we'll send a reset link.
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

      <Form<ForgotPasswordSchema>
        validationSchema={forgotPasswordSchema}
        onSubmit={onSubmit}
        useFormProps={{ defaultValues: initialValues }}
      >
        {({ register, formState: { errors } }) => (
          <motion.div className="space-y-5" variants={container}>
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

            <motion.div variants={item}>
              <Button
                className="h-12 w-full rounded-xl text-base font-semibold text-white transition-transform active:scale-[0.99]"
                style={{ backgroundColor: accent }}
                type="submit"
                size="lg"
                isLoading={isLoading}
                disabled={isLoading}
              >
                <span>Send reset link</span>
                {!isLoading && <PiArrowRightBold className="ms-2 h-5 w-5" />}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </Form>

      <motion.div variants={item} className="mt-8 text-center">
        <Link
          href={routes.signIn}
          className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ color: accent }}
        >
          <PiArrowLeftBold className="h-4 w-4" />
          Back to sign in
        </Link>
      </motion.div>
    </motion.div>
  );
}
