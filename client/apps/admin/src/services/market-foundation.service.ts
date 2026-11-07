const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
export type MarketCategory = 'beverage' | 'gift' | 'food';
export type EnrollmentChannel = 'marketplace' | 'storefront';
export interface MarketScope {
  market: string;
  category: MarketCategory;
  channel: EnrollmentChannel;
}
export interface Enrollment extends MarketScope {
  _id: string;
  tenant: string;
  version: number;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  statement: string;
  reason: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
}
export interface CategoryPolicy extends MarketScope {
  _id: string;
  version: number;
  mode: 'open' | 'closed' | 'exclusive';
  exclusiveTenant?: string;
  exceptions: string[];
  effectiveFrom: string;
  effectiveUntil: string;
  contractReference: string;
  reason: string;
}
export interface ChannelOwner {
  type: 'tenant' | 'platform';
  reference: string;
}
export interface PaymentOwner extends ChannelOwner {
  provider: string;
  account?: string;
}
export interface ChannelConfiguration {
  tenant: string | null;
  code: string;
  kind: 'marketplace' | 'storefront' | 'pos' | 'venue';
  market: string;
  currency: string;
  active: boolean;
  legalOwner: ChannelOwner;
  paymentOwner: PaymentOwner;
  allowedPaymentOwners?: PaymentOwner[];
  pricingPolicy: { code: string; version: number; termsReference: string };
  storefrontChannel?: string;
  apiKey?: string;
  location?: string;
}
export interface SalesChannel extends ChannelConfiguration {
  _id: string;
  version: number;
}
export async function foundationRequest<T>(
  token: string,
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    cache: 'no-store',
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload: unknown = await response.json().catch(() => null);
  const data = payload && typeof payload === 'object' ? payload : {};
  if (!response.ok)
    throw new Error(
      'message' in data && typeof data.message === 'string'
        ? data.message
        : 'Unable to save. Reload and try again.'
    );
  if (!('data' in data) || data.data === undefined)
    throw new Error('The response is incomplete. Reload before continuing.');
  return data.data as T;
}
