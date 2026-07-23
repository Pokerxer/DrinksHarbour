import Script from 'next/script';

/**
 * Google AdSense publisher ID, e.g. `ca-pub-1234567890123456`.
 * Set NEXT_PUBLIC_ADSENSE_CLIENT_ID to activate; the component is inert
 * (renders nothing) until it is present, so nothing ships to prod by accident.
 */
export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '';

/**
 * Loads the AdSense loader script (adsbygoogle.js) once for the whole app.
 *
 * Rendered from the root layout, so it is present on every page — the App
 * Router equivalent of Google's "paste this code between the <head> tags on
 * every page".
 *
 * Consent: AdSense reads Google Consent Mode v2 signals (ad_storage,
 * ad_user_data, ad_personalization) which GoogleAnalytics already defaults to
 * `denied` until the visitor opts in via the CookieConsent banner. So the tag
 * loads for Google's site verification/detection, but serves non-personalized
 * ads until marketing consent is granted. No extra wiring needed here.
 */
export default function GoogleAdSense() {
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <Script
      id="google-adsense"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
