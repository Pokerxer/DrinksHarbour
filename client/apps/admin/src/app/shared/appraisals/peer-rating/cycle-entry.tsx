'use client';
import { useEffect, useState } from 'react';
import { fetchCycle, type AppraisalCycle } from '@/services/appraisal.service';
import CycleDetail from '../cycle-detail';
import PeerCyclePanel from './cycle-panel';
export default function CycleEntry({ id }: { id: string }) {
  const [cycle, setCycle] = useState<AppraisalCycle | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setCycle(null);
    setError('');
    fetchCycle(id)
      .then((c) => {
        if (active) setCycle(c);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Could not load cycle.');
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  if (error)
    return (
      <div role="alert" className="p-6">
        {error}
        <button
          className="ml-3 underline"
          onClick={() => setAttempt((a) => a + 1)}
        >
          Retry
        </button>
      </div>
    );
  if (!cycle)
    return (
      <p role="status" className="p-6">
        Loading cycle…
      </p>
    );
  return cycle.mode === 'peer_rating' ? (
    <PeerCyclePanel key={id} cycle={cycle} />
  ) : (
    <CycleDetail id={id} />
  );
}
