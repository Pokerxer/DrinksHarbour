'use client';
import { useCallback, useEffect, useState } from 'react';
import { DoorOpen, RefreshCcw } from 'lucide-react';
import {
  listDoorOccurrences,
  listRedemptions,
  redeemReEntry,
  redeemToken,
  type DoorOccurrenceDTO,
  type RedemptionDTO,
} from '@/services/venue/door';
import { listHostAlerts, type HostAlertDTO } from '@/services/venue/guestlists';
import { venueErrorCode } from '@/services/venue/api';
import { buttonClass, Chip, EmptyState, fieldClass, Notice, panelClass } from './controls';

/**
 * Phase-4 E2 door panel (minimal honest scope). Lists ONLY the occurrences the
 * signed-in actor is assigned to (server-enforced doorStaffIds rule), scans
 * tokens against the shared-cap redemption ledger, and shows the VIP arrival
 * alerts (permitted info only — the server never sends spend or notes on this
 * surface). Scan outcomes render as chips: the server's domain code (e.g.
 * TOKEN_ALREADY_USED / ADMISSION_POLICY_REFUSED with its disclosed terms)
 * becomes the deny reason.
 */

const outcomeChip = (outcome: { ok: boolean; text: string }) =>
  outcome.ok
    ? { tone: 'ready' as const, label: outcome.text }
    : { tone: 'danger' as const, label: outcome.text };

export default function DoorPanel({ token, locationId }: { token: string; locationId: string }) {
  const [occurrences, setOccurrences] = useState<DoorOccurrenceDTO[]>([]);
  const [occurrenceId, setOccurrenceId] = useState('');
  const [scanMode, setScanMode] = useState<'entry' | 're-entry'>('entry');
  const [tokenInput, setTokenInput] = useState('');
  const [guests, setGuests] = useState('1');
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const [ledger, setLedger] = useState<RedemptionDTO[]>([]);
  const [alerts, setAlerts] = useState<HostAlertDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (id: string) => {
      if (!id) return;
      const [doorList, ledgerPage, alertPage] = await Promise.all([
        listDoorOccurrences(token, locationId),
        listRedemptions(token, locationId, id),
        listHostAlerts(token, locationId, id),
      ]);
      setOccurrences(doorList.items);
      setLedger(ledgerPage.items);
      setAlerts(alertPage.items);
    },
    [token, locationId],
  );

  useEffect(() => {
    let active = true;
    listDoorOccurrences(token, locationId)
      .then((rows) => {
        if (!active) return;
        setOccurrences(rows.items);
        setOccurrenceId((current) => (rows.items.some((row) => row.id === current) ? current : rows.items[0]?.id || ''));
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Unable to load door occurrences'));
    return () => {
      active = false;
    };
  }, [token, locationId]);

  useEffect(() => {
    if (!occurrenceId) return;
    load(occurrenceId).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load door data'));
  }, [occurrenceId, load]);

  const occurrence = occurrences.find((row) => row.id === occurrenceId) || null;
  const remaining = occurrence?.capacity ? Math.max(0, occurrence.capacity.maxGuests - occurrence.guestsAdmitted) : null;

  async function scan() {
    if (!occurrenceId || busy || !tokenInput.trim()) return;
    setBusy(true);
    setError('');
    setOutcome(null);
    try {
      const count = Number(guests);
      const body = { token: tokenInput.trim(), guests: Number.isInteger(count) && count > 0 ? count : 1 };
      const result = scanMode === 'entry'
        ? await redeemToken(token, locationId, occurrenceId, { ...body, ageVerified: true })
        : await redeemReEntry(token, locationId, occurrenceId, body);
      setOutcome({ ok: true, text: `${result.result === 're_entered' ? 'Re-entered' : 'Admitted'} — ${result.name} (${result.partySize})` });
      setTokenInput('');
      await load(occurrenceId);
    } catch (e) {
      const code = venueErrorCode(e);
      setOutcome({ ok: false, text: code ? `${code}: ${e instanceof Error ? e.message : 'denied'}` : e instanceof Error ? e.message : 'Scan denied' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Door" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">Door</h2>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Scan guest-list tokens at the door. Scans see only this account&apos;s
            assigned occurrences and carry minimum guest details; re-entry is
            policy-capped per token.
          </p>
        </div>
        <label className="block text-sm font-medium">
          Occurrence
          <select
            className={fieldClass}
            value={occurrenceId}
            disabled={busy || !occurrences.length}
            onChange={(e) => {
              setOccurrenceId(e.target.value);
              setOutcome(null);
            }}
          >
            {occurrences.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} — {row.occurrenceDate}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      {!occurrences.length && !error && (
        <EmptyState message="No event occurrences are assigned to you for door work. Ask a manager to assign you under the occurrence's door staff." />
      )}
      {occurrence && (
        <>
          <div className={panelClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">
                  {occurrence.name} · {occurrence.occurrenceDate}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Admitted {occurrence.guestsAdmitted}
                  {occurrence.capacity ? ` of ${occurrence.capacity.maxGuests}` : ''} · re-entry limit {occurrence.admissionPolicy.maxReEntries} per token
                </p>
              </div>
              <Chip tone={remaining === 0 ? 'danger' : 'ready'} label={remaining == null ? 'Capacity n/a' : `${remaining} slots left`} />
            </div>
            {occurrence.agePolicy && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {occurrence.agePolicy.minimumAge ? `${occurrence.agePolicy.minimumAge}+ — ` : ''}
                {occurrence.agePolicy.admissionTerms}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="block text-sm font-medium">
                Mode
                <select aria-label="Scan mode" className={fieldClass} value={scanMode} disabled={busy} onChange={(e) => setScanMode(e.target.value === 're-entry' ? 're-entry' : 'entry')}>
                  <option value="entry">Entry</option>
                  <option value="re-entry">Re-entry</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Guests
                <input aria-label="Guests" type="number" min={1} className={`${fieldClass} sm:w-24`} value={guests} disabled={busy} onChange={(e) => setGuests(e.target.value)} />
              </label>
              <label className="block flex-1 text-sm font-medium">
                Token
                <input aria-label="Admission token" className={fieldClass} value={tokenInput} placeholder="gl-…" maxLength={64} disabled={busy} onChange={(e) => setTokenInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void scan()} />
              </label>
              <button type="button" className={buttonClass} disabled={busy || !tokenInput.trim()} onClick={() => void scan()}>
                <DoorOpen aria-hidden="true" className="size-4" />
                Scan
              </button>
              <button type="button" className={buttonClass} disabled={busy} onClick={() => void load(occurrenceId).catch((e) => setError(e instanceof Error ? e.message : 'Unable to refresh'))}>
                <RefreshCcw aria-hidden="true" className={`size-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {outcome && (
              <div className="mt-3">
                <Chip {...outcomeChip(outcome)} />
              </div>
            )}
          </div>
          {alerts.length > 0 && (
            <div className={panelClass}>
              <h3 className="font-medium">VIP arrivals</h3>
              <ul className="mt-2 space-y-2">
                {alerts.map((alert) => (
                  <li key={alert.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{alert.name}</span>
                      <span className="text-gray-500 dark:text-gray-400"> — party of {alert.partySize} · flagged: {alert.provenance?.reason}</span>
                    </span>
                    <Chip tone={alert.acknowledged ? 'locked' : 'pending'} label={alert.acknowledged ? 'Acknowledged' : 'Awaiting host'} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={panelClass}>
            <h3 className="font-medium">Redemption ledger</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Newest first. Entry rows consume the shared cap; re-entry rows never do.</p>
            <ul className="mt-2 space-y-1 text-sm">
              {ledger.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-mono text-xs">{row.token}</span>
                  <Chip tone={row.kind === 'entry' ? 'ready' : 'info'} label={`${row.kind === 'entry' ? 'Entry' : 'Re-entry'} · ${row.guests} guest${row.guests === 1 ? '' : 's'}`} />
                </li>
              ))}
              {!ledger.length && <li className="text-gray-500 dark:text-gray-400">No redemptions yet.</li>}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
