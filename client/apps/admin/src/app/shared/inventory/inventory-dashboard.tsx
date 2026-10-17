'use client';

import { useMemo, useState } from 'react';
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
  buildHealthSlices,
  buildTopProducts,
  buildWarehouseSlices,
  computeCounts,
} from './inventory-dashboard-data';
import {
  buildHistoryFlow,
  confirmed,
  emptyInventoryFilters,
  filterHistory,
  filterStock,
  finite,
  stockHealth,
  stockTotals,
} from './inventory-dashboard-analysis';
import { useInventoryDashboardData } from './use-inventory-dashboard-data';
import InventoryDashboardFilters from './inventory-dashboard-filters';
import HistoryTotals from './inventory-dashboard-history-totals';
import { exportStock } from './inventory-dashboard-export';
import { KpiCards, KpiCardsSkeleton } from './inventory-dashboard-kpis';
import ChartSection from './inventory-dashboard-chart-section';
import OperationsGrid from './inventory-dashboard-operations';
import DashboardPanels from './inventory-dashboard-panels';
import InventoryHeader, { ErrorBanner } from './inventory-dashboard-header';

const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export default function InventoryDashboard() {
  const { data: session, status: sessionStatus } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const {
    movements,
    stockRows,
    status,
    errors,
    stockAvailable,
    historyAvailable,
    incomplete,
    lastUpdated,
    load,
  } = useInventoryDashboardData(token);
  const [filters, setFilters] = useState(emptyInventoryFilters);
  const rows = useMemo(() => filterStock(stockRows, filters), [stockRows, filters]);
  const history = useMemo(
    () => filterHistory(movements, filters, stockRows),
    [movements, filters, stockRows],
  );
  const postedHistory = useMemo(() => history.filter(confirmed), [history]);
  const counts = useMemo(() => computeCounts(postedHistory), [postedHistory]);
  const flowData = useMemo(() => buildHistoryFlow(postedHistory), [postedHistory]);
  const healthSlices = useMemo(() => buildHealthSlices(rows), [rows]);
  const warehouseSlices = useMemo(() => buildWarehouseSlices(rows), [rows]);
  const topProducts = useMemo(() => buildTopProducts(rows), [rows]);
  const totals = useMemo(() => stockTotals(rows), [rows]);
  const lowStock = useMemo(
    () =>
      rows
        .filter((row) => ['low', 'out'].includes(stockHealth(row)))
        .map((row) => ({
          _id: row._id,
          product: { name: `${row.productName} · ${row.sizeName} · ${row.warehouseName}` },
          sku: row.sku,
          availableStock: row.flags?.available ?? finite(row.currentQuantity),
          reorderPoint: row.flags?.reorderPoint ?? finite(row.minStockLevel),
          lowStockThreshold: finite(row.minStockLevel),
        })),
    [rows],
  );
  if (sessionStatus !== 'loading' && !token)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
        <PiSignInDuotone className="h-10 w-10 text-gray-300" />
        <h1 className="text-lg font-bold text-gray-900">Sign in required</h1>
        <p className="text-sm text-gray-500">Sign in to your tenant account to view inventory.</p>
        <Link
          href={routes.signIn}
          className="mt-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white"
        >
          Go to sign in
        </Link>
      </div>
    );
  const loading = status === 'loading' || sessionStatus === 'loading';
  const value = (number: number, money = false) =>
    stockAvailable ? (money ? ngn.format(number) : number.toLocaleString()) : 'Unavailable';
  const kpis = [
    {
      label: 'Stock value',
      value: value(totals.cost, true),
      icon: <PiCoinsDuotone />,
      href: routes.inventory.valuation,
    },
    {
      label: 'Retail value',
      value: value(totals.retail, true),
      icon: <PiChartLineUpDuotone />,
      href: routes.inventory.valuation,
    },
    { label: 'Potential profit', value: value(totals.profit, true), icon: <PiTrendUpDuotone /> },
    {
      label: 'Units on hand',
      value: value(totals.units),
      icon: <PiCubeDuotone />,
      href: routes.inventory.stock,
    },
    {
      label: 'Low stock lines',
      value: value(totals.low),
      icon: <PiWarningCircleDuotone />,
      tone: 'warn' as const,
      href: routes.inventory.procurement,
    },
    {
      label: 'Out of stock lines',
      value: value(totals.out),
      icon: <PiEmptyDuotone />,
      tone: 'danger' as const,
      href: routes.inventory.stock,
    },
  ];
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <InventoryHeader
        loading={loading}
        refreshing={status === 'refreshing'}
        lastUpdated={lastUpdated}
        onRefresh={load}
      />
      {errors.length > 0 && <ErrorBanner message={errors.join(' · ')} onRetry={load} />}
      {incomplete && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          Only the most recent {movements.length.toLocaleString()} movement records were loaded.
          History totals are incomplete. Current stock totals are unaffected.
        </p>
      )}
      <InventoryDashboardFilters
        rows={stockRows}
        movements={movements}
        filters={filters}
        change={setFilters}
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Current stock · {rows.length.toLocaleString()} matching warehouse stock lines · quantities
          include zero and negative balances
        </p>
        <button
          type="button"
          onClick={() => exportStock(rows)}
          disabled={!stockAvailable || loading || status === 'refreshing'}
          className="rounded-lg border border-[#ece4d6] bg-white px-3 py-2 text-xs font-semibold text-gray-600 disabled:opacity-50"
        >
          Export filtered stock
        </button>
      </div>
      <section className="mb-6">
        {loading ? <KpiCardsSkeleton /> : <KpiCards data={kpis} />}
      </section>
      {stockAvailable && rows.length === 0 && (
        <p className="mb-4 rounded-xl bg-white p-4 text-sm text-gray-500">
          No stock matches these filters. Clear filters to see all products.
        </p>
      )}
      {!loading && <HistoryTotals movements={postedHistory} available={historyAvailable} />}
      <section className="mb-6">
        <ChartSection
          flowData={flowData}
          healthSlices={healthSlices}
          warehouseSlices={warehouseSlices}
          topProducts={topProducts}
          loading={loading}
          stockAvailable={stockAvailable}
          historyAvailable={historyAvailable}
        />
      </section>
      <section className="mb-6">
        <p className="mb-3 text-xs text-gray-500">
          Confirmed movement record counts in the selected history. Transfers count distinct
          references; internal counts include each warehouse leg.
        </p>
        {historyAvailable || loading ? (
          <OperationsGrid
            counts={counts}
            loading={loading}
            hrefs={{
              returns: routes.inventory.returns,
              receipts: routes.inventory.receipts,
              deliveries: routes.inventory.deliveries,
              internal: routes.inventory.internal,
              adjustments: routes.inventory.adjustments,
              scrap: routes.inventory.scrap,
              transfers: routes.inventory.transfers,
            }}
          />
        ) : (
          <p className="rounded-xl bg-white p-4 text-sm text-gray-500">
            Movement counts are unavailable until history loads.
          </p>
        )}
      </section>
      <DashboardPanels
        recentMoves={postedHistory.slice(0, 8)}
        lowStockItems={lowStock}
        loading={loading}
      />
    </main>
  );
}
