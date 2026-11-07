'use client';
import { useCallback, useEffect, useState } from 'react';
import { Hand, RefreshCcw, Undo2, Wine } from 'lucide-react';
import {
  commitPackage,
  listCommitments,
  listPackages,
  redeemComponent,
  releaseCommitment,
  upgradeCommitment,
  type CommitmentDTO,
  type CommitmentState,
  type PackageDTO,
  type UpgradeInput,
} from '@/services/venue/packages';
import { describeVenueFailure } from '@/services/venue/api';
import { buttonClass, Chip, dangerButtonClass, EmptyState, fieldClass, Notice, panelClass } from './controls';

/**
 * Phase-4 E4 package commitments panel (live floor work, like door/waitlist).
 * Commit = the one-transaction reservation: tables + included stock + the
 * admissions entitlement held atomically for one booking. The Serve button
 * hands out component units one at a time (one serve = one tracked redemption
 * row), upgrades extend the same entitlement without re-holding, and release
 * returns unused stock and disables unredeemed admissions. Failures surface
 * through the shared `describeVenueFailure` helper — codes beside the message
 * (COMPONENT_EXHAUSTED, CAPACITY_UNAVAILABLE, STOCK_UNAVAILABLE, STATE_CHANGED
 * → refresh); load errors carry Retry and command errors carry Dismiss. Money
 * is never moved here — the package line is billed through the canonical
 * checkout.
 */
const stateChips: Record<CommitmentState, { tone: 'ready' | 'pending' | 'locked'; label: string }> = {
  committed: { tone: 'ready', label: 'Committed' },
  compensated: { tone: 'pending', label: 'Compensated' },
  released: { tone: 'locked', label: 'Released' },
};

function occurrenceInput(date: string, time: string): string | undefined {
  return date && time ? new Date(`${date}T${time}:00Z`).toISOString() : undefined;
}

type PanelNotice = { kind: 'load' | 'command'; text: string };

export default function PackageCommitments({ token, locationId }: { token: string; locationId: string }) {
  const [packages, setPackages] = useState<PackageDTO[]>([]);
  const [rows, setRows] = useState<CommitmentDTO[] | null>(null);
  const [error, setError] = useState<PanelNotice | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // commit form
  const [packageId, setPackageId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  // per-row upgrade input, keyed by commitment id
  const [added, setAdded] = useState<Record<string, number | null>>({});

  const load = useCallback(async () => {
    setRows(null); setError(null);
    try {
      const [activePackages, commitments] = await Promise.all([listPackages(token, locationId), listCommitments(token, locationId)]);
      setPackages(activePackages.items);
      setRows(commitments.items);
    } catch (failure) { setError({ kind: 'load', text: describeVenueFailure(failure, 'Unable to load package commitments') }); }
  }, [token, locationId]);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, confirmation?: string) => {
    setBusy(true); setError(null); setSuccess(null);
    try { await fn(); await load(); if (confirmation) setSuccess(confirmation); }
    catch (failure) { setError({ kind: 'command', text: describeVenueFailure(failure, 'Package command failed') }); }
    finally { setBusy(false); }
  };

  const commit = () => act(async () => {
    const chosen = packages.find(row => row.id === packageId);
    await commitPackage(token, locationId, {
      input: { packageId, expectedVersion: chosen?.version ?? 0, bookingAt: occurrenceInput(date, time) || null },
    });
    setPackageId(''); setDate(''); setTime('');
  }, 'Package committed — tables, component stock and admissions are held.');

  const serve = (row: CommitmentDTO, componentIndex: number) => act(async () => {
    await redeemComponent(token, locationId, row.id, { input: { componentIndex, quantity: 1 } });
  }, 'One unit served — the hand-out is tracked on the component ledger.');

  const upgrade = (row: CommitmentDTO, input: UpgradeInput) => act(
    () => upgradeCommitment(token, locationId, row.id, { expectedVersion: row.version, input }),
    'Commitment upgraded — the same entitlement was extended.',
  );

  const release = (row: CommitmentDTO) => act(() => releaseCommitment(token, locationId, row.id),
    'Commitment released — unused stock returned and unredeemed admissions disabled.');

  return (
    <section className={panelClass} aria-label="Package commitments">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">Package commitments</h2>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            A commit holds tables, included stock and admissions in one atomic reservation. Serving hands units out one at a time; releasing returns unused stock and disables admissions that were never redeemed.
          </p>
        </div>
        <button type="button" className={buttonClass} onClick={() => void load()} disabled={busy}>
          <RefreshCcw aria-hidden className={`size-4 ${busy ? 'motion-safe:animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {error && (
        <Notice tone="error" role="alert" action={
          <button type="button" className={buttonClass} onClick={() => (error.kind === 'load' ? void load() : setError(null))}>
            {error.kind === 'load' ? 'Retry' : 'Dismiss'}
          </button>
        }>{error.text}</Notice>
      )}
      {success && <Notice tone="success" role="status">{success}</Notice>}
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={event => { event.preventDefault(); if (packageId) void commit(); }}
        aria-label="Commit a package"
      >
        <div className="grid w-full gap-2 sm:w-auto sm:flex-1 sm:grid-cols-[minmax(14rem,2fr)_minmax(8rem,1fr)_minmax(8rem,1fr)] sm:items-end">
          <label className="text-sm">
            Package
            <select className={fieldClass} required value={packageId} onChange={e => setPackageId(e.target.value)}>
              <option value="">Choose package</option>
              {packages.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            Date
            <input className={fieldClass} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label className="text-sm">
            Time (UTC)
            <input className={fieldClass} type="time" value={time} onChange={e => setTime(e.target.value)} />
          </label>
        </div>
        <button type="submit" className={buttonClass} disabled={busy || !packageId}>Commit</button>
        <p className="w-full text-xs text-gray-500 dark:text-gray-400">Without a date/time the commit uses the chosen event occurrence binding; with one it reserves for that instant.</p>
      </form>
      {rows === null && !error && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400" role="status">Loading commitments…</p>}
      {rows?.length === 0 && <EmptyState message="No commitments yet — commit a package above to reserve its tables, component stock and included admissions." />}
      <ul className="mt-3 space-y-2">
        {(rows || []).map(row => (
          <li key={row.id} className="rounded-lg border border-muted p-3 dark:border-gray-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.name}</span>
              <Chip {...stateChips[row.state]} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Wine aria-hidden className="size-3.5" />
              {`${row.includedAdmissions} inclusion${row.includedAdmissions === 1 ? '' : 's'}${row.tableResourceIds.length ? ` · ${row.tableResourceIds.length} table${row.tableResourceIds.length === 1 ? '' : 's'}` : ''}${row.businessDate ? ` · ${row.businessDate}` : ''}`}
            </p>
            <ul className="mt-2 space-y-1">
              {(row.components || []).map((component, componentIndex) => {
                const served = row.stockReservations
                  .filter(entry => entry.subProductId === component.subProductId && entry.sizeId === component.sizeId)
                  .reduce((sum, entry) => sum + entry.consumed, 0);
                return (
                  <li key={componentIndex} className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <span>{`#${componentIndex + 1} × ${component.quantity} (served ${served})`}</span>
                    {row.state === 'committed' && (
                      <button type="button" className={buttonClass} onClick={() => void serve(row, componentIndex)} disabled={busy || served >= component.quantity}>
                        <Hand aria-hidden className="size-3.5" /> Serve 1
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {row.state === 'committed' && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="text-xs">
                  Additional admissions
                  <input
                    className={fieldClass}
                    type="number" min={1} max={100}
                    value={added[row.id] ?? ''}
                    onChange={e => setAdded(previous => ({ ...previous, [row.id]: e.target.value === '' ? null : Number(e.target.value) }))}
                    aria-label={`Admissions to add for ${row.name}`}
                  />
                </label>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy || !added[row.id]}
                  onClick={() => { const extra = added[row.id]; void upgrade(row, extra ? { addedAdmissions: extra } : {}); setAdded(previous => ({ ...previous, [row.id]: null })); }}
                >
                  Upgrade admissions
                </button>
                <button type="button" className={dangerButtonClass} disabled={busy} onClick={() => void release(row)}>
                  <Undo2 aria-hidden className="size-4" /> Release
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
