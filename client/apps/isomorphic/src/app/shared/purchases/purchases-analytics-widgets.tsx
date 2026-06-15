'use client';

import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PurchaseAnalyticsSummary } from '@/services/purchaseAnalytics.service';
import { fraunces } from './purchases-fonts';
import { fmtNaira, fmtCompact, PALETTE } from './purchases-analytics-helpers';

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

function MonthlyTrendCard({
  trend,
}: {
  trend: PurchaseAnalyticsSummary['monthlyTrend'];
}) {
  const data = (trend ?? []).map((m) => ({
    label: monthLabel(m.month),
    amount: m.amount,
  }));
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
              margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            >
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
              <Tooltip
                formatter={(v: number) => fmtNaira(v)}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #ece4d6',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="amount" fill="#b20202" radius={[6, 6, 0, 0]} />
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

export function AnalyticsWidgetsGrid({
  summary,
}: {
  summary: PurchaseAnalyticsSummary | null;
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
    </div>
  );
}
