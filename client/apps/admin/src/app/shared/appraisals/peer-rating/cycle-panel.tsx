'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppraisalCycle } from '@/services/appraisal.service';
import {
  fetchPeerEmployees,
  fetchPeerParticipants,
  peerCycleAction,
  type PeerEmployee,
  type PeerProgress,
} from '@/services/peerAppraisal.service';
import { CycleHeader, CycleWorkspace } from '../cycle-workspace/workspace';
import PeerSummary from '../cycle-workspace/peer-summary';
import PeerActions from '../cycle-workspace/peer-actions';
import CycleSetup from './cycle-setup';
import ParticipantTable from './participant-table';
export default function PeerCyclePanel({
  cycle: initial,
}: {
  cycle: AppraisalCycle;
}) {
  const [cycle, setCycle] = useState(initial);
  const [progress, setProgress] = useState<PeerProgress | null>(null);
  const [employees, setEmployees] = useState<PeerEmployee[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<'launch' | 'close' | 'cancel' | null>(
    null
  );
  const lock = useRef(false);
  const currentStatus = useRef(initial.status);
  const loadGeneration = useRef(0);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setError('');
    try {
      const p = await fetchPeerParticipants(initial._id);
      const e = p.status === 'draft' ? await fetchPeerEmployees() : [];
      if (generation !== loadGeneration.current) return;
      setProgress(p);
      setEmployees(e);
      if (currentStatus.current !== p.status) {
        setConfirm(null);
        setDirty(false);
      }
      currentStatus.current = p.status;
      setCycle((current) => ({ ...current, status: p.status }));
    } catch (e) {
      if (generation === loadGeneration.current) {
        setError(e instanceof Error ? e.message : 'Could not load cycle.');
      }
    }
  }, [initial._id]);
  useEffect(() => {
    void load();
    return () => {
      loadGeneration.current += 1;
    };
  }, [load]);
  async function action(kind: 'launch' | 'close' | 'cancel') {
    if (lock.current || (kind === 'launch' && dirty)) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const c = await peerCycleAction(cycle._id, kind);
      currentStatus.current = c.status;
      setCycle(c);
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update cycle.');
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <CycleWorkspace
      header={
        <CycleHeader
          cycle={cycle}
          modeLabel="Colleague bonus appraisal"
          description="A shared view of colleague ratings, completion and bonus allocations."
          actions={
            <button
              onClick={load}
              disabled={busy}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Refresh progress
            </button>
          }
        />
      }
      metrics={<PeerSummary progress={progress} status={cycle.status} />}
      sidebar={
        <PeerActions
          cycle={cycle}
          progress={progress}
          busy={busy}
          dirty={dirty}
          confirm={confirm}
          onConfirm={setConfirm}
          onAction={action}
        />
      }
    >
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          <button onClick={load} className="ml-3 underline">
            Retry
          </button>
        </div>
      )}
      {!progress && !error && (
        <p role="status" className="p-5 text-sm text-gray-500">
          Loading cycle…
        </p>
      )}
      {progress && (
        <>
          {cycle.status === 'draft' && (
            <CycleSetup
              cycleId={cycle._id}
              rosterRevision={progress.revision ?? 0}
              employees={employees}
              participants={progress.participants}
              onDirty={() => setDirty(true)}
              onSaved={() => {
                setDirty(false);
                void load();
              }}
            />
          )}
          {progress.participants.some(
            (p) => p.unavailable && !p.submittedAt
          ) && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              {cycle.status === 'draft'
                ? 'An employee is unavailable. Remove them from the draft roster and save before launching.'
                : 'An employee is unavailable. The launched roster stays fixed. If they cannot finish, cancel this cycle and create a new one.'}
            </p>
          )}
          {progress.total > 0 && (
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {cycle.status === 'closed'
                      ? 'Scores and bonus results'
                      : 'Participant roster'}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {cycle.status === 'closed'
                      ? 'Final results for everyone included in this cycle.'
                      : `${progress.submitted} of ${progress.total} participants submitted`}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {progress.total} employees
                </span>
              </div>
              <ParticipantTable
                participants={progress.participants}
                closed={cycle.status === 'closed'}
              />
            </section>
          )}
        </>
      )}
    </CycleWorkspace>
  );
}
