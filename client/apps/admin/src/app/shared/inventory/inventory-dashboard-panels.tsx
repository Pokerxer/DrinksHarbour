'use client';

import Link from 'next/link';
import { routes } from '@/config/routes';
import type { InventoryMovement } from '@/services/inventory.service';

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
          {recent.map((m) => (
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
              <span className="hidden shrink-0 text-xs capitalize text-gray-400 sm:inline">
                {m.type.replace(/_/g, ' ')}
              </span>
              <span
                className={`w-14 shrink-0 text-right font-semibold ${
                  m.category === 'in'
                    ? 'text-emerald-600'
                    : m.category === 'out'
                      ? 'text-red-600'
                      : 'text-gray-600'
                }`}
              >
                {m.category === 'in' ? '+' : m.category === 'out' ? '\u2212' : ''}
                {Math.abs(m.quantity)}
              </span>
            </li>
          ))}
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

function LowStockPanel({
  items,
  loading,
}: {
  items: LowStockItemDisplay[];
  loading: boolean;
}) {
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
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-gray-400">
          Nothing running low
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.slice(0, 8).map((item) => {
            const p = item.product as { name?: string } | null;
            const name = p?.name ?? item.sku;
            const threshold = item.reorderPoint || item.lowStockThreshold;
            return (
              <li
                key={item._id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-gray-700">
                  {name}
                </span>
                <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">
                  reorder at {threshold}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.availableStock <= 0
                      ? 'bg-red-50 text-red-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {item.availableStock} left
                </span>
              </li>
            );
          })}
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
