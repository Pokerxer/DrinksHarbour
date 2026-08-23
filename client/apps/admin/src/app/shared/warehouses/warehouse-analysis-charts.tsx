'use client';

import { useEffect, useState, useRef } from 'react';
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
} from 'react-icons/pi';
import type { StockRow } from '@/services/warehouseStock.service';
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
} from './warehouse-analysis-helpers';

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
        No stock lines match the current filters
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
  onExportCsv,
}: {
  data: GroupRow[];
  measure: Measure;
  groupLabel: string;
  measureLabel: string;
  totalValue: number;
  totalOrders: number;
  onRowClick: (label: string, orders: StockRow[]) => void;
  /** Present only when the parent wires a CSV export for this view. */
  onExportCsv?: () => void;
}) {
  let cumulative = 0;
  return (
    <div className="overflow-x-auto">
      {onExportCsv && data.length > 0 && (
        <div className="flex justify-end px-4 pt-3">
          <button
            type="button"
            onClick={onExportCsv}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-[#b20202]/30 hover:bg-[#b20202]/5 hover:text-[#b20202]"
          >
            Export CSV
          </button>
        </div>
      )}
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
              Lines
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
                  {totalValue > 0 && true
                    ? `${((row.value / totalValue) * 100).toFixed(1)}%`
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500">
                  {totalValue > 0 && true
                    ? `${((cumulative / totalValue) * 100).toFixed(1)}%`
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        {true && (
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
  onSliceClick: (label: string, orders: StockRow[]) => void;
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
  onPointClick: (label: string, orders: StockRow[]) => void;
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
  measureLabel,
  totalValue,
}: {
  active?: boolean;
  payload?: { value: number; payload: GroupRow }[];
  label?: string;
  measure: Measure;
  /** Shown above the value so the tooltip reads without the page header. */
  measureLabel?: string;
  totalValue: number;
}) {
  if (!active || !payload?.length) {
    return <div style={{ display: 'none' }} />;
  }
  const row = payload[0].payload;
  const val = row.value;
  const pct =
    totalValue > 0 && true
      ? ((val / totalValue) * 100).toFixed(1)
      : null;
  return (
    <div className="rounded-xl border border-[#ece4d6] bg-white px-3.5 py-2.5 shadow-lg">
      <p className="text-xs font-semibold text-[#2a2420]">{row.label}</p>
      {measureLabel && (
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {measureLabel}
        </p>
      )}
      <p className="mt-1 text-sm font-bold tabular-nums text-[#b20202]">
        {fmtMeasureVal(val, measure)}
      </p>
      {pct && <p className="text-[11px] text-gray-400">{pct}% of total</p>}
      {row.orders > 0 && true && (
        <p className="text-[10px] text-gray-400">
          {row.orders} line{row.orders !== 1 ? 's' : ''}
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
  onBarClick: (label: string, orders: StockRow[]) => void;
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
            true &&
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
  onExportCsv,
}: {
  data: GroupRow[];
  chartType: ChartType;
  measure: Measure;
  groupLabel: string;
  measureLabel: string;
  totalValue: number;
  totalOrders: number;
  onBarClick: (label: string, orders: StockRow[]) => void;
  onExportCsv?: () => void;
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
        onExportCsv={onExportCsv}
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
  orderMap: Record<string, Record<string, StockRow[]>>;
  onCellClick: (
    rowLabel: string,
    seriesKey: string,
    orders: StockRow[]
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
  orderMap: Record<string, Record<string, StockRow[]>>;
  onCellClick: (
    rowLabel: string,
    seriesKey: string,
    orders: StockRow[]
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
  orderMap: Record<string, Record<string, StockRow[]>>;
  onCellClick: (
    rowLabel: string,
    seriesKey: string,
    orders: StockRow[]
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
                    radius={isLast ? 4 : 0}
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
  orderMap: Record<string, Record<string, StockRow[]>>;
  onSegmentClick: (
    rowLabel: string,
    seriesKey: string,
    orders: StockRow[]
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
