'use client';

// The camera scan view for the attendance kiosk.  Renders either the camera
// viewfinder or a keyboard-entry field (the fallback when no camera is
// available or a USB HID scanner needs a focused text field).
//
// Camera scanning uses html5-qrcode — a headless QR library that renders its
// own <video> element.  The viewfinder overlay (animated corners and sweep
// line) is positioned on top of it with CSS.
//
// HID scanners act like keyboards: they type the payload + Enter into the
// focused element.  The keyboard mode gives them an <input> to land in.
// A global keydown buffer in the parent page catches scanner input even
// when the camera is active, so this component never has to race focus.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  PiCameraBold,
  PiKeyboardBold,
  PiFingerprintBold,
} from 'react-icons/pi';
import { fraunces } from './employees-fonts';

const SCAN_CONTAINER_ID = 'kiosk-qr-reader';

export type ScanMode = 'camera' | 'keyboard';

interface KioskScanViewProps {
  mode: ScanMode;
  onModeChange: (m: ScanMode) => void;
  onScan: (code: string) => void;
  onSwitchToPin: () => void;
  busy: boolean;
}

// ── Camera component (separate to isolate the effect lifecycle) ────────────

function CameraScanner({
  onScan,
  onError,
  busy,
}: {
  onScan: (code: string) => void;
  onError: () => void;
  busy: boolean;
}) {
  // The effect runs once, so anything it closes over must be a ref.
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const busyRef = useRef(busy);
  onScanRef.current = onScan;
  onErrorRef.current = onError;
  busyRef.current = busy;

  useEffect(() => {
    let disposed = false;
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;

    async function start() {
      try {
        // Lazy-load so the module isn't pulled into the server bundle.
        const mod = await import('html5-qrcode');
        if (disposed) return;

        // QR codes AND barcodes — covers every badge format in use.
        const QR = mod.Html5Qrcode;
        const F = mod.Html5QrcodeSupportedFormats;
        scanner = new QR(SCAN_CONTAINER_ID, {
          verbose: false,
          formatsToSupport: [
            F.QR_CODE,
            F.CODE_128,
            F.CODE_39,
            F.EAN_13,
            F.EAN_8,
            F.UPC_EAN_EXTENSION,
          ],
        });

        const cameras = await QR.getCameras();
        if (disposed) return;
        if (!cameras.length) {
          onErrorRef.current();
          return;
        }

        await scanner.start(
          // Prefer the back camera when a kiosk tablet has two.
          cameras.length > 1 ? cameras[cameras.length - 1].id : cameras[0].id,
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.0,
          },
          (text: string) => {
            if (!disposed && !busyRef.current) onScanRef.current(text);
          },
          () => {} // per-frame decode errors are expected
        );
      } catch {
        if (!disposed) onErrorRef.current();
      }
    }

    start();

    return () => {
      disposed = true;
      scanner
        ?.stop()
        .catch(() => {})
        .finally(() => scanner?.clear());
    };
    // Only re-start if the component remounts (StrictMode).  Not triggered
    // by busy/parent re-renders — the effect is stable across props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl border border-white/10">
      <div
        id={SCAN_CONTAINER_ID}
        className="h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
      />

      {/* Corner brackets */}
      <span className="pointer-events-none absolute left-3 top-3 h-10 w-10 border-l-2 border-t-2 border-[#b20202]/70" />
      <span className="pointer-events-none absolute right-3 top-3 h-10 w-10 border-r-2 border-t-2 border-[#b20202]/70" />
      <span className="pointer-events-none absolute bottom-3 left-3 h-10 w-10 border-b-2 border-l-2 border-[#b20202]/70" />
      <span className="pointer-events-none absolute bottom-3 right-3 h-10 w-10 border-b-2 border-r-2 border-[#b20202]/70" />

      {/* Sweep line */}
      <motion.div
        className="pointer-events-none absolute left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-[#b20202] to-transparent"
        initial={{ top: '12%' }}
        animate={{ top: ['12%', '88%', '12%'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_center,transparent_40%,#0b0d12_100%)] opacity-60" />
    </div>
  );
}

// ── Keyboard entry (HID scanner / manual) ─────────────────────────────────

function KeyboardEntry({
  onSubmit,
  busy,
}: {
  onSubmit: (code: string) => void;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  // Re-focus on mount and whenever we clear — not on every keystroke, which
  // is what an unconditional focus() in this effect did. A scanner types the
  // whole payload into whatever holds focus, so the field has to hold it.
  useEffect(() => {
    if (value === '') inputRef.current?.focus();
  }, [value]);

  const handleSubmit = useCallback(() => {
    const v = value.trim();
    if (v && !busy) {
      onSubmit(v);
      setValue('');
    }
  }, [value, busy, onSubmit]);

  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            if (!busy) setValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Type or scan your badge"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center text-lg font-semibold tabular-nums text-white placeholder-white/30 backdrop-blur-sm transition-all focus:border-white/25 focus:outline-none focus:ring-1 focus:ring-[#b20202]/40"
          disabled={busy}
        />

        {/* Subtle scan-line animation across the input */}
        <motion.div
          className="pointer-events-none absolute bottom-0 left-2 right-2 h-[1px] bg-gradient-to-r from-transparent via-[#b20202]/50 to-transparent"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <p className="mt-4 text-center text-xs text-white/40">
        Hold your badge card to the scanner, or type the code
      </p>
    </div>
  );
}

// ── Main scan view ─────────────────────────────────────────────────────────

export default function KioskScanView({
  mode,
  onModeChange,
  onScan,
  onSwitchToPin,
  busy,
}: KioskScanViewProps) {
  const [cameraFailed, setCameraFailed] = useState(false);

  const handleCameraError = useCallback(() => {
    setCameraFailed(true);
    onModeChange('keyboard');
  }, [onModeChange]);

  return (
    <div className="flex flex-col items-center">
      {/* Mode indicator / label */}
      <div className="mb-5 flex flex-col items-center gap-1">
        {mode === 'camera' ? (
          <>
            <PiCameraBold className="h-5 w-5 text-white/50" />
            <p className="text-sm font-medium text-white/60">
              Hold your badge to the camera
            </p>
            <p className="text-[11px] text-white/30">QR codes and barcodes</p>
          </>
        ) : (
          <>
            <PiKeyboardBold className="h-5 w-5 text-white/50" />
            <p className="text-sm font-medium text-white/60">
              Scan or type your badge code
            </p>
          </>
        )}
      </div>

      {/* The input area */}
      <AnimatePresence mode="wait">
        {mode === 'camera' ? (
          <motion.div
            key="camera"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25 }}
          >
            <CameraScanner
              onScan={onScan}
              onError={handleCameraError}
              busy={busy}
            />
          </motion.div>
        ) : (
          <motion.div
            key="keyboard"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25 }}
          >
            <KeyboardEntry onSubmit={onScan} busy={busy} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera failed warning.
          Shown in whatever mode we fell back TO, which is the whole point of
          it — it explains why the keyboard is on screen. Gating it on
          `mode === 'camera'` meant it never rendered at all, because the
          failure handler switches the mode in the same breath. */}
      {cameraFailed && (
        <p className="mt-3 text-xs text-amber-400/70">
          Camera unavailable — switched to keyboard entry
        </p>
      )}

      {/* Switch buttons */}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const next = mode === 'camera' ? 'keyboard' : 'camera';
            // Clear the failure on the way back so the camera is genuinely
            // retried. Hiding this button once it had failed left a kiosk
            // stuck on keyboard entry until someone reloaded the page.
            if (next === 'camera') setCameraFailed(false);
            onModeChange(next);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white/40 transition-colors hover:text-white/70"
        >
          {mode === 'camera' ? (
            <>
              <PiKeyboardBold className="h-3.5 w-3.5" />
              Use keyboard
            </>
          ) : (
            <>
              <PiCameraBold className="h-3.5 w-3.5" />
              Use camera
            </>
          )}
        </button>

        <span className="h-3 w-px bg-white/10" />

        <button
          type="button"
          onClick={onSwitchToPin}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white/40 transition-colors hover:text-white/70"
        >
          <PiFingerprintBold className="h-3.5 w-3.5" />
          Use PIN
        </button>
      </div>
    </div>
  );
}
