'use client';

import type { ProfitLoss } from '@/services/accounting.service';
import { downloadCsv, fmtMoney, printReport } from './accounting-helpers';
import ReportActions from './report-actions';

function Row({
  label,
  value,
  bold,
  indent,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  indent?: boolean;
  muted?: boolean;
}) {
  return (
    <tr className={bold ? 'bg-gray-50 font-semibold' : ''}>
      <td className={`px-4 py-3 ${indent ? 'pl-8 text-gray-600' : ''} ${muted ? 'text-gray-400' : ''}`}>
        {label}
      </td>
      <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${muted ? 'text-gray-400' : ''}`}>
        {value}
      </td>
    </tr>
  );
}

/** Profit & Loss — revenue − COGS − expenses = net profit, with margins + tax lines. */
export default function PlTable({ data, subtitle }: { data: ProfitLoss; subtitle?: string }) {
  const pct = (v: number) =>
    data.revenueTotal > 0 ? `${((v / data.revenueTotal) * 100).toFixed(1)}%` : '—';

  const print = () =>
    printReport({
      title: 'Profit & Loss',
      subtitle,
      headers: ['Line', 'Amount', '% Revenue'],
      rows: [
        ['Revenue', fmtMoney(data.revenueTotal), pct(data.revenueTotal)],
        ['Cost of Goods Sold', `(${fmtMoney(data.cogs.total)})`, pct(data.cogs.total)],
        [`Gross Profit${data.cogs.source === 'derived' ? ' *' : ''}`, fmtMoney(data.grossProfit), pct(data.grossProfit)],
        ['Operating Expenses', `(${fmtMoney(data.expenseTotal)})`, pct(data.expenseTotal)],
        ['Net Profit', fmtMoney(data.netProfit), pct(data.netProfit)],
      ],
    });

  return (
    <div>
      {data.cogs.source === 'derived' && (
        <div className="mb-3 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          ℹ COGS is derived from inventory movement costs — no journal COGS entries
          exist for this window yet.
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Line</th>
              <th className="px-4 py-3 text-right">Amount (NGN)</th>
              <th className="px-4 py-3 text-right">% Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <Row label="Revenue" value={fmtMoney(data.revenueTotal)} />
            <Row label="Cost of Goods Sold" value={`(${fmtMoney(data.cogs.total)})`} indent />
            <Row label={`Gross Profit${data.cogs.source === 'derived' ? ' *' : ''}`} value={fmtMoney(data.grossProfit)} bold />
            <Row label="Operating Expenses" value={`(${fmtMoney(data.expenseTotal)})`} indent />
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-900 bg-gray-50 font-semibold">
              <td className="px-4 py-3">Net Profit</td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(data.netProfit)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-500">{pct(data.netProfit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Tax Collected</p>
          <p className="mt-1 text-base font-semibold">{fmtMoney(data.tax.collected)}</p>
          <p className="text-xs text-gray-400">Output VAT payable</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Tax Paid</p>
          <p className="mt-1 text-base font-semibold">{fmtMoney(data.tax.paid)}</p>
          <p className="text-xs text-gray-400">Input VAT recoverable</p>
        </div>
      </div>

      <ReportActions
        onPrint={print}
        onExport={() =>
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
      />
    </div>
  );
}
