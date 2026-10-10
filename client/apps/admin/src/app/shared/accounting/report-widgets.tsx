'use client';

import type { ReactNode } from 'react';
import {
  PiArrowDown,
  PiArrowUp,
  PiCheckCircle,
  PiInfo,
  PiWarningCircle,
} from 'react-icons/pi';
import type { BalanceSheet, GeneralLedger, ProfitLoss, TrialBalance } from '@/services/accounting.service';
import { fmtMoney } from './accounting-helpers';
import {
  balanceSheetStatus,
  netMovementDirection,
  trialBalanceStatus,
  type StatusTone,
} from './report-status';

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
  tone?: StatusTone | 'default';
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
  const status = trialBalanceStatus(data);
  return (
    <KpiRow>
      <StatChip label="Total Debits" value={fmtMoney(data.totalDebits)} />
      <StatChip label="Total Credits" value={fmtMoney(data.totalCredits)} />
      <StatChip
        label="Status"
        value={status.label}
        tone={status.tone}
        sub={
          <span className="flex items-center gap-1">
            {status.tone === 'good' ? (
              <PiCheckCircle size={11} />
            ) : status.tone === 'bad' ? (
              <PiWarningCircle size={11} />
            ) : (
              <PiInfo size={11} />
            )}
            {status.detail}
          </span>
        }
      />
      <StatChip label="Accounts Touched" value={String(data.rows.length)} />
      {data.entryCount !== undefined && (
        <StatChip
          label="Entries Totalled"
          value={String(data.entryCount)}
          sub={data.draftsExcluded ? `${data.draftsExcluded} more in drafts` : 'all posted'}
        />
      )}
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
  const status = balanceSheetStatus({
    balanced: data.balanced,
    assets: data.assets.total,
    liabilities: data.liabilities.total,
    equity: data.equity.total,
  });
  return (
    <KpiRow>
      <StatChip label="Total Assets" value={fmtMoney(data.assets.total)} />
      <StatChip label="Liabilities" value={fmtMoney(data.liabilities.total)} />
      <StatChip label="Equity" value={fmtMoney(data.equity.total)} />
      <StatChip
        label="A − (L + E)"
        value={fmtMoney(status.gap)}
        tone={status.tone}
        sub={status.detail}
      />
    </KpiRow>
  );
}

export function GLKpis({ data }: { data: GeneralLedger }) {
  const opening = data.openingBalance ?? 0;
  // Nature-aware: a debit is a rise for an asset or expense and a fall for a
  // liability, equity or income account.
  const { delta, rising } = netMovementDirection(data.totals, data.account?.type);
  // With no `from` the service never read prior entries, so opening is 0 and the
  // closing figure is the movement inside the window — not the account's
  // balance. Labelling it "Closing" made an account with ₦5m of prior balance
  // and ₦100k of movement read as ₦100k.
  const isBalance = data.openingIncluded !== false;
  return (
    <KpiRow>
      {isBalance ? (
        <StatChip label="Opening" value={fmtMoney(opening)} />
      ) : (
        <StatChip
          label="Opening"
          value="—"
          tone="neutral"
          sub="not included; set a from date"
        />
      )}
      <StatChip label={`In (Debits)`} value={fmtMoney(data.totals.debits)} />
      <StatChip label="Out (Credits)" value={fmtMoney(data.totals.credits)} />
      <StatChip
        label={isBalance ? "Closing" : "Movement"}
        value={fmtMoney(data.totals.closing)}
        tone={data.totals.closing < 0 ? 'bad' : 'default'}
        sub={
          !isBalance ? (
            <span className="flex items-center gap-1">
              <PiWarningCircle size={11} /> window movement, not a balance
            </span>
          ) : delta === 0 ? (
            <span className="flex items-center gap-1">no movement this window</span>
          ) : (
            <span className="flex items-center gap-1">
              {rising ? <PiArrowUp size={11} /> : <PiArrowDown size={11} />}
              {fmtMoney(Math.abs(delta))} net {rising ? 'increase' : 'decrease'}
            </span>
          )
        }
      />
    </KpiRow>
  );
}
