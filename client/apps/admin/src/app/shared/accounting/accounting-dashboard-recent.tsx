'use client';

import Link from 'next/link';
import { PiBookOpen } from 'react-icons/pi';
import type { JournalEntry } from '@/services/accounting.service';
import {
  entryTypeLabel,
  fmtDate,
  fmtMoney,
  refDocLabel,
} from './accounting-helpers';

/** Recent journal entries as compact rows — POS recent-orders style. */
export default function AccountingDashboardRecent({
  entries,
}: {
  entries: JournalEntry[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">Recent Entries</p>
        <Link
          href="/accounting/journal-entries"
          className="text-[11px] font-semibold text-[#b20202] hover:underline"
        >
          View all →
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <PiBookOpen className="mb-2 h-8 w-8 text-gray-200" />
          <p className="text-xs text-gray-400">
            No entries yet — confirm a sale or post one manually
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {entries.slice(0, 8).map((e) => {
            const debit = e.lines.reduce((s, l) => s + (l.debit || 0), 0);
            return (
              <div key={e._id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-800">
                    {refDocLabel(e.refDocType)}
                    <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-gray-400">
                      {entryTypeLabel(e.entryType)}
                    </span>
                  </p>
                  <p className="truncate text-[10px] text-gray-400">
                    {fmtDate(e.date)}
                    {e.memo ? ` · ${e.memo}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <p className="text-xs font-bold tabular-nums text-gray-900">{fmtMoney(debit)}</p>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                      e.status === 'posted'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
