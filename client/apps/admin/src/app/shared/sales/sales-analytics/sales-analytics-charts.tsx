// Chart layer for /sales/analytics — bar / line / pie / table plus a stacked
// two-level view and the drill-down drawer. SalesOrder-typed on purpose:
// borrowing the purchases chart components would couple two domains' type
// unions together. Visual language (palette, rounded bars, compact money
// labels) is shared so both analysis pages read as siblings.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PiX } from 'react-icons/pi';
import type { SalesOrder } from '@/services/salesOrder.service';
import { PALETTE } from '../../purchases/purchases-analytics-helpers';
import {
  IS_CURRENCY,
  SALES_GROUP_ITEMS,
  formatSalesG1Label,
  type ChartType,
  type GroupRow,
  type SalesGroupByKey,
  type SalesMeasure,
} from './sales-analytics-helpers';

const AXIS_TICK = { fontSize: 11, fill: '#8a8177' };

function fmtMoney(v: number): string {
  return `₦${v.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function fmtAxis(v: number, measure: SalesMeasure): string {
  if (!IS_CURRENCY[measure]) {
    return v >= 1000 ? `${Math.round(v / 1000)}K` : String(Math.round(v));
  }
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₦${Math.round(v / 1_000)}K`;
  return `₦${v}`;
}

function fmtLabel(v: number, measure: SalesMeasure): string {
  if (!IS_CURRENCY[measure])
    return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v));
  if (v >= 1_000_000)
    return `₦${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  return fmtMoney(v);
}

// ── Drill-down drawer ──────────────────────────────────────────────────────────

export function SalesDrillDrawer({
  orders,
  title,
  onClose,
}: {
  orders: SalesOrder[];
  title: string;
  onClose: () => void;
}) {
  const total = orders.reduce((s, o) => s + (o.total ?? 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close"
        className="flex-1 cursor-default"
        onClick={onClose}
      />
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-gray-200 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Documents
            </p>
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {orders.length} document(s) · ₦
              {total.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
        <ul className="divide-y divide-gray-50">
          {orders.map((o) => (
            <li key={o._id}>
              <Link
                href={`/sales/${o._id}`}
                onClick={onClose}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
              >
                <span className="w-36 shrink-0 truncate font-mono text-xs font-semibold text-[#b20202]">
                  {o.soNumber}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    o.docType === 'quotation'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-sky-100 text-sky-700'
                  }`}
                >
                  {o.docType === 'quotation' ? 'Quote' : 'Order'}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-600">
                  {o.customerSnapshot?.name ?? 'Walk-in Customer'}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900">
                  {fmtMoney(o.total ?? 0)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Tooltips ───────────────────────────────────────────────────────────────────

interface TipEntry {
  value?: number | string;
  name?: string;
  dataKey?: string | number;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  measure,
}: {
  active?: boolean;
  payload?: TipEntry[];
  measure: SalesMeasure;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-xl">
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold text-gray-800">
          {p.name ? `${p.name}: ` : ''}
          {IS_CURRENCY[measure]
            ? fmtMoney(Number(p.value ?? 0))
            : Number(p.value ?? 0).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// ── Single-level views ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex h-[420px] items-center justify-center text-sm text-gray-400">
      No data for the current filters.
    </div>
  );
}

function TableView({
  data,
  groupLabel,
  measureLabel,
  measure,
  totalValue,
  totalOrders,
  onRowClick,
}: {
  data: GroupRow[];
  groupLabel: string;
  measureLabel: string;
  measure: SalesMeasure;
  totalValue: number;
  totalOrders: number;
  onRowClick: (label: string, orders: SalesOrder[]) => void;
}) {
  return (
    <div className="max-h-[480px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50">
          <tr className="border-b border-gray-100">
            <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {groupLabel}
            </th>
            <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Docs
            </th>
            <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {measureLabel}
            </th>
            <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Share
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((r) => (
            <tr
              key={r.isoKey}
              onClick={() => onRowClick(r.label, r.orderList)}
              className="cursor-pointer transition-colors hover:bg-gray-50"
            >
              <td className="px-5 py-2.5 font-medium text-gray-800">
                {r.label}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">
                {r.orders}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                {fmtMoney(r.value)}
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums text-gray-400">
                {totalValue > 0 && measure !== 'avg_order'
                  ? `${((r.value / totalValue) * 100).toFixed(1)}%`
                  : '—'}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-100 bg-gray-50/60 font-semibold">
            <td className="px-5 py-2.5 text-gray-700">Total</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
              {totalOrders}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">
              {fmtMoney(totalValue)}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PieView({
  data,
  measure,
  onSliceClick,
}: {
  data: GroupRow[];
  measure: SalesMeasure;
  onSliceClick: (label: string, orders: SalesOrder[]) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={420}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="55%"
          outerRadius="82%"
          paddingAngle={2}
          onClick={(d) => {
            const row = d?.payload?.payload as GroupRow | undefined;
            if (row && row.isoKey !== '__others__')
              onSliceClick(row.label, row.orderList);
          }}
          isAnimationActive={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} cursor="pointer" />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip measure={measure} />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function LineView({
  data,
  measure,
  onPointClick,
}: {
  data: GroupRow[];
  measure: SalesMeasure;
  onPointClick: (label: string, orders: SalesOrder[]) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={420}>
      <LineChart
        data={data}
        margin={{ top: 20, right: 16, left: 8, bottom: 8 }}
        onClick={(e) => {
          const label = (e?.activePayload?.[0]?.payload as GroupRow)?.label;
          const row = data.find((d) => d.label === label);
          if (label && row) onPointClick(label, row.orderList);
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => fmtAxis(v, measure)} width={56} />
        <Tooltip content={<ChartTooltip measure={measure} />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#b20202"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#b20202', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
          cursor="pointer"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function BarView({
  data,
  measure,
  onBarClick,
}: {
  data: GroupRow[];
  measure: SalesMeasure;
  onBarClick: (label: string, orders: SalesOrder[]) => void;
}) {
  const manyItems = data.length > 8;
  return (
    <ResponsiveContainer width="100%" height={Math.max(320, Math.min(560, data.length * 42))}>
      <BarChart
        data={data}
        layout={manyItems ? 'vertical' : 'horizontal'}
        margin={{ top: 20, right: 24, left: 8, bottom: 8 }}
        onClick={(e) => {
          const row = e?.activePayload?.[0]?.payload as GroupRow | undefined;
          if (row) onBarClick(row.label, row.orderList);
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" vertical={manyItems} horizontal={!manyItems} />
        {manyItems ? (
          <>
            <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => fmtAxis(v, measure)} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#57534e' }} tickLine={false} axisLine={false} width={140} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-24} textAnchor="end" height={64} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => fmtAxis(v, measure)} width={56} />
          </>
        )}
        <Tooltip cursor={{ fill: '#b2020210' }} content={<ChartTooltip measure={measure} />} />
        <Bar dataKey="value" radius={manyItems ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={manyItems ? 26 : 48} isAnimationActive={false} cursor="pointer">
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
          <LabelList
            dataKey="value"
            position={manyItems ? 'right' : 'top'}
            offset={4}
            formatter={(v: number) => (v > 0 ? fmtLabel(v, measure) : '')}
            style={{ fontSize: 11, fontWeight: 600, fill: '#4a3f3a' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SalesMainChart({
  data,
  chartType,
  measure,
  groupBy,
  measureLabel,
  totalValue,
  totalOrders,
  onDrill,
}: {
  data: GroupRow[];
  chartType: ChartType;
  measure: SalesMeasure;
  groupBy: SalesGroupByKey;
  measureLabel: string;
  totalValue: number;
  totalOrders: number;
  onDrill: (label: string, orders: SalesOrder[]) => void;
}) {
  if (data.length === 0) return <EmptyState />;

  if (chartType === 'table')
    return (
      <TableView
        data={formatDateRows(data, groupBy)}
        groupLabel={groupByLabelOf(groupBy)}
        measureLabel={measureLabel}
        measure={measure}
        totalValue={totalValue}
        totalOrders={totalOrders}
        onRowClick={onDrill}
      />
    );

  // Date dimensions read best sorted chronologically in every chart form.
  const rows = formatDateRows(data, groupBy);

  if (chartType === 'pie') {
    const top = rows.slice(0, 10);
    const rest = rows.slice(10);
    const pieData: GroupRow[] = [...top];
    if (rest.length > 0)
      pieData.push({
        label: `${rest.length} others`,
        isoKey: '__others__',
        value: rest.reduce((s, r) => s + r.value, 0),
        orders: rest.reduce((s, r) => s + r.orders, 0),
        orderList: rest.flatMap((r) => r.orderList),
      });
    return <PieView data={pieData} measure={measure} onSliceClick={onDrill} />;
  }
  if (chartType === 'line')
    return <LineView data={rows.slice(0, 30)} measure={measure} onPointClick={onDrill} />;
  return <BarView data={rows.slice(0, 30)} measure={measure} onBarClick={onDrill} />;
}

/** Re-forms display labels for date buckets already formatted upstream. */
function formatDateRows<T extends { isoKey: string; label: string }>(
  rows: T[],
  groupBy: SalesGroupByKey
): T[] {
  if (!groupBy.startsWith('order_')) return rows;
  return rows.map((r) => ({
    ...r,
    label: formatSalesG1Label(r.isoKey, groupBy),
  }));
}

function groupByLabelOf(groupBy: SalesGroupByKey): string {
  const fallback: Record<string, string> = {
    order_day: 'Day',
    order_week: 'Week',
    order_month: 'Month',
    order_quarter: 'Quarter',
    order_year: 'Year',
  };
  return (
    SALES_GROUP_ITEMS.find((g) => g.key === groupBy)?.label ??
    fallback[groupBy] ??
    groupBy
  );
}

// ── Two-level stacked view ─────────────────────────────────────────────────────

export function SalesStackedChart({
  rows,
  series,
  measure,
  groupBy,
  onCellClick,
}: {
  rows: {
    label: string;
    isoKey: string;
    __total__: number;
    orders: number;
    orderList: SalesOrder[];
    [seriesKey: string]: unknown;
  }[];
  series: string[];
  measure: SalesMeasure;
  groupBy: SalesGroupByKey;
  onCellClick: (rowLabel: string, seriesKey: string, orders: SalesOrder[]) => void;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visibleSeries = useMemo(
    () => series.filter((s) => !hidden.has(s)),
    [series, hidden]
  );
  const data = useMemo(() => {
    const shaped = rows.map((r) => ({
      ...r,
      label: formatDateRows([{ ...r, label: r.label }], groupBy)[0].label,
    }));
    // Chronological for dates; top-N by total otherwise.
    const sorted = groupBy.startsWith('order_')
      ? [...shaped].sort((a, b) => a.isoKey.localeCompare(b.isoKey))
      : [...shaped].sort((a, b) => b.__total__ - a.__total__);
    return sorted.slice(0, 12);
  }, [rows, groupBy]);

  if (rows.length === 0 || series.length === 0) return <EmptyState />;

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5 px-4 pt-3">
          {series.map((s, i) => {
            const off = hidden.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    next.has(s) ? next.delete(s) : next.add(s);
                    return next;
                  })
                }
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  off
                    ? 'border-gray-200 text-gray-300'
                    : 'border-transparent text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: off ? '#e7e5e4' : PALETTE[i % PALETTE.length] }}
                />
                {s}
              </button>
            );
          })}
        </div>
      )}
      <ResponsiveContainer width="100%" height={440}>
        <BarChart
          data={data}
          margin={{ top: 16, right: 16, left: 8, bottom: 32 }}
          onClick={(e) => {
            const rowLabel = String(e?.activeLabel ?? '');
            const entry = e?.activePayload?.[0];
            if (!entry) return;
            const key = String(entry.dataKey ?? '');
            const row = rows.find((r) => r.label === rowLabel);
            const list = row ? row.orderList : [];
            onCellClick(rowLabel, key, list);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ ...AXIS_TICK, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-22}
            textAnchor="end"
            height={58}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => fmtAxis(v, measure)} width={56} />
          <Tooltip cursor={{ fill: '#b202020d' }} content={<ChartTooltip measure={measure} />} />
          {visibleSeries.map((s) => (
            <Bar
              key={s}
              dataKey={s}
              stackId="a"
              fill={PALETTE[series.indexOf(s) % PALETTE.length]}
              maxBarSize={44}
              isAnimationActive={false}
              cursor="pointer"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
