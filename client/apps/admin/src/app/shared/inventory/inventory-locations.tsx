'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiArrowClockwise,
  PiArrowRight,
  PiBuildings,
  PiMapPin,
  PiStar,
  PiStorefront,
  PiTruck,
  PiWarehouse,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import {
  warehouseStockService,
  type StockRow,
} from '@/services/warehouseStock.service';

const TYPE_META: Record<
  Warehouse['type'],
  { label: string; icon: React.ReactNode }
> = {
  warehouse: { label: 'Warehouse', icon: <PiWarehouse /> },
  store: { label: 'Store', icon: <PiStorefront /> },
  distribution_center: { label: 'Distribution Center', icon: <PiTruck /> },
};

function addressLine(w: Warehouse) {
  const a = w.address;
  if (!a) return '—';
  return [a.line1, a.city, a.state].filter(Boolean).join(', ') || '—';
}

/**
 * Locations report: every stock location (warehouse / store / DC) with its
 * live stock footprint, linking into the warehouse detail page.
 */
export default function InventoryLocations() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [whRes, stockRes] = await Promise.allSettled([
        warehouseService.getWarehouses(token),
        warehouseStockService.getAllStock(token),
      ]);
      if (whRes.status === 'fulfilled') {
        const v = whRes.value as { data?: Warehouse[] };
        setWarehouses(v.data ?? []);
      }
      if (stockRes.status === 'fulfilled') setStock(stockRes.value.data ?? []);
      const failed = [whRes, stockRes].find((r) => r.status === 'rejected');
      if (failed && failed.status === 'rejected') {
        toast.error(
          failed.reason instanceof Error
            ? failed.reason.message
            : 'Failed to load locations'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const footprint = useMemo(() => {
    const map = new Map<string, { lines: number; units: number }>();
    for (const r of stock) {
      const cur = map.get(r.warehouseId) ?? { lines: 0, units: 0 };
      cur.lines += 1;
      cur.units += r.currentQuantity;
      map.set(r.warehouseId, cur);
    }
    return map;
  }, [stock]);

  return (
    <div className="p-4 md:p-5 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Locations</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Stock footprint per location — warehouses, stores and distribution
            centers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={routes.warehouses.list}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Manage warehouses
          </Link>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <PiArrowClockwise className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-gray-400">
          Loading locations…
        </p>
      ) : warehouses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center">
          <PiBuildings className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">
            No locations yet — create your first warehouse to start tracking
            stock.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {warehouses.map((w) => {
            const meta = TYPE_META[w.type] ?? TYPE_META.warehouse;
            const fp = footprint.get(w._id) ?? { lines: 0, units: 0 };
            return (
              <Link
                key={w._id}
                href={routes.warehouses.detail(w._id)}
                className="group rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-[#b20202]/30 hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors group-hover:bg-[#fef2f2] group-hover:text-[#b20202] [&>svg]:h-5 [&>svg]:w-5">
                      {meta.icon}
                    </span>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                        {w.name}
                        {w.isDefault && (
                          <PiStar className="h-3.5 w-3.5 text-amber-400" />
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {w.code} · {meta.label}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      w.isActive
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {w.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p className="mb-3 flex items-center gap-1.5 text-xs text-gray-500">
                  <PiMapPin className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                  {addressLine(w)}
                </p>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
                  <span className="text-gray-500">
                    <span className="font-bold text-gray-900">
                      {fp.units.toLocaleString()}
                    </span>{' '}
                    units · {fp.lines} line{fp.lines === 1 ? '' : 's'}
                  </span>
                  <PiArrowRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#b20202]" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
