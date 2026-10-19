'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, CheckCircle2 } from 'lucide-react';
import type { PeerReview } from '@/services/peerAppraisal.service';
import RatingRow from './rating-row';
import RatingConfirmation from './rating-confirmation';
import usePeerReview from './use-peer-review';
export default function ReviewForm({
  cycleId,
  review,
  onSubmitted,
}: {
  cycleId: string;
  review: PeerReview;
  onSubmitted: () => void;
}) {
  const s = usePeerReview(cycleId, review, onSubmitted);
  const [search, setSearch] = useState(''),
    [unrated, setUnrated] = useState(false),
    [confirm, setConfirm] = useState(false);
  const submitButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!confirm && restoreFocus.current) {
      submitButton.current?.focus();
      restoreFocus.current = false;
    }
  }, [confirm]);
  const visible = review.colleagues.filter(
    (c) =>
      (!unrated || s.values[c.employee] === undefined) &&
      c.displayName.toLowerCase().includes(search.trim().toLowerCase())
  );
  return (
    <section
      aria-label="Colleague ratings"
      className="min-w-0 space-y-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#b20202]">
            Colleague appraisal
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            Rate your colleagues
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${s.readOnly ? 'bg-green-50 text-green-800' : s.dirty ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'}`}
        >
          {s.readOnly
            ? 'Read only'
            : s.busy
              ? 'Saving…'
              : s.dirty
                ? 'Unsaved ratings'
                : s.count
                  ? 'Saved ratings'
                  : 'Ready to rate'}
        </span>
      </div>
      <p className="text-sm leading-6 text-gray-500">
        One overall rating per person. 1 is lowest; 5 is highest. You cannot
        change ratings after submitting.
      </p>
      <div className="rounded-xl bg-gray-50 p-4">
        <p className="text-sm font-medium" aria-live="polite">
          {s.count} of {review.colleagues.length} colleagues rated
        </p>
        <div
          role="progressbar"
          aria-label="Colleague rating progress"
          aria-valuemin={0}
          aria-valuemax={review.colleagues.length || 1}
          aria-valuenow={s.count}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200"
        >
          <div
            className="h-full rounded-full bg-[#b20202]"
            style={{
              width: `${review.colleagues.length ? (s.count / review.colleagues.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
      {s.readOnly && (
        <p className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-900">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          {s.submitted || review.submittedAt
            ? 'Your ratings have been submitted.'
            : 'This cycle is no longer collecting ratings.'}
        </p>
      )}
      {confirm && !s.readOnly ? (
        <RatingConfirmation
          colleagues={review.colleagues}
          values={s.values}
          busy={s.busy}
          onBack={() => {
            restoreFocus.current = true;
            setConfirm(false);
          }}
          onConfirm={() => s.persist(true)}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-0 flex-1 basis-full text-xs font-medium text-gray-600 sm:basis-0">
              Find a colleague
              <div className="relative mt-2">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400"
                />
                <input
                  type="search"
                  aria-label="Find a colleague"
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:border-[#b20202] focus:ring-[#b20202]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </label>
            <div
              aria-label="Filter colleagues"
              className="flex rounded-xl bg-gray-100 p-1"
            >
              {[
                { label: 'All colleagues', value: false },
                {
                  label: `Unrated (${review.colleagues.length - s.count})`,
                  value: true,
                },
              ].map((f) => (
                <button
                  type="button"
                  key={f.label}
                  aria-pressed={unrated === f.value}
                  onClick={() => setUnrated(f.value)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202] ${unrated === f.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {visible.map((c) => (
              <RatingRow
                key={c.employee}
                colleague={c}
                value={s.values[c.employee]}
                disabled={s.readOnly || s.busy}
                onChange={(n) => s.choose(c.employee, n)}
              />
            ))}
          </div>
          {!visible.length && (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
              <p>
                {search.trim()
                  ? 'No colleagues match your search.'
                  : unrated && s.complete
                    ? 'Everyone has a rating. Review your choices before submitting.'
                    : 'No colleagues are assigned to you.'}
              </p>
              {search.trim() && (
                <button
                  type="button"
                  className="mt-3 font-medium text-[#b20202] underline"
                  onClick={() => setSearch('')}
                >
                  Clear search
                </button>
              )}
            </div>
          )}
          {!s.readOnly && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
              <p className="text-xs text-gray-500">
                {s.complete
                  ? 'All colleagues rated. Ready for your final review.'
                  : `${review.colleagues.length - s.count} colleagues still need a rating.`}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={s.busy}
                  onClick={() => s.persist(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  ref={submitButton}
                  type="button"
                  disabled={s.busy || !s.complete}
                  onClick={() => setConfirm(true)}
                  className="rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b20202] disabled:opacity-40"
                >
                  Submit ratings
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {s.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700"
        >
          {s.error} Your entries remain on this screen. If the form changed
          elsewhere, reload before saving again.
        </p>
      )}
      {s.message && (
        <p role="status" className="text-sm text-green-700">
          {s.message}
        </p>
      )}
    </section>
  );
}
