'use client';

import { PiPrinter } from 'react-icons/pi';
import type { TrialBalance } from '@/services/accounting.service';
import { ACCOUNT_TYPE_LABELS, downloadCsv, fmtMoney } from './accounting-helpers';

/** Trial Balance — per-account debits/credits/closing with out-of-balance banner. */
export default function TrialBalanceTable({
  data,
  period,
}: {
  data: TrialBalance;
  period?: string;
}) {
  const print = () => {
    const rows = data.rows
      .map(
        (r) =>
          `<tr><td>${r.code}</td><td>${r.name}</td><td>${ACCOUNT_TYPE_LABELS[r.type] ?? r.type}</td><td class="num">${fmtMoney(r.debits)}</td><td class="num">${fmtMoney(r.credits)}</td><td class="num">${fmtMoney(r.closing)}</td></tr>`
      )
      .join('');
    window.open('', '_blank', 'width=900,height=700')?.document.write(
      `<!doctype html><html><head><title>Trial Balance</title><style>
        body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;margin:32px;color:#111827}
        h1{font-size:18px}.sub{color:#6b7280;font-size:12px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}
        th{text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 8px;text-transform:uppercase;font-size:9px;color:#6b7280}
        td{border-bottom:1px solid #f3f4f6;padding:7px 8px}
        td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
        tfoot td{font-weight:700;border-top:2px solid #e5e7eb}
      </style></head><body>
      <h1>Trial Balance</h1><p class="sub">Period ${period ?? 'all time'} · printed ${new Date().toLocaleString()}</p>
      <table><thead><tr><th>Code</th><th>Account</th><th>Type</th><th class="num">Debits</th><th class="num">Credits</th><th class="num">Closing</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3">Totals</td><td class="num">${fmtMoney(data.totalDebits)}</td><td class="num">${fmtMoney(data.totalCredits)}</td><td></td></tr></tfoot>
      </table><script>window.onload=()=>window.print()</script></body></html>`
    );
  };

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
              <tr key={r.code}>
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

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={print}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <PiPrinter size={14} /> Print
        </button>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              ['Code', 'Account', 'Type', 'Debits', 'Credits', 'Closing'],
              data.rows.map((r) => [r.code, r.name, r.type, r.debits.toFixed(2), r.credits.toFixed(2), r.closing.toFixed(2)]),
              'trial-balance'
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
