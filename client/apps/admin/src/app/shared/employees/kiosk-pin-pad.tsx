'use client';

// The PIN pad for the attendance kiosk — the fallback when badge scanning
// isn't used. One person at a time, on a wall-mounted screen: big targets,
// one action (the server decides in vs out), and no information about who
// works here or whether a PIN exists.

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { PiBackspace, PiCheckBold } from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import {
  pinSlots,
  isPinReady,
  pressBackspace,
  pressDigit,
} from './attendance-utils';

interface KioskPinPadProps {
  entry: string;
  busy: boolean;
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  onSwitchToBadge: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function KioskPinPad({
  entry,
  busy,
  onDigit,
  onBackspace,
  onSubmit,
  onSwitchToBadge,
}: KioskPinPadProps) {
  const handleDigit = useCallback((d: string) => onDigit(d), [onDigit]);
  const handleBackspace = useCallback(() => onBackspace(), [onBackspace]);
  const handleSubmit = useCallback(() => onSubmit(), [onSubmit]);
  const handleSwitchToBadge = useCallback(
    () => onSwitchToBadge(),
    [onSwitchToBadge]
  );

  const keyClasses =
    'h-[64px] rounded-2xl border border-white/10 bg-white/[0.04] text-2xl font-semibold tabular-nums text-white/90 backdrop-blur-sm transition-all duration-150 hover:bg-white/[0.08] hover:border-white/20 active:scale-95';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <p
        className={`${fraunces.className} text-center text-sm font-semibold text-white/60 mb-2`}
      >
        Enter your PIN
      </p>

      <div className="flex justify-center gap-3 mb-6">
        {pinSlots(entry).map((filled, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full transition-all duration-200 ${
              filled
                ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)] scale-110'
                : 'border-2 border-white/20'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => handleDigit(k)}
            className={keyClasses}
          >
            {k}
          </button>
        ))}

        <button
          type="button"
          onClick={() => handleBackspace()}
          aria-label="Delete last digit"
          className={`${keyClasses} flex items-center justify-center`}
        >
          <PiBackspace className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className={keyClasses}
        >
          0
        </button>

        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={!isPinReady(entry) || busy}
          aria-label="Clock in or out"
          className="flex h-[64px] items-center justify-center rounded-2xl text-white shadow-sm transition-all duration-150 disabled:bg-white/[0.04] disabled:text-white/20 disabled:cursor-not-allowed enabled:bg-[#b20202] enabled:hover:bg-[#8f0202] enabled:active:scale-95"
        >
          {busy ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <PiCheckBold className="h-6 w-6" />
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={() => handleSwitchToBadge()}
        className="mt-6 mx-auto block text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
      >
        Use badge instead
      </button>
    </motion.div>
  );
}
