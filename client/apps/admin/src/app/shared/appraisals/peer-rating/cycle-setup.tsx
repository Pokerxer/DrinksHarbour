'use client';
import { useEffect, useRef, useState } from 'react';
import {
  replacePeerRoster,
  fetchPeerParticipants,
  type PeerEmployee,
  type PeerParticipant,
} from '@/services/peerAppraisal.service';
export default function CycleSetup({
  cycleId,
  rosterRevision = 0,
  employees,
  participants,
  onSaved,
  onDirty,
}: {
  cycleId: string;
  rosterRevision?: number;
  employees: PeerEmployee[];
  participants: PeerParticipant[];
  onSaved: () => void;
  onDirty?: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      participants.map((p) => [p.employee, String(p.allocationMinor / 100)])
    )
  );
  const [revision, setRevision] = useState(rosterRevision);
  const dirty = useRef(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [recovered, setRecovered] = useState<PeerParticipant[] | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (dirty.current || lock.current) return;
    setSelected(
      Object.fromEntries(
        participants.map((p) => [p.employee, String(p.allocationMinor / 100)])
      )
    );
    setRevision(rosterRevision);
    setRecovered(null);
  }, [participants, rosterRevision]);
  const eligibleIds = new Set(employees.map((p) => p.employee));
  const options = [
    ...employees,
    ...(recovered ?? participants).filter((p) => !eligibleIds.has(p.employee)),
  ];
  const hasUnavailable = Object.keys(selected).some(
    (id) => !eligibleIds.has(id)
  );
  const valid =
    !hasUnavailable &&
    Object.values(selected).length >= 2 &&
    Object.values(selected).every(
      (v) =>
        /^\d+(\.\d{1,2})?$/.test(v) &&
        Number.isSafeInteger(Math.round(Number(v) * 100))
    );
  function update(next: Record<string, string>) {
    dirty.current = true;
    setSelected(next);
    setMessage('');
    onDirty?.();
  }
  async function save() {
    if (lock.current || !valid) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await replacePeerRoster(
        cycleId,
        Object.entries(selected).map(([employee, value]) => ({
          employee,
          bonusAmount: Number(value),
        })),
        revision
      );
      setRevision(saved.revision);
      dirty.current = false;
      setMessage('Roster saved');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the roster.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function reloadSaved() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await fetchPeerParticipants(cycleId);
      if (saved.status !== 'draft') {
        setConfirmReload(false);
        onSaved();
        return;
      }
      setSelected(
        Object.fromEntries(
          saved.participants.map((p) => [
            p.employee,
            String(p.allocationMinor / 100),
          ])
        )
      );
      setRecovered(saved.participants);
      setRevision(saved.revision ?? 0);
      dirty.current = false;
      setConfirmReload(false);
      setMessage('Saved roster reloaded');
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not reload saved roster.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold">
        Participants and bonus allocations
      </h2>
      <p className="text-sm text-gray-500">
        Everyone selected rates everyone else. Save at least two employees.
        Allocations and participants are fixed after launch.
      </p>
      <label className="block text-sm">
        Find an employee
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>
      <p className="text-sm">{Object.keys(selected).length} selected</p>
      <div className="max-h-96 space-y-3 overflow-auto">
        {options
          .filter((p) =>
            p.displayName.toLowerCase().includes(search.toLowerCase())
          )
          .map((p) => (
            <div
              key={p.employee}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 p-3"
            >
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Include ${p.displayName}`}
                  disabled={
                    busy ||
                    (!eligibleIds.has(p.employee) && !(p.employee in selected))
                  }
                  checked={p.employee in selected}
                  onChange={(e) => {
                    const next = { ...selected };
                    if (e.target.checked) next[p.employee] = '0';
                    else delete next[p.employee];
                    update(next);
                  }}
                />
                {p.displayName}
                {!eligibleIds.has(p.employee) && (
                  <span className="text-xs text-amber-700">
                    Unavailable — remove from roster
                  </span>
                )}
              </label>
              {p.employee in selected && (
                <label className="text-xs text-gray-500">
                  {p.displayName} bonus allocation (₦)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={busy}
                    value={selected[p.employee]}
                    onChange={(e) =>
                      update({ ...selected, [p.employee]: e.target.value })
                    }
                    className="mt-1 block w-40 rounded-lg border p-2 text-sm text-gray-900"
                  />
                </label>
              )}
            </div>
          ))}
      </div>
      {hasUnavailable && (
        <p role="alert" className="text-sm text-amber-700">
          Remove unavailable employees before saving this roster.
        </p>
      )}
      {!valid && (
        <p className="text-sm text-gray-500">
          Select at least two employees and enter nonnegative amounts with at
          most two decimal places.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {error && !confirmReload && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmReload(true)}
          className="text-sm underline"
        >
          Reload saved roster
        </button>
      )}
      {confirmReload && (
        <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm">
          <p>
            Discard your unsaved edits and load the latest saved bonus
            allocations?
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={reloadSaved}
            className="mr-3 underline"
          >
            Discard edits and reload
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmReload(false)}
            className="underline"
          >
            Keep my edits
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-green-700">
          {message}
        </p>
      )}
      <button
        type="button"
        disabled={busy || !valid}
        onClick={save}
        className="rounded-lg bg-[#b20202] px-4 py-2 text-white disabled:opacity-50"
      >
        Save roster
      </button>
    </section>
  );
}
