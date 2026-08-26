'use client';

import type { ReactNode } from 'react';
import {
  PiArrowDown,
  PiArrowUp,
  PiCheckCircle,
  PiWarningCircle,
} from 'react-icons/pi';
import type { BalanceSheet, GeneralLedger, ProfitLoss, TrialBalance } from '@/services/accounting.service';
import { fmtMoney } from './accounting-helpers';

/** Order-analysis style stat chip: uppercase label over a bold tabular value. */
export function StatChip({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: 'default' | 'good' | 'bad';
}) {
  const toneCls =
    tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="flex min-w-[120px] flex-1 flex-col gap-0.5 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${toneCls}`}>{value}</span>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  );
}

function KpiRow({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex flex-wrap gap-2">{children}</div>;
}

const marginOf = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}% of revenue` : undefined;

export function TBKpis({ data }: { data: TrialBalance }) {
  return (
    <KpiRow>
      <StatChip label="Total Debits" value={fmtMoney(data.totalDebits)} />
      <StatChip label="Total Credits" value={fmtMoney(data.totalCredits)} />
      <StatChip
        label="Status"
        value={data.balanced ? 'Balanced' : 'Out of balance'}
        tone={data.balanced ? 'good' : 'bad'}
        sub={
          data.balanced ? (
            <span className="flex items-center gap-1">
              <PiCheckCircle size={11} /> debits equal credits
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <PiWarningCircle size={11} /> run the journal backfill
            </span>
          )
        }
      />
      <StatChip label="Accounts Touched" value={String(data.rows.length)} />
    </KpiRow>
  );
}

export function PLKpis({ data }: { data: ProfitLoss }) {
  const trendUp = data.netProfit >= 0;
  return (
    <KpiRow>
      <StatChip label="Revenue" value={fmtMoney(data.revenueTotal)} />
      <StatChip
        label="Gross Profit"
        value={fmtMoney(data.grossProfit)}
        sub={marginOf(data.grossProfit, data.revenueTotal)}
      />
      <StatChip label="Operating Expenses" value={fmtMoney(data.expenseTotal)} />
      <StatChip
        label="Net Profit"
        value={fmtMoney(data.netProfit)}
        tone={trendUp ? 'good' : 'bad'}
        sub={
          <span className="flex items-center gap-1">
            {trendUp ? <PiArrowUp size={11} /> : <PiArrowDown size={11} />}
            {marginOf(data.netProfit, data.revenueTotal) ?? 'no revenue this window'}
          </span>
        }
      />
    </KpiRow>
  );
}

export function BSKpis({ data }: { data: BalanceSheet }) {
  const le = Math.round((data.liabilities.total + data.equity.total) * 100) / 100;
  const gap = Math.round((data.assets.total - le) * 100) / 100;
  return (
    <KpiRow>
      <StatChip label="Total Assets" value={fmtMoney(data.assets.total)} />
      <StatChip label="Liabilities" value={fmtMoney(data.liabilities.total)} />
      <StatChip label="Equity" value={fmtMoney(data.equity.total)} />
      <StatChip
        label="A − (L + E)"
        value={fmtMoney(gap)}
        tone={data.balanced ? 'good' : 'bad'}
        sub={data.balanced ? 'sheet balances' : 'post opening balances to close the gap'}
      />
    </KpiRow>
  );
}

export function GLKpis({ data }: { data: GeneralLedger }) {
  const opening = data.openingBalance ?? 0;
  const netMovement =
    Math.round((data.totals.debits - data.totals.credits) * 100) / 100;
  return (
    <KpiRow>
      <StatChip label="Opening" value={fmtMoney(opening)} />
      <StatChip label={`In (Debits)`} value={fmtMoney(data.totals.debits)} />
      <StatChip label="Out (Credits)" value={fmtMoney(data.totals.credits)} />
      <StatChip
        label="Closing"
        value={fmtMoney(data.totals.closing)}
        tone={data.totals.closing < 0 ? 'bad' : 'default'}
        sub={
          <span className="flex items-center gap-1">
            {netMovement >= 0 ? <PiArrowUp size={11} /> : <PiArrowDown size={11} />}
            {fmtMoney(Math.abs(netMovement))} net movement
          </span>
        }
      />
    </KpiRow>
  );
}
