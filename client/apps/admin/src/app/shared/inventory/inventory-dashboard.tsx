'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiArrowClockwise,
  PiChartLineUpDuotone,
  PiCoinsDuotone,
  PiCubeDuotone,
  PiEmptyDuotone,
  PiTrendUpDuotone,
  PiWarningCircleDuotone,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
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
import { CHART_COLORS, PIE_PALETTE } from './inventory-dashboard-charts';
import { KpiCards, KpiCardsSkeleton } from './inventory-dashboard-kpis';
import ChartSection from './inventory-dashboard-chart-section';
import OperationsGrid from './inventory-dashboard-operations';
import DashboardPanels from './inventory-dashboard-panels';
import type {
  FlowPoint,
  SlicePoint,
  TopProductPoint,
} from './inventory-dashboard-charts';

const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const SCRAP_TYPES = ['damaged', 'expired', 'theft', 'written_off'];
const FLOW_DAYS = 14;

export default function InventoryDashboard() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
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
      if (movesRes.status === 'fulfilled')
        setMovements(
          (movesRes.value as { data?: { movements?: InventoryMovement[] } })
            .data?.movements ?? []
        );
      if (valRes.status === 'fulfilled')
        setValuation(
          (valRes.value as { data?: InventoryValuation }).data ?? null
        );
      if (lowRes.status === 'fulfilled')
        setLowStock((lowRes.value as { data?: LowStockItem[] }).data ?? []);
      if (stockRes.status === 'fulfilled')
        setStockRows((stockRes.value as { data?: StockRow[] }).data ?? []);

      const failed = [movesRes, valRes, lowRes, stockRes].find(
        (r) => r.status === 'rejected'
      );
      if (failed && failed.status === 'rejected') {
        toast.error(
          failed.reason instanceof Error
            ? failed.reason.message
            : 'Some inventory data failed to load'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { in: 0, out: 0, transfer: 0, adjustment: 0, scrap: 0 };
    for (const m of movements) {
      if (SCRAP_TYPES.includes(m.type)) c.scrap += 1;
      else if (m.category === 'in') c.in += 1;
      else if (m.category === 'out') c.out += 1;
      else if (m.category === 'transfer') c.transfer += 1;
      else if (m.category === 'adjustment') c.adjustment += 1;
    }
    return c;
  }, [movements]);

  const flowData = useMemo<FlowPoint[]>(() => {
    const days: FlowPoint[] = [];
    const index = new Map<string, FlowPoint>();
    for (let i = FLOW_DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const point = {
        day: d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' }),
        in: 0,
        out: 0,
        net: 0,
      };
      days.push(point);
      index.set(key, point);
    }
    for (const m of movements) {
      const key = (m.performedAt ?? m.createdAt ?? '').slice(0, 10);
      const point = index.get(key);
      if (!point) continue;
      const qty = Math.abs(m.quantity);
      if (m.category === 'in') point.in += qty;
      else if (m.category === 'out') point.out += qty;
    }
    for (const p of days) p.net = p.in - p.out;
    return days;
  }, [movements]);

  const healthSlices = useMemo<SlicePoint[]>(() => {
    const c = { out: 0, low: 0, expiry: 0, over: 0, ok: 0 };
    for (const r of stockRows) {
      const f = r.flags;
      if (
        !f ||
        (!f.outOfStock && !f.lowStock && !f.nearExpiry && !f.overstocked)
      )
        c.ok += 1;
      else if (f.outOfStock) c.out += 1;
      else if (f.lowStock) c.low += 1;
      else if (f.nearExpiry) c.expiry += 1;
      else c.over += 1;
    }
    return [
      { name: 'Healthy', value: c.ok, color: CHART_COLORS.in },
      { name: 'Low stock', value: c.low, color: CHART_COLORS.amber },
      { name: 'Out of stock', value: c.out, color: CHART_COLORS.out },
      { name: 'Near expiry', value: c.expiry, color: CHART_COLORS.terracotta },
      { name: 'Overstocked', value: c.over, color: CHART_COLORS.slate },
    ];
  }, [stockRows]);

  const warehouseSlices = useMemo<SlicePoint[]>(() => {
    const map = new Map<string, number>();
    for (const r of stockRows) {
      const value = r.currentQuantity * (r.costPrice || 0);
      if (value > 0)
        map.set(r.warehouseName, (map.get(r.warehouseName) ?? 0) + value);
    }
    return Array.from(map.entries(), ([name, value], i) => ({
      name,
      value: Math.round(value),
      color: PIE_PALETTE[i % PIE_PALETTE.length],
    })).sort((a, b) => b.value - a.value);
  }, [stockRows]);

  const topProducts = useMemo<TopProductPoint[]>(() => {
    const map = new Map<string, number>();
    for (const r of stockRows) {
      const value = r.currentQuantity * (r.costPrice || 0);
      if (value > 0)
        map.set(r.productName, (map.get(r.productName) ?? 0) + value);
    }
    return Array.from(map.entries(), ([name, value]) => ({
      name: name.length > 22 ? `${name.slice(0, 21)}\u2026` : name,
      value: Math.round(value),
    }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [stockRows]);

  const unitsOnHand = useMemo(
    () => stockRows.reduce((s, r) => s + r.currentQuantity, 0),
    [stockRows]
  );
  const outOfStockCount = healthSlices.find(
    (s) => s.name === 'Out of stock'
  )?.value;

  const recentMoves = movements.slice(0, 8);

  const kpis = [
    {
      label: 'Stock value',
      value: loading ? '\u2026' : ngn.format(valuation?.totalValue ?? 0),
      icon: <PiCoinsDuotone />,
    },
    {
      label: 'Retail value',
      value: loading ? '\u2026' : ngn.format(valuation?.totalRetailValue ?? 0),
      icon: <PiChartLineUpDuotone />,
    },
    {
      label: 'Potential profit',
      value: loading ? '\u2026' : ngn.format(valuation?.potentialProfit ?? 0),
      icon: <PiTrendUpDuotone />,
    },
    {
      label: 'Units on hand',
      value: loading ? '\u2026' : unitsOnHand.toLocaleString(),
      icon: <PiCubeDuotone />,
    },
    {
      label: 'Low stock',
      value: loading ? '\u2026' : String(lowStock.length),
      icon: <PiWarningCircleDuotone />,
      tone: 'warn' as const,
    },
    {
      label: 'Out of stock',
      value: loading ? '\u2026' : String(outOfStockCount ?? 0),
      icon: <PiEmptyDuotone />,
      tone: 'danger' as const,
    },
  ];

  const opHrefs = {
    receipts: routes.inventory.receipts,
    deliveries: routes.inventory.deliveries,
    internal: routes.inventory.internal,
    adjustments: routes.inventory.adjustments,
    scrap: routes.inventory.scrap,
    transfers: routes.inventory.transfers,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-5 lg:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Inventory Overview
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Stock health, valuation and the last {FLOW_DAYS} days of operations
            across your warehouses.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PiArrowClockwise
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* KPI cards */}
      {loading && !valuation ? (
        <KpiCardsSkeleton />
      ) : (
        <section className="mb-6">
          <KpiCards data={kpis} />
        </section>
      )}

      {/* Charts */}
      <section className="mb-6">
        <ChartSection
          flowData={flowData}
          healthSlices={healthSlices}
          warehouseSlices={warehouseSlices}
          topProducts={topProducts}
          loading={loading && movements.length === 0}
        />
      </section>

      {/* Operation tiles */}
      <section className="mb-6">
        <OperationsGrid
          counts={counts}
          loading={loading && movements.length === 0}
          hrefs={opHrefs}
        />
      </section>

      {/* Bottom panels */}
      <section>
        <DashboardPanels
          recentMoves={recentMoves}
          lowStockItems={lowStock}
          loading={loading}
        />
      </section>
    </div>
  );
}
