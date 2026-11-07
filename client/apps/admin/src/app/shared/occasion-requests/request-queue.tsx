'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowDownUp } from 'lucide-react';
import {
  occasionRequestService,
  type RequestPage,
} from '@/services/occasionRequest.service';
import { buttonClass } from '../market-foundation/workspace';
const control = buttonClass;
export default function RequestQueue() {
  const { data: session, status: sessionStatus } = useSession();
  const user = session?.user as { token?: string; role?: string } | undefined,
    token = user?.token;
  if (sessionStatus === 'loading')
    return <p role="status">Loading your session…</p>;
  if (!token || !['admin', 'super_admin'].includes(user?.role || ''))
    return <p role="alert">Platform administrator access is required.</p>;
  return <Queue key={`${user?.role}:${token}`} token={token} />;
}
function Queue({ token }: { token: string }) {
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
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Customer planning
        </p>
        <h1 className="mt-2 text-3xl font-bold">Occasion requests</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
          Review the customer’s list, use AI to check the catalogue if useful,
          then approve a reply. Aim to respond within about 30 minutes. The
          target is not an automatic send.
        </p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
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
            onClick={() => void load()}
          >
            {busy ? 'Refreshing…' : 'Refresh queue'}
          </button>
        </div>
        <span className="text-xs text-gray-500">
          {data?.total ?? '—'} requests · refreshes every 30 seconds
        </span>
      </div>
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
        <div
          role="region"
          aria-label="Occasion requests table"
          tabIndex={0}
          className="max-h-[70vh] overflow-auto rounded-xl border border-muted bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgb(0_0_0/0.06)] dark:bg-gray-900">
              <tr>
                {[
                  'Request',
                  'Customer & occasion',
                  'Event',
                  'Reply',
                  'Response target',
                  'Status',
                ].map((value) => (
                  <th
                    scope="col"
                    className="px-4 py-3 font-semibold"
                    aria-sort={
                      value === 'Response target' && sortDir
                        ? sortDir
                        : undefined
                    }
                    key={value}
                  >
                    {value === 'Response target' ? (
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-1 font-semibold text-gray-900 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none dark:text-gray-100"
                        onClick={() =>
                          setSortDir((previous) =>
                            previous === ''
                              ? 'ascending'
                              : previous === 'ascending'
                                ? 'descending'
                                : ''
                          )
                        }
                      >
                        <ArrowDownUp
                          aria-hidden="true"
                          className="size-4"
                        />
                        Response target
                      </button>
                    ) : (
                      value
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const overdue =
                  row.status !== 'sent' &&
                  new Date(row.dueAt).getTime() < Date.now();
                return (
                  <tr
                    key={row._id}
                    className="border-t border-gray-100 hover:bg-gray-50/60 transition-colors motion-reduce:transition-none dark:border-gray-800 dark:hover:bg-gray-800/40"
                  >
                    <td className="px-4 py-4">
                      <Link
                        className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        href={`/occasion-requests/${row._id}`}
                      >
                        {row.reference}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(row.createdAt).toLocaleString('en-NG', {
                          timeZone: 'Africa/Lagos',
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      {row.name}
                      <p className="text-xs text-gray-500">{row.occasion}</p>
                    </td>
                    <td className="px-4 py-4">
                      {row.city}
                      <p className="text-xs text-gray-500">
                        {row.guests
                          ? `${row.guests} guests`
                          : 'Guest count to confirm'}
                      </p>
                    </td>
                    <td className="px-4 py-4">{row.channel}</td>
                    <td
                      className={`px-4 py-4 tabular-nums ${overdue ? 'font-semibold text-red-700 dark:text-red-300' : ''}`}
                    >
                      {row.status === 'sent'
                        ? 'Replied'
                        : `${overdue ? 'Overdue · ' : ''}${new Date(row.dueAt).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' })} WAT`}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700">
                        {row.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data?.requests.length === 0 && (
            <p className="p-8 text-center text-sm text-gray-500">
              No requests in this view yet. Clear the status filter or wait for
              the next customer request.
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
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
      </div>
    </div>
  );
}
