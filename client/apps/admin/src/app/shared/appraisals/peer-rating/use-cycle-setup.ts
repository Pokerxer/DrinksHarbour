'use client';
import { useEffect, useRef, useState } from 'react';
import {
  replacePeerRoster,
  fetchPeerParticipants,
  type PeerEmployee,
  type PeerParticipant,
} from '@/services/peerAppraisal.service';
export interface RosterChoice {
  amount: string;
  isAppraiser: boolean;
}
export default function useCycleSetup({
  cycleId,
  rosterRevision = 0,
  employees,
  participants,
  onSaved,
  onDirty,
  onSelectionChange,
}: {
  cycleId: string;
  rosterRevision?: number;
  employees: PeerEmployee[];
  participants: PeerParticipant[];
  onSaved: (revision?: number) => void;
  onDirty?: () => void;
  onSelectionChange?: (employees: string[]) => void;
}) {
  const [selected, setSelected] = useState<Record<string, RosterChoice>>(() =>
    Object.fromEntries(
      participants.map((p) => [
        p.employee,
        {
          amount: String(p.allocationMinor / 100),
          isAppraiser: p.isAppraiser !== false,
        },
      ])
    )
  );
  const [revision, setRevision] = useState(rosterRevision);
  const dirty = useRef(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [recovered, setRecovered] = useState<PeerParticipant[] | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (dirty.current || lock.current) return;
    setSelected(
      Object.fromEntries(
        participants.map((p) => [
          p.employee,
          {
            amount: String(p.allocationMinor / 100),
            isAppraiser: p.isAppraiser !== false,
          },
        ])
      )
    );
    setRevision(rosterRevision);
    setRecovered(null);
  }, [participants, rosterRevision]);
  useEffect(() => {
    onSelectionChange?.(Object.keys(selected));
  }, [selected, onSelectionChange]);
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
    Object.values(selected).filter((v) => v.isAppraiser).length >= 2 &&
    Object.values(selected).every(
      ({ amount: v }) =>
        /^\d+(\.\d{1,2})?$/.test(v) &&
        Number.isSafeInteger(Math.round(Number(v) * 100))
    );
  function update(next: Record<string, RosterChoice>) {
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
          bonusAmount: Number(value.amount),
          isAppraiser: value.isAppraiser,
        })),
        revision
      );
      setRevision(saved.revision);
      dirty.current = false;
      setMessage('Roster saved');
      onSaved(saved.revision);
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
            {
              amount: String(p.allocationMinor / 100),
              isAppraiser: p.isAppraiser !== false,
            },
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
  return {
    selected,
    update,
    options,
    eligibleIds,
    hasUnavailable,
    valid,
    busy,
    message,
    error,
    confirmReload,
    setConfirmReload,
    save,
    reloadSaved,
  };
}
