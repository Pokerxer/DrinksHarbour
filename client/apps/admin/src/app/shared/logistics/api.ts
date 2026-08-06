// Endpoint map for the logistics dispatch module.
//
// These are plain URL builders rather than fetchers: the board is a client
// component and gets its authenticated fetch from useApiClient(), which already
// carries the bearer token. Keeping the URLs in one place stops the board and
// the drivers page drifting apart.

import type {
  CreateDeliveryPayload,
  DashboardData,
  Delivery,
  Driver,
  DriverPayload,
  ResolveStopPayload,
  UnassignedOrder,
} from './types';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const deliveries = `${API_URL}/api/deliveries`;
const drivers = `${API_URL}/api/drivers`;

function qs(
  params: Record<string, string | number | undefined | null>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

export const logisticsRoutes = {
  dashboard: () => `${deliveries}/dashboard`,
  unassigned: (params: { zone?: string; limit?: number } = {}) =>
    `${deliveries}/unassigned${qs(params)}`,
  list: (
    params: {
      status?: string;
      driver?: string;
      zone?: string;
      active?: string;
      limit?: number;
    } = {}
  ) => `${deliveries}${qs(params)}`,
  create: () => deliveries,
  detail: (id: string) => `${deliveries}/${id}`,
  dispatch: (id: string) => `${deliveries}/${id}/dispatch`,
  stop: (id: string, stopId: string) => `${deliveries}/${id}/stops/${stopId}`,
  complete: (id: string) => `${deliveries}/${id}/complete`,
  settleCod: (id: string) => `${deliveries}/${id}/settle-cod`,
  cancel: (id: string) => `${deliveries}/${id}/cancel`,

  driverList: (
    params: { status?: string; active?: string; search?: string } = {}
  ) => `${drivers}${qs(params)}`,
  driverCreate: () => drivers,
  driverDetail: (id: string) => `${drivers}/${id}`,
};

// Response shapes, so callers get a type without re-declaring them.
export type DashboardResponse = DashboardData;
export type UnassignedResponse = { orders: UnassignedOrder[] };
export type DeliveryListResponse = { deliveries: Delivery[] };
export type DeliveryResponse = { delivery: Delivery };
export type DriverListResponse = { drivers: Driver[] };
export type DriverResponse = { driver: Driver };

export type { CreateDeliveryPayload, DriverPayload, ResolveStopPayload };
