'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '@/hooks/use-api-client';
import { logisticsRoutes } from './api';
import type {
  CreateDeliveryPayload,
  DashboardData,
  Delivery,
  Driver,
  ResolveStopPayload,
  UnassignedOrder,
} from './types';

/**
 * All dispatch-board state in one place.
 *
 * Every mutation refetches the whole board rather than patching local state:
 * dispatching a trip changes the unassigned queue, the KPI counts and the
 * driver roster at once, and keeping four caches in sync by hand is how a board
 * ends up showing an order in two places.
 */
export function useLogistics() {
  const { apiCall, isAuthenticated, isLoading: authLoading } = useApiClient();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [unassigned, setUnassigned] = useState<UnassignedOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zone, setZone] = useState<string>('');

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setError(null);

    try {
      const [dash, unassignedRes, listRes, driverRes] = await Promise.all([
        apiCall<DashboardData>(logisticsRoutes.dashboard()),
        apiCall<{ orders: UnassignedOrder[] }>(logisticsRoutes.unassigned({ zone: zone || undefined })),
        apiCall<{ deliveries: Delivery[] }>(logisticsRoutes.list({ active: 'true' })),
        apiCall<{ drivers: Driver[] }>(logisticsRoutes.driverList({ active: 'true' })),
      ]);

      setDashboard(dash);
      setUnassigned(unassignedRes.orders ?? []);
      setDeliveries(listRes.deliveries ?? []);
      setDrivers(driverRes.drivers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dispatch board.');
    } finally {
      setLoading(false);
    }
  }, [apiCall, isAuthenticated, zone]);

  useEffect(() => {
    if (!authLoading) void refresh();
  }, [authLoading, refresh]);

  /** Run a mutation, surface its error, and resync the board on success. */
  const mutate = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      setError(null);
      try {
        const result = await action();
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed.');
        return null;
      }
    },
    [refresh]
  );

  const createTrip = useCallback(
    (payload: CreateDeliveryPayload) =>
      mutate(() =>
        apiCall(logisticsRoutes.create(), { method: 'POST', body: JSON.stringify(payload) })
      ),
    [apiCall, mutate]
  );

  const assignDriver = useCallback(
    (deliveryId: string, driverId: string | null) =>
      mutate(() =>
        apiCall(logisticsRoutes.detail(deliveryId), {
          method: 'PATCH',
          body: JSON.stringify({ driverId }),
        })
      ),
    [apiCall, mutate]
  );

  const dispatchTrip = useCallback(
    (deliveryId: string) =>
      mutate(() => apiCall(logisticsRoutes.dispatch(deliveryId), { method: 'POST' })),
    [apiCall, mutate]
  );

  const resolveStop = useCallback(
    (deliveryId: string, stopId: string, payload: ResolveStopPayload) =>
      mutate(() =>
        apiCall(logisticsRoutes.stop(deliveryId, stopId), {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      ),
    [apiCall, mutate]
  );

  const completeTrip = useCallback(
    (deliveryId: string) =>
      mutate(() => apiCall(logisticsRoutes.complete(deliveryId), { method: 'POST' })),
    [apiCall, mutate]
  );

  const settleCod = useCallback(
    (deliveryId: string, notes?: string) =>
      mutate(() =>
        apiCall(logisticsRoutes.settleCod(deliveryId), {
          method: 'POST',
          body: JSON.stringify({ notes }),
        })
      ),
    [apiCall, mutate]
  );

  const cancelTrip = useCallback(
    (deliveryId: string, reason?: string) =>
      mutate(() =>
        apiCall(logisticsRoutes.cancel(deliveryId), {
          method: 'POST',
          body: JSON.stringify({ reason }),
        })
      ),
    [apiCall, mutate]
  );

  return {
    dashboard,
    unassigned,
    deliveries,
    drivers,
    loading: loading || authLoading,
    error,
    setError,
    zone,
    setZone,
    refresh,
    createTrip,
    assignDriver,
    dispatchTrip,
    resolveStop,
    completeTrip,
    settleCod,
    cancelTrip,
  };
}
