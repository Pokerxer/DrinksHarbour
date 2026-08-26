'use client';

import type { TrialBalance } from '@/services/accounting.service';
import {
  ACCOUNT_TYPE_LABELS,
  downloadCsv,
  fmtMoney,
  periodLabel,
  printReport,
} from './accounting-helpers';
import ReportActions from './report-actions';

/** Trial Balance — per-account debits/credits/closing with out-of-balance banner. */
export default function TrialBalanceTable({
  data,
  period,
}: {
  data: TrialBalance;
  period?: string;
}) {
  const subtitle = `${period ? `Period ${periodLabel(period)}` : 'All time'} · NGN`;
  const print = () =>
    printReport({
      title: 'Trial Balance',
      subtitle,
      headers: ['Code', 'Account', 'Type', 'Debits', 'Credits', 'Closing'],
      rows: data.rows.map((r) => [
        r.code,
        r.name,
        ACCOUNT_TYPE_LABELS[r.type] ?? r.type,
        fmtMoney(r.debits),
        fmtMoney(r.credits),
        fmtMoney(r.closing),
      ]),
      foot: ['Totals', '', '', fmtMoney(data.totalDebits), fmtMoney(data.totalCredits), ''],
    });

  return (
    <div>
      {!data.balanced && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠ Out of balance — total debits {fmtMoney(data.totalDebits)} vs credits{' '}
          {fmtMoney(data.totalCredits)}. Some entries may be missing; run the journal
          backfill or check for drafts.
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Debits</th>
              <th className="px-4 py-3 text-right">Credits</th>
              <th className="px-4 py-3 text-right">Closing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No posted entries for this period.
                </td>
              </tr>
            )}
            {data.rows.map((r) => (
              <tr key={r.code} className={r.debits === 0 && r.credits === 0 ? 'text-gray-400' : ''}>
                <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{r.code}</td>
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3 capitalize">{ACCOUNT_TYPE_LABELS[r.type] ?? r.type}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(r.debits)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(r.credits)}</td>
                <td className={`whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums ${r.closing < 0 ? 'text-red-600' : ''}`}>
                  {fmtMoney(r.closing)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr>
              <td colSpan={3} className="px-4 py-3">Totals</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(data.totalDebits)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(data.totalCredits)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <ReportActions
        onPrint={print}
        onExport={() =>
          downloadCsv(
            ['Code', 'Account', 'Type', 'Debits', 'Credits', 'Closing'],
            data.rows.map((r) => [r.code, r.name, r.type, r.debits.toFixed(2), r.credits.toFixed(2), r.closing.toFixed(2)]),
            'trial-balance'
          )
        }
      />
    </div>
  );
}
