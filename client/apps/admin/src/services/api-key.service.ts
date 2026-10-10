export const WEBSITE_SCOPES = ['storefront:read', 'checkout:write'];
export const API_KEY_PERMISSIONS = [
  {
    scope: 'storefront:read',
    label: 'Read storefront',
    description: 'Read your store branding, products, prices and availability.',
  },
  {
    scope: 'checkout:write',
    label: 'Create and verify checkouts',
    description: 'Quote carts, create orders and take Paystack payments.',
  },
  {
    scope: 'inventory:read',
    label: 'Read inventory',
    description: 'Read operational stock records for reporting and sync.',
  },
  {
    scope: 'bookings:read',
    label: 'Read bookings',
    description: 'Read venue bookings without changing them.',
  },
];
export function apiKeyScopeLabel(scope: string) {
  return (
    API_KEY_PERMISSIONS.find((permission) => permission.scope === scope)
      ?.label || scope
  );
}
export type ApiKey = {
  _id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt?: string;
  lastUsedAt?: string | null;
  expiresAt: string;
  revokedAt: string | null;
};
export type NewApiKey = {
  name: string;
  scopes: string[];
  expiresInDays: number;
};
export function getKeyStatus(
  key: Pick<ApiKey, 'expiresAt' | 'revokedAt'>,
  now = Date.now()
) {
  if (key.revokedAt) return 'Revoked';
  return new Date(key.expiresAt).getTime() > now ? 'Active' : 'Expired';
}
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
export async function apiKeyRequest<T = { keys: ApiKey[] }>(
  token: string,
  path = '',
  method = 'GET',
  body?: NewApiKey,
  signal?: AbortSignal
): Promise<T> {
  if (!token) throw new Error('Sign in to manage API keys.');
  const response = await fetch(`${API}/api/api-keys${path}`, {
    method,
    signal,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = (await response.json().catch(() => null)) as {
    message?: string;
    data?: T;
  } | null;
  if (!response.ok || !result || (method !== 'DELETE' && result.data == null))
    throw new Error(
      result?.message || 'Unable to manage API keys. Please retry.'
    );
  return result.data as T;
}
