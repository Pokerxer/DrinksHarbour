'use client';

// ─── Cookie consent storage ───────────────────────────────────────────────────
// Single source of truth for the consent record. The banner
// (components/legal/CookieConsent.tsx) writes it; analytics/pixel helpers read
// it. Keep the key here so readers and writers can never drift apart.

export const CONSENT_STORAGE_KEY = 'dh_cookie_consent_v1';

export interface CookieConsent {
  essential: true;
  preference: boolean;
  analytics: boolean;
  marketing: boolean;
  ts: number;
}

// Read the stored consent record (or null if the visitor hasn't chosen yet).
export function readConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookieConsent) : null;
  } catch {
    return null;
  }
}

export function writeConsent(consent: CookieConsent): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    window.dispatchEvent(new CustomEvent('dh:cookie-consent', { detail: consent }));
  } catch {
    /* storage unavailable — fail silently */
  }
}

// Whether the visitor has granted consent for an optional cookie category.
export function hasConsent(category: 'preference' | 'analytics' | 'marketing'): boolean {
  const c = readConsent();
  return !!c && c[category] === true;
}
