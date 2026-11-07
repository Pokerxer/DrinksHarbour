import { dispatchRequest } from './local-dispatch.service';
export type Coverage = {
  country: string;
  state: string;
  city: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};
export type ReviewInput = {
  tenant: string;
  location: string;
  version: number;
  currency: 'NGN';
  amountMinor: number;
  maxUnits: number;
  maxWeightGrams: number;
  vehicleTypes: string[];
  coverage: Coverage[];
  capabilities: {
    alcohol: boolean;
    ageVerification: boolean;
    fragile: boolean;
  };
  reviewReference: string;
  validUntil: string;
};
export type ReviewedContract = ReviewInput & {
  _id: string;
  status: 'reviewed' | 'revoked';
  reviewedAt: string;
  revokedAt?: string;
};
export type ConfigurationLocation = {
  _id: string;
  tenant: string;
  name: string;
  code: string;
  tenantName?: string;
};
export type Pagination = {
  page: number;
  pages: number;
  total: number;
  limit: number;
};
export type LocationPage = {
  locations: ConfigurationLocation[];
  pagination: Pagination;
};
export type DeliveryConfiguration = {
  location: ConfigurationLocation;
  state: 'reviewed' | 'revoked' | 'expired' | 'unavailable';
  creationEnabled: boolean;
  latest: ReviewedContract | null;
  contracts: ReviewedContract[];
  pagination: Pagination;
};
export const deliverySettingsRequest = dispatchRequest;
