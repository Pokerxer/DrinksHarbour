import { foundationRequest } from './market-foundation.service';
export type CarrierRate = {
  courierId: string;
  serviceCode: string;
  name: string;
  amountMinor: number;
  displayMinor: number;
};
export type CarrierBooking = {
  _id: string;
  allocationId: string;
  state: string;
  providerStatus: string | null;
  amountMinor: number;
  displayMinor: number;
};
export type CarrierOptions = {
  enabled: boolean;
  ready: boolean;
  review: { _id: string; version: number; status: string; validUntil: string } | null;
  allocations: { _id: string; lines: { line: string; quantity: number }[] }[];
  bookings: CarrierBooking[];
};
export type CarrierQuote = {
  _id: string;
  allocationId: string;
  currency: string;
  expiresAt: string;
  rates: CarrierRate[];
};
export type CarrierReview = {
  tenant: string;
  location: string;
  version: number;
  account: string;
  categoryId: number;
  maxUnits: number;
  maxWeightGrams: number;
  allowedServices: { courierId: string; serviceCode: string }[];
  capabilities: { alcohol: boolean; ageVerification: boolean; fragile: boolean };
  reviewReference: string;
  validUntil: string;
};
export function carrierRequest<T>(
  token: string,
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return foundationRequest<T>(token, `/merchant-carrier${path}`, method, body, signal);
}
