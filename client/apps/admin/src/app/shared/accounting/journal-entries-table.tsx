'use client';

import { PiBookOpenText, PiWarning } from 'react-icons/pi';
import type { Account, JournalEntry } from '@/services/accounting.service';
import {
  ENTRY_TYPE_LABELS,
  STATUS_STYLES,
  entryTotals,
  fmtDate,
  fmtMoney,
  summarizePage,
} from './accounting-helpers';

const COLS = 7;

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: COLS }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3 rounded bg-gray-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Sticky-header entries table with account names, badges and page totals. */
export default function JournalEntriesTable({
  entries,
  loading,
  accountsByCode,
  selectedId,
  onSelect,
}: {
  entries: JournalEntry[];
  loading: boolean;
  accountsByCode: Map<string, Account>;
  selectedId?: string;
  onSelect: (entry: JournalEntry) => void;
}) {
  const totals = summarizePage(entries);
  const withheld = totals.draftCount;

  return (
    <div className="max-h-[62vh] overflow-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Memo</th>
            <th className="px-4 py-3 text-right">Debit</th>
            <th className="px-4 py-3 text-right">Credit</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && <SkeletonRows />}
          {!loading && entries.length === 0 && (
            <tr>
              <td colSpan={COLS} className="px-4 py-12 text-center">
                <PiBookOpenText size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">No journal entries found</p>
                <p className="text-xs text-gray-400">Adjust the filters or post a manual entry.</p>
              </td>
            </tr>
          )}
          {!loading &&
            entries.map((e) => {
              const { debit, credit } = entryTotals(e);
              const lopsided = Math.abs(debit - credit) > 0.01;
              return (
                <tr
                  key={e._id}
                  onClick={() => onSelect(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      onSelect(e);
                    }
                  }}
                  // Rows open the detail panel, so they must be reachable and
                  // announceable from the keyboard, not just clickable.
                  tabIndex={0}
                  role="button"
                  aria-label={`${e.entryType} entry dated ${fmtDate(e.date)}${
                    lopsided ? ', out of balance' : ''
                  }`}
                  className={`cursor-pointer hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900 ${
                    selectedId === e._id ? 'bg-[#fef2f2]/60' : ''
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 font-medium capitalize">
                    {(e.refDocType || '—').replace(/_/g, ' ').toLowerCase()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {ENTRY_TYPE_LABELS[e.entryType] ?? e.entryType}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-gray-500">{e.memo || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(debit)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(credit)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                          STATUS_STYLES[e.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {e.status}
                      </span>
                      {lopsided && (
                        <PiWarning
                          size={13}
                          className="text-amber-600"
                          aria-label="Debits and credits do not agree"
                        />
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
        </tbody>
        {!loading && entries.length > 0 && (
          <tfoot className="sticky bottom-0 border-t border-gray-200 bg-gray-50 text-sm font-semibold text-gray-900">
            <tr>
              <td colSpan={4} className="px-4 py-2.5">
                <span className="block text-xs uppercase tracking-wide text-gray-500">
                  Page totals · {totals.postedCount} posted{' '}
                  {totals.postedCount === 1 ? 'entry' : 'entries'}
                  {withheld > 0 && (
                    <span className="normal-case text-gray-400">
                      {' '}
                      · {withheld} draft{withheld === 1 ? '' : 's'} excluded
                    </span>
                  )}
                </span>
                {totals.outOfBalance && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs font-medium normal-case text-amber-700">
                    <PiWarning size={12} />
                    Out of balance by {fmtMoney(totals.outOfBalanceBy)} on this page
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{fmtMoney(totals.debit)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{fmtMoney(totals.credit)}</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
