'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { hasConsent } from '@/components/legal/CookieConsent';

// GA4 measurement ID. Configurable via env; falls back to the account's tag.
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-H958Z6E9WJ';

/**
 * Loads the Google tag (gtag.js / GA4) once for the whole app.
 *
 * Rendered from the root layout, so it is present on every page — the
 * App Router equivalent of Google's "paste after <head> on every page".
 *
 * Loading is gated on the visitor's `analytics` cookie consent, to stay
 * consistent with the site's own CookieConsent banner and first-party
 * AnalyticsTracker. GA only mounts once analytics consent is granted, and
 * re-checks whenever the visitor changes their choice.
 */
export default function GoogleAnalytics() {
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

  if (!GA_MEASUREMENT_ID || !analyticsAllowed) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
