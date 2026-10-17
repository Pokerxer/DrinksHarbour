'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchPeerReview,
  fetchPeerResult,
  type PeerReview,
  type PeerResult,
} from '@/services/peerAppraisal.service';
import ReviewForm from './review-form';
import ResultCard from './result-card';
export default function PeerEmployeePage({ id }: { id: string }) {
  const [review, setReview] = useState<PeerReview | null>(null);
  const [result, setResult] = useState<PeerResult | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    setReview(null);
    setResult(null);
    (async () => {
      try {
        const r = await fetchPeerReview(id);
        const final = r.status === 'closed' ? await fetchPeerResult(id) : null;
        if (active) {
          setReview(r);
          setResult(final);
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Could not open appraisal.'
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [id, attempt]);
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <Link href="/appraisals" className="text-sm text-gray-500">
        ← My appraisals
      </Link>
      {error ? (
        <p role="alert">
          {error}
          <button
            className="ml-3 underline"
            onClick={() => setAttempt((a) => a + 1)}
          >
            Retry
          </button>
        </p>
      ) : !review ? (
        <p role="status">Loading appraisal…</p>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">{review.name}</h1>
          {result ? (
            <ResultCard result={result} />
          ) : review.status === 'cancelled' ? (
            <p>This cycle was cancelled. No bonus result has been released.</p>
          ) : (
            <>
              {review.submittedAt && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 text-sm">
                  <p>
                    Your ratings are submitted. Your score and bonus will appear
                    after HR closes the cycle.
                  </p>
                  <button
                    className="underline"
                    onClick={() => setAttempt((a) => a + 1)}
                  >
                    Check for results
                  </button>
                </div>
              )}
              <ReviewForm
                key={`${id}-${review.revision}`}
                cycleId={id}
                review={review}
                onSubmitted={() => setAttempt((a) => a + 1)}
              />
            </>
          )}
        </>
      )}
    </main>
  );
}
