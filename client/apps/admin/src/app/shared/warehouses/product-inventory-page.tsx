'use client';

// app/shared/warehouses/product-inventory-page.tsx
//
// /warehouses/product/[id] — the warehouse-side home for one product:
// its inventory across every location and its full movement history.
//
// Identity comes straight from GET /subproducts/:id so the header renders the
// real product name/image even when the product has no stock anywhere (the
// stocked rows only carry identity as populated refs). Reuses the sub-product
// page's LocationsTab + HistoryTab pieces.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiArrowLeft,
  PiChartLine,
  PiCubeBold,
  PiLockKeyBold,
  PiMagnifyingGlass,
  PiPackageBold,
  PiSpinner,
  PiWarehouse,
} from 'react-icons/pi';
import {
  inventoryService,
  type InventoryMovement,
  type InventorySummary,
} from '@/services/inventory.service';
import { subproductService } from '@/services/subproduct.service';
import type { WarehouseStockRow } from '@/services/warehouseStock.service';
import { routes } from '@/config/routes';
import { fraunces } from '../purchases/purchases-fonts';
import { LocationsTab } from '../ecommerce/sub-product/create-edit/inventory/LocationsTab';
import { InventorySummaryCard } from '../ecommerce/sub-product/create-edit/inventory/HistoryTab/InventorySummaryCard';
import { ServerMovementsList } from '../ecommerce/sub-product/create-edit/inventory/HistoryTab/ServerMovementsList';
import AdjustStockModal from './warehouse-detail/adjust-stock-modal';
import type { AdjustType } from '@/services/warehouseStock.service';

type Tab = 'inventory' | 'history';

const isTab = (v: string | null): v is Tab =>
  v === 'inventory' || v === 'history';

/** Header identity, tolerant of whatever the sub-product endpoint populates. */
interface ProductIdentity {
  name: string;
  sku: string;
  image: string | null;
}

function identityFromSubProduct(sp: unknown): ProductIdentity {
  const doc = sp as {
    sku?: string;
    name?: string;
    imagesOverride?: { url?: string }[];
    images?: { url?: string }[];
    product?:
      | string
      | { name?: string; images?: { url?: string }[] }
      | null;
  };
  const prod =
    doc?.product && typeof doc.product === 'object' ? doc.product : null;
  return {
    name: prod?.name || doc?.name || '',
    sku: doc?.sku ?? '',
    image:
      doc?.imagesOverride?.[0]?.url ??
      doc?.images?.[0]?.url ??
      prod?.images?.[0]?.url ??
      null,
  };
}

function identityFromRows(rows: WarehouseStockRow[]): ProductIdentity {
  const first = rows[0];
  if (!first) return { name: '', sku: '', image: null };
  const sp =
    first.subProduct && typeof first.subProduct === 'object'
      ? first.subProduct
      : null;
  return {
    name: sp?.product?.name ?? '',
    sku: sp?.sku ?? '',
    image:
      sp?.imagesOverride?.[0]?.url ??
      sp?.product?.images?.[0]?.url ??
      null,
  };
}

export default function ProductInventoryPage({
  subProductId,
}: {
  subProductId: string;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTabState] = useState<Tab>(() =>
    searchParams.get('tab') === 'history' ? 'history' : 'inventory'
  );
  const setTab = useCallback(
    (t: Tab) => {
      setTabState(t);
      router.replace(t === 'inventory' ? '?' : `?tab=${t}`, { scroll: false });
    },
    [router]
  );

  const [identity, setIdentity] = useState<ProductIdentity | null>(null);
  const [rows, setRows] = useState<WarehouseStockRow[] | null>(null);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<{
    row: WarehouseStockRow;
    type: AdjustType;
  } | null>(null);

  // Authoritative identity — works even with zero stock anywhere.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    subproductService
      .getSubProduct(subProductId, token)
      .then((res: unknown) => {
        if (!alive) return;
        const sp = (res as { data?: { subProduct?: unknown } })?.data
          ?.subProduct;
        if (sp) setIdentity(identityFromSubProduct(sp));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, subProductId]);

  const loadLocations = useCallback(async () => {
    if (!token) return;
    try {
      const { warehouseStockService } = await import(
        '@/services/warehouseStock.service'
      );
      const res = (await warehouseStockService.getStockByWarehouse(
        subProductId,
        token
      )) as { data?: WarehouseStockRow[] };
      setRows(res.data ?? []);
    } catch {
      setRows([]);
    }
  }, [subProductId, token]);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const [summaryRes, movementsRes] = (await Promise.all([
        inventoryService.getInventorySummary(subProductId, token),
        inventoryService.getMovements(token, { subProductId, limit: 100 }),
      ])) as [
        { success: boolean; data?: InventorySummary },
        { success: boolean; data?: { movements?: InventoryMovement[] } },
      ];
      if (summaryRes.success) setSummary(summaryRes.data ?? null);
      if (movementsRes.success)
        setMovements(movementsRes.data?.movements || []);
    } catch {
      // The history list renders its own empty state on failure.
      setMovements([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [subProductId, token]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    if (tab === 'history' && movements.length === 0 && !loadingHistory) {
      loadHistory();
    }
  }, [tab, movements.length, loadingHistory, loadHistory]);

  // ── KPI rollup off the stocked rows ──
  const kpis = useMemo(() => {
    if (!rows)
      return {
        locations: 0,
        onHand: 0,
        reserved: 0,
        available: 0,
        value: null as number | null,
      };
    let onHand = 0;
    let reserved = 0;
    let value = 0;
    let priced = false;
    for (const r of rows) {
      onHand += r.currentQuantity || 0;
      reserved += r.reservedQuantity || 0;
      const sz = r.size && typeof r.size === 'object' ? r.size : null;
      const sp =
        r.subProduct && typeof r.subProduct === 'object' ? r.subProduct : null;
      const c =
        sz?.costPrice && sz.costPrice > 0
          ? sz.costPrice
          : sp?.costPrice && sp.costPrice > 0
            ? sp.costPrice
            : null;
      if (c !== null) {
        priced = true;
        value += c * (r.currentQuantity || 0);
      }
    }
    return {
      locations: new Set(rows.map((r) => String(r.warehouse))).size,
      onHand,
      reserved,
      available: Math.max(0, onHand - reserved),
      value: priced ? value : null,
    };
  }, [rows]);

  // Rows-derived identity is a fallback while the direct fetch is in flight.
  const shown: ProductIdentity =
    identity ?? (rows ? identityFromRows(rows) : { name: '', sku: '', image: null });

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-3 py-4 sm:px-4 sm:py-6">
      {/* ── Header ── */}
      <div>
        <Link
          href={routes.warehouses.list}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-[#b20202]"
        >
          <PiArrowLeft className="h-4 w-4" /> Warehouses
        </Link>

        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#ece4d6] bg-white p-6 shadow-sm">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
            {shown.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shown.image}
                alt={shown.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <PiPackageBold className="h-6 w-6 text-gray-300" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Product inventory · all locations
            </p>
            <h1
              className={`${fraunces.className} truncate text-2xl font-semibold text-[#2a2420]`}
            >
              {shown.name ||
                (identity === null && rows === null ? 'Loading…' : '')}
              {!shown.name &&
                identity !== null && (
                  <span className="text-base font-normal text-gray-400">
                    Unnamed product
                  </span>
                )}
            </h1>
            {shown.sku && (
              <p className="font-mono text-xs text-gray-400">{shown.sku}</p>
            )}
          </div>
          {rows !== null && rows.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              <PiWarehouse className="h-3.5 w-3.5" />
              Stocked in {kpis.locations} location
              {kpis.locations === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* ── KPI strip ── */}
      {rows !== null && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Locations" value={kpis.locations.toLocaleString()} icon={<PiWarehouse className="h-4 w-4" />} tone="plain" />
          <Kpi label="On hand" value={kpis.onHand.toLocaleString()} icon={<PiCubeBold className="h-4 w-4" />} tone="strong" />
          <Kpi label="Reserved" value={kpis.reserved.toLocaleString()} icon={<PiLockKeyBold className="h-4 w-4" />} tone="amber" />
          <Kpi label="Available" value={kpis.available.toLocaleString()} icon={<PiCubeBold className="h-4 w-4" />} tone="green" />
          <Kpi
            label="Est. stock value"
            value={
              kpis.value === null
                ? '—'
                : `₦${Math.round(kpis.value).toLocaleString()}`
            }
            title={kpis.value === null ? 'No cost basis on file' : undefined}
            icon={<PiPackageBold className="h-4 w-4" />}
            tone="brand"
          />
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200">
        <div className="flex gap-1">
          {(
            [
              ['inventory', 'Inventory', <PiWarehouse key="i" className="h-3.5 w-3.5" />],
              ['history', 'History & Movements', <PiChartLine key="h" className="h-3.5 w-3.5" />],
            ] as [Tab, string, React.ReactNode][]
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-selected={tab === id}
              role="tab"
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === id
                  ? 'border-b-2 border-[#b20202] text-[#b20202]'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {tab === 'inventory' && rows !== null && rows.length > 0 && (
          <div className="relative mb-1 w-full max-w-xs">
            <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by warehouse or size…"
              aria-label="Filter inventory by warehouse or size"
              className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-8 text-xs text-gray-700 outline-none focus:border-[#b20202]"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                aria-label="Clear filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Panels ── */}
      {rows === null ? (
        <div className="flex items-center justify-center py-20">
          <PiSpinner className="h-7 w-7 animate-spin text-gray-400" />
        </div>
      ) : tab === 'inventory' ? (
        <LocationsTab
          subProductId={subProductId}
          token={token}
          filterText={filterText}
          onRefresh={loadLocations}
          onCustomAdjust={(row, type) => setAdjustTarget({ row, type })}
        />
      ) : (
        <div className="space-y-5">
          <InventorySummaryCard
            subProductId={subProductId}
            inventorySummary={summary}
            isLoading={loadingHistory}
            onRecordStock={() => {
              // Receiving happens in the Inventory tab's per-location actions.
              setTab('inventory');
            }}
          />
          <ServerMovementsList
            movements={movements}
            isLoading={loadingHistory}
            onRefresh={loadHistory}
            onCancel={async (id: string) => {
              try {
                await inventoryService.cancelMovement(id, token, 'Manual cancel');
                await loadHistory();
              } catch {
                /* toast handled upstream by list */
              }
            }}
          />
        </div>
      )}

      {/* ── Adjustment modal (replaces the legacy prompt flow) ── */}
      {adjustTarget &&
        adjustTarget.row.warehouse &&
        typeof adjustTarget.row.warehouse === 'object' &&
        adjustTarget.row.warehouse._id && (
          <AdjustStockModal
            warehouseId={adjustTarget.row.warehouse._id}
            row={adjustTarget.row}
            onClose={() => setAdjustTarget(null)}
            onDone={async () => {
              setAdjustTarget(null);
              await loadLocations();
              // Movements changed too; drop the cache so History refetches.
              setMovements([]);
            }}
          />
        )}
    </main>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
  title,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'plain' | 'strong' | 'amber' | 'green' | 'brand';
  title?: string;
}) {
  const colorCls = {
    plain: 'text-gray-500 bg-gray-100',
    strong: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
    green: 'text-emerald-600 bg-emerald-50',
    brand: 'text-[#b20202] bg-[#b20202]/10',
  }[tone];
  const valueCls =
    tone === 'brand'
      ? 'text-[#b20202]'
      : tone === 'green'
        ? 'text-emerald-700'
        : 'text-[#2a2420]';
  return (
    <div
      title={title}
      className="rounded-xl border border-[#ece4d6] bg-white p-3.5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${colorCls}`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`${fraunces.className} mt-1.5 truncate text-xl font-semibold tabular-nums ${valueCls}`}
      >
        {value}
      </p>
    </div>
  );
}
