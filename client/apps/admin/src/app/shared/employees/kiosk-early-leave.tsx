'use client';

// "Your shift is not over — clock out anyway?"
//
// Shown when the server refuses a clock-out with `leaving_early`. It is a
// QUESTION, not a refusal, and the visual weight says so: the confirm button is
// the plain one and Stay is the emphasised one, but both are full-size and
// neither is hidden. The employee may genuinely be going — ill, sent home, shift
// cut short — and the only outcome worse than an early clock-out is no clock-out
// at all, which leaves a record open for somebody to invent an end time for.
//
// Sized for a wall: this is read at arm's length by somebody holding a badge, so
// the buttons are thumb-targets and the sentence is one line of large type
// rather than a paragraph.

import { motion } from 'framer-motion';
import { PiClockCountdownDuotone } from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import type { EarlyLeavePrompt } from './attendance-utils';

export default function KioskEarlyLeave({
  prompt,
  busy,
  onConfirm,
  onCancel,
}: {
  prompt: EarlyLeavePrompt;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden px-6">
      <div className="absolute inset-0 bg-[#0b0d12]/95 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="relative z-10 flex w-full max-w-lg flex-col items-center text-center"
      >
        <div
          className="absolute h-72 w-72 rounded-full opacity-50 blur-3xl"
          style={{ background: 'rgba(251,191,36,0.35)' }}
        />

        <span className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-2 border-amber-400/60 bg-white/[0.08] text-amber-300 backdrop-blur-sm [&>svg]:h-11 [&>svg]:w-11">
          <PiClockCountdownDuotone />
        </span>

        <h2
          className={`relative z-10 mt-7 ${fraunces.className} text-3xl font-black leading-tight text-amber-200 sm:text-4xl`}
        >
          {prompt.headline}
        </h2>

        <p className="relative z-10 mt-3 text-lg leading-relaxed text-amber-100/80 sm:text-xl">
          {prompt.detail}
        </p>

        <p className="relative z-10 mt-6 text-base font-semibold text-white/70">
          {prompt.question}
        </p>

        <div className="relative z-10 mt-8 grid w-full grid-cols-2 gap-4">
          {/* Staying is the emphasised choice, and it is FIRST — on a screen
              where somebody is tapping quickly, the accidental press should be
              the harmless one. */}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-2xl bg-white px-6 py-5 text-lg font-bold text-[#0b0d12] transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            Stay clocked in
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-2xl border border-amber-400/50 bg-amber-500/10 px-6 py-5 text-lg font-bold text-amber-200 transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            {busy ? 'Clocking out…' : 'Clock out anyway'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
