'use client';
import { useRef, useState } from 'react';
import {
  savePeerRatings,
  submitPeerRatings,
  type PeerReview,
} from '@/services/peerAppraisal.service';
import RatingRow from './rating-row';
export default function ReviewForm({
  cycleId,
  review,
  onSubmitted,
}: {
  cycleId: string;
  review: PeerReview;
  onSubmitted: () => void;
}) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(review.ratings.map((r) => [r.subject, r.rating]))
  );
  const [revision, setRevision] = useState(review.revision);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState(Boolean(review.submittedAt));
  const readOnly = submitted || review.status !== 'collecting';
  const count = review.colleagues.filter(
    (c) => values[c.employee] !== undefined
  ).length;
  async function persist(submit: boolean) {
    if (lock.current || readOnly) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    const ratings = review.colleagues
      .filter((c) => values[c.employee] !== undefined)
      .map((c) => ({ subject: c.employee, rating: values[c.employee] }));
    try {
      const result = await (submit ? submitPeerRatings : savePeerRatings)(
        cycleId,
        ratings,
        revision
      );
      setRevision(result.revision);
      if (submit) {
        setSubmitted(true);
        onSubmitted();
      } else setMessage('Draft saved');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not save your ratings. Try again.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Rate your colleagues</h2>
        <p className="mt-1 text-sm text-gray-500">
          One overall rating per person. 1 is lowest; 5 is highest. You cannot
          change ratings after submitting.
        </p>
      </div>
      <p className="text-sm font-medium" aria-live="polite">
        {count} of {review.colleagues.length} colleagues rated
      </p>
      {readOnly && (
        <p className="rounded-lg bg-gray-50 p-3 text-sm">
          {submitted
            ? 'Your ratings have been submitted.'
            : 'This cycle is no longer collecting ratings.'}
        </p>
      )}
      <label className="block text-sm">
        Find a colleague
        <input
          className="mt-1 w-full rounded-lg border border-gray-200 p-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {review.colleagues
          .filter((c) =>
            c.displayName.toLowerCase().includes(search.toLowerCase())
          )
          .map((c) => (
            <RatingRow
              key={c.employee}
              colleague={c}
              value={values[c.employee]}
              disabled={readOnly || busy}
              onChange={(n) => {
                setValues((v) => ({ ...v, [c.employee]: n }));
                setMessage('');
              }}
            />
          ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error} Your entries remain on this screen. If the form changed
          elsewhere, reload before saving again.
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-green-700">
          {message}
        </p>
      )}
      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 disabled:opacity-50"
            disabled={busy}
            onClick={() => persist(false)}
          >
            Save draft
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#b20202] px-4 py-2 text-white disabled:opacity-50"
            disabled={busy || count !== review.colleagues.length}
            onClick={() => persist(true)}
          >
            Submit ratings
          </button>
        </div>
      )}
    </section>
  );
}
