import type { CollectionInput, CollectionResult, VenueBill, VenueMode } from './types';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const keys = new Map<string, string>();
// Only a digest is persisted; guest details and bearer tokens stay out of storage.
export async function requestKey(signature: string) {
  const bytes = new TextEncoder().encode(signature);
  const digest = globalThis.crypto?.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('') : signature;
  const storageKey = `venue-request:${digest}`;
  let key = keys.get(storageKey);
  try { if (globalThis.crypto?.subtle) key = localStorage.getItem(storageKey) || key; } catch { /* memory fallback */ }
  if (!key) key = globalThis.crypto?.randomUUID?.() || `venue-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  keys.set(storageKey, key);
  try { if (globalThis.crypto?.subtle) localStorage.setItem(storageKey, key); } catch { /* private browser */ }
  return key;
}
async function executeRequest<T>(token: string, path: string, method = 'GET', body?: unknown, mode: VenueMode = 'admin'): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Connect to the internet to manage this venue bill.');
  const root = mode === 'pos' ? '/api/pos/venue' : '/api/venue-ops';
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (method !== 'GET') headers['Idempotency-Key'] = await requestKey(JSON.stringify([token, root, path, body]));
  const response = await fetch(`${API}${root}${path}`, { method, headers, cache: 'no-store', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json() as { data: T; message?: string; code?: string };
  if (!response.ok) {
    // The server error handler serialises the domain `code` of operational
    // errors so clients can BRANCH (e.g. S6 `BILL_ALREADY_COLLECTED`) — attach
    // it instead of discarding it; display keeps falling back to the message.
    const error = new Error(result.message || 'Unable to update venue bill. Refresh and try again.') as VenueApiError;
    if (typeof result.code === 'string') error.code = result.code;
    throw error;
  }
  return result.data;
}

/** An error raised by the venue API — carries the server's domain `code` when it set one. */
export type VenueApiError = Error & { code?: string };

/** The domain code of a venue API error (`BILL_ALREADY_COLLECTED`, `STATE_CHANGED`, …), if any. */
export function venueErrorCode(error: unknown): string | undefined {
  return error instanceof Error ? (error as VenueApiError).code : undefined;
}

/**
 * Human failure text shared by the venue workspace panels: `CODE: message`
 * when the thrown error carries a domain code, the bare message otherwise,
 * and the caller's fallback for anything that is not an Error.
 */
export function describeVenueFailure(failure: unknown, fallback: string): string {
  const code = failure instanceof Error ? (failure as VenueApiError).code : undefined;
  return failure instanceof Error ? (code ? `${code}: ${failure.message}` : failure.message) : fallback;
}
const inFlight = new Map<string, Promise<unknown>>();
// Navigation auto-save and checkout may run together; coalesce the exact command.
export function venueRequest<T>(token: string, path: string, method = 'GET', body?: unknown, mode: VenueMode = 'admin'): Promise<T> {
  if (method === 'GET') return executeRequest<T>(token, path, method, body, mode);
  const signature = JSON.stringify([token, mode, method, path, body]);
  const previous = inFlight.get(signature);
  if (previous) return previous as Promise<T>;
  const request = executeRequest<T>(token, path, method, body, mode).finally(() => { inFlight.delete(signature); });
  inFlight.set(signature, request);
  return request;
}
export const getBill = (token: string, id: string, mode?: VenueMode) => venueRequest<VenueBill>(token, `/service-sessions/${id}/bill`, 'GET', undefined, mode);
export const freezeBill = (token: string, id: string, body: { expectedVersion: number; lineVersion: number; ageVerified: boolean }, mode?: VenueMode) => venueRequest<VenueBill>(token, `/service-sessions/${id}/bill`, 'POST', body, mode);
export const collectBill = (token: string, id: string, body: CollectionInput, mode?: VenueMode) => venueRequest<CollectionResult>(token, `/service-sessions/${id}/collections`, 'POST', body, mode);
export const reconcileBill = (token: string, id: string, mode?: VenueMode) => venueRequest<unknown>(token, `/service-sessions/${id}/reconcile`, 'POST', {}, mode);
export const setLines = (token: string, id: string, body: { expectedVersion: number; lines: import('./checkout-lines').VenueInputLine[] }, mode?: VenueMode) => venueRequest<{ version: number; lineVersion: number }>(token, `/service-sessions/${id}/lines`, 'PUT', body, mode);
