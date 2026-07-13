'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { hasConsent } from '@/components/legal/CookieConsent';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// ── Module-level dedup state ──────────────────────────────────────────────────
// Persists across remounts of the same component within the same page session.
// Prevents the track/duration/track loop caused by rapid remounts.

const MIN_TRACK_INTERVAL_MS = 5_000;   // don't re-fire pageview for the same path < 5s
const MIN_DURATION_SECONDS  = 2;       // ignore durations shorter than 2s (spurious cleanups)

const lastTracked: Map<string, number> = new Map(); // path → timestamp of last pageview fire

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSessionId(): string { return crypto.randomUUID(); }

function getOrCreateSessionId(): string {
  const existing = sessionStorage.getItem('dh_session_id');
  if (existing) return existing;
  const id = generateSessionId();
  sessionStorage.setItem('dh_session_id', id);
  return id;
}

function checkIsNewUser(): boolean {
  const visited = localStorage.getItem('dh_first_visit');
  if (!visited) { localStorage.setItem('dh_first_visit', new Date().toISOString()); return true; }
  return false;
}

function checkIsFirstInSession(): boolean {
  const started = sessionStorage.getItem('dh_session_started');
  if (!started) { sessionStorage.setItem('dh_session_started', '1'); return true; }
  return false;
}

function incrementPageViewCount(): number {
  const current = parseInt(sessionStorage.getItem('dh_pv_count') || '0', 10);
  const next = current + 1;
  sessionStorage.setItem('dh_pv_count', String(next));
  return next;
}

function detectDevice(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return 'tablet';
  if (/Mobile|Android|iPhone|iPod/.test(ua)) return 'mobile';
  return 'desktop';
}

function parseUTMParams() {
  if (typeof window === 'undefined') return { utmSource: null, utmMedium: null, utmCampaign: null };
  const p = new URLSearchParams(window.location.search);
  return { utmSource: p.get('utm_source'), utmMedium: p.get('utm_medium'), utmCampaign: p.get('utm_campaign') };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export default function useAnalyticsTracker(): void {
  const pathname         = usePathname();
  const startTimeRef     = useRef<number>(Date.now());
  const currentPageRef   = useRef<string>(pathname);
  const sessionIdRef     = useRef<string>('');
  const trackedThisMount = useRef<boolean>(false);

  // ── Consent gate ──────────────────────────────────────────────────────────
  // Analytics is an optional cookie category: only track once the visitor has
  // granted analytics consent. Re-checks when they change their choice.
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAnalyticsAllowed(hasConsent('analytics'));
    sync();
    window.addEventListener('dh:cookie-consent', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('dh:cookie-consent', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!analyticsAllowed) return; // no analytics consent → do not track

    const now = Date.now();
    const lastFire = lastTracked.get(pathname) ?? 0;

    // Dedup: skip if we already tracked this path within MIN_TRACK_INTERVAL_MS.
    // This stops the mount → cleanup → remount → cleanup → … loop cold.
    if (now - lastFire < MIN_TRACK_INTERVAL_MS) {
      // Still reset the timer so duration is measured from now
      startTimeRef.current = now;
      currentPageRef.current = pathname;
      return;
    }

    lastTracked.set(pathname, now);
    trackedThisMount.current = true;

    const sessionId = getOrCreateSessionId();
    sessionIdRef.current = sessionId;
    startTimeRef.current = now;
    currentPageRef.current = pathname;

    const { utmSource, utmMedium, utmCampaign } = parseUTMParams();

    fetch(`${API_URL}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        sessionId,
        page: pathname,
        title: document.title,
        referrer: document.referrer,
        device: detectDevice(),
        isNewUser: checkIsNewUser(),
        isFirstInSession: checkIsFirstInSession(),
        pageViewsInSession: incrementPageViewCount(),
        ...(utmSource   && { utmSource }),
        ...(utmMedium   && { utmMedium }),
        ...(utmCampaign && { utmCampaign }),
      }),
    }).catch(() => {});

    function sendDuration() {
      // Don't fire for spurious cleanups (remounts < MIN_DURATION_SECONDS)
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (duration < MIN_DURATION_SECONDS) return;

      const body = JSON.stringify({
        sessionId: sessionIdRef.current,
        page: currentPageRef.current,
        duration,
      });

      const sent = navigator.sendBeacon(
        `${API_URL}/api/analytics/track/duration`,
        new Blob([body], { type: 'application/json' }),
      );

      if (!sent) {
        fetch(`${API_URL}/api/analytics/track/duration`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body,
        }).catch(() => {});
      }
    }

    window.addEventListener('beforeunload', sendDuration);
    return () => {
      window.removeEventListener('beforeunload', sendDuration);
      sendDuration(); // SPA navigation or unmount
    };
  }, [pathname, analyticsAllowed]);
}
