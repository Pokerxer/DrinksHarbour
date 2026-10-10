// app/shared/accounting/period-comparison.ts
//
// Prior-period variance for the P&L. Pure so the direction rules are testable
// without rendering the widget.
import type { ProfitLoss } from '@/services/accounting.service';

export type ComparisonKey =
  | 'netSales'
  | 'revenue'
  | 'cogs'
  | 'grossProfit'
  | 'expenses'
  | 'netProfit';

export interface ComparisonRow {
  key: ComparisonKey;
  label: string;
  current: number;
  previous: number;
  delta: number;
  /** null when unchanged — there is no "good" or "bad" about a flat figure. */
  favourable: boolean | null;
  /** null when the prior figure cannot serve as a percentage base. */
  pct: number | null;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Higher is better for these lines; for the cost lines it is reversed. */
const HIGHER_IS_BETTER: Record<ComparisonKey, boolean> = {
  netSales: true,
  revenue: true,
  cogs: false,
  grossProfit: true,
  expenses: false,
  netProfit: true,
};

const METRICS: Array<{ key: ComparisonKey; label: string; pick: (p: ProfitLoss) => number }> = [
  { key: 'netSales', label: 'Net sales', pick: (p) => p.sales?.net ?? p.revenueTotal },
  { key: 'revenue', label: 'Revenue', pick: (p) => p.revenueTotal },
  { key: 'cogs', label: 'Cost of goods sold', pick: (p) => p.cogs?.total ?? 0 },
  { key: 'grossProfit', label: 'Gross profit', pick: (p) => p.grossProfit ?? 0 },
  { key: 'expenses', label: 'Operating expenses', pick: (p) => p.expenseTotal ?? 0 },
  { key: 'netProfit', label: 'Net profit', pick: (p) => p.netProfit ?? 0 },
];

/**
 * Build variance rows against the prior window.
 *
 * `favourable` is deliberately not `delta > 0`: more cost of goods sold is a
 * worse result even though it moved upward, and a loss narrowing from −5,000 to
 * −2,000 improved without anything "rising". Callers colour from this flag and
 * should not re-derive it from the sign.
 *
 * Returns no rows when there is no prior window — an all-time P&L has nothing
 * to be measured against, and a fabricated baseline is worse than none.
 */
export function periodComparison(
  current: ProfitLoss,
  previous: ProfitLoss | null | undefined
): { rows: ComparisonRow[]; hasPrior: boolean } {
  if (!previous) return { rows: [], hasPrior: false };
  const rows = METRICS.map(({ key, label, pick }) => {
    const now = round2(pick(current));
    const before = round2(pick(previous));
    const delta = round2(now - before);
    return {
      key,
      label,
      current: now,
      previous: before,
      delta,
      favourable: delta === 0 ? null : delta > 0 === HIGHER_IS_BETTER[key],
      // A zero or negative base cannot yield a meaningful percentage.
      pct: before > 0 ? round2((delta / before) * 1000) / 10 : null,
    };
  });
  return { rows, hasPrior: true };
}
