'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiCaretLeft, PiCaretRight } from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  accountingService,
  type Account,
  type JournalEntry,
} from '@/services/accounting.service';
import {
  ENTRY_TYPE_LABELS,
  entryTypeLabel,
  fmtDate,
  fmtMoney,
  postedByLabel,
} from './accounting-helpers';
import JournalEntriesControls from './journal-entries-controls';
import JournalEntryDetail from './journal-entry-detail';
import JournalEntryFormModal from './journal-entry-form-modal';

const PAGE_SIZE = 25;

function presetRange(key: string): { from: string; to: string } | null {
  if (!key) return null;
  const now = new Date();
  if (key === 'mtd')
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: '' };
  const days = key === '7d' ? 7 : 30;
  return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(), to: '' };
}

/** /accounting/journal-entries — POS Orders style control-bar list view. */
export default function JournalEntriesBrowser() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [tabFilter, setTabFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const range = presetRange(preset);
      const res = await accountingService.journalEntries(token, {
        page,
        limit: PAGE_SIZE,
        entryType: tabFilter || undefined,
        status: statusFilter || undefined,
        from: range?.from || from || undefined,
        to: range?.to || to || undefined,
        account: search.match(/^\d{3,4}$/) ? search : undefined,
      });
      let rows = res.data ?? [];
      if (search && !search.match(/^\d{3,4}$/)) {
        // Client-side memo/reference text filter on the current page.
        const q = search.toLowerCase();
        rows = rows.filter(
          (e) =>
            e.memo?.toLowerCase().includes(q) ||
            e.refDocType.toLowerCase().includes(q) ||
            entryTypeLabel(e.entryType).toLowerCase().includes(q)
        );
      }
      setEntries(rows);
      setPages(res.pagination?.pages ?? 1);
      setTotal(res.pagination?.total ?? 0);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, page, tabFilter, statusFilter, search, preset, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    accountingService
      .accounts(token, { isActive: 'true' })
      .then((res) => setAccounts(res.data ?? []))
      .catch(() => {});
  }, [token]);

  const applyPreset = (key: string) => {
    setPreset(key);
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <div>
      <JournalEntriesControls
        tabFilter={tabFilter}
        onTab={(key) => {
          setPage(1);
          setTabFilter(key);
        }}
        statusFilter={statusFilter}
        onStatus={(v) => {
          setPage(1);
          setStatusFilter(v);
        }}
        search={search}
        onSearch={setSearch}
        preset={preset}
        onPreset={applyPreset}
        from={from}
        to={to}
        onFrom={(v) => {
          setPreset('');
          setPage(1);
          setFrom(v);
        }}
        onTo={(v) => {
          setPreset('');
          setPage(1);
          setTo(v);
        }}
        total={total}
        entries={entries}
        onRefresh={() => load()}
        onNewEntry={() => setShowForm(true)}
      />

      {/* Sticky-header table */}
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
              <th className="px-4 py-3">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No journal entries for this filter.
                </td>
              </tr>
            )}
            {entries.map((e) => {
              const debit = e.lines.reduce((s, l) => s + (l.debit || 0), 0);
              const credit = e.lines.reduce((s, l) => s + (l.credit || 0), 0);
              return (
                <tr
                  key={e._id}
                  onClick={() => setSelected(e)}
                  className={`cursor-pointer hover:bg-gray-50 ${selected?._id === e._id ? 'bg-[#fef2f2]/60' : ''}`}
                >
                  <td className="whitespace-nowrap px-4 py-3">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 font-medium capitalize">{e.refDocType.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="whitespace-nowrap px-4 py-3">{ENTRY_TYPE_LABELS[e.entryType] ?? e.entryType}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-gray-500">{e.memo || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(debit)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fmtMoney(credit)}</td>
                  <td className="px-4 py-3 capitalize">{e.status}</td>
                  <td className="whitespace-nowrap px-4 py-3">{postedByLabel(e)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-end gap-2 text-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border border-gray-300 p-1.5 disabled:opacity-40"
          aria-label="Previous page"
        >
          <PiCaretLeft size={14} />
        </button>
        <span className="text-gray-600">
          Page {page} of {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border border-gray-300 p-1.5 disabled:opacity-40"
          aria-label="Next page"
        >
          <PiCaretRight size={14} />
        </button>
      </div>

      {selected && (
        <JournalEntryDetail
          entry={selected}
          onClose={() => setSelected(null)}
          onChanged={() => load()}
        />
      )}
      {showForm && (
        <JournalEntryFormModal
          accounts={accounts}
          onClose={() => setShowForm(false)}
          onPosted={() => load()}
        />
      )}
    </div>
  );
}
