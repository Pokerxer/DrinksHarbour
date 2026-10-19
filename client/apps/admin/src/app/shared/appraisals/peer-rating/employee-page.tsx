'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3 } from 'lucide-react';
import {
  fetchPeerReview,
  fetchPeerResult,
  type PeerReview,
  type PeerResult,
} from '@/services/peerAppraisal.service';
import ReviewForm from './review-form';
import ResultCard from './result-card';
import EmployeeHeader from './employee-header';
import EmployeeGuide from './employee-guide';
import EmployeeExam from '../examination/employee-exam';
export default function PeerEmployeePage({ id }: { id: string }) {
  return <EmployeeWorkspace key={id} id={id} />;
}
function EmployeeWorkspace({ id }: { id: string }) {
  const [review, setReview] = useState<PeerReview | null>(null),
    [result, setResult] = useState<PeerResult | null>(null);
  const [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0),
    [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    let active = true;
    setError('');
    setRefreshing(true);
    (async () => {
      try {
        const loaded = await fetchPeerReview(id);
        if (!active) return;
        setReview(loaded);
        if (loaded.status === 'closed') {
          const final = await fetchPeerResult(id);
          if (active) setResult(final);
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Could not open appraisal.'
          );
      } finally {
        if (active) setRefreshing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, attempt]);
  const refresh = () => setAttempt((a) => a + 1);
  return (
    <main className="mx-auto max-w-6xl space-y-6 py-6 sm:py-8">
      {!review && (
        <Link href="/appraisals" className="text-sm text-gray-500">
          ← My appraisals
        </Link>
      )}
      {review && <EmployeeHeader review={review} />}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{error}</p>
          <button
            type="button"
            disabled={refreshing}
            className="font-semibold underline disabled:opacity-50"
            onClick={refresh}
          >
            Retry
          </button>
        </div>
      )}
      {!review && !error && (
        <div
          role="status"
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6"
        >
          <p className="text-sm text-gray-500">Loading appraisal…</p>
          <div aria-hidden="true" className="h-5 w-1/2 rounded bg-gray-100" />
          <div aria-hidden="true" className="h-32 rounded-xl bg-gray-50" />
        </div>
      )}
      {review && (
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-6">
            {review.status === 'cancelled' ? (
              <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <h2 className="text-lg font-semibold">Appraisal cancelled</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  This cycle was cancelled. No bonus result has been released.
                </p>
              </section>
            ) : review.status === 'closed' ? (
              result ? (
                <ResultCard result={result} />
              ) : (
                !error && (
                  <p
                    role="status"
                    className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500"
                  >
                    Loading your released result…
                  </p>
                )
              )
            ) : (
              <>
                {review.hasExamination && review.status === 'collecting' && (
                  <EmployeeExam cycleId={id} />
                )}
                {review.isAppraiser === false ? (
                  <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
                    <Clock3
                      aria-hidden="true"
                      className="h-6 w-6 text-[#b20202]"
                    />
                    <h2 className="text-lg font-semibold">
                      Waiting for your results
                    </h2>
                    <p className="text-sm leading-6 text-gray-500">
                      You are not selected to appraise in this cycle. Your score
                      and bonus will appear after the selected appraisers submit
                      and HR closes the cycle.
                    </p>
                    <button
                      type="button"
                      disabled={refreshing}
                      onClick={refresh}
                      className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                    >
                      Check for results
                    </button>
                  </section>
                ) : (
                  <>
                    {review.submittedAt && (
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm">
                        <div className="flex items-start gap-3">
                          <CheckCircle2
                            aria-hidden="true"
                            className="mt-0.5 h-5 w-5 shrink-0 text-green-700"
                          />
                          <p className="max-w-md leading-6 text-green-900">
                            Your ratings are submitted. Your score and bonus
                            will appear after HR closes the cycle.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={refreshing}
                          className="font-medium text-green-900 underline disabled:opacity-50"
                          onClick={refresh}
                        >
                          Check for results
                        </button>
                      </div>
                    )}
                    <ReviewForm
                      key={`${id}-${review.revision}`}
                      cycleId={id}
                      review={review}
                      onSubmitted={refresh}
                    />
                  </>
                )}
              </>
            )}
          </div>
          <EmployeeGuide review={review} />
        </div>
      )}
    </main>
  );
}
