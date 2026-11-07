import { foundationRequest } from './market-foundation.service';
export type DispatchLine = {
  line: string;
  quantity: number;
  productName?: string;
};
export type DispatchOrder = {
  _id: string;
  currency: string;
  fulfillmentVersion?: number;
  lines: DispatchLine[];
  quantityProgress?: { line: string; shipped: number; cancelled: number }[];
};
export type DispatchQuote = {
  _id: string;
  amountMinor: number;
  currency: string;
  expiresAt: string;
};
export type DispatchBooking = {
  _id: string;
  state:
    | 'booked'
    | 'dispatched'
    | 'delivered'
    | 'failed'
    | 'cancelled'
    | 'returning'
    | 'returned';
  version: number;
  amountMinor: number;
  currency: string;
  lines: DispatchLine[];
  events: { key: string; state: string; at: string }[];
};
export type DispatchOptions = {
  creationEnabled: boolean;
  contract: null | {
    _id: string;
    version: number;
    amountMinor: number;
    currency: string;
    coverage: string[];
    validUntil: string;
  };
  drivers: {
    _id: string;
    name: string;
    vehicleType: string;
    capacityKg: number;
  }[];
  recoveryDrivers?: DispatchOptions['drivers'];
  bookings: DispatchBooking[];
  hasMoreBookings?: boolean;
};
export type ReturnRange = { start: number; quantity: number };
export type ReturnDisposition = {
  _id: string;
  booking: string;
  merchantOrder: string;
  shipmentAllocation: string;
  disposition: string;
  version: number;
  lines: { line: string; quantity: number; ranges: ReturnRange[] }[];
  inspections: {
    line: string;
    condition: string;
    ranges: ReturnRange[];
    evidence?: { kind: string; reference?: string }[];
    note?: string;
    inspectedAt?: string;
  }[];
  decisions: {
    line: string;
    treatment: string;
    ranges: ReturnRange[];
    note?: string;
    decidedAt?: string;
  }[];
  effects: { supported: boolean; reasons: string[]; returnVersion?: number };
  operations: number;
};
export async function dispatchRequest<T>(
  token: string,
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  if (!token) throw new Error('Sign in to manage local rider deliveries.');
  return foundationRequest<T>(
    token,
    `/merchant-local-dispatch${path}`,
    method,
    body,
    signal
  );
}
