'use client';

import { useEffect, useState } from 'react';
import { PiCaretRight } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import {
  accountingService,
  type Account,
  type JournalEntry,
} from '@/services/accounting.service';
import {
  STATUS_STYLES,
  downloadCsv,
  entryTotals,
  entryTypeLabel,
  fmtDate,
  fmtMoney,
  refDocLabel,
} from './accounting-helpers';

/** Right-hand detail panel for a selected journal entry. */
export default function JournalEntryDetail({
  entry,
  accountsByCode,
  onClose,
  onChanged,
}: {
  entry: JournalEntry;
  accountsByCode?: Map<string, Account>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [busy, setBusy] = useState(false);

  const accountName = (code: string) => accountsByCode?.get(code)?.name;
  const totalDebit = entryTotals(entry).debit;
  const totalCredit = entryTotals(entry).credit;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (action: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(successMsg);
      onChanged();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const printEntry = () => {
    const rows = entry.lines
      .map(
        (l) =>
          `<tr><td>${l.account}${accountName(l.account) ? ` — ${accountName(l.account)}` : ''}</td><td>${l.memo ?? ''}</td><td class="num">${fmtMoney(l.debit)}</td><td class="num">${fmtMoney(l.credit)}</td></tr>`
      )
      .join('');
    const html = `<!doctype html><html><head><title>Journal Entry</title><style>
      body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;margin:32px;color:#111827}
      h1{font-size:18px}.sub{color:#6b7280;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}
      th{text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 8px;text-transform:uppercase;font-size:9px;color:#6b7280}
      td{border-bottom:1px solid #f3f4f6;padding:7px 8px}
      td.num{text-align:right;font-variant-numeric:tabular-nums}
      tfoot td{font-weight:700;border-top:2px solid #e5e7eb}
    </style></head><body>
      <h1>Journal Entry</h1>
      <p class="sub">${refDocLabel(entry.refDocType)} · ${entryTypeLabel(entry.entryType)} · ${fmtDate(entry.date)} · ${entry.status}</p>
      <p class="sub">${entry.memo ?? ''}</p>
      <table><thead><tr><th>Account</th><th>Memo</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2">Totals</td><td class="num">${fmtMoney(totalDebit)}</td><td class="num">${fmtMoney(totalCredit)}</td></tr></tfoot>
      </table><script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const meta: Array<[string, string]> = [
    ['Period', entry.period || '—'],
    ['Source', (entry.source || '—').replace(/_/g, ' ')],
    ['Posted by', entry.postedBy?.name || 'System'],
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{refDocLabel(entry.refDocType)}</h3>
          <p className="text-xs text-gray-500">
            {entryTypeLabel(entry.entryType)} · {fmtDate(entry.date)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
              STATUS_STYLES[entry.status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {entry.status}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close detail"
          >
            <PiCaretRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="mb-3 text-sm text-gray-600">{entry.memo || 'No memo'}</p>

        <dl className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs">
          {meta.map(([label, value]) => (
            <div key={label}>
              <dt className="uppercase tracking-wide text-gray-400">{label}</dt>
              <dd className="mt-0.5 font-medium capitalize text-gray-700">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entry.lines.map((l, i) => {
                const name = accountName(l.account);
                return (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <span className="font-medium tabular-nums">{l.account}</span>
                      {name && <span className="block text-[11px] text-gray-500">{name}</span>}
                      {l.memo && <span className="block text-[11px] italic text-gray-400">{l.memo}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(l.debit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(l.credit)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-3 py-2">Totals</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totalDebit)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-gray-200 px-5 py-3">
        {entry.status === 'posted' && entry.entryType !== 'reversal' && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => accountingService.reverseJournalEntry(token, entry._id),
                'Reversal posted'
              )
            }
            className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
          >
            Reverse
          </button>
        )}
        {entry.status === 'draft' && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => accountingService.deleteJournalEntry(token, entry._id), 'Draft deleted')
            }
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete Draft
          </button>
        )}
        <button
          type="button"
          onClick={printEntry}
          className="ml-auto rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Print
        </button>
      </div>
    </div>
  );
}

export function exportEntriesCsv(entries: JournalEntry[]) {
  downloadCsv(
    ['Date', 'Reference', 'Ref Number', 'Type', 'Memo', 'Debit', 'Credit', 'Status'],
    entries.map((e) => [
      fmtDate(e.date),
      refDocLabel(e.refDocType),
      e.refDoc,
      entryTypeLabel(e.entryType),
      e.memo ?? '',
      entryTotals(e).debit.toFixed(2),
      entryTotals(e).credit.toFixed(2),
      e.status,
    ]),
    'journal-entries'
  );
}
