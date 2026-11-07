'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BookingDeposit from './booking-deposit';
import { useAuth } from '@/context/AuthContext';
import { privateVenue, venueKey } from '@/lib/venue/client';
import type { Reservation } from '@/lib/venue/types';
export default function OwnedRequests({ reference }: { reference?: string }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [rows, setRows] = useState<Reservation[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);
  const [owner, setOwner] = useState('');
  const load = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    const current = ++generation.current;
    setRows([]);
    setNext(null);
    setLoadingMore(false);
    setOwner(user._id);
    setLoading(true);
    setError('');
    try {
      if (reference) {
        const row = await privateVenue<Reservation>(
          `/me/requests/${encodeURIComponent(reference)}`,
        );
        if (current === generation.current) setRows([row]);
      } else {
        const result = await privateVenue<{
          items: Reservation[];
          next: string | null;
        }>('/me/requests');
        if (current === generation.current) {
          setRows(result.items);
          setNext(result.next);
        }
      }
    } catch (e) {
      if (current === generation.current)
        setError(
          e instanceof Error ? e.message : 'Unable to load reservations',
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [reference, isAuthenticated, user?._id]);
  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);
  const more = async () => {
    if (!next || loadingMore || !isAuthenticated) return;
    const current = generation.current;
    setLoadingMore(true);
    setError('');
    try {
      const page = await privateVenue<{
        items: Reservation[];
        next: string | null;
      }>(`/me/requests?after=${encodeURIComponent(next)}`);
      if (current === generation.current) {
        setRows((previous) => [...previous, ...page.items]);
        setNext(page.next);
      }
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : 'Unable to load more');
    } finally {
      if (current === generation.current) setLoadingMore(false);
    }
  };
  if (isLoading) return <p role="status" className="rounded-2xl bg-stone-50 p-6 text-stone-600">Loading your account…</p>;
  if (!isAuthenticated) {
    const returnPath = `/my-account/reservations${reference ? `/${encodeURIComponent(reference)}` : ''}`;
    return <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6"><h1 className="text-2xl font-bold">My reservations</h1><p className="text-stone-600">Sign in to see your venue requests and booking updates.</p><Link className="inline-flex min-h-11 items-center rounded-xl bg-red-800 px-5 py-3 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2" href={`/login?redirect=${encodeURIComponent(returnPath)}`}>Sign in to view reservations</Link></section>;
  }
  return (
    <section className="space-y-5 text-stone-900">
      <h1 className="font-[var(--font-kavoon)] text-3xl font-normal">
        {reference ? 'Reservation request' : 'My reservations'}
      </h1>
      <p className="max-w-2xl leading-7 text-stone-600">Requests and venue visits are separate from your shopping orders.</p>
      {loading && <p role="status" className="rounded-2xl border border-stone-200 bg-stone-50 p-6">Loading your reservations…</p>}
      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
          <p>{error}</p>
          <button className="mt-2 min-h-11 rounded-lg px-3 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2" onClick={() => void load()}>
            Retry reservations
          </button>
        </div>
      )}
      {!loading && !error && !rows.length && (
        <div role="status" className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center text-stone-600">
          <p>
            You have no venue requests yet.{' '}
            <Link href="/venues" className={`inline-flex min-h-11 items-center underline underline-offset-4 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2`}>
              Find a venue
            </Link>
          </p>
        </div>
      )}
      {(owner === user?._id ? rows : []).map((row) => (
        <article
          key={row.id}
          className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 className="text-xl font-semibold">
            {row.policy.venueName} · {row.policy.locationName}
          </h2>
          <p className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${row.status === 'confirmed' ? 'border-green-200 bg-green-50 text-green-950' : row.status === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-900' : row.status === 'cancelled' || row.status === 'declined' ? 'border-red-200 bg-red-50 text-red-800' : 'border-stone-200 bg-stone-100 text-stone-800'}`}>{row.statusLabel}</p>
          <p className="leading-7 text-stone-600">
            {new Intl.DateTimeFormat('en-NG', {
              timeZone: row.policy.timezone,
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(row.bookingAt))}{' '}
            · {row.policy.timezone} · {row.partySize} guests
          </p>
          <p className="break-all">
            Reference:{' '}
            <Link
              href={`/my-account/reservations/${encodeURIComponent(row.reference)}`}
              className="underline"
            >
              {row.reference}
            </Link>
          </p>
          {reference && (
            <>
              <h3 className="font-semibold">
                Policies accepted with this request
              </h3>
              <p className="whitespace-pre-wrap">{row.policy.policies}</p>
              {row.payment&&user&&<BookingDeposit key={`${user._id}:${row.reference}:${row.version}`} row={row} identity={user._id} email={user.email||''} onRefresh={()=>void load()}/>}
              {['pending','confirmed'].includes(row.status) && (
                <button
                  disabled={busy}
                  className="min-h-11 rounded-xl border border-red-200 px-4 py-3 font-semibold text-red-800 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-800 disabled:cursor-wait disabled:opacity-60"
                  onClick={async () => {
                    if (busy || !user) return;
                    const current = generation.current;
                    setBusy(true);
                    setError('');
                    try {
                      const body = { expectedVersion: row.version };
                      const result = await privateVenue<Reservation>(
                        `/me/requests/${row.reference}/cancel`,
                        'POST',
                        body,
                        await venueKey(`${user._id}:${row.reference}`, body),
                      );
                      if (current === generation.current) setRows([result]);
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : 'Unable to cancel request',
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Cancelling request…' : 'Cancel request'}
                </button>
              )}
            </>
          )}
        </article>
      ))}
      {next && !reference && (
        <button disabled={loadingMore} onClick={() => void more()} className="min-h-11 rounded-xl border border-stone-300 px-5 py-3 font-semibold hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
          {loadingMore ? 'Loading more reservations…' : 'More reservations'}
        </button>
      )}
      <Link href="/contact" className="inline-block underline">
        Contact platform support
      </Link>
    </section>
  );
}
