'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiChartLineUpDuotone,
  PiCoinsDuotone,
  PiCubeDuotone,
  PiEmptyDuotone,
  PiSignInDuotone,
  PiTrendUpDuotone,
  PiWarningCircleDuotone,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import {
  inventoryService,
  type InventoryMovement,
  type InventoryValuation,
  type LowStockItem,
} from '@/services/inventory.service';
import {
  warehouseStockService,
  type StockRow,
} from '@/services/warehouseStock.service';
import {
  FLOW_DAYS,
  buildFlowData,
  buildHealthSlices,
  buildTopProducts,
  buildWarehouseSlices,
  computeCounts,
  countOutOfStock,
  sumUnits,
} from './inventory-dashboard-data';
import { KpiCards, KpiCardsSkeleton } from './inventory-dashboard-kpis';
import ChartSection from './inventory-dashboard-chart-section';
import OperationsGrid from './inventory-dashboard-operations';
import DashboardPanels from './inventory-dashboard-panels';
import InventoryHeader, { ErrorBanner } from './inventory-dashboard-header';

const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

type Status = 'loading' | 'refreshing' | 'ready' | 'error';

export default function InventoryDashboard() {
  const { data: session, status: sessionStatus } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Monotonic request id — only the latest load may commit state.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    const requestId = ++requestIdRef.current;
    setStatus((s) => (s === 'loading' ? 'loading' : 'refreshing'));
    try {
      const flowStart = new Date();
      flowStart.setDate(flowStart.getDate() - (FLOW_DAYS - 1));
      flowStart.setHours(0, 0, 0, 0);

      const [movesRes, valRes, lowRes, stockRes] = await Promise.allSettled([
        inventoryService.getMovements(token, {
          limit: 500,
          startDate: flowStart.toISOString(),
        }),
        inventoryService.getInventoryValuation(token),
        inventoryService.getLowStockItems(token),
        warehouseStockService.getAllStock(token),
      ]);

      // A newer refresh started; this response is stale — drop it.
      if (requestId !== requestIdRef.current) return;

      let failures = 0;
      let firstError: string | null = null;
      const settle = <T,>(
        res: PromiseSettledResult<T>,
        apply: (v: T) => void
      ) => {
        if (res.status === 'fulfilled') apply(res.value);
        else {
          failures += 1;
          firstError ??=
            res.reason instanceof Error
              ? res.reason.message
              : 'Some inventory data failed to load';
        }
      };

      settle(movesRes, (r) =>
        setMovements(
          (r as { data?: { movements?: InventoryMovement[] } }).data
            ?.movements ?? []
        )
      );
      settle(valRes, (r) =>
        setValuation((r as { data?: InventoryValuation }).data ?? null)
      );
      settle(lowRes, (r) =>
        setLowStock((r as { data?: LowStockItem[] }).data ?? [])
      );
      settle(stockRes, (r) =>
        setStockRows((r as { data?: StockRow[] }).data ?? [])
      );

      setStatus(failures === 4 ? 'error' : 'ready');
      setErrorMsg(failures > 0 ? firstError : null);
      if (failures === 0) setLastUpdated(new Date().toISOString());
    } catch {
      if (requestId === requestIdRef.current) {
        setStatus('error');
        setErrorMsg('Failed to load inventory data');
      }
    }
  }, [token]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') load();
  }, [load, sessionStatus]);

  const counts = useMemo(() => computeCounts(movements), [movements]);
  const flowData = useMemo(() => buildFlowData(movements), [movements]);
  const healthSlices = useMemo(() => buildHealthSlices(stockRows), [stockRows]);
  const warehouseSlices = useMemo(
    () => buildWarehouseSlices(stockRows),
    [stockRows]
  );
  const topProducts = useMemo(() => buildTopProducts(stockRows), [stockRows]);
  const unitsOnHand = useMemo(() => sumUnits(stockRows), [stockRows]);
  const outOfStockCount = useMemo(
    () => countOutOfStock(stockRows),
    [stockRows]
  );

  if (sessionStatus !== 'loading' && !token) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
        <PiSignInDuotone className="h-10 w-10 text-gray-300" />
        <h1 className="text-lg font-bold text-gray-900">Sign in required</h1>
        <p className="text-sm text-gray-500">
          Sign in to your tenant account to view live inventory health,
          valuation and operations.
        </p>
        <Link
          href={routes.signIn}
          className="mt-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202]"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  const initialLoad = status === 'loading' && !valuation;
  const busy = status === 'loading' || status === 'refreshing';

  const kpis = [
    {
      label: 'Stock value',
      value: valuation ? ngn.format(valuation.totalValue) : '\u2026',
      icon: <PiCoinsDuotone />,
      href: routes.inventory.valuation,
    },
    {
      label: 'Retail value',
      value: valuation ? ngn.format(valuation.totalRetailValue) : '\u2026',
      icon: <PiChartLineUpDuotone />,
      href: routes.inventory.valuation,
    },
    {
      label: 'Potential profit',
      value: valuation ? ngn.format(valuation.potentialProfit) : '\u2026',
      icon: <PiTrendUpDuotone />,
    },
    {
      label: 'Units on hand',
      value: unitsOnHand.toLocaleString(),
      icon: <PiCubeDuotone />,
      href: routes.inventory.stock,
    },
    {
      label: 'Low stock',
      value: String(lowStock.length),
      icon: <PiWarningCircleDuotone />,
      tone: 'warn' as const,
      href: routes.inventory.procurement,
    },
    {
      label: 'Out of stock',
      value: String(outOfStockCount),
      icon: <PiEmptyDuotone />,
      tone: 'danger' as const,
      href: routes.inventory.stock,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-5 lg:px-6">
      <InventoryHeader
        loading={initialLoad}
        refreshing={status === 'refreshing'}
        lastUpdated={lastUpdated}
        onRefresh={load}
      />

      {errorMsg && (
        <ErrorBanner
          message={
            status === 'error'
              ? `${errorMsg} — no inventory data could be loaded.`
              : `Partial load: ${errorMsg}`
          }
          onRetry={load}
        />
      )}

      {initialLoad ? (
        <section className="mb-6">
          <KpiCardsSkeleton />
        </section>
      ) : (
        <section className="mb-6">
          <KpiCards data={kpis} />
        </section>
      )}

      <section className="mb-6">
        <ChartSection
          flowData={flowData}
          healthSlices={healthSlices}
          warehouseSlices={warehouseSlices}
          topProducts={topProducts}
          loading={status === 'loading'}
        />
      </section>

      <section className="mb-6">
        <OperationsGrid
          counts={counts}
          loading={busy && movements.length === 0}
          hrefs={{
            receipts: routes.inventory.receipts,
            deliveries: routes.inventory.deliveries,
            internal: routes.inventory.internal,
            adjustments: routes.inventory.adjustments,
            scrap: routes.inventory.scrap,
            transfers: routes.inventory.transfers,
          }}
        />
      </section>

      <section>
        <DashboardPanels
          recentMoves={movements.slice(0, 8)}
          lowStockItems={lowStock}
          loading={status === 'loading'}
        />
      </section>
    </div>
  );
}
