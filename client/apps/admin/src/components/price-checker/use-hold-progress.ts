'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const HOLD_MS_DEFAULT = 1500;

function rafAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
}

/**
 * Press-and-hold progress (0 → 1) for the tray's hold-to-clear action:
 * accidental taps cancel harmlessly and may be re-held, a full hold fires
 * `onComplete` exactly once and freezes at 1. Without rAF the hold completes
 * instantly (a kiosk without an animation loop is also one without
 * accidental taps).
 */
export function useHoldProgress(durationMs = HOLD_MS_DEFAULT, onComplete?: () => void) {
  const [progress, setProgress] = useState(0);
  const running = useRef(false);
  const startedAt = useRef<number | null>(null);
  const done = useRef(false);
  const frame = useRef(0);
  const complete = useRef(onComplete);
  complete.current = onComplete;

  const tick = useCallback(
    (timestamp: number) => {
      if (!running.current) return;
      if (startedAt.current === null) startedAt.current = timestamp;
      const value = Math.min(1, (timestamp - startedAt.current) / durationMs);
      setProgress(value);
      if (value >= 1) {
        done.current = true;
        running.current = false;
        complete.current?.();
        setProgress(1);
        return;
      }
      frame.current = window.requestAnimationFrame(tick);
    },
    [durationMs]
  );

  const start = useCallback(() => {
    if (done.current || running.current) return;
    if (!rafAvailable()) {
      done.current = true;
      complete.current?.();
      return;
    }
    running.current = true;
    startedAt.current = null;
    frame.current = window.requestAnimationFrame(tick);
  }, [tick]);

  const cancel = useCallback(() => {
    if (!running.current) return;
    running.current = false;
    startedAt.current = null;
    setProgress(0);
  }, []);

  useEffect(
    () => () => {
      running.current = false;
      if (frame.current && rafAvailable()) window.cancelAnimationFrame(frame.current);
    },
    []
  );

  return { progress, doneRef: done, start, cancel };
}
