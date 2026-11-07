'use client';
import { useEffect, useState } from 'react';
import { useAuthorization } from '@/hooks/use-authorization';
import {
  deliverySettingsRequest,
  type LocationPage,
} from '@/services/delivery-settings.service';
import ConfigurationWorkspace from './configuration-workspace';
import { buttonClass, fieldClass } from '../market-foundation/workspace';
export default function DeliverySettingsView() {
  const { user, role, permissions } = useAuthorization();
  if (
    !['super_admin', 'admin'].includes(role) ||
    !permissions.includes('settings:write')
  )
    return <p role="alert">Platform settings authority is required.</p>;
  if (!user?.token)
    return <p role="alert">Sign in to review delivery settings.</p>;
  return <Locations key={`${role}:${user.token}`} token={user.token} />;
}
function Locations({ token }: { token: string }) {
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(1),
    [data, setData] = useState<LocationPage>(),
    [selected, setSelected] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setError('');
    setSelected('');
    void deliverySettingsRequest<LocationPage>(
      token,
      `/configuration/locations?page=${page}&limit=25`,
      'GET',
      undefined,
      controller.signal
    )
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Unable to load locations');
      });
    return () => controller.abort();
  }, [token, page, refresh]);
  const location = data?.locations.find((r) => r._id === selected);
  return (
    <main className="space-y-5">
      <header className="rounded-xl border border-muted bg-gray-50 p-5 dark:bg-gray-100/30">
        <h1 className="text-2xl font-semibold">Delivery settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
          Review local rider coverage and handling terms for a saved merchant
          location.
        </p>
      </header>
      {error && (
        <div className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:bg-red-950/20">
          <p role="alert" className="text-red-700 dark:text-red-300">
            {error}
          </p>
          <button
            className={buttonClass}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry locations
          </button>
        </div>
      )}
      {!data && !error && (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading locations…</span>
          {[0, 1].map((skeleton) => (
            <span
              className="block h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/70"
              key={skeleton}
            />
          ))}
        </div>
      )}
      {data && (
        <>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Location
            </span>
            <select
              aria-label="Location"
              className={fieldClass}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select a location</option>
              {data.locations.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.tenantName} — {r.name} ({r.code})
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              Each saved merchant location holds its own reviewed rider terms.
            </span>
          </label>
          {!data.locations.length && (
            <div className="rounded-xl border border-muted bg-gray-50 p-6 dark:bg-gray-100/30">
              <p className="font-medium">
                No active locations are available for review.
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Locations appear here once merchants save an active fulfilment
                location.
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-muted p-4">
            <button
              className={buttonClass}
              disabled={page <= 1 || !!error}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous locations
            </button>
            <span className="text-sm tabular-nums">
              Page {page} of {data.pagination.pages || 1}
            </span>
            <button
              className={buttonClass}
              disabled={page >= data.pagination.pages || !!error}
              onClick={() => setPage((p) => p + 1)}
            >
              Next locations
            </button>
          </div>
        </>
      )}
      {location && (
        <ConfigurationWorkspace
          key={`${token}:${location.tenant}:${location._id}`}
          token={token}
          location={location}
        />
      )}
    </main>
  );
}
