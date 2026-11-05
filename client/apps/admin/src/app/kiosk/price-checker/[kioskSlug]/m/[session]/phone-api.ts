import type { KioskProduct } from '../../../../../../components/price-checker/types';

// Same-origin helper client for the phone companion page. All traffic goes
// through the existing Next route proxy (`/api/price-checker/...`), which owns
// the slug-scoped session cookie — the phone never sees the token.

export interface PhoneScanResult {
  found: boolean;
  status: 'FOUND' | 'NOT_FOUND' | 'UNAVAILABLE';
  product?: KioskProduct;
}

async function call<T>(slug: string, action: 'session' | 'scan', body?: object): Promise<T> {
  const response = await fetch(`/api/price-checker/${encodeURIComponent(slug)}/${action}`, {
    method: body ? 'POST' : 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: T };
  if (!response.ok || !payload?.data)
    throw new Error('Price check is unavailable right now.');
  return payload.data;
}

/** Establishes the audience-bound price-checker session cookie for the phone. */
export function openSession(slug: string) {
  return call<void>(slug, 'session', { slug });
}

/** Checks one barcode, logging it as a phone scan and pairing it to a kiosk. */
export function postPhoneScan(slug: string, barcode: string, sessionId: string) {
  return call<PhoneScanResult>(slug, 'scan', {
    barcode,
    requestId: crypto.randomUUID(),
    origin: 'phone',
    pairSession: sessionId,
  });
}
