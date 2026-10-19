import Link from 'next/link';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import type { PeerReview } from '@/services/peerAppraisal.service';
export default function EmployeeHeader({ review }: { review: PeerReview }) {
  const status =
    review.status === 'closed'
      ? 'Results released'
      : review.status === 'cancelled'
        ? 'Cancelled'
        : review.status === 'collecting'
          ? 'In progress'
          : 'Not started';
  return (
    <header className="space-y-6 border-b border-gray-200 pb-6">
      <Link
        href="/appraisals"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#b20202] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        My appraisals
      </Link>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#b20202]">
          <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
          Your appraisal
        </p>
        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${review.status === 'closed' ? 'bg-green-50 text-green-800' : review.status === 'cancelled' ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-[#790505]'}`}
        >
          {status}
        </span>
        <h1 className="col-span-2 min-w-0 break-words text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          {review.name}
        </h1>
        <p className="col-span-2 max-w-2xl text-sm leading-6 text-gray-500">
          {review.status === 'closed'
            ? 'Your final scores and calculated bonus are ready.'
            : review.status === 'cancelled'
              ? 'This appraisal has ended without a released bonus result.'
              : 'Complete your assigned tasks here. Your final score and bonus will appear when HR closes the cycle.'}
        </p>
      </div>
    </header>
  );
}
