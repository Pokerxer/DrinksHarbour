'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PiBuildings } from 'react-icons/pi';
import { routes } from '@/config/routes';
import LocationToolbar from './inventory-location-toolbar';
import LocationSummary from './inventory-location-summary';
import LocationTable from './inventory-location-table';
import {
  EMPTY_LOCATION_FILTERS,
  filterLocations,
  locationReports,
  type LocationFilters,
} from './inventory-location-report';
import { useInventoryLocations } from './use-inventory-locations';
export default function InventoryLocations() {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const data = useInventoryLocations(token, status);
  const [filters, setFilters] = useState<LocationFilters>(EMPTY_LOCATION_FILTERS);
  const stockAvailable = !data.loading && !data.stockError && !data.error;
  const reports = useMemo(
    () => locationReports(data.warehouses, data.stock),
    [data.warehouses, data.stock],
  );
  const visible = useMemo(
    () =>
      filterLocations(reports, {
        ...filters,
        stock: stockAvailable ? filters.stock : '',
        sort: stockAvailable ? filters.sort : 'name',
      }),
    [reports, filters, stockAvailable],
  );
  const known = new Set(data.warehouses.map((w) => w._id));
  const unassigned = data.stock.filter((row) => !known.has(row.warehouseId)).length;
  return (
    <div className="w-full">
      <div className="flex min-h-[640px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        <LocationToolbar
          filters={filters}
          change={setFilters}
          loading={data.loading}
          stockAvailable={stockAvailable}
          count={visible.length}
          total={data.warehouses.length}
          refresh={data.load}
        />
        {(data.error || data.stockError) && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 bg-red-50 px-5 py-3 text-sm text-red-700"
          >
            {data.error || data.stockError}
            {!data.error &&
              ' · Stock figures and product search are unavailable. Location search still works.'}
            <button type="button" onClick={data.load} className="underline">
              Retry
            </button>
          </div>
        )}
        <LocationSummary
          reports={visible}
          loading={data.loading}
          unavailable={!stockAvailable}
          locationUnavailable={!!data.error}
        />
        {stockAvailable && unassigned > 0 && (
          <p role="status" className="bg-amber-50 px-5 py-3 text-xs text-amber-800">
            {unassigned} stock lines have no matching location and are excluded from location
            totals.{' '}
            <Link href={routes.inventory.stock} className="underline">
              Review inventory stock
            </Link>
          </p>
        )}
        <div className="min-h-[420px] flex-1 overflow-auto lg:max-h-[70dvh]">
          {data.loading ? (
            <p role="status" className="py-12 text-center text-xs text-gray-400">
              Loading location stock…
            </p>
          ) : data.error ? null : !visible.length ? (
            <div className="py-14 text-center">
              <PiBuildings className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-xs text-gray-500">
                {data.warehouses.length
                  ? 'No locations match your filters.'
                  : 'No inventory locations yet.'}
              </p>
              {data.warehouses.length ? (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_LOCATION_FILTERS)}
                  className="mt-3 text-xs font-semibold text-[#b20202] underline"
                >
                  Show all locations
                </button>
              ) : (
                <Link
                  href={routes.warehouses.list}
                  className="mt-3 inline-block text-xs font-semibold text-[#b20202] underline"
                >
                  Set up a location
                </Link>
              )}
            </div>
          ) : (
            <LocationTable reports={visible} stockAvailable={stockAvailable} />
          )}
        </div>
        <footer className="border-t border-gray-200 bg-white px-4 py-2.5 text-[10px] text-gray-400 sm:px-5">
          Totals cover the locations shown and all their stock, even when searching for a product.
          Available = on hand − reserved. Alert counts are stock lines, not units.
        </footer>
      </div>
    </div>
  );
}
