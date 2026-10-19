import {
  CheckCircle2,
  ClipboardList,
  FileQuestion,
  LockKeyhole,
} from 'lucide-react';
import type { PeerReview } from '@/services/peerAppraisal.service';
export default function EmployeeGuide({ review }: { review: PeerReview }) {
  const active = review.status === 'collecting';
  return (
    <aside
      className="min-w-0 space-y-5 lg:sticky lg:top-6"
      aria-label="Appraisal guide"
    >
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">Your tasks</h2>
        <ul className="mt-4 space-y-5 text-sm">
          <li className="flex gap-3">
            <ClipboardList
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-[#b20202]"
            />
            <div>
              <p className="font-medium text-gray-800">Colleague ratings</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {review.isAppraiser === false
                  ? 'You are not selected to give ratings.'
                  : review.submittedAt
                    ? 'Submitted. Your ratings are locked.'
                    : active
                      ? `Rate each of your ${review.colleagues.length} colleagues once, then submit.`
                      : 'Ratings are unavailable for this cycle.'}
              </p>
            </div>
          </li>
          {review.hasExamination && (
            <li className="flex gap-3">
              <FileQuestion
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-[#b20202]"
              />
              <div>
                <p className="font-medium text-gray-800">Examination</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {active
                    ? 'If selected, complete your examination below. Check your assignment and time limit before you begin.'
                    : 'An examination contributes to your score only if it was assigned to you.'}
                </p>
              </div>
            </li>
          )}
          <li className="flex gap-3">
            {review.status === 'closed' ? (
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-green-700"
              />
            ) : (
              <LockKeyhole
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
              />
            )}
            <div>
              <p className="font-medium text-gray-800">Score and bonus</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {review.status === 'closed'
                  ? 'Released by HR. Your calculated bonus is shown on this page.'
                  : review.status === 'cancelled'
                    ? 'No bonus result is released for a cancelled cycle.'
                    : 'HR releases your score after the required ratings, examinations and attendance checks are complete.'}
              </p>
            </div>
          </li>
        </ul>
      </section>
      {active && review.isAppraiser !== false && (
        <section className="rounded-2xl bg-gray-50 p-5">
          <h2 className="text-sm font-semibold text-gray-900">
            Before you rate
          </h2>
          <p className="mt-2 text-xs leading-6 text-gray-500">
            Use one overall score from 1 to 5 for each colleague. Consider your
            experience working together. Self-ratings are excluded.
          </p>
          <p className="mt-3 border-t border-gray-200 pt-3 text-xs leading-6 text-gray-500">
            Save a draft to return later. Submit only when you have checked
            every rating.
          </p>
        </section>
      )}
    </aside>
  );
}
