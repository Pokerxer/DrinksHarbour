'use client';

import { fraunces } from '../purchases/purchases-fonts';
import {
  fmtNaira,
  fmtCompact,
  fmtCount,
  PALETTE,
  EXPIRY_LABEL,
  EXPIRY_ORDER,
  STOCK_STATUS_LABEL,
  type GroupRow,
} from './warehouse-analysis-helpers';

// ── Top Categories (by on-hand units) ────────────────────────────────────────
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
                  {fmtCount(r.value)}
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

// ── Stock by Warehouse (by stock value) ───────────────────────────────────────
function ByWarehouseCard({ rows }: { rows: GroupRow[] }) {
  const top = (rows ?? []).slice(0, 8);
  const total = top.reduce((s, r) => s + r.value, 0);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
      <div className="border-b border-[#ece4d6] px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
          Distribution
        </p>
        <h2
          className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}
        >
          Stock Value by Warehouse
        </h2>
      </div>
      {top.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-10 text-sm text-gray-400">
          No warehouse data yet
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#ece4d6] bg-[#FAF8F3] text-xs">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Warehouse
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Lines
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Stock Value
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1ece2]">
            {top.map((r, i) => (
              <tr key={r.isoKey} className="transition-colors hover:bg-[#FAF8F3]">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: PALETTE[i % PALETTE.length] }}
                    />
                    <span className="font-medium text-[#2a2420]">{r.label}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">
                  {r.orders.toLocaleString()}
                </td>
                <td
                  className={`${fraunces.className} px-4 py-2.5 text-right font-semibold tabular-nums text-[#2a2420]`}
                >
                  {fmtNaira(r.value)}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500">
                  {total > 0 ? `${((r.value / total) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Stock Status (in / low / out) ─────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  [STOCK_STATUS_LABEL.in]: '#3d6b5c',
  [STOCK_STATUS_LABEL.low]: '#c8932c',
  [STOCK_STATUS_LABEL.out]: '#b20202',
};

function StatusBreakdownCard({ rows }: { rows: GroupRow[] }) {
  const ordered = [
    STOCK_STATUS_LABEL.in,
    STOCK_STATUS_LABEL.low,
    STOCK_STATUS_LABEL.out,
  ].map((label) => rows.find((r) => r.label === label) ?? null);
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
        Health
      </p>
      <h2
        className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}
      >
        Stock Status
      </h2>
      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6 text-sm text-gray-400">
          No stock yet
        </div>
      ) : (
        <>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#f1ece2]">
            {ordered.map((r, i) =>
              r && r.value > 0 ? (
                <div
                  key={i}
                  style={{
                    width: `${(r.value / total) * 100}%`,
                    backgroundColor: STATUS_COLOR[r.label],
                  }}
                />
              ) : null
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {[
              STOCK_STATUS_LABEL.in,
              STOCK_STATUS_LABEL.low,
              STOCK_STATUS_LABEL.out,
            ].map((label) => {
              const r = rows.find((x) => x.label === label);
              return (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_COLOR[label] }}
                  />
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="ml-auto text-[11px] tabular-nums text-gray-400">
                    {(r?.orders ?? 0).toLocaleString()} lines
                  </span>
                  <span
                    className={`${fraunces.className} w-20 text-right text-sm font-semibold tabular-nums text-[#2a2420]`}
                  >
                    {fmtCompact(r?.value ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Expiry buckets (by stock value) ───────────────────────────────────────────
const EXPIRY_COLOR: Record<string, string> = {
  [EXPIRY_LABEL.expired]: '#b20202',
  [EXPIRY_LABEL.d30]: '#a8512e',
  [EXPIRY_LABEL.d90]: '#c8932c',
  [EXPIRY_LABEL.later]: '#3d6b5c',
  [EXPIRY_LABEL.none]: '#a39e95',
};

function ExpiryBreakdownCard({ rows }: { rows: GroupRow[] }) {
  const ordered = EXPIRY_ORDER.map((b) => {
    const label = EXPIRY_LABEL[b];
    return rows.find((r) => r.label === label) ?? null;
  });
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  const hasData = rows.some((r) => r.value > 0);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
        Freshness
      </p>
      <h2
        className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}
      >
        Value at Expiry Risk
      </h2>
      {!hasData ? (
        <div className="flex flex-1 items-center justify-center py-6 text-sm text-gray-400">
          No batch / expiry data
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {EXPIRY_ORDER.map((b, i) => {
            const label = EXPIRY_LABEL[b];
            const r = ordered[i];
            const val = r?.value ?? 0;
            return (
              <div key={b}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#2a2420]">{label}</span>
                  <span className="tabular-nums text-gray-400">
                    {fmtCompact(val)} · {(r?.orders ?? 0).toLocaleString()} lines
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f1ece2]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${max > 0 ? (val / max) * 100 : 0}%`,
                      backgroundColor: EXPIRY_COLOR[label],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Top SKUs by stock value ───────────────────────────────────────────────────
function TopProductsCard({ rows }: { rows: GroupRow[] }) {
  const top = (rows ?? []).slice(0, 8);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
      <div className="border-b border-[#ece4d6] px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
          Concentration
        </p>
        <h2
          className={`${fraunces.className} text-base font-semibold text-[#2a2420]`}
        >
          Top Products by Value
        </h2>
      </div>
      {top.length === 0 ? (
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
                Lines
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Stock Value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1ece2]">
            {top.map((r) => (
              <tr key={r.isoKey} className="transition-colors hover:bg-[#FAF8F3]">
                <td className="max-w-[220px] truncate px-4 py-2.5 font-medium text-[#2a2420]">
                  {r.label}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">
                  {r.orders.toLocaleString()}
                </td>
                <td
                  className={`${fraunces.className} px-4 py-2.5 text-right font-semibold tabular-nums text-[#2a2420]`}
                >
                  {fmtNaira(r.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function AnalyticsWidgetsGrid({
  topProducts,
  byWarehouse,
  topCategories,
  statusRows,
  expiryRows,
}: {
  topProducts: GroupRow[];
  byWarehouse: GroupRow[];
  topCategories: GroupRow[];
  statusRows: GroupRow[];
  expiryRows: GroupRow[];
}) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <TopProductsCard rows={topProducts} />
      </div>
      <div>
        <StatusBreakdownCard rows={statusRows} />
      </div>
      <div className="lg:col-span-2">
        <ByWarehouseCard rows={byWarehouse} />
      </div>
      <div>
        <ExpiryBreakdownCard rows={expiryRows} />
      </div>
      <div className="lg:col-span-3">
        <TopCategoriesCard rows={topCategories} />
      </div>
    </div>
  );
}
