'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Empty, Input, Text, Title } from 'rizzui';
import { PiMagnifyingGlassBold, PiPlusBold } from 'react-icons/pi';
import { useApiClient } from '@/hooks/use-api-client';
import { logisticsRoutes } from '../api';
import { DRIVER_STATUS_COLOR, DRIVER_STATUS_LABEL } from '../format';
import DriverFormModal from './driver-form-modal';
import type { Driver, DriverPayload } from '../types';

export default function DriversPage() {
  const { apiCall, isAuthenticated, isLoading: authLoading } = useApiClient();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Driver | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setError(null);
    try {
      const res = await apiCall<{ drivers: Driver[] }>(
        logisticsRoutes.driverList()
      );
      setDrivers(res.drivers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load drivers.');
    } finally {
      setLoading(false);
    }
  }, [apiCall, isAuthenticated]);

  useEffect(() => {
    if (!authLoading) void refresh();
  }, [authLoading, refresh]);

  async function handleSubmit(payload: DriverPayload) {
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await apiCall(logisticsRoutes.driverDetail(editing._id), {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiCall(logisticsRoutes.driverCreate(), {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setFormOpen(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save the driver.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(driver: Driver) {
    setError(null);
    try {
      await apiCall(logisticsRoutes.driverDetail(driver._id), {
        method: 'DELETE',
      });
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not deactivate the driver.'
      );
    }
  }

  const term = search.trim().toLowerCase();
  const visible = term
    ? drivers.filter(
        (d) =>
          d.name.toLowerCase().includes(term) ||
          d.phone.includes(term) ||
          (d.vehicle?.plateNumber ?? '').toLowerCase().includes(term)
      )
    : drivers;

  return (
    <div className="@container">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title as="h2" className="text-xl font-semibold">
            Riders
          </Title>
          <Text className="text-sm text-gray-500">
            Everyone who can be assigned a delivery trip.
          </Text>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <PiPlusBold className="me-1.5 h-3.5 w-3.5" />
          Add rider
        </Button>
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

      <Input
        placeholder="Search by name, phone or plate"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        prefix={<PiMagnifyingGlassBold className="h-4 w-4" />}
        className="mb-5 max-w-sm"
      />

      {loading ? (
        <div className="rounded-lg border border-muted p-8 text-center">
          <Text className="text-sm text-gray-500">Loading riders…</Text>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-muted">
          <Empty
            className="p-10"
            text={
              drivers.length === 0
                ? 'No riders yet. Add one before building a trip.'
                : 'No riders match that search.'
            }
            textClassName="text-sm text-gray-500"
          />
        </div>
      ) : (
        <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {visible.map((driver) => (
            <div
              key={driver._id}
              className="rounded-lg border border-muted bg-gray-0 p-4 dark:bg-gray-50"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Title as="h4" className="truncate text-sm font-semibold">
                    {driver.name}
                  </Title>
                  <a
                    href={`tel:${driver.phone}`}
                    className="text-xs text-primary hover:underline"
                  >
                    {driver.phone}
                  </a>
                </div>
                <Badge
                  variant="flat"
                  size="sm"
                  color={
                    driver.isActive
                      ? DRIVER_STATUS_COLOR[driver.status]
                      : 'secondary'
                  }
                >
                  {driver.isActive
                    ? DRIVER_STATUS_LABEL[driver.status]
                    : 'Deactivated'}
                </Badge>
              </div>

              {driver.vehicle?.type || driver.vehicle?.plateNumber ? (
                <Text className="text-xs capitalize text-gray-500">
                  {[driver.vehicle.type, driver.vehicle.plateNumber]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : null}

              {driver.licenseNumber ? (
                <Text className="mt-1 text-xs text-gray-400">
                  Licence {driver.licenseNumber}
                </Text>
              ) : null}

              <div className="mt-3 flex gap-2 border-t border-muted pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(driver);
                    setFormOpen(true);
                  }}
                >
                  Edit
                </Button>
                {driver.isActive ? (
                  <Button
                    size="sm"
                    variant="text"
                    color="danger"
                    // The server refuses this mid-trip; disabling here saves the round trip.
                    disabled={driver.status === 'on_trip'}
                    title={
                      driver.status === 'on_trip'
                        ? 'This rider is out on a trip'
                        : undefined
                    }
                    onClick={() => void handleDeactivate(driver)}
                  >
                    Deactivate
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <DriverFormModal
        open={formOpen}
        driver={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}
