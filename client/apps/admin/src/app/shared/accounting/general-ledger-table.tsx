'use client';

import type { GeneralLedger } from '@/services/accounting.service';
import { downloadCsv, fmtDate, fmtMoney } from './accounting-helpers';

/** General Ledger — per-account line listing with a running balance. */
export default function GeneralLedgerTable({ data }: { data: GeneralLedger }) {
  return (
    <div>
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Memo</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.lines.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No movements for this account in the selected window.
                </td>
              </tr>
            )}
            {data.lines.map((l, i) => (
              <tr key={`${l.entryId}-${i}`}>
                <td className="whitespace-nowrap px-4 py-3">{fmtDate(l.date)}</td>
                <td className="px-4 py-3 capitalize">{l.refDocType.replace(/_/g, ' ').toLowerCase()}</td>
                <td className="max-w-[220px] truncate px-4 py-3 text-gray-500">{l.memo || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(l.debit)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(l.credit)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{fmtMoney(l.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr>
              <td colSpan={3} className="px-4 py-3">Totals</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(data.totals.debits)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(data.totals.credits)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(data.totals.closing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              ['Date', 'Reference', 'Memo', 'Debit', 'Credit', 'Balance'],
              data.lines.map((l) => [
                fmtDate(l.date),
                l.refDocType,
                l.memo ?? '',
                l.debit.toFixed(2),
                l.credit.toFixed(2),
                l.balance.toFixed(2),
              ]),
              'general-ledger'
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
