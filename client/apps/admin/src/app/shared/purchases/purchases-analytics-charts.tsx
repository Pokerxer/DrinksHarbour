'use client';

import {
  useEffect,
  useState,
  useRef,
  Fragment,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  Bar,
  BarChart,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from 'recharts';
import {
  PiCaretDown,
  PiCheck,
  PiWarning,
  PiX,
  PiMagnifyingGlass,
  PiShoppingCart,
  PiFloppyDisk,
  PiTable,
} from 'react-icons/pi';
import type { PurchaseOrder } from '@/services/purchaseOrder.service';
import {
  PALETTE,
  fmtAxisVal,
  fmtMeasureVal,
  fmtDataLabel,
  computeAvg,
  formatG1Label,
  ALL_GROUP_ITEMS,
  type GroupRow,
  type GroupRow2,
  type Measure,
  type ChartType,
  type GroupByKey,
  type HierPivotResult,
} from './purchases-analytics-helpers';

// ── Dropdown primitives (matches POS analysis styling) ────────────────────────

export function Dropdown({
  label,
  icon,
  children,
  active,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
          active
            ? 'border-[#b20202]/30 bg-[#b20202]/5 text-[#b20202]'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        {icon}
        {label}
        <PiCaretDown
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 max-h-96 w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

export function DropItem({
  label,
  selected,
  onClick,
  badge,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-xs transition-colors hover:bg-gray-50 ${
        selected ? 'font-semibold text-[#b20202]' : 'text-gray-700'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="ml-2 flex shrink-0 items-center gap-1.5">
        {badge}
        {selected && <PiCheck className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

export function DropSection({ title }: { title: string }) {
  return (
    <p className="px-3.5 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
      {title}
    </p>
  );
}

// ── FilterListSection (category/brand checkbox lists, POS pattern) ────────────

export function FilterListSection({
  label,
  items,
  activeFilters,
  prefix,
  onToggle,
  maxVisible = 6,
  filter = '',
}: {
  label: string;
  items: { _id: string; name: string }[];
  activeFilters: string[];
  prefix: string;
  onToggle: (key: string) => void;
  maxVisible?: number;
  filter?: string;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (items.length === 0) return null;

  const matched = filter
    ? items.filter((it) => it.name.toLowerCase().includes(filter.toLowerCase()))
    : items;

  if (filter && matched.length === 0) return null;

  const isOpen = filter ? true : open;
  const visible = showAll ? matched : matched.slice(0, maxVisible);
  const activeCount = items.filter((it) =>
    activeFilters.includes(`${prefix}${it._id}`)
  ).length;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3.5 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400"
      >
        <span className="flex items-center gap-1.5">
          {label}
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b20202] px-1 text-[9px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </span>
        <PiCaretDown
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <>
          {visible.map((it) => {
            const key = `${prefix}${it._id}`;
            return (
              <DropItem
                key={key}
                label={it.name}
                selected={activeFilters.includes(key)}
                onClick={() => onToggle(key)}
              />
            );
          })}
          {matched.length > maxVisible && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full px-3.5 py-1.5 text-left text-[11px] font-medium text-[#b20202] hover:underline"
            >
              {showAll ? 'Show less' : `+${matched.length - maxVisible} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#b20202]/5">
        <PiWarning className="h-5 w-5 text-[#b20202]/40" />
      </span>
      <p className="text-sm text-gray-500">
        No purchase orders match the current filters
      </p>
    </div>
  );
}

// ── Single group-by: table / pie / line / bar ──────────────────────────────────

function TableView({
  data,
  measure,
  groupLabel,
  measureLabel,
  totalValue,
  totalOrders,
  onRowClick,
}: {
  data: GroupRow[];
  measure: Measure;
  groupLabel: string;
  measureLabel: string;
  totalValue: number;
  totalOrders: number;
  onRowClick: (label: string, orders: PurchaseOrder[]) => void;
}) {
  let cumulative = 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-xs">
            <th className="px-4 py-2.5 text-left font-medium text-gray-500">
              #
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-gray-500">
              {groupLabel}
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500">
              Orders
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500">
              {measureLabel}
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500">
              Share
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-gray-500">
              Cumulative
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => {
            cumulative += row.value;
            return (
              <tr
                key={row.isoKey}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => onRowClick(row.label, row.orderList)}
              >
                <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: PALETTE[i % PALETTE.length] }}
                    />
                    <span className="font-medium text-gray-900">
                      {row.label}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600">
                  {row.orders}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                  {fmtMeasureVal(row.value, measure)}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500">
                  {totalValue > 0 && measure !== 'avg_order'
                    ? `${((row.value / totalValue) * 100).toFixed(1)}%`
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500">
                  {totalValue > 0 && measure !== 'avg_order'
                    ? `${((cumulative / totalValue) * 100).toFixed(1)}%`
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        {measure !== 'avg_order' && (
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
              <td />
              <td className="px-4 py-2.5 text-gray-700">Total</td>
              <td className="px-4 py-2.5 text-right text-gray-700">
                {totalOrders}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">
                {fmtMeasureVal(totalValue, measure)}
              </td>
              <td />
              <td />
            </tr>
          </tfoot>
        )}
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
  measure: Measure;
  onSliceClick: (label: string, orders: PurchaseOrder[]) => void;
}) {
  return (
    <div className="px-3 py-4" style={{ height: 420 }}>
      <div className="flex h-full gap-4">
        <div className="w-3/5">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={140}
                paddingAngle={2}
                onClick={(_, index) =>
                  onSliceClick(data[index].label, data[index].orderList)
                }
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PALETTE[i % PALETTE.length]}
                    className="cursor-pointer"
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmtMeasureVal(v, measure)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex w-2/5 flex-col gap-1 overflow-y-auto py-2 text-xs">
          {data.map((row, i) => (
            <button
              key={row.isoKey}
              type="button"
              onClick={() => onSliceClick(row.label, row.orderList)}
              className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-gray-50"
            >
              <span className="flex items-center gap-1.5 truncate">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="truncate text-gray-700">{row.label}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums text-gray-900">
                {fmtMeasureVal(row.value, measure)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LineView({
  data,
  measure,
  measureLabel,
  onPointClick,
}: {
  data: GroupRow[];
  measure: Measure;
  measureLabel: string;
  onPointClick: (label: string, orders: PurchaseOrder[]) => void;
}) {
  const values = data.map((r) => r.value);
  const total = values.reduce((s, v) => s + v, 0);
  const avg = data.length > 0 ? total / data.length : 0;
  const peak = data.length > 0 ? Math.max(...values) : 0;
  const trough = data.length > 0 ? Math.min(...values) : 0;

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 px-5 pt-4 text-center">
        {[
          { label: 'Total', value: total },
          { label: 'Average', value: avg },
          { label: 'Peak', value: peak },
          { label: 'Trough', value: trough },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-gray-50 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              {label}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900">
              {fmtMeasureVal(value, measure)}
            </p>
          </div>
        ))}
      </div>
      <div className="px-3 py-4" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            onClick={(e) => {
              if (e?.activeTooltipIndex == null) return;
              const row = data[e.activeTooltipIndex];
              onPointClick(row.label, row.orderList);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#a39e95' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#a39e95' }}
              tickFormatter={(v: number) => fmtAxisVal(v, measure)}
            />
            <Tooltip
              formatter={(v: number) => [
                fmtMeasureVal(v, measure),
                measureLabel,
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#b20202"
              strokeWidth={2}
              dot={{ r: 3, fill: '#b20202' }}
              activeDot={{ r: 5 }}
              cursor="pointer"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Custom tooltip for bar charts ──────────────────────────────────────────────

function BarTooltip({
  active,
  payload,
  label,
  measure,
  totalValue,
}: {
  active?: boolean;
  payload?: { value: number; payload: GroupRow }[];
  label?: string;
  measure: Measure;
  totalValue: number;
}) {
  if (!active || !payload?.length) {
    return <div style={{ display: 'none' }} />;
  }
  const row = payload[0].payload;
  const val = row.value;
  const pct =
    totalValue > 0 && measure !== 'avg_order'
      ? ((val / totalValue) * 100).toFixed(1)
      : null;
  return (
    <div className="rounded-xl border border-[#ece4d6] bg-white px-3.5 py-2.5 shadow-lg">
      <p className="text-xs font-semibold text-[#2a2420]">{row.label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-[#b20202]">
        {fmtMeasureVal(val, measure)}
      </p>
      {pct && <p className="text-[11px] text-gray-400">{pct}% of total</p>}
      {row.orders > 0 && measure !== 'count' && (
        <p className="text-[10px] text-gray-400">
          {row.orders} order{row.orders !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

// ── Single group-by: table / pie / line / bar ──────────────────────────────────

function BarView({
  data,
  measure,
  measureLabel,
  totalValue,
  onBarClick,
}: {
  data: GroupRow[];
  measure: Measure;
  measureLabel: string;
  totalValue: number;
  onBarClick: (label: string, orders: PurchaseOrder[]) => void;
}) {
  const manyItems = data.length > 8;
  const height = manyItems ? Math.max(320, data.length * 32) : 420;
  const avg = data.length >= 3 ? computeAvg(data) : 0;

  return (
    <div className="px-3 py-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={manyItems ? 'vertical' : 'horizontal'}
          margin={
            manyItems
              ? { top: 8, right: 80, bottom: 8, left: 8 }
              : { top: 24, right: 24, bottom: 8, left: 8 }
          }
        >
          <defs>
            {data.map((_, i) => (
              <linearGradient
                key={i}
                id={`bv-grad-${i}`}
                x1="0"
                y1="0"
                x2={manyItems ? '1' : '0'}
                y2={manyItems ? '0' : '1'}
              >
                <stop
                  offset="0%"
                  stopColor={PALETTE[i % PALETTE.length]}
                  stopOpacity={0.65}
                />
                <stop
                  offset="100%"
                  stopColor={PALETTE[i % PALETTE.length]}
                  stopOpacity={1}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
          {manyItems ? (
            <>
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#a39e95' }}
                tickFormatter={(v: number) => fmtAxisVal(v, measure)}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: '#a39e95' }}
                width={120}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#a39e95' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#a39e95' }}
                tickFormatter={(v: number) => fmtAxisVal(v, measure)}
              />
            </>
          )}
          <Tooltip
            content={
              <BarTooltip
                measure={measure}
                measureLabel={measureLabel}
                totalValue={totalValue}
              />
            }
          />
          {avg > 0 &&
            measure !== 'avg_order' &&
            (manyItems ? (
              <ReferenceLine
                x={avg}
                stroke="#b20202"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={`Avg ${fmtAxisVal(avg, measure)}`}
              />
            ) : (
              <ReferenceLine
                y={avg}
                stroke="#b20202"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={`Avg ${fmtAxisVal(avg, measure)}`}
              />
            ))}
          <Bar
            dataKey="value"
            radius={manyItems ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            cursor="pointer"
            isAnimationActive={false}
          >
            {data.map((row, i) => (
              <Cell
                key={i}
                fill={`url(#bv-grad-${i})`}
                cursor="pointer"
                onClick={() => onBarClick(row.label, row.orderList)}
              />
            ))}
            <LabelList
              dataKey="value"
              position={manyItems ? 'right' : 'top'}
              offset={4}
              formatter={(v: number) => (v > 0 ? fmtDataLabel(v, measure) : '')}
              style={{ fontSize: 11, fontWeight: 600, fill: '#4a3f3a' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MainChart({
  data,
  chartType,
  measure,
  groupLabel,
  measureLabel,
  totalValue,
  totalOrders,
  onBarClick,
}: {
  data: GroupRow[];
  chartType: ChartType;
  measure: Measure;
  groupLabel: string;
  measureLabel: string;
  totalValue: number;
  totalOrders: number;
  onBarClick: (label: string, orders: PurchaseOrder[]) => void;
}) {
  if (data.length === 0) return <EmptyState />;

  if (chartType === 'table') {
    return (
      <TableView
        data={data}
        measure={measure}
        groupLabel={groupLabel}
        measureLabel={measureLabel}
        totalValue={totalValue}
        totalOrders={totalOrders}
        onRowClick={onBarClick}
      />
    );
  }

  if (chartType === 'pie') {
    const top = data.slice(0, 10);
    const rest = data.slice(10);
    const pieData: GroupRow[] = [...top];
    if (rest.length > 0) {
      pieData.push({
        label: `${rest.length} others`,
        isoKey: '__others__',
        value: rest.reduce((s, r) => s + r.value, 0),
        orders: rest.reduce((s, r) => s + r.orders, 0),
        orderList: rest.flatMap((r) => r.orderList),
      });
    }
    return (
      <PieView data={pieData} measure={measure} onSliceClick={onBarClick} />
    );
  }

  if (chartType === 'line') {
    return (
      <LineView
        data={data.slice(0, 30)}
        measure={measure}
        measureLabel={measureLabel}
        onPointClick={onBarClick}
      />
    );
  }

  return (
    <BarView
      data={data.slice(0, 30)}
      measure={measure}
      measureLabel={measureLabel}
      totalValue={totalValue}
      onBarClick={onBarClick}
    />
  );
}

// ── Custom tooltip for stacked bars ───────────────────────────────────────────

function StackedTooltip({
  active,
  payload,
  label,
  measure,
  hoveredSeg,
}: {
  active?: boolean;
  payload?: {
    value: number;
    name: string;
    dataKey: string;
    payload: GroupRow2;
  }[];
  label?: string;
  measure: Measure;
  hoveredSeg: { sk: string; ri: number } | null;
}) {
  if (!active || !payload?.length || !hoveredSeg) {
    return <div style={{ display: 'none' }} />;
  }
  const seg = payload.find((p) => p.dataKey === hoveredSeg.sk);
  if (!seg) {
    return <div style={{ display: 'none' }} />;
  }

  return (
    <div
      className="rounded-xl border border-[#ece4d6] bg-white px-3.5 py-2.5 shadow-lg"
      style={{ pointerEvents: 'none' }}
    >
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span className="font-medium">{seg.name}</span>
        <span className="font-semibold tabular-nums text-gray-900">
          {fmtMeasureVal(seg.value, measure)}
        </span>
      </div>
    </div>
  );
}

// ── Two-level group-by: stacked table / pie / line / bar ───────────────────────

function StackedTableView({
  rows,
  series,
  measure,
  groupLabel,
  orderMap,
  onCellClick,
}: {
  rows: GroupRow2[];
  series: string[];
  measure: Measure;
  groupLabel: string;
  orderMap: Record<string, Record<string, PurchaseOrder[]>>;
  onCellClick: (
    rowLabel: string,
    seriesKey: string,
    orders: PurchaseOrder[]
  ) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-xs">
            <th className="px-4 py-2.5 text-left font-medium text-gray-500">
              {groupLabel}
            </th>
            {series.map((s) => (
              <th
                key={s}
                className="px-4 py-2.5 text-right font-medium text-gray-500"
              >
                {s}
              </th>
            ))}
            <th className="px-4 py-2.5 text-right font-medium text-gray-500">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={row.isoKey} className="hover:bg-gray-50">
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                  />
                  <span className="font-medium text-gray-900">{row.label}</span>
                </span>
              </td>
              {series.map((s) => (
                <td
                  key={s}
                  className="cursor-pointer px-4 py-2.5 text-right tabular-nums text-gray-700 hover:underline"
                  onClick={() =>
                    onCellClick(row.label, s, orderMap[row.isoKey]?.[s] ?? [])
                  }
                >
                  {fmtMeasureVal((row[s] as number) ?? 0, measure)}
                </td>
              ))}
              <td
                className="cursor-pointer px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900 hover:underline"
                onClick={() => onCellClick(row.label, '', row.orderList)}
              >
                {fmtMeasureVal(row.__total__, measure)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
            <td className="px-4 py-2.5 text-gray-700">Total</td>
            {series.map((s) => {
              const colTotal = rows.reduce(
                (sum, r) => sum + ((r[s] as number) ?? 0),
                0
              );
              return (
                <td
                  key={s}
                  className="px-4 py-2.5 text-right tabular-nums text-gray-700"
                >
                  {fmtMeasureVal(colTotal, measure)}
                </td>
              );
            })}
            <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">
              {fmtMeasureVal(
                rows.reduce((s, r) => s + r.__total__, 0),
                measure
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function StackedLineView({
  rows,
  series,
  measure,
  measureLabel,
  orderMap,
  onCellClick,
}: {
  rows: GroupRow2[];
  series: string[];
  measure: Measure;
  measureLabel: string;
  orderMap: Record<string, Record<string, PurchaseOrder[]>>;
  onCellClick: (
    rowLabel: string,
    seriesKey: string,
    orders: PurchaseOrder[]
  ) => void;
}) {
  return (
    <div className="px-3 py-4" style={{ height: 420 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          onClick={(e) => {
            if (e?.activeTooltipIndex == null || !e?.activePayload?.length)
              return;
            const row = rows[e.activeTooltipIndex];
            const dataKey = String(e.activePayload[0].dataKey ?? '');
            onCellClick(
              row.label,
              dataKey,
              orderMap[row.isoKey]?.[dataKey] ?? []
            );
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#a39e95' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#a39e95' }}
            tickFormatter={(v: number) => fmtAxisVal(v, measure)}
          />
          <Tooltip
            formatter={(v: number, name) => [fmtMeasureVal(v, measure), name]}
          />
          {series.map((s, si) => (
            <Line
              key={s}
              type="monotone"
              dataKey={s}
              name={s}
              stroke={PALETTE[si % PALETTE.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function StackedBarView({
  rows,
  series,
  measure,
  measureLabel,
  orderMap,
  onCellClick,
}: {
  rows: GroupRow2[];
  series: string[];
  measure: Measure;
  measureLabel: string;
  orderMap: Record<string, Record<string, PurchaseOrder[]>>;
  onCellClick: (
    rowLabel: string,
    seriesKey: string,
    orders: PurchaseOrder[]
  ) => void;
}) {
  const manyItems = rows.length > 8;
  const height = manyItems ? Math.max(320, rows.length * 32) : 420;
  const [hoveredSeg, setHoveredSeg] = useState<{
    sk: string;
    ri: number;
  } | null>(null);

  return (
    <div className="px-3 py-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout={manyItems ? 'vertical' : 'horizontal'}
          margin={
            manyItems
              ? { top: 8, right: 80, bottom: 8, left: 8 }
              : { top: 24, right: 24, bottom: 8, left: 8 }
          }
          onMouseLeave={() => setHoveredSeg(null)}
        >
          <defs>
            {series.map((_, si) => (
              <linearGradient
                key={si}
                id={`sbv-grad-${si}`}
                x1="0"
                y1="0"
                x2={manyItems ? '1' : '0'}
                y2={manyItems ? '0' : '1'}
              >
                <stop
                  offset="0%"
                  stopColor={PALETTE[si % PALETTE.length]}
                  stopOpacity={0.7}
                />
                <stop
                  offset="100%"
                  stopColor={PALETTE[si % PALETTE.length]}
                  stopOpacity={1}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
          {manyItems ? (
            <>
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#a39e95' }}
                tickFormatter={(v: number) => fmtAxisVal(v, measure)}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: '#a39e95' }}
                width={120}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#a39e95' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#a39e95' }}
                tickFormatter={(v: number) => fmtAxisVal(v, measure)}
              />
            </>
          )}
          <Tooltip
            content={
              <StackedTooltip measure={measure} hoveredSeg={hoveredSeg} />
            }
          />
          {series.map((s, si) => (
            <Bar
              key={s}
              dataKey={s}
              name={s}
              stackId="a"
              fill={`url(#sbv-grad-${si})`}
              isAnimationActive={false}
            >
              {rows.map((row, ri) => {
                const val = (row[s] as number) ?? 0;
                if (val <= 0) return null;
                const isLast = si === series.length - 1;
                return (
                  <Cell
                    key={ri}
                    fill={`url(#sbv-grad-${si})`}
                    cursor="pointer"
                    radius={
                      isLast
                        ? manyItems
                          ? ([0, 4, 4, 0] as [number, number, number, number])
                          : ([4, 4, 0, 0] as [number, number, number, number])
                        : 0
                    }
                    onMouseEnter={() => setHoveredSeg({ sk: s, ri })}
                    onClick={() =>
                      onCellClick(row.label, s, orderMap[row.isoKey]?.[s] ?? [])
                    }
                  />
                );
              })}
              {si === series.length - 1 && (
                <LabelList
                  dataKey="__total__"
                  position={manyItems ? 'right' : 'top'}
                  offset={4}
                  formatter={(v: number) =>
                    v > 0 ? fmtDataLabel(v, measure) : ''
                  }
                  style={{ fontSize: 11, fontWeight: 600, fill: '#4a3f3a' }}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StackedChart({
  rows,
  series,
  chartType,
  measure,
  groupLabel,
  measureLabel,
  orderMap,
  onSegmentClick,
}: {
  rows: GroupRow2[];
  series: string[];
  chartType: ChartType;
  measure: Measure;
  groupLabel: string;
  measureLabel: string;
  orderMap: Record<string, Record<string, PurchaseOrder[]>>;
  onSegmentClick: (
    rowLabel: string,
    seriesKey: string,
    orders: PurchaseOrder[]
  ) => void;
}) {
  if (rows.length === 0) return <EmptyState />;

  if (chartType === 'pie') {
    const groupRows: GroupRow[] = rows.map((r) => ({
      label: r.label,
      isoKey: r.isoKey,
      value: r.__total__,
      orders: r.orders,
      orderList: r.orderList,
    }));
    const total = groupRows.reduce((s, r) => s + r.value, 0);
    const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
    return (
      <MainChart
        data={groupRows}
        chartType="pie"
        measure={measure}
        groupLabel={groupLabel}
        measureLabel={measureLabel}
        totalValue={total}
        totalOrders={totalOrders}
        onBarClick={(label, orders) => onSegmentClick(label, '', orders)}
      />
    );
  }

  if (chartType === 'table') {
    return (
      <StackedTableView
        rows={rows}
        series={series}
        measure={measure}
        groupLabel={groupLabel}
        orderMap={orderMap}
        onCellClick={onSegmentClick}
      />
    );
  }

  if (chartType === 'line') {
    return (
      <StackedLineView
        rows={rows}
        series={series}
        measure={measure}
        measureLabel={measureLabel}
        orderMap={orderMap}
        onCellClick={onSegmentClick}
      />
    );
  }

  return (
    <StackedBarView
      rows={rows}
      series={series}
      measure={measure}
      measureLabel={measureLabel}
      orderMap={orderMap}
      onCellClick={onSegmentClick}
    />
  );
}

// ── Pivot UI ──────────────────────────────────────────────────────────────────

function PivotDimDropdown({
  onAdd,
  existing,
  otherDims,
  title,
}: {
  onAdd: (k: GroupByKey) => void;
  existing: GroupByKey[];
  otherDims: GroupByKey[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
        title={title}
      >
        +
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Group by
          </p>
          {ALL_GROUP_ITEMS.map((g) => {
            const inThis = existing.includes(g.key);
            const inOther = otherDims.includes(g.key);
            const disabled = inThis || inOther;
            return (
              <button
                key={g.key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onAdd(g.key);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  disabled
                    ? 'cursor-not-allowed text-gray-300'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {inThis ? (
                  <PiCheck className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                ) : inOther ? (
                  <span className="w-3.5 shrink-0 text-[9px] text-gray-300">
                    ↔
                  </span>
                ) : (
                  <span className="w-3.5" />
                )}
                {g.label}
                {inOther && (
                  <span className="ml-auto text-[9px] text-gray-300">
                    other axis
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function exportPivotCSV(
  p: HierPivotResult,
  rowDims: GroupByKey[],
  colDims: GroupByKey[],
  measure: Measure,
  expandedRows: Set<string>,
  expandedCols: Set<string>
) {
  const rowHeader = rowDims
    .map((d) => ALL_GROUP_ITEMS.find((g) => g.key === d)?.label ?? d)
    .join(' › ');
  const headers: string[] = [rowHeader, 'Total'];

  const visCols: { path: string[]; label: string }[] = [];
  if (colDims.length > 0) {
    p.colVals0.forEach((ck) => {
      if (colDims.length >= 2 && expandedCols.has(ck)) {
        (p.subColValsMap[ck] ?? []).forEach((sk) => {
          visCols.push({
            path: [ck, sk],
            label: `${formatG1Label(ck, colDims[0])} / ${formatG1Label(sk, colDims[1])}`,
          });
        });
      } else {
        visCols.push({ path: [ck], label: formatG1Label(ck, colDims[0]) });
      }
    });
    visCols.forEach((c) => headers.push(c.label));
  }

  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const numVal = (rowPath: string[], colPath: string[]) =>
    fmtMeasureVal(p.getValue(rowPath, colPath), measure);

  const csvRows: string[][] = [headers];

  const gtRow = ['Total', numVal([], [])];
  visCols.forEach((c) => gtRow.push(numVal([], c.path)));
  csvRows.push(gtRow);

  p.rowVals0.forEach((rk) => {
    const row = [formatG1Label(rk, rowDims[0]), numVal([rk], [])];
    visCols.forEach((c) => row.push(numVal([rk], c.path)));
    csvRows.push(row);

    if (rowDims.length >= 2 && expandedRows.has(rk)) {
      (p.subRowValsMap[rk] ?? []).forEach((srk) => {
        const sub = [
          `  ${formatG1Label(rk, rowDims[0])} / ${formatG1Label(srk, rowDims[1])}`,
          numVal([rk, srk], []),
        ];
        visCols.forEach((c) => sub.push(numVal([rk, srk], c.path)));
        csvRows.push(sub);
      });
    }
  });

  const content = csvRows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pivot-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPivotExcel(
  p: HierPivotResult,
  rowDims: GroupByKey[],
  colDims: GroupByKey[],
  measure: Measure,
  expandedRows: Set<string>,
  expandedCols: Set<string>
) {
  const rowHeader = rowDims
    .map((d) => ALL_GROUP_ITEMS.find((g) => g.key === d)?.label ?? d)
    .join(' › ');

  const visCols: { path: string[]; label: string }[] = [];
  if (colDims.length > 0) {
    p.colVals0.forEach((ck) => {
      if (colDims.length >= 2 && expandedCols.has(ck)) {
        (p.subColValsMap[ck] ?? []).forEach((sk) => {
          visCols.push({
            path: [ck, sk],
            label: `${formatG1Label(ck, colDims[0])} / ${formatG1Label(sk, colDims[1])}`,
          });
        });
      } else {
        visCols.push({ path: [ck], label: formatG1Label(ck, colDims[0]) });
      }
    });
  }

  const x = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const numVal = (rp: string[], cp: string[]) => p.getValue(rp, cp);

  const strCell = (v: string, bold = false) =>
    `<Cell${bold ? ' ss:StyleID="bold"' : ''}><Data ss:Type="String">${x(v)}</Data></Cell>`;
  const numCell = (v: number, bold = false) =>
    v === 0
      ? `<Cell${bold ? ' ss:StyleID="bold"' : ''}><Data ss:Type="String">—</Data></Cell>`
      : `<Cell${bold ? ' ss:StyleID="bold"' : ''}><Data ss:Type="Number">${v.toFixed(2)}</Data></Cell>`;

  const rows: string[] = [];

  const hdrCells = [
    strCell(rowHeader, true),
    strCell('Total', true),
    ...visCols.map((c) => strCell(c.label, true)),
  ].join('');
  rows.push(`<Row>${hdrCells}</Row>`);

  const gtCells = [
    strCell('Total', true),
    numCell(p.grandTotal, true),
    ...visCols.map((c) => numCell(numVal([], c.path), true)),
  ].join('');
  rows.push(`<Row>${gtCells}</Row>`);

  p.rowVals0.forEach((rk) => {
    const rowCells = [
      strCell(formatG1Label(rk, rowDims[0])),
      numCell(p.rowTotals[rk]),
      ...visCols.map((c) => numCell(numVal([rk], c.path))),
    ].join('');
    rows.push(`<Row>${rowCells}</Row>`);
    if (rowDims.length >= 2 && expandedRows.has(rk)) {
      (p.subRowValsMap[rk] ?? []).forEach((srk) => {
        const subCells = [
          strCell(
            `  ${formatG1Label(rk, rowDims[0])} / ${formatG1Label(srk, rowDims[1])}`
          ),
          numCell(numVal([rk, srk], [])),
          ...visCols.map((c) => numCell(numVal([rk, srk], c.path))),
        ].join('');
        rows.push(`<Row>${subCells}</Row>`);
      });
    }
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="bold"><Font ss:Bold="1"/></Style>
  </Styles>
  <Worksheet ss:Name="Pivot">
    <Table>${rows.join('')}</Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pivot-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function PivotView({
  pivotData,
  pivotRowDims,
  pivotColDims,
  measure,
  pivotHeatMap,
  pivotShowOrders,
  pivotRowSearch,
  expandedRows,
  expandedCols,
  setPivotRowDims,
  setPivotColDims,
  setPivotHeatMap,
  setPivotShowOrders,
  setPivotRowSearch,
  setExpandedRows,
  setExpandedCols,
  onCellClick,
}: {
  pivotData: HierPivotResult | null;
  pivotRowDims: GroupByKey[];
  pivotColDims: GroupByKey[];
  measure: Measure;
  pivotHeatMap: boolean;
  pivotShowOrders: boolean;
  pivotRowSearch: string;
  expandedRows: Set<string>;
  expandedCols: Set<string>;
  setPivotRowDims: Dispatch<SetStateAction<GroupByKey[]>>;
  setPivotColDims: Dispatch<SetStateAction<GroupByKey[]>>;
  setPivotHeatMap: Dispatch<SetStateAction<boolean>>;
  setPivotShowOrders: Dispatch<SetStateAction<boolean>>;
  setPivotRowSearch: Dispatch<SetStateAction<string>>;
  setExpandedRows: Dispatch<SetStateAction<Set<string>>>;
  setExpandedCols: Dispatch<SetStateAction<Set<string>>>;
  onCellClick: (orders: PurchaseOrder[], title: string) => void;
}) {
  const p = pivotData;

  const toggleRow = (key: string) =>
    setExpandedRows((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  const toggleCol = (key: string) =>
    setExpandedCols((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  const canExpandRow = pivotRowDims.length >= 2;
  const canExpandCol = pivotColDims.length >= 2;

  const searchQ = pivotRowSearch.trim().toLowerCase();
  const visibleRows = p
    ? searchQ
      ? p.rowVals0.filter((rk) =>
          formatG1Label(rk, pivotRowDims[0]).toLowerCase().includes(searchQ)
        )
      : p.rowVals0
    : [];

  const visibleCols: { colPath: string[]; label: string; isSubCol: boolean }[] =
    [];
  if (p) {
    p.colVals0.forEach((ck) => {
      if (canExpandCol && expandedCols.has(ck)) {
        (p.subColValsMap[ck] ?? []).forEach((sk) => {
          visibleCols.push({
            colPath: [ck, sk],
            label: formatG1Label(sk, pivotColDims[1]),
            isSubCol: true,
          });
        });
      } else {
        visibleCols.push({
          colPath: [ck],
          label: formatG1Label(ck, pivotColDims[0]),
          isSubCol: false,
        });
      }
    });
  }

  const cellVal = (rowPath: string[], colPath: string[]) =>
    p ? p.getValue(rowPath, colPath) : 0;
  const ordCount = (rowPath: string[], colPath: string[]) =>
    p ? p.getOrderCount(rowPath, colPath) : 0;

  const heatStyle = (val: number) => {
    if (!pivotHeatMap || !p || val <= 0) return {};
    const share = p.maxCellVal > 0 ? val / p.maxCellVal : 0;
    return { backgroundColor: `rgba(178,2,2,${Math.max(0.04, share * 0.26)})` };
  };

  const buildCellTitle = (rPath: string[], cPath: string[]): string => {
    const rLabel =
      rPath.length === 0
        ? 'All'
        : rPath.map((k, i) => formatG1Label(k, pivotRowDims[i])).join(' › ');
    const cLabel =
      cPath.length === 0
        ? 'Total'
        : cPath.map((k, i) => formatG1Label(k, pivotColDims[i])).join(' › ');
    if (rPath.length === 0 && cPath.length === 0) return 'Grand Total';
    if (cPath.length === 0) return rLabel;
    if (rPath.length === 0) return cLabel;
    return `${rLabel} × ${cLabel}`;
  };

  const DataCell = ({
    rowPath,
    colPath,
    isTotal = false,
  }: {
    rowPath: string[];
    colPath: string[];
    isTotal?: boolean;
  }) => {
    const val = cellVal(rowPath, colPath);
    const pct = p && p.grandTotal > 0 ? (val / p.grandTotal) * 100 : 0;
    const share = p && p.maxCellVal > 0 ? val / p.maxCellVal : 0;
    const darkText = pivotHeatMap && share > 0.55;
    const ords = pivotShowOrders ? ordCount(rowPath, colPath) : 0;
    const handleClick =
      val > 0
        ? () => {
            const cellOrders = p?.getOrders(rowPath, colPath) ?? [];
            if (cellOrders.length > 0)
              onCellClick(cellOrders, buildCellTitle(rowPath, colPath));
          }
        : undefined;
    if (val === 0) {
      return (
        <td
          className={`border-b border-r border-gray-100 px-3 py-2 text-right tabular-nums ${isTotal ? 'bg-gray-50' : ''}`}
        >
          <span className="text-gray-200">—</span>
        </td>
      );
    }
    return (
      <td
        className={`border-b border-r border-gray-100 px-3 py-2 text-right tabular-nums transition-colors ${isTotal ? 'bg-gray-50' : ''} ${handleClick ? 'cursor-pointer hover:brightness-95' : ''}`}
        style={isTotal ? {} : heatStyle(val)}
        onClick={handleClick}
      >
        <div
          className={`text-xs font-semibold ${darkText ? 'text-[#6b0000]' : isTotal ? 'text-gray-800' : 'text-gray-700'}`}
        >
          {fmtMeasureVal(val, measure)}
        </div>
        {pct >= 1 && !isTotal && (
          <div className="text-[10px] text-gray-400">{pct.toFixed(1)}%</div>
        )}
        {pivotShowOrders && ords > 0 && !isTotal && (
          <div className="text-[10px] text-gray-300">{ords} ord</div>
        )}
      </td>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ── Pivot toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 px-4 py-2.5">
        {/* Row groupings */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Rows
          </span>
          {pivotRowDims.map((d, i) => (
            <span
              key={d}
              className="flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700"
            >
              {ALL_GROUP_ITEMS.find((g) => g.key === d)?.label ?? d}
              <button
                onClick={() => {
                  setPivotRowDims((prev) => prev.filter((_, j) => j !== i));
                  setExpandedRows(new Set());
                }}
                className="ml-0.5 rounded opacity-60 hover:text-red-500 hover:opacity-100"
              >
                <PiX className="h-3 w-3" />
              </button>
            </span>
          ))}
          {pivotRowDims.length < 3 && (
            <PivotDimDropdown
              title="Add row grouping"
              existing={pivotRowDims}
              otherDims={pivotColDims}
              onAdd={(k) => {
                setPivotRowDims((prev) => [...prev, k]);
                setExpandedRows(new Set());
              }}
            />
          )}
          {canExpandRow && p && p.rowVals0.length > 0 && (
            <div className="flex gap-0.5">
              <button
                type="button"
                title="Expand all rows"
                onClick={() => setExpandedRows(new Set(p.rowVals0))}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                all+
              </button>
              <button
                type="button"
                title="Collapse all rows"
                onClick={() => setExpandedRows(new Set())}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                all−
              </button>
            </div>
          )}
        </div>

        {/* Flip button */}
        <button
          type="button"
          title="Transpose rows ↔ cols"
          onClick={() => {
            const r = pivotRowDims;
            const c = pivotColDims;
            setPivotRowDims(c.length > 0 ? c : ['vendor']);
            setPivotColDims(r);
            setExpandedRows(new Set());
            setExpandedCols(new Set());
          }}
          className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-gray-400 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
        >
          ⇄
        </button>

        {/* Column groupings */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Cols
          </span>
          {pivotColDims.map((d, i) => (
            <span
              key={d}
              className="flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
            >
              {ALL_GROUP_ITEMS.find((g) => g.key === d)?.label ?? d}
              <button
                onClick={() => {
                  setPivotColDims((prev) => prev.filter((_, j) => j !== i));
                  setExpandedCols(new Set());
                }}
                className="ml-0.5 rounded opacity-60 hover:text-red-500 hover:opacity-100"
              >
                <PiX className="h-3 w-3" />
              </button>
            </span>
          ))}
          {pivotColDims.length < 2 && (
            <PivotDimDropdown
              title="Add column grouping"
              existing={pivotColDims}
              otherDims={pivotRowDims}
              onAdd={(k) => {
                setPivotColDims((prev) => [...prev, k]);
                setExpandedCols(new Set());
              }}
            />
          )}
          {canExpandCol && p && p.colVals0.length > 0 && (
            <div className="flex gap-0.5">
              <button
                type="button"
                title="Expand all columns"
                onClick={() => setExpandedCols(new Set(p.colVals0))}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                all+
              </button>
              <button
                type="button"
                title="Collapse all columns"
                onClick={() => setExpandedCols(new Set())}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                all−
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Heat map toggle */}
        <button
          type="button"
          onClick={() => setPivotHeatMap((h) => !h)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
            pivotHeatMap
              ? 'border-orange-200 bg-orange-50 text-orange-700'
              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{
              background: pivotHeatMap
                ? 'linear-gradient(to right, #fef2f2, #b20202)'
                : '#e5e7eb',
            }}
          />
          Heat map
        </button>

        {/* Show orders toggle */}
        <button
          type="button"
          onClick={() => setPivotShowOrders((s) => !s)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
            pivotShowOrders
              ? 'border-sky-200 bg-sky-50 text-sky-700'
              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          <PiShoppingCart className="h-3 w-3" />
          Orders
        </button>

        {/* Row search */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs shadow-sm">
          <PiMagnifyingGlass className="h-3 w-3 shrink-0 text-gray-400" />
          <input
            type="text"
            value={pivotRowSearch}
            onChange={(e) => setPivotRowSearch(e.target.value)}
            placeholder="Filter rows…"
            className="w-24 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-300"
          />
          {pivotRowSearch && (
            <button
              onClick={() => setPivotRowSearch('')}
              className="text-gray-300 hover:text-gray-500"
            >
              <PiX className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Export buttons */}
        {p && p.rowVals0.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                exportPivotCSV(
                  p,
                  pivotRowDims,
                  pivotColDims,
                  measure,
                  expandedRows,
                  expandedCols
                )
              }
              className="flex items-center gap-1.5 rounded-l-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700"
            >
              <PiFloppyDisk className="h-3 w-3" />
              CSV
            </button>
            <button
              type="button"
              onClick={() =>
                exportPivotExcel(
                  p,
                  pivotRowDims,
                  pivotColDims,
                  measure,
                  expandedRows,
                  expandedCols
                )
              }
              className="flex items-center gap-1.5 rounded-r-lg border border-l-0 border-gray-200 bg-white px-2.5 py-1.5 text-xs text-emerald-600 shadow-sm transition-colors hover:bg-emerald-50"
            >
              <PiFloppyDisk className="h-3 w-3" />
              Excel
            </button>
          </div>
        )}

        <div className="ml-auto text-xs text-gray-400">
          {p ? (
            <>
              <span className="font-semibold text-gray-700">
                {visibleRows.length}
              </span>
              {visibleRows.length !== p.rowVals0.length &&
                ` / ${p.rowVals0.length}`}{' '}
              rows ·{' '}
              <span className="font-semibold text-gray-700">
                {fmtMeasureVal(p.grandTotal, measure)}
              </span>
            </>
          ) : (
            'Loading…'
          )}
        </div>
      </div>

      {/* ── Pivot table ───────────────────────────────────────────────── */}
      {!p || p.rowVals0.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <PiTable className="h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-400">
            {pivotRowDims.length === 0
              ? 'Add a row grouping to start'
              : 'No data for the selected filters'}
          </p>
        </div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: '75vh' }}>
          {visibleRows.length === 0 && searchQ && (
            <div className="flex items-center justify-center py-10 text-sm text-gray-400">
              No rows match{' '}
              <span className="ml-1 font-medium text-gray-600">
                &quot;{pivotRowSearch}&quot;
              </span>
            </div>
          )}
          <table
            className="border-collapse text-xs"
            style={{
              minWidth: '100%',
              display: visibleRows.length === 0 ? 'none' : undefined,
            }}
          >
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[260px] border-b border-r border-gray-100 bg-gray-50 px-4 py-3 text-left align-bottom">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#b20202]">
                    {pivotRowDims
                      .map(
                        (d) =>
                          ALL_GROUP_ITEMS.find((g) => g.key === d)?.label ?? d
                      )
                      .join(' › ')}
                  </div>
                </th>
                <th className="sticky top-0 z-20 min-w-[120px] border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-right align-bottom">
                  <div className="text-xs font-bold text-gray-700">Total</div>
                  <div className="mt-0.5 text-[10px] tabular-nums text-gray-500">
                    {fmtMeasureVal(p.grandTotal, measure)}
                  </div>
                  {pivotShowOrders && (
                    <div className="text-[10px] text-gray-300">
                      {p.getOrderCount([], [])} ord
                    </div>
                  )}
                </th>
                {p.colVals0.map((ck) => {
                  const isExpanded = canExpandCol && expandedCols.has(ck);
                  const subCols = isExpanded ? (p.subColValsMap[ck] ?? []) : [];
                  const colSpan = isExpanded ? subCols.length : 1;
                  return (
                    <th
                      key={ck}
                      colSpan={colSpan}
                      className="sticky top-0 z-20 min-w-[110px] border-b border-l border-gray-100 bg-white px-3 py-3 text-center align-bottom"
                    >
                      <div className="flex items-center justify-center gap-1">
                        {canExpandCol && (
                          <button
                            onClick={() => toggleCol(ck)}
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-[10px] font-bold text-gray-500 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
                          >
                            {isExpanded ? '−' : '+'}
                          </button>
                        )}
                        <span className="font-semibold leading-tight text-gray-700">
                          {formatG1Label(ck, pivotColDims[0])}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] tabular-nums text-gray-400">
                        {fmtMeasureVal(p.colTotals[ck], measure)}
                      </div>
                    </th>
                  );
                })}
              </tr>

              {canExpandCol && expandedCols.size > 0 && (
                <tr>
                  <th className="sticky left-0 top-[52px] z-30 border-b border-r border-gray-100 bg-gray-50" />
                  <th className="sticky top-[52px] z-20 border-b border-r border-gray-200 bg-gray-50" />
                  {p.colVals0.map((ck) => {
                    if (!expandedCols.has(ck)) {
                      return (
                        <th
                          key={ck}
                          className="sticky top-[52px] z-20 min-w-[110px] border-b border-r border-gray-100 bg-white"
                        />
                      );
                    }
                    return (p.subColValsMap[ck] ?? []).map((sk) => (
                      <th
                        key={`${ck}:${sk}`}
                        className="sticky top-[52px] z-20 min-w-[100px] border-b border-r border-gray-100 bg-white px-3 py-2 text-right"
                      >
                        <span className="text-[11px] font-medium text-gray-600">
                          {formatG1Label(sk, pivotColDims[1])}
                        </span>
                      </th>
                    ));
                  })}
                </tr>
              )}
            </thead>

            <tbody>
              <tr className="border-b-2 border-gray-200 bg-gray-50/80">
                <td className="sticky left-0 z-10 border-b-2 border-r border-gray-200 bg-gray-50 px-4 py-2.5">
                  <span className="text-xs font-bold text-gray-700">Total</span>
                </td>
                <DataCell rowPath={[]} colPath={[]} isTotal />
                {visibleCols.map(({ colPath, isSubCol }) => (
                  <DataCell
                    key={colPath.join(':')}
                    rowPath={[]}
                    colPath={colPath}
                    isTotal={isSubCol}
                  />
                ))}
              </tr>

              {visibleRows.map((rk, ri) => {
                const rowTotal = p.rowTotals[rk];
                const rowShare =
                  p.grandTotal > 0 ? (rowTotal / p.grandTotal) * 100 : 0;
                const isRowExpanded = canExpandRow && expandedRows.has(rk);
                const subRows = isRowExpanded
                  ? (p.subRowValsMap[rk] ?? [])
                  : [];

                return (
                  <Fragment key={rk}>
                    <tr
                      className={
                        ri % 2 === 0
                          ? 'bg-white hover:bg-gray-50/60'
                          : 'bg-gray-50/30 hover:bg-gray-50/80'
                      }
                    >
                      <td
                        className="sticky left-0 z-10 border-b border-r border-gray-100 px-4 py-2.5"
                        style={{
                          background: ri % 2 === 0 ? '#fff' : '#fafafa',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {canExpandRow ? (
                            <button
                              onClick={() => toggleRow(rk)}
                              className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-[10px] font-bold text-gray-500 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
                            >
                              {isRowExpanded ? '−' : '+'}
                            </button>
                          ) : (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-200 text-[10px] text-gray-300">
                              □
                            </span>
                          )}
                          <div className="min-w-0">
                            <div
                              className="break-words font-medium leading-snug text-gray-800"
                              style={{ maxWidth: 220 }}
                            >
                              {formatG1Label(rk, pivotRowDims[0])}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1">
                              <div
                                className="h-0.5 flex-1 overflow-hidden rounded-full bg-gray-100"
                                style={{ width: 80 }}
                              >
                                <div
                                  className="h-full rounded-full bg-[#b20202] opacity-30"
                                  style={{ width: `${rowShare}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-gray-400">
                                {rowShare.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <DataCell rowPath={[rk]} colPath={[]} isTotal />
                      {visibleCols.map(({ colPath, isSubCol }) => (
                        <DataCell
                          key={colPath.join(':')}
                          rowPath={[rk]}
                          colPath={colPath}
                          isTotal={isSubCol}
                        />
                      ))}
                    </tr>

                    {subRows.map((srk) => (
                      <tr
                        key={`${rk}:${srk}`}
                        className="bg-[#fafbff] hover:bg-blue-50/20"
                      >
                        <td className="sticky left-0 z-10 border-b border-r border-gray-100 bg-[#fafbff] px-4 py-2">
                          <div className="flex items-center gap-2 pl-7">
                            <span className="h-px w-3 shrink-0 bg-gray-300" />
                            <span
                              className="break-words leading-snug text-gray-600"
                              style={{ maxWidth: 200 }}
                            >
                              {formatG1Label(srk, pivotRowDims[1])}
                            </span>
                          </div>
                        </td>
                        <DataCell rowPath={[rk, srk]} colPath={[]} isTotal />
                        {visibleCols.map(({ colPath, isSubCol }) => (
                          <DataCell
                            key={colPath.join(':')}
                            rowPath={[rk, srk]}
                            colPath={colPath}
                            isTotal={isSubCol}
                          />
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>

            {p.colVals0.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-bold text-gray-700">
                    Total
                  </td>
                  <td className="border-r border-gray-200 bg-gray-100 px-3 py-2.5 text-right tabular-nums">
                    <div className="text-sm font-bold text-gray-900">
                      {fmtMeasureVal(p.grandTotal, measure)}
                    </div>
                  </td>
                  {visibleCols.map(({ colPath }) => {
                    const val = cellVal([], colPath);
                    const pct =
                      p.grandTotal > 0 ? (val / p.grandTotal) * 100 : 0;
                    return (
                      <td
                        key={colPath.join(':')}
                        className="border-r border-gray-100 bg-gray-50 px-3 py-2.5 text-right tabular-nums"
                      >
                        <div className="font-bold text-gray-800">
                          {fmtMeasureVal(val, measure)}
                        </div>
                        {pct > 0 && (
                          <div className="text-[10px] text-gray-400">
                            {pct.toFixed(1)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
