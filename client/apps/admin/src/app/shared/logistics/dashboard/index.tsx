'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Empty, Text, Title } from 'rizzui';
import { PiArrowClockwiseBold, PiUsersThreeDuotone } from 'react-icons/pi';
import { routes } from '@/config/routes';
import KpiCards from './kpi-cards';
import UnassignedOrders from './unassigned-orders';
import TripCard from './trip-card';
import CreateTripModal from './create-trip-modal';
import ResolveStopModal from './resolve-stop-modal';
import { useLogistics } from '../use-logistics';
import { DRIVER_STATUS_COLOR, DRIVER_STATUS_LABEL } from '../format';
import type {
  Delivery,
  DeliveryStop,
  DriverStatus,
  ResolveStopPayload,
} from '../types';

export default function LogisticsDashboard() {
  const {
    dashboard,
    unassigned,
    deliveries,
    drivers,
    loading,
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
    cancelTrip,
  } = useLogistics();

  const [selected, setSelected] = useState<string[]>([]);
  const [buildOpen, setBuildOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [resolving, setResolving] = useState<{
    delivery: Delivery;
    stop: DeliveryStop;
    mode: 'delivered' | 'failed';
  } | null>(null);

  const selectedOrders = unassigned.filter((o) => selected.includes(o._id));

  function toggle(orderId: string) {
    setSelected((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  }

  function selectAll() {
    setSelected((prev) =>
      prev.length === unassigned.length ? [] : unassigned.map((o) => o._id)
    );
  }

  async function handleCreateTrip(payload: Parameters<typeof createTrip>[0]) {
    setSubmitting(true);
    const result = await createTrip(payload);
    setSubmitting(false);
    if (result !== null) {
      setBuildOpen(false);
      setSelected([]);
    }
  }

  async function handleResolve(payload: ResolveStopPayload) {
    if (!resolving) return;
    setSubmitting(true);
    const result = await resolveStop(
      resolving.delivery._id,
      resolving.stop._id,
      payload
    );
    setSubmitting(false);
    if (result !== null) setResolving(null);
  }

  const driverCounts = dashboard?.drivers;

  return (
    <div className="@container">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title as="h2" className="text-xl font-semibold">
            Dispatch board
          </Title>
          <Text className="text-sm text-gray-500">
            Batch waiting orders onto rider trips and track them to the door.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Link href={routes.logistics.drivers}>
            <Button variant="outline" size="sm">
              <PiUsersThreeDuotone className="me-1.5 h-4 w-4" />
              Drivers
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <PiArrowClockwiseBold className="me-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Alert
          color="danger"
          variant="flat"
          className="mb-5"
          closable
          onClose={() => setError(null)}
        >
          <Text>{error}</Text>
        </Alert>
      ) : null}

      <KpiCards data={dashboard} loading={loading} className="mb-6" />

      {driverCounts ? (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Text className="text-sm text-gray-500">Riders:</Text>
          {(Object.keys(driverCounts) as DriverStatus[]).map((status) => (
            <Badge
              key={status}
              variant="outline"
              size="sm"
              color={DRIVER_STATUS_COLOR[status]}
            >
              {DRIVER_STATUS_LABEL[status]} {driverCounts[status] ?? 0}
            </Badge>
          ))}
          {drivers.length === 0 && !loading ? (
            <Link
              href={routes.logistics.drivers}
              className="text-sm text-primary hover:underline"
            >
              Add your first rider →
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-6">
        <UnassignedOrders
          className="col-span-full @4xl:col-span-5 @6xl:col-span-4"
          orders={unassigned}
          selected={selected}
          onToggle={toggle}
          onSelectAll={selectAll}
          onCreateTrip={() => setBuildOpen(true)}
          zone={zone}
          onZoneChange={setZone}
          zones={dashboard?.zones ?? []}
          loading={loading}
        />

        <div className="col-span-full space-y-4 @4xl:col-span-7 @6xl:col-span-8">
          <div className="flex items-center justify-between">
            <Title as="h3" className="text-base font-semibold">
              Active trips
              <Badge
                variant="flat"
                color="secondary"
                size="sm"
                className="ms-2"
              >
                {deliveries.length}
              </Badge>
            </Title>
          </div>

          {loading && deliveries.length === 0 ? (
            <div className="rounded-lg border border-muted p-8 text-center">
              <Text className="text-sm text-gray-500">Loading trips…</Text>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="rounded-lg border border-muted">
              <Empty
                className="p-10"
                text="No active trips. Select orders on the left to build one."
                textClassName="text-sm text-gray-500"
              />
            </div>
          ) : (
            deliveries.map((delivery) => (
              <TripCard
                key={delivery._id}
                delivery={delivery}
                drivers={drivers}
                onAssignDriver={assignDriver}
                onDispatch={dispatchTrip}
                onResolveStop={(d, stop, mode) =>
                  setResolving({ delivery: d, stop, mode })
                }
                onComplete={completeTrip}
                onCancel={(id) => cancelTrip(id)}
              />
            ))
          )}
        </div>
      </div>

      <CreateTripModal
        open={buildOpen}
        orders={selectedOrders}
        drivers={drivers}
        onClose={() => setBuildOpen(false)}
        onSubmit={handleCreateTrip}
        submitting={submitting}
      />

      <ResolveStopModal
        open={resolving !== null}
        stop={resolving?.stop ?? null}
        mode={resolving?.mode ?? 'delivered'}
        onClose={() => setResolving(null)}
        onSubmit={handleResolve}
        submitting={submitting}
      />
    </div>
  );
}
