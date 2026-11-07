import { foundationRequest } from './market-foundation.service';
export type MerchantLine = {
  line: string;
  product: string;
  subproduct: string;
  size: string;
  quantity: number;
  merchandiseMinor: number;
  productName?: string;
  sizeName?: string;
  sku?: string;
};
export type MerchantOrder = {
  _id: string;
  order: string;
  orderNumber?: string;
  tenant: string;
  location: string;
  currency: string;
  state:
    | 'pending'
    | 'accepted'
    | 'picking'
    | 'partially_shipped'
    | 'shipped'
    | 'delivered'
    | 'cancelled';
  version: number;
  fulfillmentVersion?: 2;
  quantityProgress?: {
    line: string;
    shipped: number;
    delivered: number;
    cancelled: number;
    financialBlocks: {
      start: number;
      quantity: number;
      kind: 'reserved' | 'refunded';
    }[];
  }[];
  lines: MerchantLine[];
  merchandiseMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  refundedMinor: number;
  refundReservedMinor: number;
  recipient?: {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};
export type MerchantRefund = {
  _id: string;
  merchantOrder: string;
  amountMinor: number;
  currency: string;
  reason: string;
  state: 'reserved' | 'submitting' | 'uncertain' | 'succeeded';
  issue?: string;
  fulfillmentVersion?: 2;
  unitRanges?: {
    line: string;
    ranges: { start: number; quantity: number }[];
  }[];
};
export async function merchantRequest<T>(
  token: string,
  path = '',
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  if (!token) throw new Error('Sign in to manage merchant orders.');
  return foundationRequest<T>(
    token,
    `/merchant-orders${path}`,
    method,
    body,
    signal
  );
}
export function amountToMinor(input: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(input))
    throw new Error('Enter a positive amount with at most two decimal places.');
  const value = Math.round(Number(input) * 100);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error('Enter a positive amount.');
  return value;
}
export const formatMerchantMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(
    minor / 100
  );

export type MerchantSave = (
  path: string,
  payload: Record<string, unknown>,
  identity: string
) => Promise<boolean>;
