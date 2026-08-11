'use client';

// The clock kiosk — `/employees/attendance/kiosk` when a manager is signed in,
// and `/kiosk/<token>` on a screen left on the counter that nobody logs in to.
//
// ONE COMPONENT, TWO CREDENTIALS. The public page passes a device token; the
// in-app page passes nothing and the session is used. resolveKioskAuth decides
// between them, and the URL wins over the session on purpose — see the rule
// there. A device-paired screen takes badge scans only, because a four-digit
// secret typed into an internet-facing endpoint is a different risk from a card
// somebody has to be holding.
//
// This screen is mounted on a wall in a shop, so it is built for one hand, at
// arm's length, by somebody in a hurry. Big targets, one action, no chrome.
//
// THE CREDENTIAL IS THE BADGE. Employees scan the QR on their badge card
// (the same QR `employee-badge.tsx` prints), the server decides whether the
// press is an in or an out, and the pad answers with the employee's name.
// Camera scanning is the default; a USB HID scanner is a keyboard and gets
// caught by a global key buffer while the camera is on; the PIN pad remains
// as the fallback for whoever left their card at home.
//
// TWO THINGS IT DELIBERATELY DOES NOT DO
// --------------------------------------
// 1. It shows NO employee list, ever. A pad that names the staff is a directory
//    of who works here, mounted where anyone walking past can read it.
// 2. It never discloses WHY a credential was refused. The API answers a bad
//    PIN with one generic 401 and this page repeats it verbatim; anything more
//    specific ("no such PIN", "that account is suspended") makes the pad an
//    oracle.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  PiArrowUUpLeft,
  PiFingerprintDuotone,
  PiUsersDuotone,
} from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import {
  describeClock,
  describeEarlyLeavePrompt,
  isPinReady,
  resolveKioskAuth,
  isValidBadgeScan,
  normaliseBadgeScan,
  pressBackspace,
  pressDigit,
  pushScanKey,
  shouldAcceptScan,
  PIN_MAX_LENGTH,
  type ClockConfirmation,
  type EarlyLeavePrompt,
  type LastScan,
  type ScanBuffer,
} from './attendance-utils';
import { localToday } from './shift-roster-utils';
import KioskScanView from './kiosk-scan-view';
import KioskPinPad from './kiosk-pin-pad';
import KioskConfirmation from './kiosk-confirmation';
import KioskEarlyLeave from './kiosk-early-leave';
import {
  attendanceService,
  AttendanceConflictError,
  LEAVING_EARLY,
} from '@/services/attendance.service';
import { useTenant } from '@/context/TenantContext';
import { routes } from '@/config/routes';

/** How long the confirmation stays up before the pad resets for the next person. */
const RESET_AFTER_MS = 4000;

/**
 * How long after the last keystroke a scan is submitted when the reader was
 * configured without a trailing Enter. Long enough to outlast the burst,
 * short enough that the employee is still standing there.
 */
const SCAN_IDLE_FLUSH_MS = 300;

/** Three surface modes — camera/keyboard for badge scans, pin for the numpad. */
type KioskMode = 'camera' | 'keyboard' | 'pin';

export default function AttendanceKioskPage({
  kioskToken,
}: {
  /** Present only on the public `/kiosk/<token>` page. */
  kioskToken?: string;
} = {}) {
  const { data: session } = useSession();
  const { tenant } = useTenant();
  const auth = resolveKioskAuth({
    kioskToken,
    sessionToken: (session?.user as { token?: string })?.token,
  });
  const { token } = auth;
  const isDevice = auth.mode === 'device';

  // The shop's own name. On the in-app page it comes from the tenant subdomain;
  // on a logged-out screen there is no session to read it from, so the device
  // token's own resolution endpoint brings it back — the same call that proves
  // the screen is still paired.
  const [shopName, setShopName] = useState(tenant?.name ?? '');
  const [unpaired, setUnpaired] = useState('');

  const [mode, setMode] = useState<KioskMode>('camera');
  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<ClockConfirmation | null>(
    null
  );
  /**
   * A clock-out the server is holding until the employee acknowledges it.
   *
   * `retry` re-sends the SAME credential with the acknowledgement attached
   * rather than re-reading the badge: the card is already back in a pocket by
   * the time the question is answered, and asking for a second scan would be a
   * different, worse question.
   */
  const [earlyLeave, setEarlyLeave] = useState<{
    prompt: EarlyLeavePrompt;
    retry: () => Promise<void>;
  } | null>(null);

  const [now, setNow] = useState('');
  const [onShift, setOnShift] = useState<number | null>(null);

  // A ref, not state: the timer has to be cleared by whichever press comes
  // next, and a stale one would blank a confirmation the moment it appeared.
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The scanner's idle flush gets its OWN timer. Sharing one ref with the
  // confirmation reset meant a single keystroke could cancel the reset, and
  // the previous employee's name then stayed on a wall-mounted screen until
  // somebody else punched.
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // HID scanner key buffer (camera mode only — see the keydown effect below).
  const scanBuffer = useRef<ScanBuffer>({ text: '', at: 0 });

  // The last code accepted, so a badge left against the lens is read once.
  const lastScan = useRef<LastScan | null>(null);

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
      if (flushTimer.current) clearTimeout(flushTimer.current);
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

  /**
   * How many people are currently clocked in — a count, never names.
   *
   * Two different calls for the same number, and that is deliberate. The
   * manager's page reads the attendance LOG, which carries every punch and the
   * people who made them. A device token must never reach that: it would put a
   * list of who works here on a screen anybody can walk up to. The kiosk
   * session endpoint answers with the count alone.
   */
  const refreshOnShift = useCallback(async () => {
    if (!token) return;
    try {
      if (isDevice) {
        const s = await attendanceService.kioskSession(token);
        setOnShift(s.onShift);
        setShopName(s.tenant.name);
        setUnpaired('');
      } else {
        const log = await attendanceService.log({ from: localToday() }, token);
        setOnShift(log.summary.open);
      }
    } catch (err) {
      setOnShift(null);
      // A revoked or mistyped pairing is not a transient failure — the screen
      // will never work again until somebody pairs it, so it says so instead of
      // waiting silently for scans it cannot post.
      if (isDevice) {
        setUnpaired(
          err instanceof Error ? err.message : 'This kiosk is not paired'
        );
      }
    }
  }, [token, isDevice]);

  useEffect(() => {
    if (token) void refreshOnShift();
  }, [token, refreshOnShift]);

  const punch = useCallback(
    async (
      call: (opts: {
        confirmEarlyLeave?: boolean;
      }) => Promise<import('@/services/attendance.service').ClockResponse>
    ) => {
      if (busy) return;
      setBusy(true);
      setError('');
      setConfirmation(null);
      try {
        const result = await call({});
        setConfirmation(describeClock(result));
        clearLater();
        void refreshOnShift();
      } catch (err) {
        // Leaving early is a QUESTION, not a failure. The server withheld the
        // write and told us what it wants acknowledged, so the pad asks instead
        // of showing a refusal the employee cannot act on. No reset timer is
        // started: this one waits for an answer rather than clearing itself
        // while somebody is reading it.
        if (
          err instanceof AttendanceConflictError &&
          err.code === LEAVING_EARLY &&
          err.details
        ) {
          const details = err.details;
          setEarlyLeave({
            prompt: describeEarlyLeavePrompt(details),
            retry: async () => {
              setBusy(true);
              try {
                const result = await call({ confirmEarlyLeave: true });
                setEarlyLeave(null);
                setConfirmation(describeClock(result));
                clearLater();
                void refreshOnShift();
              } catch (retryErr) {
                setEarlyLeave(null);
                setError(
                  retryErr instanceof Error
                    ? retryErr.message
                    : 'Could not clock you out'
                );
                clearLater();
              } finally {
                setBusy(false);
              }
            },
          });
          return;
        }

        // Repeated verbatim. The API says one generic thing per credential on
        // purpose, and dressing it up here would undo that.
        setError(
          err instanceof Error ? err.message : 'Could not read that code'
        );
        clearLater();
      } finally {
        setBusy(false);
      }
    },
    [busy, clearLater, refreshOnShift]
  );

  const submitBadge = useCallback(
    (raw: string) => {
      // A question is on the screen and the camera is still running. Scans are
      // dropped until it is answered — otherwise the card still in somebody's
      // hand punches again behind the dialog they are reading.
      if (earlyLeave) return;

      const code = normaliseBadgeScan(raw);
      if (!isValidBadgeScan(code)) {
        // A garbage read (blurry QR, hand over the lens) gets a soft refusal,
        // not a trip to the rate-limited endpoint.
        setError('Could not read that badge — try again.');
        clearLater();
        return;
      }

      // The camera decodes the card in front of it about ten times a second.
      // Ignored SILENTLY, not refused: the employee has done nothing wrong and
      // their confirmation is still on the screen, so an error here would
      // replace "Welcome, Alice" with a complaint while she lowers her hand.
      const at = Date.now();
      if (!shouldAcceptScan(code, lastScan.current, at)) return;
      lastScan.current = { code, at };

      void punch((opts) =>
        isDevice
          ? attendanceService.clockWithKioskBadge(code, token, opts)
          : attendanceService.clockWithBadge(code, token, opts)
      );
    },
    [punch, token, isDevice, clearLater, earlyLeave]
  );

  const submitPin = useCallback(() => {
    // Unreachable on a device-paired screen: the pad is never mounted and the
    // server would refuse it anyway. Guarded here too so a stray key event
    // cannot post a PIN the endpoint will only reject.
    if (!auth.pinOffered) return;
    if (!isPinReady(entry)) return;
    const pin = entry;
    setEntry('');
    void punch(() => attendanceService.clock(pin, token));
  }, [entry, punch, token, auth.pinOffered]);

  // A USB numpad works like the on-screen keys, but only while the PIN pad is
  // showing — digit presses must not also feed the badge buffer.
  useEffect(() => {
    if (mode !== 'pin') return;
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key))
        setEntry((s) => pressDigit(s, e.key, PIN_MAX_LENGTH));
      else if (e.key === 'Backspace') setEntry(pressBackspace);
      else if (e.key === 'Enter') submitPin();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, submitPin]);

  // HID scanner catch-all: while the camera is scanning, a USB reader's
  // keystrokes accumulate in a burst buffer and submit on Enter (or on a
  // pause, for readers configured to skip the Enter). The folding rule lives
  // in pushScanKey so it can be tested — notably that Shift, which a reader
  // sends before every capital, does not end the burst.
  useEffect(() => {
    if (mode !== 'camera') return;
    function onKey(e: KeyboardEvent) {
      if (busy || earlyLeave) return;
      if (e.key === 'Enter') e.preventDefault();

      const { buffer, submit } = pushScanKey(
        scanBuffer.current,
        e.key,
        Date.now()
      );
      scanBuffer.current = buffer;

      if (flushTimer.current) clearTimeout(flushTimer.current);

      if (submit) {
        submitBadge(submit);
        return;
      }

      // Readers configured without a trailing Enter: flush once it goes quiet.
      if (buffer.text) {
        flushTimer.current = setTimeout(() => {
          const code = scanBuffer.current.text;
          scanBuffer.current = { text: '', at: 0 };
          if (code) submitBadge(code);
        }, SCAN_IDLE_FLUSH_MS);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, busy, submitBadge, earlyLeave]);

  // The early-leave question owns the screen while it is up: the spinner and
  // the confirmation would otherwise stack on top of the thing being read.
  const showOverlay = !earlyLeave && (busy || !!confirmation || !!error);

  return (
    <div className="relative flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center overflow-hidden bg-[#0b0d12] px-4 py-8 text-white sm:px-8">
      {/* Backdrop glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#b20202]/20 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 h-[300px] w-[300px] rounded-full bg-[#b20202]/10 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 h-[260px] w-[260px] rounded-full bg-[#1e3a8a]/10 blur-3xl" />
      </div>

      {/* Brand + clock header */}
      <header className="relative z-10 mb-8 flex w-full max-w-md items-center justify-between sm:mb-10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b20202] text-white [&>svg]:h-6 [&>svg]:w-6">
            <PiFingerprintDuotone />
          </span>
          <div className="leading-tight">
            {/* The shop's own name, at a size somebody can read on the way in —
                this is the only thing on screen that says which door they are
                standing at. */}
            <p
              className={`${fraunces.className} text-lg font-black tracking-tight text-white sm:text-xl`}
            >
              {shopName || 'DrinksHarbour'}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
              Staff clock
            </p>
          </div>
        </div>

        <div className="text-right">
          <p
            className={`${fraunces.className} text-4xl font-black tabular-nums leading-none tracking-tight text-white sm:text-5xl`}
          >
            {now || '--:--'}
          </p>
          <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-white/40">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </p>
        </div>
      </header>

      {/* Main surface */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md sm:p-8"
      >
        {mode === 'pin' ? (
          <KioskPinPad
            entry={entry}
            busy={busy}
            onDigit={(d) => {
              setError('');
              setConfirmation(null);
              setEntry((s) => pressDigit(s, d, PIN_MAX_LENGTH));
            }}
            onBackspace={() => setEntry(pressBackspace)}
            onSubmit={submitPin}
            onSwitchToBadge={() => setMode('camera')}
          />
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1
                className={`${fraunces.className} text-2xl font-black tracking-tight text-white sm:text-3xl`}
              >
                Scan your badge
              </h1>
              <p className="mt-1.5 text-sm text-white/40">
                Hold the card up to the camera
              </p>
            </div>
            <KioskScanView
            mode={mode as 'camera' | 'keyboard'}
            onModeChange={(m) => setMode(m)}
            onScan={submitBadge}
            onSwitchToPin={
              auth.pinOffered ? () => setMode('pin') : undefined
            }
            busy={busy}
            />
          </>
        )}

        {/* Count of people currently clocked in — a number, never names. */}
        {onShift !== null && mode !== 'pin' && (
          <div className="mt-7 flex items-center justify-center gap-2.5 border-t border-white/5 pt-6">
            <PiUsersDuotone className="h-4 w-4 text-white/30" />
            <p className="text-sm font-medium text-white/40">
              <span className="font-bold tabular-nums text-white/70">
                {onShift}
              </span>{' '}
              {onShift === 1 ? 'person is' : 'people are'} on shift now
            </p>
          </div>
        )}
      </motion.div>

      {/* Only on the in-app kiosk. On a public screen this link leads to a
          gated route, so it is an invitation to a sign-in page on a device
          nobody is meant to sign in to — and it names the shop's admin area to
          whoever is standing in front of it. */}
      {!isDevice && (
        <div className="relative z-10 mt-8 text-center">
          <Link
            href={routes.employees.attendance}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition-colors hover:text-white/60"
          >
            <PiArrowUUpLeft className="h-3.5 w-3.5" />
            Back to the attendance log
          </Link>
        </div>
      )}

      {/* A pairing that was revoked, or a mistyped URL. Terminal, not
          transient — the screen cannot recover on its own, so it says so
          rather than silently swallowing every scan. */}
      {isDevice && unpaired && (
        <div className="relative z-10 mt-8 max-w-sm text-center">
          <p className="text-xs font-semibold text-white/70">{unpaired}</p>
          <p className="mt-1 text-[11px] text-white/40">
            Ask a manager to pair this screen again from Settings.
          </p>
        </div>
      )}

      {/* Result overlay — one person, the one at the screen. Never a list. */}
      {showOverlay && (
        <KioskConfirmation
          confirmation={confirmation}
          error={error}
          busy={busy}
        />
      )}

      {/* Clocking out with shift left to run. Waits for an answer — no reset
          timer, because it is a decision rather than a notification. */}
      {earlyLeave && (
        <KioskEarlyLeave
          prompt={earlyLeave.prompt}
          busy={busy}
          onConfirm={() => void earlyLeave.retry()}
          onCancel={() => setEarlyLeave(null)}
        />
      )}
    </div>
  );
}
