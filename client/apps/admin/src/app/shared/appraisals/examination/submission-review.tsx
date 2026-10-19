'use client';
import { useEffect, useRef } from 'react';
export default function SubmissionReview({
  count,
  maxMarks,
  busy,
  onConfirm,
  onBack,
}: {
  count: number;
  maxMarks: number;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, []);
  return (
    <section
      aria-label="Review your submission"
      className="space-y-4 rounded-2xl border border-red-200 bg-red-50/50 p-5"
    >
      <h3
        ref={title}
        tabIndex={-1}
        className="text-base font-semibold text-[#790505] outline-none"
      >
        Review your submission
      </h3>
      <p className="text-sm leading-6 text-gray-700">
        You have answered all {count} questions, worth {maxMarks} marks. Confirm
        when you are ready. Submitted answers cannot be changed.
      </p>
      <p className="text-xs text-gray-500">
        If this exam is timed, your timer continues while you review.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onBack}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-40"
        >
          Keep answering
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="rounded-lg bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#960202] disabled:opacity-40"
        >
          {busy ? 'Saving answers…' : 'Confirm submission'}
        </button>
      </div>
    </section>
  );
}
