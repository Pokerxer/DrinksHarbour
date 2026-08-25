'use client';

import type { ProfitLoss } from '@/services/accounting.service';
import { downloadCsv, fmtMoney } from './accounting-helpers';

function Row({ label, value, bold, indent }: { label: string; value: number | string; bold?: boolean; indent?: boolean }) {
  return (
    <tr className={bold ? 'bg-gray-50 font-semibold' : ''}>
      <td className={`px-4 py-3 ${indent ? 'pl-8 text-gray-600' : ''}`}>{label}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{typeof value === 'number' ? fmtMoney(value) : value}</td>
    </tr>
  );
}

/** Profit & Loss — revenue − COGS − expenses = net profit, with tax lines. */
export default function PlTable({ data }: { data: ProfitLoss }) {
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Line</th>
              <th className="px-4 py-3 text-right">Amount (NGN)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <Row label="Revenue" value={data.revenueTotal} />
            <Row label="Cost of Goods Sold" value={data.cogs.total} indent />
            <Row label={`Gross Profit${data.cogs.source === 'derived' ? ' (COGS derived from inventory moves)' : ''}`} value={data.grossProfit} />
            <Row label="Operating Expenses" value={data.expenseTotal} indent />
            <Row label="Net Profit" value={data.netProfit} bold />
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Tax Collected</p>
          <p className="mt-1 text-base font-semibold">{fmtMoney(data.tax.collected)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Tax Paid</p>
          <p className="mt-1 text-base font-semibold">{fmtMoney(data.tax.paid)}</p>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              ['Line', 'Amount'],
              [
                ['Revenue', data.revenueTotal.toFixed(2)],
                ['COGS', data.cogs.total.toFixed(2)],
                ['Gross Profit', data.grossProfit.toFixed(2)],
                ['Operating Expenses', data.expenseTotal.toFixed(2)],
                ['Net Profit', data.netProfit.toFixed(2)],
                ['Tax Collected', data.tax.collected.toFixed(2)],
                ['Tax Paid', data.tax.paid.toFixed(2)],
              ],
              'profit-and-loss'
            )
          }
          className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-black"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
