'use client';

import type { ProfitLoss } from '@/services/accounting.service';
import { downloadCsv, fmtMoney, printReport } from './accounting-helpers';
import { profitLossRows } from './profit-loss-rows';
import ReportActions from './report-actions';

export default function PlTable({
  data,
  subtitle,
}: {
  data: ProfitLoss;
  subtitle?: string;
}) {
  const rows = profitLossRows(data);
  const netSales = data.sales?.net ?? data.revenueTotal;
  const pct = (value: number) =>
    netSales > 0 ? `${((value / netSales) * 100).toFixed(1)}%` : '—';
  const taxes = [
    { label: 'Output VAT', amount: data.tax.collected },
    { label: 'Input VAT', amount: data.tax.paid },
  ];
  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        Based on posted entries. Sales exclude VAT and tips. Refunds and credit
        notes reduce sales; cost reversals reduce cost of goods sold. Profit
        reflects the costs recorded so far.
      </p>
      {data.cogs.source === 'derived' && (
        <p className="mb-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
          Cost of goods sold is estimated from inventory movements because this
          period has no cost journal entries.
        </p>
      )}
      {data.tax.reconciled === false && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          VAT journal entries and the tax ledger differ. Reconcile the tax
          records before using the tax summary.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Line</th>
              <th className="px-4 py-3 text-right">Amount (NGN)</th>
              <th className="px-4 py-3 text-right">% Net sales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr
                key={row.label}
                className={row.bold ? 'bg-gray-50 font-semibold' : ''}
              >
                <td className="px-4 py-3">{row.label}</td>
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${row.amount < 0 ? 'text-red-700' : ''}`}
                >
                  {fmtMoney(row.amount)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                  {pct(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-md">
        {taxes.map((row) => (
          <div
            key={row.label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {row.label}
            </p>
            <p className="mt-1 text-base font-semibold">
              {fmtMoney(row.amount)}
            </p>
            <p className="text-xs text-gray-400">Separate from profit</p>
          </div>
        ))}
      </div>
      <ReportActions
        onPrint={() =>
          printReport({
            title: 'Profit & Loss',
            subtitle,
            headers: ['Line', 'Amount', '% Net sales'],
            rows: [
              ...rows.map((row) => [
                row.label,
                fmtMoney(row.amount),
                pct(row.amount),
              ]),
              ...taxes.map((row) => [row.label, fmtMoney(row.amount), '—']),
            ],
          })
        }
        onExport={() =>
          downloadCsv(
            ['Line', 'Amount'],
            [...rows, ...taxes].map((row) => [
              row.label,
              row.amount.toFixed(2),
            ]),
            'profit-and-loss'
          )
        }
      />
    </div>
  );
}
