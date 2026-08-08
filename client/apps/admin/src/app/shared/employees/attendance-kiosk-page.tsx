'use client';

// The clock kiosk — `/employees/attendance/kiosk`.
//
// This screen is mounted on a wall in a shop, so it is built for one hand, at
// arm's length, by somebody in a hurry. Big targets, one action, no chrome.
//
// TWO THINGS IT DELIBERATELY DOES NOT DO
// --------------------------------------
// 1. It shows NO employee list, ever. A pad that names the staff is a directory
//    of who works here, mounted where anyone walking past can read it — and it
//    would turn a PIN into the only remaining secret rather than one of two.
// 2. It never tells you whether a PIN exists. The API answers a bad code with
//    one generic 401 and this page repeats it verbatim; anything more specific
//    ("no such PIN", "that account is suspended") makes the pad an oracle.
//
// There is one button because there is one action: the server reads the
// employee's open record and decides whether this press is an in or an out.
// A pad with separate In and Out buttons has to guess before it knows who is
// standing at it, and gets it wrong for the person who forgot to clock out.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  PiArrowUUpLeft,
  PiBackspace,
  PiCheckBold,
  PiFingerprintDuotone,
  PiSignInDuotone,
  PiSignOutDuotone,
  PiWarningCircle,
} from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import {
  PIN_MAX_LENGTH,
  describeClock,
  isPinReady,
  pinSlots,
  pressBackspace,
  pressDigit,
  type ClockConfirmation,
} from './attendance-utils';
import { attendanceService } from '@/services/attendance.service';
import { routes } from '@/config/routes';

/** How long the confirmation stays up before the pad resets for the next person. */
const RESET_AFTER_MS = 4000;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function AttendanceKioskPage() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<ClockConfirmation | null>(
    null
  );
  const [now, setNow] = useState<string>('');

  // A ref, not state: the timer has to be cleared by whichever press comes
  // next, and a stale one would blank a confirmation the moment it appeared.
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const clearLater = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setConfirmation(null);
      setError('');
    }, RESET_AFTER_MS);
  }, []);

  const submit = useCallback(async () => {
    if (busy || !isPinReady(entry)) return;
    setBusy(true);
    setError('');
    setConfirmation(null);
    try {
      const result = await attendanceService.clock(entry, token);
      setConfirmation(describeClock(result));
      clearLater();
    } catch (err) {
      // Repeated verbatim. The API says "Invalid PIN" for every failure on
      // purpose, and dressing it up here would undo that.
      setError(err instanceof Error ? err.message : 'Could not read that PIN');
      clearLater();
    } finally {
      // Always cleared, so a network failure cannot leave the pad frozen for
      // the whole shift with nobody able to reach the person who owns it.
      setEntry('');
      setBusy(false);
    }
  }, [busy, entry, token, clearLater]);

  const press = useCallback((digit: string) => {
    setConfirmation(null);
    setError('');
    setEntry((e) => pressDigit(e, digit, PIN_MAX_LENGTH));
  }, []);

  // A USB numpad is the cheapest possible kiosk input, so the physical keys
  // work exactly like the on-screen ones.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setEntry(pressBackspace);
      else if (e.key === 'Enter') void submit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, submit]);

  const slots = pinSlots(entry);
  const ready = isPinReady(entry);

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b20202] text-white [&>svg]:h-7 [&>svg]:w-7">
            <PiFingerprintDuotone />
          </span>
          <h1
            className={`${fraunces.className} text-3xl font-black text-gray-900`}
          >
            Clock in
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your PIN
            {now && (
              <span className="ml-1 tabular-nums text-gray-400">· {now}</span>
            )}
          </p>
        </div>

        {/* Result — one person, the one at the screen. Never a list. */}
        <div className="mb-5 min-h-[84px]">
          <AnimatePresence mode="wait">
            {confirmation && (
              <motion.div
                key="ok"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-start gap-3 rounded-2xl border p-4 ${
                  confirmation.tone === 'in'
                    ? 'border-green-200 bg-green-50'
                    : 'border-sky-200 bg-sky-50'
                }`}
              >
                <span
                  className={`mt-0.5 [&>svg]:h-6 [&>svg]:w-6 ${
                    confirmation.tone === 'in'
                      ? 'text-green-700'
                      : 'text-sky-700'
                  }`}
                >
                  {confirmation.tone === 'in' ? (
                    <PiSignInDuotone />
                  ) : (
                    <PiSignOutDuotone />
                  )}
                </span>
                <div>
                  <p
                    className={`text-base font-bold ${
                      confirmation.tone === 'in'
                        ? 'text-green-900'
                        : 'text-sky-900'
                    }`}
                  >
                    {confirmation.headline}
                  </p>
                  <p
                    className={`mt-0.5 text-sm ${
                      confirmation.tone === 'in'
                        ? 'text-green-800'
                        : 'text-sky-800'
                    }`}
                  >
                    {confirmation.detail}
                  </p>
                </div>
              </motion.div>
            )}

            {error && !confirmation && (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <PiWarningCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
                <div>
                  <p className="text-base font-bold text-amber-900">{error}</p>
                  <p className="mt-0.5 text-sm text-amber-800">
                    Try again, or ask a manager to check your PIN.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Entry */}
        <div
          className="mb-6 flex items-center justify-center gap-3"
          aria-label="PIN entry"
        >
          {slots.map((filled, i) => (
            <span
              key={i}
              className={`h-4 w-4 rounded-full transition-colors ${
                filled ? 'bg-[#b20202]' : 'border-2 border-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Pad */}
        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className="h-[68px] rounded-2xl border border-gray-200 bg-white text-2xl font-semibold tabular-nums text-gray-900 shadow-sm transition-colors active:bg-gray-100"
            >
              {k}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setEntry(pressBackspace)}
            aria-label="Delete last digit"
            className="flex h-[68px] items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors active:bg-gray-100"
          >
            <PiBackspace className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={() => press('0')}
            className="h-[68px] rounded-2xl border border-gray-200 bg-white text-2xl font-semibold tabular-nums text-gray-900 shadow-sm transition-colors active:bg-gray-100"
          >
            0
          </button>

          {/* One button, because there is one action. The server decides which. */}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!ready || busy}
            aria-label="Clock in or out"
            className="flex h-[68px] items-center justify-center rounded-2xl bg-[#b20202] text-white shadow-sm transition-colors active:bg-[#8f0202] disabled:bg-gray-200 disabled:text-gray-400"
          >
            {busy ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <PiCheckBold className="h-6 w-6" />
            )}
          </button>
        </div>

        <div className="mt-8 text-center">
          <Link
            href={routes.employees.attendance}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 transition-colors hover:text-gray-700"
          >
            <PiArrowUUpLeft className="h-3.5 w-3.5" />
            Back to the attendance log
          </Link>
        </div>
      </div>
    </div>
  );
}
