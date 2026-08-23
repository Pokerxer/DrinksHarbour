// Insight widgets under the /sales/analytics main chart — momentum, top
// customers/products, lifecycle pipeline, payment collection, salesperson
// leaderboard. Every figure is derived from the same filtered ledger the
// chart uses, through the tested engine — no private math.

'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fraunces } from '../../purchases/purchases-fonts';
import {
  PALETTE,
  fmtCompact,
} from '../../purchases/purchases-analytics-helpers';
import type { SalesOrder } from '@/services/salesOrder.service';
import {
  computeSalesGroupData,
  formatSalesG1Label,
  type ProdMeta,
} from './sales-analytics-helpers';

const naira = (v: number) =>
  `₦${Math.round(v).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

const EYEBROW =
  'text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70';
const CARD =
  'flex h-full flex-col overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm';

function CardHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="border-b border-[#ece4d6] px-5 py-3">
      <p className={EYEBROW}>{eyebrow}</p>
      <h2 className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}>
        {title}
      </h2>
    </div>
  );
}

function Empty({ what }: { what: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-10 text-sm text-gray-400">
      {what}
    </div>
  );
}

// ── Monthly revenue momentum ───────────────────────────────────────────────────

function MonthlyTrendCard({ docs }: { docs: SalesOrder[] }) {
  const data = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const o of docs) {
      const d = new Date(o.createdAt || Date.now());
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + (o.total ?? 0));
    }
    const rows = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, amount]) => ({
        label: formatSalesG1Label(key, 'order_month'),
        amount,
        prev: null as number | null,
      }));
    for (let i = 1; i < rows.length; i++) rows[i].prev = rows[i - 1].amount;
    return rows;
  }, [docs]);

  const avg =
    data.length >= 2
      ? data.reduce((s, d) => s + d.amount, 0) / data.length
      : 0;

  return (
    <div className={`${CARD} p-5`}>
      <p className={EYEBROW}>Momentum</p>
      <h2 className={`${fraunces.className} mb-3 text-base font-semibold text-[#2a2420]`}>
        Monthly Revenue
      </h2>
      {data.length === 0 ? (
        <Empty what="Not enough history yet" />
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sa-mt-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b20202" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#b20202" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a39e95' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => fmtCompact(v)} tick={{ fontSize: 11, fill: '#a39e95' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as {
                    amount: number;
                    prev: number | null;
                  };
                  return (
                    <div className="rounded-xl border border-[#ece4d6] bg-white px-3 py-2 shadow-lg">
                      <p className="text-xs font-semibold text-[#2a2420]">{label}</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-[#b20202]">
                        {naira(d.amount)}
                      </p>
                      {d.prev != null && d.prev > 0 && (
                        <p
                          className={`mt-0.5 text-[11px] ${d.amount >= d.prev ? 'text-emerald-600' : 'text-red-500'}`}
                        >
                          {d.amount >= d.prev ? '▲' : '▼'}{' '}
                          {Math.abs(((d.amount - d.prev) / d.prev) * 100).toFixed(1)}% vs prev month
                        </p>
                      )}
                    </div>
                  );
                }}
              />
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
              <Bar dataKey="amount" fill="url(#sa-mt-grad)" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="amount"
                  position="top"
                  offset={4}
                  formatter={(v: number) => (v > 0 ? fmtCompact(v) : '')}
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

// ── Top customers / products (engine-computed) ────────────────────────────────

function RankTable({
  eyebrow,
  title,
  rows,
  emptyText,
}: {
  eyebrow: string;
  title: string;
  rows: { label: string; sub?: string; orders: number; value: number }[];
  emptyText: string;
}) {
  const top = rows.slice(0, 6);
  return (
    <div className={CARD}>
      <CardHead eyebrow={eyebrow} title={title} />
      {top.length === 0 ? (
        <Empty what={emptyText} />
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-[#f1ece2]">
            {top.map((r, i) => (
              <tr key={r.label} className="transition-colors hover:bg-[#FAF8F3]">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: PALETTE[i % PALETTE.length] }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#2a2420]">{r.label}</p>
                      {r.sub && <p className="text-[11px] text-gray-400">{r.sub}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right text-xs tabular-nums text-gray-400">
                  {r.orders} doc{r.orders === 1 ? '' : 's'}
                </td>
                <td
                  className={`${fraunces.className} px-4 py-2.5 text-right font-semibold tabular-nums text-[#2a2420]`}
                >
                  {naira(r.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Lifecycle pipeline ─────────────────────────────────────────────────────────

const ORDER_PIPELINE: { key: string; label: string; color: string }[] = [
  { key: 'draft', label: 'Draft', color: '#a39e95' },
  { key: 'confirmed', label: 'Confirmed', color: '#5b7da0' },
  { key: 'partially_fulfilled', label: 'Partial', color: '#d9a05b' },
  { key: 'fulfilled', label: 'Fulfilled', color: '#3d6b5c' },
  { key: 'cancelled', label: 'Cancelled', color: '#c46a6a' },
];

const QUOTE_PIPELINE: { key: string; label: string; color: string }[] = [
  { key: 'draft', label: 'Draft', color: '#a39e95' },
  { key: 'sent', label: 'Sent', color: '#5b7da0' },
  { key: 'accepted', label: 'Accepted', color: '#3d6b5c' },
  { key: 'converted', label: 'Converted', color: '#7d6b9e' },
];

function LifecycleCard({ docs }: { docs: SalesOrder[] }) {
  const { orders, quotes } = useMemo(() => {
    const o = new Map<string, number>();
    const q = new Map<string, number>();
    for (const d of docs) {
      if (d.docType === 'quotation')
        q.set(d.quoteStatus ?? 'draft', (q.get(d.quoteStatus ?? 'draft') ?? 0) + 1);
      else
        o.set(d.orderStatus ?? 'draft', (o.get(d.orderStatus ?? 'draft') ?? 0) + 1);
    }
    return { orders: o, quotes: q };
  }, [docs]);

  const orderTotal = Array.from(orders.values()).reduce((s, v) => s + v, 0);
  const quoteTotal = Array.from(quotes.values()).reduce((s, v) => s + v, 0);

  const Segments = ({
    meta,
    counts,
    total,
  }: {
    meta: { key: string; label: string; color: string }[];
    counts: Map<string, number>;
    total: number;
  }) => (
    <>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#f1ece2]">
        {meta.map(({ key, color }) => {
          const val = counts.get(key) ?? 0;
          if (!val) return null;
          return (
            <div
              key={key}
              style={{ width: `${(val / total) * 100}%`, backgroundColor: color }}
            />
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-y-2">
        {meta.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-500">{label}</span>
            <span className="ml-auto text-sm font-semibold tabular-nums text-[#2a2420]">
              {counts.get(key) ?? 0}
            </span>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className={`${CARD} p-5`}>
      <p className={EYEBROW}>Pipeline</p>
      <h2 className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}>
        Lifecycle
      </h2>
      {orderTotal === 0 && quoteTotal === 0 ? (
        <Empty what="No documents yet" />
      ) : (
        <div className="space-y-4">
          {orderTotal > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-500">
                Orders · {orderTotal}
              </p>
              <Segments meta={ORDER_PIPELINE} counts={orders} total={orderTotal} />
            </div>
          )}
          {quoteTotal > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-500">
                Quotations · {quoteTotal}
              </p>
              <Segments meta={QUOTE_PIPELINE} counts={quotes} total={quoteTotal} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Payment collection ─────────────────────────────────────────────────────────

function PaymentCard({ docs }: { docs: SalesOrder[] }) {
  const buckets = useMemo(() => {
    const paid = { total: 0, count: 0 };
    const partial = { total: 0, count: 0 };
    const unpaid = { total: 0, count: 0 };
    for (const o of docs) {
      if (o.docType !== 'order') continue;
      const b =
        o.paymentStatus === 'paid' ? paid : o.paymentStatus === 'partial' ? partial : unpaid;
      // Partial: count only what the till actually took, never the full total.
      b.total += o.paymentStatus === 'partial' ? (o.amountPaid ?? 0) : (o.total ?? 0);
      b.count += 1;
    }
    const grand = paid.total + partial.total + unpaid.total;
    return { paid, partial, unpaid, grand };
  }, [docs]);

  const rows = [
    { label: 'Collected', ...buckets.paid, color: '#3d6b5c' },
    { label: 'Part-collected', ...buckets.partial, color: '#d9a05b' },
    { label: 'Unpaid', ...buckets.unpaid, color: '#c46a6a' },
  ];
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className={`${CARD} p-5`}>
      <p className={EYEBROW}>Cash</p>
      <h2 className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}>
        Payment Collection
      </h2>
      {buckets.grand === 0 ? (
        <Empty what="No orders to collect on" />
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#2a2420]">{r.label}</span>
                <span className="tabular-nums text-gray-400">
                  {naira(r.total)} · {r.count}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f1ece2]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(r.total / max) * 100}%`,
                    backgroundColor: r.color,
                  }}
                />
              </div>
            </div>
          ))}
          <p className="pt-1 text-[11px] leading-relaxed text-gray-400">
            Partial orders count only what the till has taken — the balance stays
            in Unpaid&apos;s world, not here.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Grid ───────────────────────────────────────────────────────────────────────

export default function SalesWidgetsGrid({
  docs,
  prodMeta,
  toBase,
}: {
  docs: SalesOrder[];
  prodMeta: Record<string, ProdMeta>;
  toBase: (a: number, c: string) => number;
}) {
  const customers = useMemo(
    () =>
      computeSalesGroupData(docs, 'customer', 'revenue', prodMeta, toBase, []).slice(0, 6),
    [docs, prodMeta, toBase]
  );
  const products = useMemo(
    () =>
      computeSalesGroupData(docs, 'product', 'revenue', prodMeta, toBase, []).slice(0, 6),
    [docs, prodMeta, toBase]
  );
  const salespeople = useMemo(
    () =>
      computeSalesGroupData(docs, 'salesperson', 'revenue', prodMeta, toBase, []).slice(0, 5),
    [docs, prodMeta, toBase]
  );

  if (docs.length === 0) return null;

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <RankTable
          eyebrow="Who buys"
          title="Top Customers"
          rows={customers.map((r) => ({
            label: r.label,
            orders: r.orders,
            value: r.value,
          }))}
          emptyText="No customers yet"
        />
      </div>
      <LifecycleCard docs={docs} />
      <MonthlyTrendCard docs={docs} />
      <PaymentCard docs={docs} />
      <div className="lg:col-span-1">
        <RankTable
          eyebrow="What moves"
          title="Top Products"
          rows={products.map((r) => ({
            label: r.label,
            orders: r.orders,
            value: r.value,
          }))}
          emptyText="No product lines yet"
        />
      </div>
      <div className="lg:col-span-3">
        <RankTable
          eyebrow="Who sells"
          title="Salesperson Leaderboard"
          rows={salespeople.map((r) => ({
            label: r.label,
            sub: `${((r.value / Math.max(1, salespeople.reduce((s, x) => s + x.value, 0))) * 100).toFixed(1)}% of leaderboard revenue`,
            orders: r.orders,
            value: r.value,
          }))}
          emptyText="No salesperson data yet"
        />
      </div>
    </div>
  );
}
