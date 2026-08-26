'use client';

import type { GeneralLedger } from '@/services/accounting.service';
import { downloadCsv, fmtDate, fmtMoney, printReport, refDocLabel } from './accounting-helpers';
import ReportActions from './report-actions';

/** General Ledger — per-account line listing with a nature-aware running balance. */
export default function GeneralLedgerTable({
  data,
  subtitle,
}: {
  data: GeneralLedger;
  subtitle?: string;
}) {
  const opening = data.openingBalance ?? 0;

  const print = () =>
    printReport({
      title: `General Ledger — ${data.account ? `${data.account.code} ${data.account.name}` : ''}`.trim(),
      subtitle,
      headers: ['Date', 'Reference', 'Memo', 'Debit', 'Credit', 'Balance'],
      rows: [
        ...(opening !== 0
          ? [['', 'Opening balance', '', '', '', fmtMoney(opening)] as [string, string, string, string, string, string]]
          : []),
        ...data.lines.map(
          (l) =>
            [fmtDate(l.date), refDocLabel(l.refDocType), l.memo ?? '', fmtMoney(l.debit), fmtMoney(l.credit), fmtMoney(l.balance)] as [
              string,
              string,
              string,
              string,
              string,
              string
            ]
        ),
      ],
      foot: ['Totals', '', '', fmtMoney(data.totals.debits), fmtMoney(data.totals.credits), fmtMoney(data.totals.closing)],
    });

  return (
    <div>
      {data.account && (
        <p className="mb-2 text-xs text-gray-500">
          {data.account.code} · {data.account.name}
          {opening !== 0 && (
            <>
              {' '}· opening balance <span className="font-medium text-gray-700">{fmtMoney(opening)}</span>
            </>
          )}
        </p>
      )}
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
            {data.lines.length === 0 && opening === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No movements for this account in the selected window.
                </td>
              </tr>
            )}
            {opening !== 0 && data.lines.length > 0 && (
              <tr className="bg-gray-50/70 text-gray-500">
                <td colSpan={5} className="px-4 py-2.5 text-xs uppercase tracking-wide">
                  Opening balance
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{fmtMoney(opening)}</td>
              </tr>
            )}
            {data.lines.map((l, i) => (
              <tr key={`${l.entryId}-${i}`}>
                <td className="whitespace-nowrap px-4 py-3">{fmtDate(l.date)}</td>
                <td className="whitespace-nowrap px-4 py-3 capitalize">{refDocLabel(l.refDocType)}</td>
                <td className="max-w-[220px] truncate px-4 py-3 text-gray-500">{l.memo || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(l.debit)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(l.credit)}</td>
                <td className={`whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums ${l.balance < 0 ? 'text-red-600' : ''}`}>
                  {fmtMoney(l.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-gray-50 font-semibold">
            <tr>
              <td colSpan={3} className="px-4 py-3">Totals</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(data.totals.debits)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(data.totals.credits)}</td>
              <td className={`px-4 py-3 text-right tabular-nums ${data.totals.closing < 0 ? 'text-red-600' : ''}`}>
                {fmtMoney(data.totals.closing)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ReportActions
        onPrint={print}
        onExport={() =>
          downloadCsv(
            ['Date', 'Reference', 'Memo', 'Debit', 'Credit', 'Balance'],
            [
              ...(opening !== 0
                ? [['', 'Opening balance', '', '', '', opening.toFixed(2)] as [string, string, string, string, string, string]]
                : []),
              ...data.lines.map(
                (l) => [fmtDate(l.date), l.refDocType, l.memo ?? '', l.debit.toFixed(2), l.credit.toFixed(2), l.balance.toFixed(2)] as [
                  string,
                  string,
                  string,
                  string,
                  string,
                  string
                ]
              ),
            ],
            `general-ledger-${data.account?.code ?? ''}`
          )
        }
      />
    </div>
  );
}
