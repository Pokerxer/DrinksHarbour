'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowDownUp } from 'lucide-react';
import {
  occasionRequestService,
  type OccasionRequest,
  type RequestPage,
} from '@/services/occasionRequest.service';
import { buttonClass } from '../market-foundation/workspace';
const control = buttonClass;

/** Optional selection callback: inside the two-pane inbox a row click
 * selects the conversation in place; deep links stay real hrefs. */
type Props = { pane?: boolean; selectedId?: string; onSelect?: (id: string) => void };

export default function RequestQueue(props: Props = {}) {
  const { data: session, status: sessionStatus } = useSession();
  const user = session?.user as { token?: string; role?: string } | undefined,
    token = user?.token;
  if (sessionStatus === 'loading')
    return <p role="status">Loading your session…</p>;
  if (!token || !['admin', 'super_admin'].includes(user?.role || ''))
    return <p role="alert">Platform administrator access is required.</p>;
  return <Queue key={`${user?.role}:${token}`} token={token} pane={props.pane} selectedId={props.selectedId} onSelect={props.onSelect} />;
}

function Queue({ token, pane, selectedId, onSelect }: Required<{ token: string }> & Props) {
  const [data, setData] = useState<RequestPage>(),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [sortDir, setSortDir] = useState<'' | 'ascending' | 'descending'>('');
  const requestId = useRef(0);
  const load = useCallback(async () => {
    if (!token) return;
    const id = ++requestId.current;
    setBusy(true);
    try {
      const result = await occasionRequestService.list(token, page, status);
      if (id !== requestId.current) return;
      setData(result);
      setError('');
    } catch (failure) {
      if (id === requestId.current)
        setError(
          failure instanceof Error ? failure.message : 'Queue unavailable.'
        );
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, [token, page, status]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    return () => {
      clearInterval(timer);
      requestId.current += 1;
    };
  }, [load]);
  const rows = useMemo(() => {
    const list = [...(data?.requests || [])];
    if (sortDir)
      list.sort((a, b) => {
        const diff =
          new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        return sortDir === 'ascending' ? diff : -diff;
      });
    return list;
  }, [data, sortDir]);
  return (
    <div className={pane ? 'flex h-full min-h-0 flex-col' : 'mx-auto max-w-6xl space-y-6'}>
      {!pane && <Header />}
      {!pane && <Controls status={status} setStatus={setStatus} setPage={setPage} setData={setData} busy={busy} reload={load} data={data} sortDir={sortDir} setSortDir={setSortDir} />}
      {error && (
        <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20">
          <p
            role="alert"
            className="text-sm text-red-800 dark:text-red-300"
          >
            {error}
          </p>
          <button className={control} onClick={() => void load()}>
            Retry queue read
          </button>
        </div>
      )}
      {!data && !error ? (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading requests…</span>
          {[0, 1, 2].map((skeleton) => (
            <div
              className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/70"
              key={skeleton}
            />
          ))}
        </div>
      ) : (
        <List rows={rows} pane={pane} selectedId={selectedId} onSelect={onSelect} empty={!!data && data.requests.length === 0} sortDir={sortDir} />
      )}
      {!pane && <Pagination busy={busy} data={data} page={page} setPage={setPage} setData={setData} />}
      {pane && data && data.pages > 1 && <div className="flex flex-wrap items-center gap-3 pb-2 text-sm">
        <button className={control} disabled={busy || page <= 1} onClick={() => { setData(undefined); setPage(p => p - 1); }}>Previous</button>
        <p className="tabular-nums">Page {page} of {Math.max(1, data.pages)}</p>
        <button className={control} disabled={busy || page >= data.pages} onClick={() => { setData(undefined); setPage(p => p + 1); }}>Next</button>
      </div>}
    </div>
  );
}

function Header() {
  return <div>
    <p className="text-xs font-semibold uppercase tracking-widest text-primary">
      Customer planning
    </p>
    <h1 className="mt-2 text-3xl font-bold">Occasion requests</h1>
    <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
      Review the customer’s list, use AI to check the catalogue if useful,
      then approve a reply. Aim to respond within about 30 minutes. The
      target is not an automatic send.
    </p>
  </div>;
}

type ControlPayload = {
  status: string; setStatus: Dispatch<SetStateAction<string>>; setPage: Dispatch<SetStateAction<number>>; setData: (value: RequestPage | undefined) => void;
  busy: boolean; reload: () => void; data?: RequestPage; sortDir: '' | 'ascending' | 'descending'; setSortDir: Dispatch<SetStateAction<'' | 'ascending' | 'descending'>>;
};
function Controls({ status, setStatus, setPage, setData, busy, reload, data, sortDir, setSortDir }: ControlPayload) {
  return <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-semibold">
        Status{' '}
        <select
          className={control}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
            setData(undefined);
          }}
        >
          <option value="">All requests</option>
          {['pending', 'draft', 'sending', 'sent', 'delivery_failed'].map(
            (value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            )
          )}
        </select>
      </label>
      <button
        className={control}
        disabled={busy}
        onClick={() => void reload()}
      >
        {busy ? 'Refreshing…' : 'Refresh queue'}
      </button>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gray-900 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none dark:text-gray-100"
        onClick={() => setSortDir((previous) => (previous === '' ? 'ascending' : previous === 'ascending' ? 'descending' : ''))}
      >
        <ArrowDownUp aria-hidden="true" className="size-4" />
        Response target
      </button>
    </div>
    <span className="text-xs text-gray-500">
      {data?.total ?? '—'} requests · refreshes every 30 seconds
    </span>
  </div>;
}

function List({ rows, pane, selectedId, onSelect, empty, sortDir }: { rows: OccasionRequest[]; pane?: boolean; selectedId?: string; onSelect?: (id: string) => void; empty: boolean; sortDir: '' | 'ascending' | 'descending' }) {
  return <div
    role="region"
    aria-label="Occasion requests"
    tabIndex={0}
    aria-sort={sortDir || undefined}
    className="max-h-[70vh] space-y-2 overflow-auto rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
    {rows.map(row => <Row key={row._id} row={row} pane={pane} selectedId={selectedId} onSelect={onSelect} />)}
    {empty && (
      <p className="p-8 text-center text-sm text-gray-500">
        No requests in this view yet. Clear the status filter or wait for
        the next customer request.
      </p>
    )}
  </div>;
}

function Row({ row, pane, selectedId, onSelect }: { row: OccasionRequest; pane?: boolean; selectedId?: string; onSelect?: (id: string) => void }) {  const overdue =
    row.status !== 'sent' &&
    new Date(row.dueAt).getTime() < Date.now();
  const unread = row.customerUnreadCount ?? 0;
  const href = `/occasion-requests/${row._id}`;
  const selected = pane && selectedId === row._id;
  return <Link
    href={href}
    className={`block rounded-xl bg-white p-4 shadow-sm ring-1 ring-inset transition-colors hover:bg-[#fdf8f6] motion-reduce:transition-none dark:bg-gray-900/60 dark:hover:bg-gray-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? 'ring-2 ring-primary' : 'ring-gray-200 dark:ring-gray-700'} ${pane ? '' : 'p-5'}`}
    onClick={event => { if (onSelect && event.shiftKey === false && event.metaKey === false && event.ctrlKey === false) { event.preventDefault(); onSelect(row._id); } }}
  >
    <div className="flex flex-wrap items-start gap-3">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6e3e3] text-sm font-bold uppercase text-[#7c1d1d]">{row.occasion.slice(0, 1)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-950 dark:text-gray-100">{row.name}</span>
          <span className="text-xs text-gray-500">{row.occasion} · {row.city}</span>
        </span>
        <span className="mt-1 block truncate text-xs text-gray-600 dark:text-gray-300">
          <strong className="font-medium text-gray-700 dark:text-gray-200">{row.reference}</strong>
        </span>
        <span className="mt-1 block text-xs leading-5 text-gray-500">
          {row.guests ? `${row.guests} guests` : 'Guest count to confirm'} · {row.channel === 'email' ? 'Email reply' : 'WhatsApp reply'}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[11px] tabular-nums text-gray-500">
          {row.status === 'sent' && row.sentAt
            ? `${new Date(row.sentAt).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' })} WAT`
            : row.firstStaffReplyAt
              ? `${new Date(row.firstStaffReplyAt).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' })} WAT`
              : `${new Date(row.createdAt).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' })}`}
        </span>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700">
          {row.status.replaceAll('_', ' ')}
        </span>
        {unread > 0 && <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="rounded-full bg-[#7c1d1d] px-2 py-0.5 text-xs font-bold text-white">{unread}</span>
          <span className="sr-only">{unread} saved {unread === 1 ? 'reply' : 'replies'} this customer has not read yet</span>
        </span>}
        {row.status !== 'sent' && <span className={`text-[11px] font-medium ${overdue ? 'font-semibold text-red-700 dark:text-red-300' : 'text-gray-500'}`}>
          {overdue ? 'Overdue · ' : ''}{new Date(row.dueAt).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' })} WAT
        </span>}
      </span>
    </div>
  </Link>;
}

function Pagination({ busy, data, page, setPage, setData }: { busy: boolean; data?: RequestPage; page: number; setPage: Dispatch<SetStateAction<number>>; setData: (value: RequestPage | undefined) => void }) {
  return <div className="flex flex-wrap items-center gap-4">
    <button
      className={control}
      disabled={busy || page <= 1}
      onClick={() => {
        setData(undefined);
        setPage((value) => value - 1);
      }}
    >
      Previous
    </button>
    <p className="text-sm tabular-nums">
      Page {page} of {Math.max(1, data?.pages || 1)}
    </p>
    <button
      className={control}
      disabled={busy || !data || page >= data.pages}
      onClick={() => {
        setData(undefined);
        setPage((value) => value + 1);
      }}
    >
      Next
    </button>
  </div>;
}
