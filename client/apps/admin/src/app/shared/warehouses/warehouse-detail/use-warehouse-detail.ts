'use client';

// app/shared/warehouses/warehouse-detail/use-warehouse-detail.ts
// Data hook for the detail page: loads the warehouse, its stock lines and the
// tenant's warehouse settings in parallel and tracks a phase machine so the UI
// can distinguish loading / ready / error / not-found instead of showing an
// empty state for all of them.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  warehouseService,
  type Warehouse,
  type WarehouseSettings,
} from '@/services/warehouse.service';
import {
  warehouseStockService,
  type WarehouseStockRow,
} from '@/services/warehouseStock.service';
import { LOW_STOCK } from './row-utils';

export type DetailPhase = 'loading' | 'ready' | 'error' | 'not_found';

const NOT_FOUND_PATTERNS = [
  /not\s*found/i,
  /status[:\s]*404\b/i,
  /\b404\b/,
];

export function useWarehouseDetail(warehouseId: string) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [phase, setPhase] = useState<DetailPhase>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [rows, setRows] = useState<WarehouseStockRow[]>([]);
  const [lowStock, setLowStock] = useState(LOW_STOCK);

  const load = useCallback(async () => {
    if (!token) {
      // `phase` starts at 'loading'; clearing it here keeps a signed-out or
      // mid-hydration visit from spinning forever.
      setPhase((p) => (p === 'loading' ? 'ready' : p));
      return;
    }
    setPhase('loading');
    try {
      // Warehouse first: a 404 must short-circuit before we render stock.
      let wh: Warehouse;
      try {
        // The service's handle() is untyped upstream, so assert the envelope.
        const res = (await warehouseService.getWarehouseById(
          warehouseId,
          token
        )) as { data: Warehouse };
        wh = res.data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (NOT_FOUND_PATTERNS.some((re) => re.test(msg))) {
          setPhase('not_found');
          return;
        }
        throw e;
      }
      const stock = (await warehouseStockService.getWarehouseStock(
        warehouseId,
        token
      )) as { data?: WarehouseStockRow[] };
      setWarehouse(wh);
      setRows(stock.data ?? []);
      setPhase('ready');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to load');
      setPhase('error');
    }
  }, [token, warehouseId]);

  useEffect(() => {
    load();
  }, [load]);

  // Tenant-global low-stock threshold from warehouse settings; purely a
  // display refinement, so failures are swallowed.
  useEffect(() => {
    if (!token || phase !== 'ready') return;
    let alive = true;
    warehouseService
      .getWarehouseSettings(token)
      .then((res) => {
        if (!alive) return;
        const settings: WarehouseSettings | undefined =
          res?.data?.warehouseSettings;
        if (typeof settings?.lowStockThreshold === 'number')
          setLowStock(settings.lowStockThreshold);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, phase]);

  const stats = useMemo(() => {
    const units = rows.reduce((s, r) => s + r.currentQuantity, 0);
    const reserved = rows.reduce((s, r) => s + r.reservedQuantity, 0);
    return { total: rows.length, units, reserved };
  }, [rows]);

  return {
    phase,
    errorMessage,
    warehouse,
    rows,
    lowStock,
    stats,
    reload: load,
  };
}
