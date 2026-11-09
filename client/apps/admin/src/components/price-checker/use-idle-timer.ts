'use client';
import { useEffect, useRef } from 'react';

const IDLE_MS = 5 * 60_000;
const COMPARE_MS = 2 * 60_000;

interface StaleOptions {
  /** Inactivity window override (the compare view uses a shorter one). */
  timeoutMs?: number;
  /** Arming switch — a kiosk with no customer content has nothing to wipe. */
  enabled?: boolean;
}

/**
 * Customer-walked-away guard: when the kiosk still holds a comparison tray,
 * a recap, or a product screen and nobody interacts for the window, fire the
 * wipe once. Every `activity` change restarts the window; the offline scan
 * queue (server telemetry, not customer data) is intentionally untouched by
 * the caller.
 */
export function useStaleSession(
  activity: string,
  onStale: () => void,
  { timeoutMs = IDLE_MS, enabled = true }: StaleOptions = {}
) {
  const holder = useRef(onStale);
  holder.current = onStale;
  const armed = useRef(false);
  useEffect(() => {
    if (!enabled || !activity) {
      armed.current = false;
      return;
    }
    armed.current = true;
    const timer = window.setTimeout(() => {
      if (!armed.current) return;
      armed.current = false;
      holder.current();
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [activity, enabled, timeoutMs]);
}

export { IDLE_MS, COMPARE_MS };
