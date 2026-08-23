'use client';

import Link from 'next/link';
import { routes } from '@/config/routes';
import type { InventoryMovement } from '@/services/inventory.service';
import { TYPE_COLOR, TYPE_LABEL } from './inventory-receipts-support';

function fmtDate(s?: string) {
  if (!s) return '\u2014';
  return new Date(s).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
  });
}

function productName(m: InventoryMovement): string {
  const p = m.product as { name?: string } | undefined;
  const sp = m.subProduct as { name?: string; sku?: string } | undefined;
  return p?.name ?? sp?.name ?? sp?.sku ?? m.reference ?? '\u2014';
}

function warehouseLabel(m: InventoryMovement): string {
  if (m.category === 'transfer') {
    const src = m.sourceWarehouse as { name?: string } | undefined;
    const dst = m.destinationWarehouse as { name?: string } | undefined;
    const pair = [src?.name, dst?.name].filter(Boolean);
    return pair.length === 2 ? `${pair[0]} → ${pair[1]}` : pair[0] ?? '\u2014';
  }
  const w = m.warehouse as { name?: string } | undefined;
  return w?.name ?? '\u2014';
}

function qtySign(m: InventoryMovement): '+' | '\u2212' | '' {
  if (m.category === 'in') return '+';
  if (m.category === 'out') return '\u2212';
  if (m.category === 'adjustment')
    return m.type.endsWith('_in') ? '+' : '\u2212';
  return '';
}

function PanelSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-3 w-16 rounded bg-gray-200" />
      </div>
      <div className="space-y-3 px-4 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-14 rounded bg-gray-200" />
            <div className="h-3 flex-1 rounded bg-gray-200" />
            <div className="h-5 w-12 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentMovesPanel({
  recent,
  loading,
}: {
  recent: InventoryMovement[];
  loading: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white xl:col-span-3">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-800">Recent moves</h2>
        <Link
          href={routes.inventory.movesHistory}
          className="text-xs font-medium text-[#b20202] hover:underline"
        >
          View all
        </Link>
      </div>
      {loading ? (
        <PanelSkeleton />
      ) : recent.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-gray-400">
          No stock moves yet
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {recent.map((m) => {
            const sign = qtySign(m);
            return (
              <li
                key={m._id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="w-14 shrink-0 text-xs text-gray-400">
                  {fmtDate(m.performedAt ?? m.createdAt)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-700">
                  {productName(m)}
                </span>
                <span className="hidden min-w-0 max-w-[180px] shrink truncate text-xs text-gray-400 lg:inline">
                  {warehouseLabel(m)}
                </span>
                <span
                  className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline ${
                    TYPE_COLOR[m.type] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {TYPE_LABEL[m.type] ?? m.type.replace(/_/g, ' ')}
                </span>
                <span
                  className={`w-14 shrink-0 text-right font-semibold ${
                    sign === '+'
                      ? 'text-emerald-600'
                      : sign === '\u2212'
                        ? 'text-red-600'
                        : 'text-gray-600'
                  }`}
                >
                  {sign}
                  {Math.abs(m.quantity)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface LowStockItemDisplay {
  _id: string;
  product: { name?: string } | string | null;
  sku: string;
  availableStock: number;
  reorderPoint: number;
  lowStockThreshold: number;
}

/** 0–100 severity: how far below the reorder point the item sits. */
function severityPct(item: LowStockItemDisplay): number {
  const threshold = item.reorderPoint || item.lowStockThreshold || 0;
  if (threshold <= 0) return item.availableStock <= 0 ? 100 : 40;
  return Math.min(100, Math.max(8, 100 - (item.availableStock / threshold) * 100));
}

function LowStockRow({ item }: { item: LowStockItemDisplay }) {
  const p = item.product as { name?: string } | null;
  const name = p?.name ?? item.sku;
  const threshold = item.reorderPoint || item.lowStockThreshold;
  const out = item.availableStock <= 0;

  return (
    <li className="px-4 py-2.5 text-sm">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate font-medium text-gray-700">
          {name}
        </span>
        <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">
          reorder at {threshold}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            out ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {out ? 'Out of stock' : `${item.availableStock} left`}
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          role="presentation"
          className={`h-full rounded-full ${out ? 'bg-red-500' : 'bg-amber-400'}`}
          style={{ width: `${severityPct(item)}%` }}
        />
      </div>
    </li>
  );
}

const bySeverity = (a: LowStockItemDisplay, b: LowStockItemDisplay) => {
  if ((a.availableStock <= 0) !== (b.availableStock <= 0))
    return a.availableStock <= 0 ? -1 : 1;
  return a.availableStock - b.availableStock;
};

function LowStockPanel({
  items,
  loading,
}: {
  items: LowStockItemDisplay[];
  loading: boolean;
}) {
  const critical = [...items].sort(bySeverity).slice(0, 8);
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white xl:col-span-2">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-800">Low stock</h2>
        <Link
          href={routes.inventory.procurement}
          className="text-xs font-medium text-[#b20202] hover:underline"
        >
          Procurement
        </Link>
      </div>
      {loading ? (
        <PanelSkeleton />
      ) : critical.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-gray-400">
          Nothing running low
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {critical.map((item) => (
            <LowStockRow key={item._id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

interface DashboardPanelsProps {
  recentMoves: InventoryMovement[];
  lowStockItems: LowStockItemDisplay[];
  loading: boolean;
}

export default function DashboardPanels({
  recentMoves,
  lowStockItems,
  loading,
}: DashboardPanelsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <RecentMovesPanel recent={recentMoves} loading={loading} />
      <LowStockPanel items={lowStockItems} loading={loading} />
    </div>
  );
}

export { RecentMovesPanel, LowStockPanel };
export type { LowStockItemDisplay };
