'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function generateSessionId(): string {
  return crypto.randomUUID();
}

function getOrCreateSessionId(): string {
  const existing = sessionStorage.getItem('dh_session_id');
  if (existing) return existing;
  const id = generateSessionId();
  sessionStorage.setItem('dh_session_id', id);
  return id;
}

function checkIsNewUser(): boolean {
  const visited = localStorage.getItem('dh_first_visit');
  if (!visited) {
    localStorage.setItem('dh_first_visit', new Date().toISOString());
    return true;
  }
  return false;
}

function checkIsFirstInSession(): boolean {
  const started = sessionStorage.getItem('dh_session_started');
  if (!started) {
    sessionStorage.setItem('dh_session_started', '1');
    return true;
  }
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

interface UTMParams {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

function parseUTMParams(): UTMParams {
  if (typeof window === 'undefined') {
    return { utmSource: null, utmMedium: null, utmCampaign: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
  };
}

export default function useAnalyticsTracker(): void {
  const pathname = usePathname();
  const startTimeRef = useRef<number>(Date.now());
  const currentPageRef = useRef<string>(pathname);
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sessionId = getOrCreateSessionId();
    sessionIdRef.current = sessionId;

    const isNewUser = checkIsNewUser();
    const isFirstInSession = checkIsFirstInSession();
    const pageViewsInSession = incrementPageViewCount();
    const device = detectDevice();
    const { utmSource, utmMedium, utmCampaign } = parseUTMParams();

    const page = pathname;
    const title = document.title;
    const referrer = document.referrer;

    currentPageRef.current = page;
    startTimeRef.current = Date.now();

    const payload = {
      sessionId,
      page,
      title,
      referrer,
      device,
      isNewUser,
      isFirstInSession,
      pageViewsInSession,
      ...(utmSource && { utmSource }),
      ...(utmMedium && { utmMedium }),
      ...(utmCampaign && { utmCampaign }),
    };

    fetch(`${API_URL}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Use keepalive so the request survives short-lived navigations
      keepalive: true,
    }).catch(() => {
      // Silently swallow analytics errors to avoid disrupting UX
    });

    // Send duration for the PREVIOUS page on navigation change
    // (handled by cleanup below)

    function sendDuration() {
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      const durationPayload = JSON.stringify({
        sessionId: sessionIdRef.current,
        page: currentPageRef.current,
        duration,
      });

      const sent = navigator.sendBeacon(
        `${API_URL}/api/analytics/track/duration`,
        new Blob([durationPayload], { type: 'application/json' })
      );

      // Fallback to fetch if sendBeacon is unavailable or fails
      if (!sent) {
        fetch(`${API_URL}/api/analytics/track/duration`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: durationPayload,
          keepalive: true,
        }).catch(() => {});
      }
    }

    window.addEventListener('beforeunload', sendDuration);

    return () => {
      window.removeEventListener('beforeunload', sendDuration);
      // Send duration when navigating away (SPA route change)
      sendDuration();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
