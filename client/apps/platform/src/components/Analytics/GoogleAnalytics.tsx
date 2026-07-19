'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { readConsent } from '@/components/legal/CookieConsent';

// GA4 measurement ID. Configurable via env; falls back to the account's tag.
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-H958Z6E9WJ';

/**
 * Loads the Google tag (gtag.js / GA4) once for the whole app, with
 * Google Consent Mode v2.
 *
 * Rendered from the root layout, so it is present on every page — the
 * App Router equivalent of Google's "paste after <head> on every page".
 *
 * The tag ALWAYS loads (so Google detects it and tags fire), but consent
 * defaults to `denied`. GA runs in cookieless/anonymous mode until the
 * visitor grants consent via the CookieConsent banner, at which point we
 * push a `consent update`. This satisfies both Google's tag-detection and
 * the site's own opt-in cookie policy.
 *
 *   analytics_storage      ← 'analytics' category
 *   ad_storage / ad_user_data / ad_personalization ← 'marketing' category
 */
export default function GoogleAnalytics() {
  // Sync stored/updated consent into gtag Consent Mode.
  useEffect(() => {
    const applyConsent = () => {
      const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
      if (typeof gtag !== 'function') return;
      const c = readConsent();
      gtag('consent', 'update', {
        analytics_storage: c?.analytics ? 'granted' : 'denied',
        ad_storage: c?.marketing ? 'granted' : 'denied',
        ad_user_data: c?.marketing ? 'granted' : 'denied',
        ad_personalization: c?.marketing ? 'granted' : 'denied',
      });
    };

    applyConsent(); // reflect any choice made on a previous visit
    window.addEventListener('dh:cookie-consent', applyConsent);
    window.addEventListener('storage', applyConsent);
    return () => {
      window.removeEventListener('dh:cookie-consent', applyConsent);
      window.removeEventListener('storage', applyConsent);
    };
  }, []);

  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      {/* Set Consent Mode defaults BEFORE config runs (denied until opt-in). */}
      <Script id="google-consent-default" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500
          });
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
