'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchMyPeerCycles,
  type PeerMyCycle,
} from '@/services/peerAppraisal.service';
export default function MyPeerCycles() {
  const [cycles, setCycles] = useState<PeerMyCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchMyPeerCycles()
      .then((rows) => {
        if (active) setCycles(rows);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : 'Could not load colleague appraisals.'
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <section className="space-y-3" aria-label="Colleague bonus appraisals">
      <h2 className="text-lg font-semibold">Colleague bonus appraisals</h2>
      {loading && (
        <p role="status" className="text-sm text-gray-500">
          Loading colleague appraisals…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
          <button
            className="ml-3 underline"
            onClick={() => setAttempt((a) => a + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {!loading && !error && cycles.length === 0 && (
        <p className="text-sm text-gray-500">
          Your colleague bonus cycles will appear here when HR launches them.
        </p>
      )}
      {cycles.map((c) => (
        <Link
          key={c._id}
          href={`/appraisals/peer/${c._id}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
        >
          <span className="font-medium">{c.name}</span>
          <span className="text-sm text-gray-500">
            {c.status === 'closed'
              ? 'View score and bonus →'
              : c.status === 'cancelled'
                ? 'Cancelled'
                : c.submittedAt
                  ? 'Submitted · awaiting results'
                  : 'Rate colleagues →'}
          </span>
        </Link>
      ))}
    </section>
  );
}
