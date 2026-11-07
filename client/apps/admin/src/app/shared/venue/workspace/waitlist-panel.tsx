'use client';
import { useCallback, useEffect, useState } from 'react';
import { ListOrdered, RefreshCcw } from 'lucide-react';
import {
  acceptWaitlistOffer,
  cancelWaitlistEntry,
  declineWaitlistOffer,
  listWaitlist,
  offerWaitlist,
  type WaitlistEntryDTO,
  type WaitlistState,
} from '@/services/venue/waitlist';
import { venueErrorCode } from '@/services/venue/api';
import { buttonClass, Chip, EmptyState, Notice, panelClass } from './controls';

/**
 * Phase-4 E3 waitlist panel (minimal honest scope). Shows the waitlist queue
 * (state chips, requested windows, party size, contact route), and drives the
 * ONE-CANDIDATE offer flow: offer (a bounded capacity hold with an acceptance
 * deadline — never a confirmed booking), decline/cancel, and the accepted →
 * booking linkage. The server's domain codes (WAITLIST_OFFER_EXPIRED,
 * CAPACITY_UNAVAILABLE, …) render as deny chips. No messaging happens here —
 * the verified contact route is recorded, staff reach the guest their own way.
 */

const stateChips: Record<WaitlistState, { tone: 'ready' | 'pending' | 'danger' | 'info' | 'locked'; label: string }> = {
  waiting: { tone: 'pending', label: 'Waiting' },
  offered: { tone: 'info', label: 'Offered' },
  accepted: { tone: 'ready', label: 'Accepted' },
  declined: { tone: 'locked', label: 'Declined' },
  expired: { tone: 'danger', label: 'Expired' },
  cancelled: { tone: 'locked', label: 'Cancelled' },
};

const clock = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** A sensible default seat time inside the entry's window: the earliest instant that is still bookable. */
function defaultBookingAt(entry: WaitlistEntryDTO) {
  const earliest = Date.parse(entry.window.earliestAt);
  const latest = Date.parse(entry.window.latestAt);
  const target = Math.max(earliest, Date.now() + 30 * 60000);
  return new Date(Math.min(target, latest)).toISOString();
}

export default function WaitlistPanel({ token, locationId }: { token: string; locationId: string }) {
  const [entries, setEntries] = useState<WaitlistEntryDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const page = await listWaitlist(token, locationId);
    setEntries(page.items);
  }, [token, locationId]);

  useEffect(() => {
    let active = true;
    load().catch((e) => active && setError(e instanceof Error ? e.message : 'Unable to load the waitlist'));
    return () => {
      active = false;
    };
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    setOutcome(null);
    try {
      await action();
      await load();
      setMessage(success);
    } catch (e) {
      const code = venueErrorCode(e);
      setOutcome({ ok: false, text: code ? `${code}: ${e instanceof Error ? e.message : 'refused'}` : e instanceof Error ? e.message : 'The waitlist command was refused' });
    } finally {
      setBusy(false);
    }
  }

  const offer = (entry: WaitlistEntryDTO) =>
    run(
      () => offerWaitlist(token, entry.id, { expectedVersion: entry.version, input: { bookingAt: defaultBookingAt(entry) } }),
      `Table offered to ${entry.name} — held until the acceptance deadline.`,
    );
  const accept = (entry: WaitlistEntryDTO) =>
    run(() => acceptWaitlistOffer(token, entry.id), `${entry.name} accepted — the booking is confirmed or held for payment.`);
  const decline = (entry: WaitlistEntryDTO) =>
    run(() => declineWaitlistOffer(token, entry.id, { expectedVersion: entry.version }), `Offer declined — the held table was released.`);
  const cancel = (entry: WaitlistEntryDTO) =>
    run(() => cancelWaitlistEntry(token, locationId, entry.id, { expectedVersion: entry.version }), `${entry.name} removed from the waitlist.`);

  const queue = entries.filter((row) => ['waiting', 'offered'].includes(row.state));
  const settled = entries.filter((row) => !['waiting', 'offered'].includes(row.state));

  return (
    <section aria-label="Waitlist" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">Waitlist</h2>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Track parties waiting for a table. Offering holds ONE table for ONE
            party until the acceptance deadline — an offer is never a confirmed
            booking, and an expired offer confirms and charges nothing.
          </p>
        </div>
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={() => void load().catch((e) => setError(e instanceof Error ? e.message : 'Unable to refresh'))}
        >
          <RefreshCcw aria-hidden="true" className={`size-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      {message && <Notice tone="success" role="status">{message}</Notice>}
      {outcome && <Chip tone={outcome.ok ? 'ready' : 'danger'} label={outcome.text} />}
      {!entries.length && !error && (
        <EmptyState message="No waitlist entries at this location yet. Guests can join from the venue's public page, or add them at the door." />
      )}
      <ul className="space-y-2">
        {queue.map((entry) => (
          <li key={entry.id} className={`${panelClass} flex flex-wrap items-center justify-between gap-3`}>
            <div className="min-w-0">
              <p className="font-medium">
                {entry.name} · party of {entry.partySize}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Window {clock(entry.window.earliestAt)} – {clock(entry.window.latestAt)} · contact: {entry.verifiedContactRoute}
                {entry.acceptableZones.length ? ` · zones: ${entry.acceptableZones.join(', ')}` : ''}
              </p>
              {entry.state === 'offered' && entry.offer && (
                <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Table held — offer expires {clock(entry.offer.expiresAt)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip {...stateChips[entry.state]} />
              {entry.state === 'waiting' && (
                <button type="button" className={buttonClass} disabled={busy} onClick={() => void offer(entry)}>
                  <ListOrdered aria-hidden="true" className="size-4" />
                  Offer table
                </button>
              )}
              {entry.state === 'offered' && (
                <>
                  <button type="button" className={buttonClass} disabled={busy} onClick={() => void accept(entry)}>
                    Accept
                  </button>
                  <button type="button" className={buttonClass} disabled={busy} onClick={() => void decline(entry)}>
                    Decline
                  </button>
                </>
              )}
              <button type="button" className={buttonClass} disabled={busy} onClick={() => void cancel(entry)}>
                Cancel
              </button>
            </div>
          </li>
        ))}
      </ul>
      {settled.length > 0 && (
        <div className={panelClass}>
          <h3 className="font-medium">Resolved</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Accepted entries link to the booking the offer converted into; expired offers released their table and never confirmed or charged.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {settled.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="font-medium">{entry.name}</span>
                  <span className="text-gray-500 dark:text-gray-400"> — party of {entry.partySize}</span>
                  {entry.state === 'accepted' && entry.offer && (
                    <span className="text-gray-500 dark:text-gray-400"> · booking {entry.offer.bookingRef.slice(-6)}</span>
                  )}
                </span>
                <Chip {...stateChips[entry.state]} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
