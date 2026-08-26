'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiCaretLeft, PiCaretRight } from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  accountingService,
  type Account,
  type JournalEntry,
} from '@/services/accounting.service';
import { pageWindowLabel } from './accounting-helpers';
import JournalEntriesControls from './journal-entries-controls';
import JournalEntriesTable from './journal-entries-table';
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
  const [deferredSearch, setDeferredSearch] = useState('');
  const [preset, setPreset] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDeferredSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const accountsByCode = useMemo(
    () => new Map(accounts.map((a) => [a.code, a])),
    [accounts]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const range = presetRange(preset);
      const isAccountCode = /^\d{3,4}$/.test(deferredSearch.trim());
      const res = await accountingService.journalEntries(token, {
        page,
        limit: PAGE_SIZE,
        entryType: tabFilter || undefined,
        status: statusFilter || undefined,
        from: range?.from || from || undefined,
        to: range?.to || to || undefined,
        account: isAccountCode ? deferredSearch.trim() : undefined,
        q: deferredSearch.trim() && !isAccountCode ? deferredSearch.trim() : undefined,
      });
      setEntries(res.data ?? []);
      setPages(res.pagination?.pages ?? 1);
      setTotal(res.pagination?.total ?? 0);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, page, tabFilter, statusFilter, deferredSearch, preset, from, to]);

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
        rangeLabel={pageWindowLabel(page, PAGE_SIZE, total)}
        entries={entries}
        loading={loading}
        onRefresh={() => load()}
        onNewEntry={() => setShowForm(true)}
      />

      <JournalEntriesTable
        entries={entries}
        loading={loading}
        accountsByCode={accountsByCode}
        selectedId={selected?._id}
        onSelect={setSelected}
      />

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
          accountsByCode={accountsByCode}
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
