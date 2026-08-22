'use client';

// app/shared/purchases/warehouse-select.tsx — the one destination-warehouse picker,
// shared by the create, edit and settings screens so all three seed and render the
// same way. Seeding rules live in ./warehouse-select-helpers (pure, unit-tested).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PiCaretDown, PiWarehouse } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import { pickSeedWarehouse } from './warehouse-select-helpers';

/**
 * Load this tenant's active warehouses once per token.
 *
 * Returns `loaded` separately from `loading` so callers can tell "still fetching"
 * from "fetched, and there genuinely are none" — the two need different empty states.
 */
export function useActiveWarehouses(token: string) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // getWarehouses resolves to the raw JSON envelope (untyped), so name the
        // shape here rather than letting `unknown` leak into the state setter.
        const res = (await warehouseService.getWarehouses(token, {
          isActive: true,
        })) as { data?: Warehouse[] };
        if (cancelled) return;
        setWarehouses(res.data ?? []);
      } catch {
        if (cancelled) return;
        setWarehouses([]);
        toast.error('Failed to load warehouses');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { warehouses, loading, loaded };
}

/**
 * Seed `value` from the loaded list once, without ever clobbering a pick the user
 * has already made (the loading effect re-runs on token refresh).
 */
export function useSeededWarehouse(
  warehouses: Warehouse[],
  loaded: boolean,
  value: string,
  onChange: (id: string) => void,
  setting?: string
) {
  useEffect(() => {
    if (!loaded || warehouses.length === 0) return;
    const seed = pickSeedWarehouse(warehouses, { current: value, setting });
    if (seed && seed !== value) onChange(seed);
    // `value` is read through pickSeedWarehouse but must not retrigger seeding —
    // re-running on every keystroke of the user's own choice would fight them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, warehouses, setting]);
}

const SELECT_CLS =
  'w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm text-gray-900 outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400';

export default function WarehouseSelect({
  warehouses,
  loading,
  value,
  onChange,
  id = 'destination-warehouse',
  noneLabel,
  disabled = false,
}: {
  warehouses: Warehouse[];
  loading: boolean;
  value: string;
  onChange: (id: string) => void;
  id?: string;
  /** When set, an explicit "no warehouse" option is offered with this label. */
  noneLabel?: string;
  disabled?: boolean;
}) {
  // Fetched and genuinely empty is a dead end the user can act on — send them to
  // the warehouses module rather than showing an empty dropdown.
  if (!loading && warehouses.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        No warehouses yet —{' '}
        <Link href={routes.warehouses.list} className="font-semibold underline">
          create one
        </Link>{' '}
        so received goods have somewhere to land.
      </div>
    );
  }

  return (
    <div className="relative">
      <PiWarehouse className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <select
        id={id}
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
        className={`${SELECT_CLS} pl-9`}
      >
        {loading && <option value="">Loading warehouses…</option>}
        {!loading && noneLabel && <option value="">{noneLabel}</option>}
        {warehouses.map((w) => (
          <option key={w._id} value={w._id}>
            {w.code ? `${w.name} (${w.code})` : w.name}
            {w.isDefault ? ' — default' : ''}
          </option>
        ))}
      </select>
      <PiCaretDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
    </div>
  );
}
