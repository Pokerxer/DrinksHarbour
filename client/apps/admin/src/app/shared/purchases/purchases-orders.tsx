'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiPlus,
  PiMagnifyingGlass,
  PiArrowClockwise,
  PiEye,
  PiPencilSimple,
  PiTrash,
  PiPackage,
  PiReceipt,
  PiClockCountdown,
  PiCurrencyDollar,
  PiList,
  PiSquaresFour,
  PiChartBar,
  PiArrowUp,
  PiArrowDown,
  PiArrowsDownUp,
  PiCaretRight,
  PiX,
  PiCheck,
  PiWarning,
} from 'react-icons/pi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from './types';
import { STATUS_BADGE, statusLabel } from './types';

// ─── types ────────────────────────────────────────────────────────
type TabKey = 'all' | 'rfq' | 'po' | 'to_receive' | 'to_bill';
type ViewMode = 'list' | 'grid' | 'graph';
type GraphPeriod = 'day' | 'month' | 'year';
type SortCol =
  | 'poNumber'
  | 'vendor'
  | 'status'
  | 'total'
  | 'arrival'
  | 'created';
type SortDir = 'asc' | 'desc';

// ─── constants ────────────────────────────────────────────────────
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All Orders' },
  { key: 'rfq', label: 'Quotations' },
  { key: 'po', label: 'Confirmed' },
  { key: 'to_receive', label: 'To Receive' },
  { key: 'to_bill', label: 'Outstanding' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  confirmed: '#3b82f6',
  received: '#10b981',
  billed: '#8b5cf6',
  validated: '#14b8a6',
  cancel: '#ef4444',
  cancelled: '#ef4444',
};

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-slate-400',
  confirmed: 'bg-blue-500',
  received: 'bg-emerald-500',
  billed: 'bg-violet-500',
  validated: 'bg-teal-500',
  cancel: 'bg-red-400',
  cancelled: 'bg-red-400',
};

const VENDOR_PALETTE = [
  '#b20202',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

// ─── helpers ─────────────────────────────────────────────────────
function orderTotal(o: PurchaseOrder) {
  return o.items.reduce(
    (s, i) => s + (i.totalCost ?? i.unitPrice * i.quantity),
    0
  );
}
function isToReceive(o: PurchaseOrder) {
  // A confirmed PO with anything still to receive, or one already in progress
  // (partially_received) that hasn't been fully received yet.
  if (o.status === 'partially_received') return true;
  return (
    o.status === 'confirmed' && o.items.some((i) => i.receivedQty < i.quantity)
  );
}
function isToBill(o: PurchaseOrder) {
  return ['partially_received', 'received', 'done', 'validated'].includes(
    o.status
  );
}
function fmtCurrency(n: number, cur = 'NGN') {
  if (n >= 1_000_000) return `${cur} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${cur} ${(n / 1_000).toFixed(0)}k`;
  return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function daysSince(s?: string): number {
  if (!s) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(s).getTime()) / (1000 * 60 * 60 * 24))
  );
}
function ageCls(days: number) {
  if (days > 30) return 'bg-red-100 text-red-700';
  if (days > 7) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}
function ageLabel(days: number) {
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days}d`;
}
function dayKey(s?: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayShort(k: string) {
  const [y, m, d] = k.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(
    'en-GB',
    { day: 'numeric', month: 'short' }
  );
}
function monthKey(s?: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthShort(k: string) {
  const [y, m] = k.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: '2-digit',
  });
}
function yearKey(s?: string): string | null {
  if (!s) return null;
  return String(new Date(s).getFullYear());
}

// ─── skeletons ────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[60, 80, 50, 55, 50, 50, 30].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div
            className="h-3.5 animate-pulse rounded bg-gray-100"
            style={{ width: `${w}%` }}
          />
        </td>
      ))}
    </tr>
  );
}
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex justify-between">
        <div className="h-4 w-28 rounded bg-gray-100" />
        <div className="h-5 w-16 rounded-full bg-gray-100" />
      </div>
      <div className="mb-2 h-3.5 w-36 rounded bg-gray-100" />
      <div className="mb-4 h-3 w-24 rounded bg-gray-100" />
      <div className="flex justify-between border-t border-gray-100 pt-3">
        <div className="h-4 w-20 rounded bg-gray-100" />
        <div className="flex gap-1">
          <div className="h-7 w-7 rounded bg-gray-100" />
          <div className="h-7 w-7 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

// ─── sort icon ────────────────────────────────────────────────────
function SortIcon({
  col,
  sortCol,
  sortDir,
}: {
  col: SortCol;
  sortCol: SortCol;
  sortDir: SortDir;
}) {
  if (col !== sortCol)
    return (
      <PiArrowsDownUp className="h-3 w-3 text-gray-300 group-hover:text-gray-400" />
    );
  return sortDir === 'asc' ? (
    <PiArrowUp className="h-3 w-3 text-[#b20202]" />
  ) : (
    <PiArrowDown className="h-3 w-3 text-[#b20202]" />
  );
}

// ─── order card (grid) ────────────────────────────────────────────
function OrderCard({
  order,
  onDelete,
  deleting,
  showBillNow,
}: {
  order: PurchaseOrder;
  onDelete: (e: React.MouseEvent, id: string) => void;
  deleting: string | null;
  showBillNow?: boolean;
}) {
  const router = useRouter();
  const total = orderTotal(order);
  const canEdit = order.status === 'draft' && !order.isLocked;
  const canDelete = order.status === 'draft';
  const ageDays = showBillNow
    ? daysSince(order.arrivalDate ?? order.updatedAt)
    : 0;
  return (
    <div
      onClick={() => router.push(routes.eCommerce.purchaseDetails(order._id))}
      className="group block cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-bold text-gray-900 group-hover:text-[#b20202]">
            {order.poNumber}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {order.isLocked && (
              <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-700">
                Locked
              </span>
            )}
            {order.isBackorder && (
              <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                Backorder
              </span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[order.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {statusLabel(order.status)}
        </span>
      </div>
      <p className="mb-1 text-sm font-medium text-gray-700">
        {order.vendorName ?? <span className="text-gray-400">No vendor</span>}
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
        {showBillNow ? (
          <>
            <span>
              Received {fmtDate(order.arrivalDate ?? order.updatedAt)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-bold ${ageCls(ageDays)}`}
            >
              {ageLabel(ageDays)} outstanding
            </span>
          </>
        ) : (
          <>
            {order.createdAt && <span>{fmtDate(order.createdAt)}</span>}
            {order.expectedArrival && (
              <span>ETA {fmtDate(order.expectedArrival)}</span>
            )}
          </>
        )}
      </div>
      <div
        className="flex items-center justify-between border-t border-gray-100 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-bold text-gray-900">
          {order.currency}{' '}
          {total.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <div className="flex gap-1">
          {showBillNow && (
            <Link
              href={`${routes.eCommerce.createVendorBill}?po=${order._id}`}
              title="Create Bill"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
            >
              <PiReceipt className="h-3.5 w-3.5" />
              Bill
            </Link>
          )}
          <Link
            href={routes.eCommerce.purchaseDetails(order._id)}
            title="View"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <PiEye className="h-4 w-4" />
          </Link>
          {canEdit && (
            <Link
              href={routes.eCommerce.editPurchase(order._id)}
              title="Edit"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <PiPencilSimple className="h-4 w-4" />
            </Link>
          )}
          {canDelete && (
            <button
              type="button"
              title="Delete"
              onClick={(e) => onDelete(e, order._id)}
              disabled={deleting === order._id}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            >
              <PiTrash className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── custom tooltip ───────────────────────────────────────────────
function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-lg">
      {label && (
        <p className="mb-1.5 text-xs font-bold text-gray-700">{label}</p>
      )}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs text-gray-600">
          <span className="font-semibold" style={{ color: p.color ?? p.fill }}>
            {p.name ?? 'Value'}:
          </span>{' '}
          {p.name?.toLowerCase().includes('spend')
            ? fmtCurrency(p.value, currency)
            : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── graph view ───────────────────────────────────────────────────
const PERIOD_LABELS: Record<GraphPeriod, string> = {
  day: 'Last 30 Days',
  month: 'Last 12 Months',
  year: 'All Years',
};

function GraphView({
  orders,
  currency,
  period,
  onPeriodChange,
}: {
  orders: PurchaseOrder[];
  currency: string;
  period: GraphPeriod;
  onPeriodChange: (p: GraphPeriod) => void;
}) {
  // ── timeline data (respects selected period) ──────────────────
  const timelineData = useMemo(() => {
    const map = new Map<string, { spend: number; count: number }>();
    orders.forEach((o) => {
      const k =
        period === 'day'
          ? dayKey(o.createdAt)
          : period === 'month'
            ? monthKey(o.createdAt)
            : yearKey(o.createdAt);
      if (!k) return;
      const prev = map.get(k) ?? { spend: 0, count: 0 };
      map.set(k, { spend: prev.spend + orderTotal(o), count: prev.count + 1 });
    });
    let entries = Array.from(map.entries())
      .map(([k, v]) => ({
        key: k,
        label:
          period === 'day'
            ? dayShort(k)
            : period === 'month'
              ? monthShort(k)
              : k,
        spend: v.spend,
        count: v.count,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
    if (period === 'day') entries = entries.slice(-30);
    else if (period === 'month') entries = entries.slice(-12);
    return entries;
  }, [orders, period]);

  // ── current-period bucket ─────────────────────────────────────
  const currentPeriodKey = useMemo(() => {
    const now = new Date().toISOString();
    return period === 'day'
      ? dayKey(now)
      : period === 'month'
        ? monthKey(now)
        : yearKey(now);
  }, [period]);

  const currentBucket = timelineData.find((d) => d.key === currentPeriodKey);

  // ── status distribution ───────────────────────────────────────
  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => map.set(o.status, (map.get(o.status) ?? 0) + 1));
    return Array.from(map.entries())
      .map(([status, count]) => ({
        name: statusLabel(status),
        value: count,
        status,
      }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  // ── top vendors ───────────────────────────────────────────────
  const vendorData = useMemo(() => {
    const map = new Map<string, { spend: number; count: number }>();
    orders.forEach((o) => {
      const name = o.vendorName ?? 'Unknown';
      const prev = map.get(name) ?? { spend: 0, count: 0 };
      map.set(name, {
        spend: prev.spend + orderTotal(o),
        count: prev.count + 1,
      });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, spend: v.spend, count: v.count }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 7);
  }, [orders]);

  // ── top products by quantity & value ─────────────────────────
  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; value: number }>();
    orders.forEach((o) =>
      o.items.forEach((item) => {
        const prev = map.get(item.productName) ?? { qty: 0, value: 0 };
        map.set(item.productName, {
          qty: prev.qty + item.quantity,
          value:
            prev.value + (item.totalCost ?? item.unitPrice * item.quantity),
        });
      })
    );
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, qty: v.qty, value: v.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [orders]);

  // ── aggregate kpis ────────────────────────────────────────────
  const totalSpend = useMemo(
    () => orders.reduce((s, o) => s + orderTotal(o), 0),
    [orders]
  );
  const avgOrderValue = orders.length > 0 ? totalSpend / orders.length : 0;
  const totalItemQty = useMemo(
    () =>
      orders.reduce(
        (s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0),
        0
      ),
    [orders]
  );
  const pendingReceiptCount = useMemo(
    () => orders.filter(isToReceive).length,
    [orders]
  );

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white py-20 text-center">
        <PiChartBar className="h-10 w-10 text-gray-200" />
        <p className="text-sm font-medium text-gray-500">
          No data to visualize
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Period selector + summary ──────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3.5">
        <div>
          <p className="text-sm font-bold text-gray-800">
            Spend Overview —{' '}
            <span className="text-[#b20202]">{PERIOD_LABELS[period]}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {timelineData.length} period{timelineData.length !== 1 ? 's' : ''} ·{' '}
            {orders.length} orders · {fmtCurrency(totalSpend, currency)} total
          </p>
        </div>
        <div className="flex gap-0.5 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(['day', 'month', 'year'] as GraphPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                period === p
                  ? 'bg-white text-[#b20202] shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {p === 'day' ? 'Day' : p === 'month' ? 'Month' : 'Year'}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI mini row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Avg Order Value',
            value: fmtCurrency(avgOrderValue, currency),
            sub: `across ${orders.length} orders`,
            accent: false,
          },
          {
            label:
              period === 'day'
                ? "Today's Spend"
                : period === 'month'
                  ? 'This Month'
                  : 'This Year',
            value: currentBucket
              ? fmtCurrency(currentBucket.spend, currency)
              : '—',
            sub: currentBucket
              ? `${currentBucket.count} order${currentBucket.count !== 1 ? 's' : ''}`
              : 'no orders yet',
            accent: true,
          },
          {
            label: 'Total Items Ordered',
            value: totalItemQty.toLocaleString(),
            sub: `${topProducts.length} unique product${topProducts.length !== 1 ? 's' : ''}`,
            accent: false,
          },
          {
            label: 'Pending Receipt',
            value: String(pendingReceiptCount),
            sub:
              pendingReceiptCount === 0
                ? 'all received'
                : `order${pendingReceiptCount !== 1 ? 's' : ''} awaiting goods`,
            accent: pendingReceiptCount > 0,
          },
        ].map(({ label, value, sub, accent }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p
              className={`mt-1 text-xl font-black ${accent ? 'text-[#b20202]' : 'text-gray-900'}`}
            >
              {value}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Spend timeline bar chart ───────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">Spend Timeline</p>
            <p className="text-xs text-gray-400">
              Purchase order value ·{' '}
              {period === 'day'
                ? 'daily'
                : period === 'month'
                  ? 'monthly'
                  : 'yearly'}{' '}
              breakdown
            </p>
          </div>
          <p className="text-right text-xs text-gray-400">
            <span className="block text-lg font-black text-gray-900">
              {fmtCurrency(totalSpend, currency)}
            </span>
            total spend
          </p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={timelineData}
            barSize={period === 'day' ? 10 : period === 'month' ? 24 : 36}
            margin={{ top: 16, right: 4, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval={period === 'day' ? 4 : 0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmtCurrency(v, '')}
              width={54}
            />
            <Tooltip
              content={<ChartTooltip currency={currency} />}
              cursor={{ fill: '#f9fafb' }}
            />
            <Bar dataKey="spend" name="Spend" radius={[4, 4, 0, 0]}>
              {timelineData.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.key === currentPeriodKey ? '#b20202' : '#e5e7eb'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Order-count micro-legend below the chart */}
        {timelineData.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-3">
            {timelineData.slice(-6).map((d) => (
              <div key={d.key} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background:
                      d.key === currentPeriodKey ? '#b20202' : '#d1d5db',
                  }}
                />
                <span className="text-[10px] text-gray-500">
                  {d.label}:{' '}
                  <strong className="text-gray-700">{d.count}</strong>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Status donut + Top vendors ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Status distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-1 text-sm font-bold text-gray-800">
            Status Distribution
          </p>
          <p className="mb-4 text-xs text-gray-400">
            Order count by current status
          </p>
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <ResponsiveContainer width={148} height={148}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {statusData.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] ?? '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-lg font-black text-gray-900">
                  {orders.length}
                </p>
                <p className="text-[10px] text-gray-400">orders</p>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {statusData.map((d) => (
                <div
                  key={d.status}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background: STATUS_COLORS[d.status] ?? '#94a3b8',
                      }}
                    />
                    <span className="truncate text-xs text-gray-600">
                      {d.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="h-1 w-14 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((d.value / orders.length) * 100)}%`,
                          background: STATUS_COLORS[d.status] ?? '#94a3b8',
                        }}
                      />
                    </div>
                    <span className="w-5 text-right text-xs font-bold text-gray-800">
                      {d.value}
                    </span>
                    <span className="w-7 text-right text-[10px] text-gray-400">
                      {Math.round((d.value / orders.length) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top vendors */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-1 text-sm font-bold text-gray-800">
            Top Vendors by Spend
          </p>
          <p className="mb-4 text-xs text-gray-400">
            Cumulative order value per supplier
          </p>
          {vendorData.length === 0 ? (
            <p className="text-sm text-gray-400">No vendor data</p>
          ) : (
            <div className="space-y-3">
              {vendorData.map((v, i) => {
                const pct =
                  vendorData[0].spend > 0
                    ? (v.spend / vendorData[0].spend) * 100
                    : 0;
                const color = VENDOR_PALETTE[i % VENDOR_PALETTE.length];
                return (
                  <div key={v.name}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white"
                          style={{ background: color }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="truncate text-xs font-medium text-gray-700"
                          title={v.name}
                        >
                          {v.name}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[10px] text-gray-400">
                          {v.count} PO
                          {v.count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          {fmtCurrency(v.spend, currency)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Top Products ───────────────────────────────────────────── */}
      {topProducts.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-1 text-sm font-bold text-gray-800">
            Top Products by Value
          </p>
          <p className="mb-4 text-xs text-gray-400">
            Most purchased items across all orders
          </p>
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {topProducts.map((p, i) => {
              const pct =
                topProducts[0].value > 0
                  ? (p.value / topProducts[0].value) * 100
                  : 0;
              const color = VENDOR_PALETTE[i % VENDOR_PALETTE.length];
              return (
                <div key={p.name}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-black text-white"
                        style={{ background: color }}
                      >
                        {i + 1}
                      </span>
                      <span
                        className="truncate text-xs font-medium text-gray-700"
                        title={p.name}
                      >
                        {p.name}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[10px] text-gray-400">
                        ×{p.qty.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-gray-900">
                        {fmtCurrency(p.value, currency)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── empty state ──────────────────────────────────────────────────
function EmptyState({
  tab,
  msg,
  vendorParam,
  inline,
}: {
  tab: TabKey;
  msg: string;
  vendorParam: string | null;
  inline?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 ${inline ? '' : 'rounded-xl border border-gray-200 bg-white'} py-16 text-center`}
    >
      <PiPackage className="h-10 w-10 text-gray-200" />
      <p className="text-sm font-medium text-gray-500">{msg}</p>
      {tab === 'all' && (
        <Link
          href={
            vendorParam
              ? `${routes.eCommerce.createPurchase}?vendor=${vendorParam}`
              : routes.eCommerce.createPurchase
          }
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-bold text-white hover:bg-[#9a0101]"
        >
          <PiPlus className="h-4 w-4" /> Create Purchase Order
        </Link>
      )}
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────
export default function PurchasesOrders() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendorParam = searchParams.get('vendor');
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('list');
  const [graphPeriod, setGraphPeriod] = useState<GraphPeriod>('month');
  const [sortCol, setSortCol] = useState<SortCol>('created');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (vendorParam) params.vendor = vendorParam;
      const res = await purchaseOrderService.getPurchaseOrders(token, params);
      const data: PurchaseOrder[] = res.data ?? res.purchaseOrders ?? [];
      setOrders(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token, vendorParam]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(id);
  }

  async function confirmDelete(id: string) {
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await purchaseOrderService.deletePurchaseOrder(id, token);
      toast.success('Purchase order deleted');
      setOrders((prev) => prev.filter((o) => o._id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  // ── derived ──────────────────────────────────────────────────────
  const tabCounts = useMemo(
    () => ({
      all: orders.length,
      rfq: orders.filter((o) => o.status === 'draft').length,
      po: orders.filter((o) => o.status === 'confirmed').length,
      to_receive: orders.filter(isToReceive).length,
      to_bill: orders.filter(isToBill).length,
    }),
    [orders]
  );

  const totalSpend = useMemo(
    () => orders.reduce((s, o) => s + orderTotal(o), 0),
    [orders]
  );
  const outstandingTotal = useMemo(
    () => orders.filter(isToBill).reduce((s, o) => s + orderTotal(o), 0),
    [orders]
  );
  const currency = orders[0]?.currency ?? 'NGN';

  // When entering the outstanding tab, default to oldest-first so most urgent show first
  useEffect(() => {
    if (activeTab === 'to_bill') {
      setSortCol('arrival');
      setSortDir('asc');
    }
  }, [activeTab]);

  const tabFiltered = useMemo(() => {
    if (activeTab === 'rfq') return orders.filter((o) => o.status === 'draft');
    if (activeTab === 'po')
      return orders.filter((o) => o.status === 'confirmed');
    if (activeTab === 'to_receive') return orders.filter(isToReceive);
    if (activeTab === 'to_bill') return orders.filter(isToBill);
    return orders;
  }, [orders, activeTab]);

  const filtered = useMemo(() => {
    let list = tabFiltered;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.poNumber?.toLowerCase().includes(q) ||
          o.vendorName?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let va: number | string = 0,
        vb: number | string = 0;
      if (sortCol === 'poNumber') {
        va = a.poNumber ?? '';
        vb = b.poNumber ?? '';
      } else if (sortCol === 'vendor') {
        va = a.vendorName ?? '';
        vb = b.vendorName ?? '';
      } else if (sortCol === 'status') {
        va = a.status;
        vb = b.status;
      } else if (sortCol === 'total') {
        va = orderTotal(a);
        vb = orderTotal(b);
      } else if (sortCol === 'arrival') {
        va = a.expectedArrival ? new Date(a.expectedArrival).getTime() : 0;
        vb = b.expectedArrival ? new Date(b.expectedArrival).getTime() : 0;
      } else {
        va = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        vb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      }
      const cmp =
        typeof va === 'string'
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tabFiltered, search, sortCol, sortDir]);

  const EMPTY_MSGS: Record<TabKey, string> = {
    all: 'No purchase orders yet',
    rfq: 'No open quotation requests',
    po: 'No confirmed purchase orders',
    to_receive: 'All goods have been received',
    to_bill: 'All received orders have been billed — great work!',
  };

  const Th = ({
    col,
    label,
    right,
  }: {
    col: SortCol;
    label: string;
    right?: boolean;
  }) => (
    <th
      className={`px-4 py-3 text-xs font-semibold text-gray-500 ${right ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => toggleSort(col)}
        className={`group inline-flex items-center gap-1 transition-colors hover:text-gray-800 ${sortCol === col ? 'text-gray-800' : ''}`}
      >
        {label}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </button>
    </th>
  );

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {vendorParam && (
            <div className="mb-1 flex items-center gap-1 text-xs text-gray-400">
              <Link
                href="/purchases"
                className="text-[#b20202] hover:underline"
              >
                All Orders
              </Link>
              <PiCaretRight className="h-3 w-3" />
              <span>Filtered by vendor</span>
              <Link
                href="/purchases"
                className="ml-1 flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-500 hover:bg-gray-200"
              >
                <PiX className="h-3 w-3" /> clear
              </Link>
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500">
            {vendorParam
              ? 'Showing orders for this vendor'
              : 'Manage purchase orders and quotations'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={load}
            title="Refresh"
            className={`rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 ${loading ? 'animate-spin' : ''}`}
          >
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <Link
            href={
              vendorParam
                ? `${routes.eCommerce.createPurchase}?vendor=${vendorParam}`
                : routes.eCommerce.createPurchase
            }
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" /> New Order
          </Link>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            icon: <PiPackage className="h-4 w-4" />,
            iconCls: 'text-gray-600 bg-gray-100',
            label: 'Total Orders',
            value: orders.length,
            fmt: (v: number) => String(v),
          },
          {
            icon: <PiReceipt className="h-4 w-4" />,
            iconCls: 'text-blue-600 bg-blue-50',
            label: 'Quotations',
            value: tabCounts.rfq,
            fmt: (v: number) => String(v),
          },
          {
            icon: <PiClockCountdown className="h-4 w-4" />,
            iconCls: 'text-amber-600 bg-amber-50',
            label: 'To Receive',
            value: tabCounts.to_receive,
            fmt: (v: number) => String(v),
          },
          {
            icon: <PiReceipt className="h-4 w-4" />,
            iconCls: 'text-violet-600 bg-violet-50',
            label: 'Outstanding (To Bill)',
            value: tabCounts.to_bill,
            fmt: (v: number) =>
              v > 0 ? `${v} · ${fmtCurrency(outstandingTotal, currency)}` : '0',
            onClick: () => setActiveTab('to_bill'),
          },
        ].map(({ icon, iconCls, label, value, fmt, onClick }) => (
          <div
            key={label}
            onClick={onClick}
            className={`rounded-xl border border-gray-200 bg-white p-4 ${onClick ? 'cursor-pointer transition-all hover:border-violet-300 hover:shadow-sm' : ''}`}
          >
            <div
              className={`mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg ${iconCls}`}
            >
              {icon}
            </div>
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-0.5 text-2xl font-black text-gray-900">
              {loading ? (
                <span className="inline-block h-7 w-16 animate-pulse rounded bg-gray-100" />
              ) : (
                fmt(value)
              )}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="mb-4 border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {!loading && (
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold ${activeTab === tab.key ? 'bg-[#b20202]/10 text-[#b20202]' : 'bg-gray-100 text-gray-500'}`}
                >
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Outstanding banner ──────────────────────────────────── */}
      {activeTab === 'to_bill' && !loading && filtered.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-xl border border-violet-200 bg-violet-50">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600">
                <PiReceipt className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-violet-900">
                  {filtered.length} order{filtered.length !== 1 ? 's' : ''}{' '}
                  awaiting billing
                </p>
                <p className="text-xs text-violet-600">
                  Total outstanding:{' '}
                  <span className="font-semibold">
                    {currency}{' '}
                    {filtered
                      .reduce((s, o) => s + orderTotal(o), 0)
                      .toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {(() => {
                const today = filtered.filter(
                  (o) => daysSince(o.arrivalDate ?? o.updatedAt) === 0
                ).length;
                const week = filtered.filter((o) => {
                  const d = daysSince(o.arrivalDate ?? o.updatedAt);
                  return d > 0 && d <= 7;
                }).length;
                const month = filtered.filter((o) => {
                  const d = daysSince(o.arrivalDate ?? o.updatedAt);
                  return d > 7 && d <= 30;
                }).length;
                const old = filtered.filter(
                  (o) => daysSince(o.arrivalDate ?? o.updatedAt) > 30
                ).length;
                return (
                  <>
                    {today > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
                        {today} today
                      </span>
                    )}
                    {week > 0 && (
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700">
                        {week} &lt;7d
                      </span>
                    )}
                    {month > 0 && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">
                        {month} &lt;30d
                      </span>
                    )}
                    {old > 0 && (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">
                        {old} 30d+
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {view !== 'graph' && (
          <div className="relative max-w-xs flex-1">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO# or vendor…"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <PiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        {view !== 'graph' && !loading && (
          <p className="shrink-0 text-sm text-gray-400">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* View toggle */}
        <div className="ml-auto flex gap-0.5 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(
            [
              ['list', <PiList className="h-4 w-4" key="l" />, 'List'],
              ['grid', <PiSquaresFour className="h-4 w-4" key="g" />, 'Grid'],
              ['graph', <PiChartBar className="h-4 w-4" key="c" />, 'Graph'],
            ] as const
          ).map(([v, icon, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-all ${view === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid view ───────────────────────────────────────────── */}
      {view === 'grid' &&
        (loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            tab={activeTab}
            msg={EMPTY_MSGS[activeTab]}
            vendorParam={vendorParam}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((o) => (
              <OrderCard
                key={o._id}
                order={o}
                onDelete={handleDelete}
                deleting={deletingId}
                showBillNow={activeTab === 'to_bill'}
              />
            ))}
          </div>
        ))}

      {/* ── List view ───────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <Th col="poNumber" label="PO Number" />
                <Th col="vendor" label="Vendor" />
                <Th col="status" label="Status" />
                <Th col="total" label="Value" right />
                {activeTab === 'to_bill' ? (
                  <>
                    <Th col="arrival" label="Received" />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                      Age
                    </th>
                  </>
                ) : (
                  <>
                    <Th col="arrival" label="Expected Arrival" />
                    <Th col="created" label="Created" />
                  </>
                )}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <EmptyState
                      tab={activeTab}
                      msg={EMPTY_MSGS[activeTab]}
                      vendorParam={vendorParam}
                      inline
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((order) => {
                  const total = orderTotal(order);
                  const canEdit = order.status === 'draft' && !order.isLocked;
                  const canDelete = order.status === 'draft';
                  const isDeleting = deletingId === order._id;
                  const isConfirming = confirmDeleteId === order._id;
                  const isOutstanding = activeTab === 'to_bill';
                  const ageDays = isOutstanding
                    ? daysSince(order.arrivalDate ?? order.updatedAt)
                    : 0;
                  return (
                    <tr
                      key={order._id}
                      onClick={() =>
                        !isConfirming &&
                        router.push(routes.eCommerce.purchaseDetails(order._id))
                      }
                      className={`cursor-pointer transition-colors hover:bg-gray-50/80 ${isDeleting ? 'opacity-40' : ''} ${isOutstanding && ageDays > 30 ? 'bg-red-50/30' : ''}`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900">
                            {order.poNumber}
                          </span>
                          {order.isLocked && (
                            <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700">
                              Locked
                            </span>
                          )}
                          {order.isBackorder && (
                            <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                              BO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-700">
                        {order.vendorName ?? (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[order.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[order.status] ?? 'bg-gray-400'}`}
                          />
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-gray-900">
                        {order.currency}{' '}
                        {total.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      {isOutstanding ? (
                        <>
                          <td className="px-4 py-3.5 text-sm text-gray-500">
                            {fmtDate(order.arrivalDate ?? order.updatedAt)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${ageCls(ageDays)}`}
                            >
                              {ageLabel(ageDays)}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3.5 text-sm text-gray-500">
                            {fmtDate(order.expectedArrival)}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-500">
                            {fmtDate(order.createdAt)}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3.5">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isConfirming ? (
                            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
                              <PiWarning className="h-3.5 w-3.5 shrink-0 text-red-500" />
                              <span className="text-xs font-semibold text-red-600">
                                Delete?
                              </span>
                              <button
                                onClick={() => confirmDelete(order._id)}
                                className="flex h-5 w-5 items-center justify-center rounded bg-red-500 text-white hover:bg-red-600"
                              >
                                <PiCheck className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex h-5 w-5 items-center justify-center rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
                              >
                                <PiX className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              {isOutstanding && (
                                <Link
                                  href={`${routes.eCommerce.createVendorBill}?po=${order._id}`}
                                  title="Create Bill"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
                                >
                                  <PiReceipt className="h-3.5 w-3.5" />
                                  Bill
                                </Link>
                              )}
                              <Link
                                href={routes.eCommerce.purchaseDetails(
                                  order._id
                                )}
                                title="View"
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              >
                                <PiEye className="h-4 w-4" />
                              </Link>
                              {canEdit && (
                                <Link
                                  href={routes.eCommerce.editPurchase(
                                    order._id
                                  )}
                                  title="Edit"
                                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                >
                                  <PiPencilSimple className="h-4 w-4" />
                                </Link>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  title="Delete"
                                  onClick={(e) => handleDelete(e, order._id)}
                                  disabled={isDeleting}
                                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                >
                                  <PiTrash className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
              <p className="text-xs text-gray-500">
                {filtered.length} order{filtered.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs font-semibold text-gray-700">
                Total: {currency}{' '}
                {filtered
                  .reduce((s, o) => s + orderTotal(o), 0)
                  .toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Graph view ──────────────────────────────────────────── */}
      {view === 'graph' &&
        (loading ? (
          <div className="space-y-4">
            <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-56 animate-pulse rounded-xl border border-gray-200 bg-white" />
              <div className="h-56 animate-pulse rounded-xl border border-gray-200 bg-white" />
            </div>
          </div>
        ) : (
          <GraphView
            orders={filtered}
            currency={currency}
            period={graphPeriod}
            onPeriodChange={setGraphPeriod}
          />
        ))}
    </div>
  );
}
