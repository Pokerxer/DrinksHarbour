'use client';

import dynamic from 'next/dynamic';

// AgeGate and CookieConsent both read localStorage synchronously on mount to
// decide whether to show. Rendering them on the server would crash (no
// localStorage) and cause a hydration flash, so they load client-only via
// ssr: false — which is only permitted inside a Client Component like this one.
const AgeGate       = dynamic(() => import('@/components/AgeGate/AgeGate'),      { ssr: false });
const CookieConsent = dynamic(() => import('@/components/legal/CookieConsent'), { ssr: false });

export default function ClientOverlays() {
  return (
    <>
      <AgeGate />
      <CookieConsent />
    </>
  );
}
