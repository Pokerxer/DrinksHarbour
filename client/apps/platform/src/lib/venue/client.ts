import { fetchWithAuth } from '@/lib/fetchWithAuth';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const pending = new Map<string, string>();
export async function venueKey(
  identity: string,
  payload: unknown,
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([identity, payload]));
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
  const storageKey = `venue-request:${digest}`;
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) return saved;
  } catch {}
  const value = pending.get(storageKey) || crypto.randomUUID();
  pending.set(storageKey, value);
  try {
    sessionStorage.setItem(storageKey, value);
  } catch {}
  return value;
}
export async function privateVenue<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetchWithAuth(`${API}/api/venue-experience${path}`, {
    method,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = (await response.json()) as { data: T; message?: string };
  if (!response.ok)
    throw new Error(
      result.message || 'Unable to load this reservation. Please retry.',
    );
  return result.data;
}
export async function submitVenueRequest<T>(
  slug: string,
  locationSlug: string,
  identity: string,
  input: unknown,
): Promise<T> {
  const proofResponse = await fetch('/api/venue-channel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, locationSlug, input }),
    cache: 'no-store',
  });
  const proof = (await proofResponse.json()) as {
    channel: string;
    issued: string;
    signature: string;
    message?: string;
  };
  if (!proofResponse.ok)
    throw new Error(
      proof.message ||
        'Requests are temporarily unavailable. Please retry later.',
    );
  const response = await fetchWithAuth(
    `${API}/api/venue-experience/public/${encodeURIComponent(slug)}/${encodeURIComponent(locationSlug)}/requests`,
    {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': await venueKey(
          `${identity}:${slug}:${locationSlug}`,
          input,
        ),
        'x-venue-channel': proof.channel,
        'x-venue-issued': proof.issued,
        'x-venue-signature': proof.signature,
      },
      body: JSON.stringify(input),
    },
  );
  const result = (await response.json()) as { data: T; message?: string };
  if (!response.ok)
    throw new Error(result.message || 'Unable to send request. Please retry.');
  return result.data;
}
