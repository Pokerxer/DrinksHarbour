const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
export const countryPrerequisites = [
  'legal',
  'payments',
  'fulfillment',
  'operations',
  'merchantPolicy',
] as const;
export type CountryPrerequisite = (typeof countryPrerequisites)[number];
export interface CountryConfiguration {
  code: string;
  name: string;
  currency: string;
  locale: string;
  timezones: string[];
  active: boolean;
  version: number;
  capabilities: { marketplace: boolean; storefront: boolean; erm: boolean };
  readiness?: Partial<
    Record<
      CountryPrerequisite,
      { evidence: string; reviewedBy: string; reviewedAt: string }
    >
  >;
  revisions?: {
    version: number;
    action: string;
    actor: string;
    at: string;
    reason: string;
  }[];
}
export async function countryRequest<T = CountryConfiguration>(
  token: string,
  path = '',
  method = 'GET',
  body?: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${API_URL}/api/countries/admin${path}`, {
    method,
    cache: 'no-store',
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload: unknown = await response.json().catch(() => null);
  const record = payload && typeof payload === 'object' ? payload : {};
  if (!response.ok)
    throw new Error(
      'message' in record && typeof record.message === 'string'
        ? record.message
        : 'Unable to manage countries. Reload and try again.'
    );
  if (!('data' in record) || record.data === undefined)
    throw new Error(
      'The country response is incomplete. Reload and try again.'
    );
  return record.data as T;
}
