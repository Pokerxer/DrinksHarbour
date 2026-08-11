'use client';

// Full-screen animated overlay for the attendance kiosk. After a badge scan or
// PIN punch it answers with a greeting for a clock-in, a farewell for a
// clock-out, or a soft error — one person at a time, on a wall-mounted screen.

import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  PiSignInDuotone,
  PiSignOutDuotone,
  PiWarningCircle,
} from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import type { ClockConfirmation } from './attendance-utils';

interface ToneConfig {
  tone: 'in' | 'out' | 'error';
  /** Radial gradient colour for the backdrop glow. */
  glow: string;
  /** Ring border on the icon circle. */
  iconBg: string;
  iconColor: string;
  icon: ReactNode;
  titleClass: string;
  detailClass: string;
}

/** One visual treatment per outcome — the only place a tone becomes styling. */
const TONES: Record<ToneConfig['tone'], ToneConfig> = {
  in: {
    tone: 'in',
    glow: 'rgba(16,185,129,0.4)',
    iconBg: 'border-green-400/60',
    iconColor: 'text-green-300',
    icon: <PiSignInDuotone />,
    titleClass: 'text-green-300',
    detailClass: 'text-green-200/80',
  },
  out: {
    tone: 'out',
    glow: 'rgba(56,189,248,0.4)',
    iconBg: 'border-sky-400/60',
    iconColor: 'text-sky-300',
    icon: <PiSignOutDuotone />,
    titleClass: 'text-sky-300',
    detailClass: 'text-sky-200/80',
  },
  error: {
    tone: 'error',
    glow: 'rgba(251,191,36,0.3)',
    iconBg: 'border-amber-400/60',
    iconColor: 'text-amber-300',
    icon: <PiWarningCircle />,
    titleClass: 'text-amber-300',
    detailClass: 'text-amber-200/80',
  },
};

interface KioskConfirmProps {
  confirmation: ClockConfirmation | null;
  error: string;
  busy: boolean;
}

export default function KioskConfirmation({
  confirmation,
  error,
  busy,
}: KioskConfirmProps) {
  const tone = confirmation ? TONES[confirmation.tone] : null;

  return (
    <div className='absolute inset-0 z-50 flex items-center justify-center overflow-hidden'>
      <div className='absolute inset-0 bg-[#0b0d12]/90 backdrop-blur-sm' />

      <AnimatePresence mode='wait'>
        {busy && (
          <motion.div
            key='reading'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='flex flex-col items-center'
          >
            <span className='h-20 w-20 animate-spin rounded-full border-[3px] border-white/10 border-t-[#b20202]' />
            <p className='mt-5 text-base font-medium text-white/60'>
              Reading your badge…
            </p>
          </motion.div>
        )}

        {!busy && tone && confirmation && (
          <motion.div
            key='confirm'
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className='relative flex flex-col items-center'
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className='absolute h-64 w-64 rounded-full opacity-60 blur-3xl'
              style={{ background: tone.glow }}
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 15,
                delay: 0.15,
              }}
              className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-2 bg-white/[0.08] backdrop-blur-sm ${tone.iconBg}`}
            >
              <span className={`${tone.iconColor} [&>svg]:h-10 [&>svg]:w-10`}>
                {tone.icon}
              </span>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={`z-10 mt-7 px-6 text-center ${fraunces.className} text-4xl font-black leading-tight sm:text-5xl ${tone.titleClass}`}
            >
              {confirmation.headline}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className={`z-10 mt-3 max-w-md px-6 text-center text-lg leading-relaxed sm:text-xl ${tone.detailClass}`}
            >
              {confirmation.detail}
            </motion.p>
          </motion.div>
        )}

        {!busy && !confirmation && error && (
          <motion.div
            key='error'
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className='rounded-2xl border border-amber-400/20 bg-amber-500/10 p-6 backdrop-blur-sm'
          >
            <PiWarningCircle className='mx-auto h-14 w-14 text-amber-400' />
            <p className='mt-4 max-w-md text-center text-2xl font-bold text-amber-300'>
              {error}
            </p>
            <p className='mt-2 text-center text-base text-amber-200/60'>
              Please try again.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
