'use client';

import { useEffect, useState } from 'react';
import { PiWarning, PiX } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import ConfirmDialog from '@/app/shared/confirm-dialog';
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
  const [confirmingReverse, setConfirmingReverse] = useState(false);

  const accountName = (code: string) => accountsByCode?.get(code)?.name;
  const totalDebit = entryTotals(entry).debit;
  const totalCredit = entryTotals(entry).credit;
  const outOfBalanceBy = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
  const outOfBalance = outOfBalanceBy > 0.01;
  const canReverse = entry.status === 'posted' && entry.entryType !== 'reversal';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Never carry a pending confirmation across to a different entry.
  useEffect(() => {
    setConfirmingReverse(false);
  }, [entry._id]);

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
    const escapeHtml = (value: unknown) =>
      String(value ?? '').replace(
        /[&<>"']/g,
        (char) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          })[char]!
      );
    const rows = entry.lines
      .map(
        (l) =>
          `<tr><td>${escapeHtml(l.account)}${accountName(l.account) ? ` — ${escapeHtml(accountName(l.account))}` : ''}</td><td>${escapeHtml(l.memo)}</td><td class="num">${fmtMoney(l.debit)}</td><td class="num">${fmtMoney(l.credit)}</td></tr>`
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
      <p class="sub">${escapeHtml(refDocLabel(entry.refDocType))} · ${escapeHtml(entryTypeLabel(entry.entryType))} · ${fmtDate(entry.date)} · ${escapeHtml(entry.status)}</p>
      <p class="sub">${escapeHtml(entry.memo)}</p>
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
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Journal entry detail">
      {/* Scrim: the panel is a drawer over the table, so the rows behind it
          stay visible and look live. A dimmed, click-to-dismiss backdrop says
          "this is a layer", and gives touch users something to hit. */}
      <button
        type="button"
        aria-label="Close detail"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/20"
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {refDocLabel(entry.refDocType)}
          </h3>
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
            <PiX size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="mb-3 text-sm text-gray-600">{entry.memo || 'No memo'}</p>

        <dl className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs">
          {meta.map(([label, value]) => (
            <div key={label}>
              <dt className="uppercase tracking-wide text-gray-400">{label}</dt>
              <dd className="mt-0.5 font-medium capitalize text-gray-700">
                {value}
              </dd>
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
                      <span className="font-medium tabular-nums">
                        {l.account}
                      </span>
                      {name && (
                        <span className="block text-[11px] text-gray-500">
                          {name}
                        </span>
                      )}
                      {l.memo && (
                        <span className="block text-[11px] italic text-gray-400">
                          {l.memo}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtMoney(l.debit)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtMoney(l.credit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-3 py-2">Totals</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtMoney(totalDebit)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtMoney(totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
          {/* An entry whose two sides disagree is broken; saying so here is the
              difference between a 1-naira typo being caught and being posted. */}
          {outOfBalance && (
            <p className="flex items-start gap-1.5 border-t border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
              <PiWarning size={13} className="mt-px shrink-0" />
              <span>
                Debits and credits differ by {fmtMoney(outOfBalanceBy)}. This entry
                is out of balance and will not post cleanly.
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-gray-200 px-5 py-3">
        {canReverse && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmingReverse(true)}
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
              run(
                () => accountingService.deleteJournalEntry(token, entry._id),
                'Draft deleted'
              )
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

      <ConfirmDialog
        open={confirmingReverse}
        title="Reverse this entry?"
        message={`A mirrored reversal of ${fmtMoney(totalDebit)} will be posted today. The original stays on the ledger, and any VAT this entry captured is unwound at the same time.`}
        confirmLabel="Post reversal"
        busy={busy}
        onConfirm={() =>
          run(
            () => accountingService.reverseJournalEntry(token, entry._id),
            'Reversal posted'
          )
        }
        onCancel={() => setConfirmingReverse(false)}
      />
    </div>
  );
}

/**
 * Journal export rows. Pure so the shape can be unit-tested.
 *
 * The source document is written as its Mongo id, labelled "Source ID" rather
 * than "Ref Number": the model stores no human-readable document number, so
 * calling the ObjectId a reference number gave accountants a column of noise.
 * The receipt/order number is carried in the memo, which is exported alongside.
 */
export function journalEntriesCsv(entries: JournalEntry[]) {
  return {
    headers: [
      'Date',
      'Source',
      'Source ID',
      'Type',
      'Memo',
      'Debit',
      'Credit',
      'Status',
    ],
    rows: entries.map((e) => {
      const t = entryTotals(e);
      return [
        fmtDate(e.date),
        refDocLabel(e.refDocType),
        e.refDoc ?? '',
        entryTypeLabel(e.entryType),
        e.memo ?? '',
        t.debit.toFixed(2),
        t.credit.toFixed(2),
        e.status,
      ];
    }),
  };
}

export function exportEntriesCsv(entries: JournalEntry[]) {
  const { headers, rows } = journalEntriesCsv(entries);
  downloadCsv(headers, rows, 'journal-entries');
}
