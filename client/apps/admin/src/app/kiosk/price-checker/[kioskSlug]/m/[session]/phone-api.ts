import type { KioskConfig, ScanResult } from '@/components/price-checker/types';

class PhoneRequestError extends Error {
  constructor(readonly status: number) {
    super('Price check is unavailable right now.');
  }
}

async function call<T>(slug: string, action: 'session' | 'scan', body: object): Promise<T> {
  const response = await fetch(`/api/price-checker/${encodeURIComponent(slug)}/${action}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: T };
  if (!response.ok || !payload?.data) throw new PhoneRequestError(response.status);
  return payload.data;
}

export function openSession(slug: string) {
  return call<KioskConfig>(slug, 'session', { slug });
}

export async function postPhoneScan(slug: string, barcode: string, sessionId: string) {
  const body = { barcode, requestId: crypto.randomUUID(), origin: 'phone', pairSession: sessionId };
  try {
    return await call<ScanResult>(slug, 'scan', body);
  } catch (error) {
    if (!(error instanceof PhoneRequestError) || error.status !== 401) throw error;
    await openSession(slug);
    return call<ScanResult>(slug, 'scan', body);
  }
}
