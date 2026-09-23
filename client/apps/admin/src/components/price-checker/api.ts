import type { KioskConfig, ScanResult } from './types';
export class KioskError extends Error {
  constructor(public status: number) {
    super('Kiosk request failed');
  }
}
async function request<T>(
  slug: string,
  action: string,
  signal: AbortSignal,
  body?: object
): Promise<T> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api/price-checker/${encodeURIComponent(slug)}/${action}`, {
      method: action === 'config' ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new KioskError(response.status);
    const payload = (await response.json()) as { data?: T };
    if (!payload?.data) throw new KioskError(503);
    return payload.data;
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted) throw new KioskError(503);
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
export const openKiosk = (slug: string, signal: AbortSignal) =>
  request<KioskConfig>(slug, 'session', signal);
export async function checkPrice(
  slug: string,
  barcode: string,
  requestId: string,
  signal: AbortSignal
) {
  const scan = () => request<ScanResult>(slug, 'scan', signal, { barcode, requestId });
  try {
    return await scan();
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof KioskError && error.status === 401) await openKiosk(slug, signal);
    else if (
      !(error instanceof TypeError) &&
      !(error instanceof KioskError && [502, 503, 504].includes(error.status))
    )
      throw error;
    // Retain the original request ID: a lost response must never count as another scan.
    return scan();
  }
}
