'use client';

import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from 'recharts';
import type { PurchaseAnalyticsSummary } from '@/services/purchaseAnalytics.service';
import { fraunces } from './purchases-fonts';
import {
  fmtNaira,
  fmtCompact,
  fmtDataLabel,
  PALETTE,
  type GroupRow,
} from './purchases-analytics-helpers';

const STATUS_META: {
  key: keyof PurchaseAnalyticsSummary['statusBreakdown'];
  label: string;
  color: string;
}[] = [
  { key: 'draft', label: 'Draft', color: '#a39e95' },
  { key: 'confirmed', label: 'Confirmed', color: '#5b7da0' },
  { key: 'received', label: 'Received', color: '#3d6b5c' },
  { key: 'validated', label: 'Validated', color: '#b20202' },
  { key: 'cancelled', label: 'Cancelled', color: '#c46a6a' },
];

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: '2-digit',
  });
}

function TopProductsCard({
  products,
}: {
  products: PurchaseAnalyticsSummary['topProducts'];
}) {
  const rows = (products ?? []).slice(0, 6);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
      <div className="border-b border-[#ece4d6] px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
          Best Sellers
        </p>
        <h2
          className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}
        >
          Top Products
        </h2>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-10 text-sm text-gray-400">
          No product data yet
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#ece4d6] bg-[#FAF8F3] text-xs">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Product
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Qty
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Total Spend
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1ece2]">
            {rows.map((p, i) => (
              <tr key={i} className="transition-colors hover:bg-[#FAF8F3]">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-[#2a2420]">{p.productName}</p>
                  <p className="text-[11px] text-gray-400">
                    {p.sizeName} · {p.orderCount} order
                    {p.orderCount === 1 ? '' : 's'}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">
                  {p.totalQuantity.toLocaleString()}
                </td>
                <td
                  className={`${fraunces.className} px-4 py-2.5 text-right font-semibold tabular-nums text-[#2a2420]`}
                >
                  {fmtNaira(p.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBreakdownCard({
  breakdown,
}: {
  breakdown: PurchaseAnalyticsSummary['statusBreakdown'];
}) {
  const total = STATUS_META.reduce((s, m) => s + (breakdown?.[m.key] ?? 0), 0);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
        Pipeline
      </p>
      <h2
        className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}
      >
        Order Status
      </h2>

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6 text-sm text-gray-400">
          No orders yet
        </div>
      ) : (
        <>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#f1ece2]">
            {STATUS_META.map(({ key, color }) => {
              const val = breakdown?.[key] ?? 0;
              if (!val) return null;
              return (
                <div
                  key={key}
                  style={{
                    width: `${(val / total) * 100}%`,
                    backgroundColor: color,
                  }}
                />
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-y-2.5">
            {STATUS_META.map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-500">{label}</span>
                <span
                  className={`${fraunces.className} ml-auto text-sm font-semibold tabular-nums text-[#2a2420]`}
                >
                  {breakdown?.[key] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: {
    value: number;
    payload: { amount: number; prevAmount: number | null };
  }[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return <div style={{ display: 'none' }} />;
  }
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-[#ece4d6] bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-[#2a2420]">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-[#b20202]">
        {fmtNaira(d.amount)}
      </p>
      {d.prevAmount != null && d.prevAmount > 0 && (
        <p
          className={`mt-0.5 text-[11px] ${
            d.amount >= d.prevAmount ? 'text-emerald-600' : 'text-red-500'
          }`}
        >
          {d.amount >= d.prevAmount ? '▲' : '▼'}{' '}
          {Math.abs(((d.amount - d.prevAmount) / d.prevAmount) * 100).toFixed(
            1
          )}
          % vs prev month
        </p>
      )}
    </div>
  );
}

function MonthlyTrendCard({
  trend,
}: {
  trend: PurchaseAnalyticsSummary['monthlyTrend'];
}) {
  const raw = trend ?? [];
  const data = raw.map((m, i, arr) => ({
    label: monthLabel(m.month),
    amount: m.amount,
    prevAmount: i > 0 ? arr[i - 1].amount : null,
  }));
  const avg =
    data.length >= 2 ? data.reduce((s, d) => s + d.amount, 0) / data.length : 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
        Momentum
      </p>
      <h2
        className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}
      >
        Monthly Spend
      </h2>
      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6 text-sm text-gray-400">
          Not enough history yet
        </div>
      ) : (
        <div className="mt-3 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 4, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="mt-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b20202" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#b20202" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0ebe3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#a39e95' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => fmtCompact(v)}
                tick={{ fontSize: 11, fill: '#a39e95' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<MonthlyTooltip />} />
              {avg > 0 && (
                <ReferenceLine
                  y={avg}
                  stroke="#b20202"
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                  strokeOpacity={0.5}
                  label="Avg"
                />
              )}
              <Bar
                dataKey="amount"
                fill="url(#mt-grad)"
                radius={[6, 6, 0, 0]}
                animationDuration={600}
                animationBegin={0}
              >
                <LabelList
                  dataKey="amount"
                  position="top"
                  offset={4}
                  formatter={(v: number) =>
                    v > 0 ? fmtDataLabel(v, 'total_cost') : ''
                  }
                  style={{ fontSize: 10, fontWeight: 600, fill: '#4a3f3a' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SizeBreakdownCard({
  sizes,
}: {
  sizes: PurchaseAnalyticsSummary['sizeBreakdown'];
}) {
  const top = (sizes ?? []).slice(0, 6);
  const max = Math.max(1, ...top.map((s) => s.totalAmount));
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
        Assortment
      </p>
      <h2
        className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}
      >
        By Pack Size
      </h2>
      {top.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6 text-sm text-gray-400">
          No size data yet
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {top.map((s, i) => (
            <div key={s.sizeName}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#2a2420]">{s.sizeName}</span>
                <span className="tabular-nums text-gray-400">
                  {fmtCompact(s.totalAmount)} ·{' '}
                  {s.totalQuantity.toLocaleString()} units
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f1ece2]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(s.totalAmount / max) * 100}%`,
                    backgroundColor: PALETTE[i % PALETTE.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopCategoriesCard({ rows }: { rows: GroupRow[] }) {
  const top = (rows ?? []).slice(0, 6);
  const max = top.reduce((m, r) => Math.max(m, r.value), 0);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
        By Category
      </p>
      <h2
        className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}
      >
        Top Categories
      </h2>
      {top.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-10 text-sm text-gray-400">
          No category data yet
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {top.map((r, i) => (
            <div key={r.isoKey} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium text-[#2a2420]">
                  {r.label}
                </span>
                <span
                  className={`${fraunces.className} shrink-0 text-sm font-semibold tabular-nums text-[#2a2420]`}
                >
                  {r.value.toLocaleString()}
                  <span className="ml-1 text-[11px] font-normal text-gray-400">
                    units
                  </span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#f1ece2]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%`,
                    backgroundColor: PALETTE[i % PALETTE.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnalyticsWidgetsGrid({
  summary,
  topCategories,
}: {
  summary: PurchaseAnalyticsSummary | null;
  topCategories: GroupRow[];
}) {
  if (!summary) return null;

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <TopProductsCard products={summary.topProducts} />
      </div>
      <div>
        <StatusBreakdownCard breakdown={summary.statusBreakdown} />
      </div>
      <div className="lg:col-span-2">
        <MonthlyTrendCard trend={summary.monthlyTrend} />
      </div>
      <div>
        <SizeBreakdownCard sizes={summary.sizeBreakdown} />
      </div>
      <div className="lg:col-span-3">
        <TopCategoriesCard rows={topCategories} />
      </div>
    </div>
  );
}
