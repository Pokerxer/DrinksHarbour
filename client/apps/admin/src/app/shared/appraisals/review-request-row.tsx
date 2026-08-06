'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { ComponentType } from 'react';
import {
  PiAlarm,
  PiArrowRight,
  PiCheckCircle,
  PiCrown,
  PiNotePencil,
  PiUsersThree,
} from 'react-icons/pi';
import type { FeedbackKind, ReviewRequest } from '@/services/appraisal.service';
import {
  deadlineTone,
  formatDueLabel,
  nudgeIsStillOpen,
  NUDGE_COPY,
  personName,
} from './my-appraisals-utils';

const KIND_META: Record<
  FeedbackKind,
  { label: string; icon: ComponentType<{ className?: string }>; avatarBg: string }
> = {
  self: {
    label: 'Self assessment',
    icon: PiNotePencil,
    avatarBg: 'bg-gray-100 text-gray-500',
  },
  manager: {
    label: 'Manager review',
    icon: PiCrown,
    avatarBg: 'bg-purple-50 text-purple-600',
  },
  peer: {
    label: 'Peer review',
    icon: PiUsersThree,
    avatarBg: 'bg-blue-50 text-blue-600',
  },
};

export default function ReviewRequestRow({
  review,
  index,
}: {
  review: ReviewRequest;
  index: number;
}) {
  const isSelf = review.kind === 'self';
  const submitted = review.status === 'submitted';
  const meta = KIND_META[review.kind] ?? KIND_META.peer;
  const Icon = meta.icon;
  const subject = isSelf
    ? 'Your self-assessment'
    : personName(review.appraisal?.employee);
  const deadline = review.cycle?.feedbackDeadline;
  const tone = deadlineTone(deadline);
  const nudge = review.nudge;
  const hasNudge =
    !!nudge &&
    review.status === 'pending' &&
    nudgeIsStillOpen(nudge.reason, review.appraisal?.state ?? 'draft');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.05, 0.4),
        type: 'spring',
        stiffness: 260,
        damping: 26,
      }}
      className={`group flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all duration-200 ${
        submitted
          ? 'border-gray-100 bg-gray-50/60'
          : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.avatarBg}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {subject}
          </p>
          <p className="truncate text-xs text-gray-400">
            {meta.label} · {review.cycle?.name || 'Appraisal cycle'}
            {!submitted && deadline && tone !== 'none' ? (
              tone === 'overdue' ? (
                <span className="font-semibold text-red-600">
                  {' '}
                  · Overdue · {formatDueLabel(deadline)}
                </span>
              ) : tone === 'soon' ? (
                <span className="font-semibold text-amber-600">
                  {' '}
                  · Due soon · {formatDueLabel(deadline)}
                </span>
              ) : (
                <span> · Due {formatDueLabel(deadline)}</span>
              )
            ) : null}
          </p>

          {hasNudge && nudge ? (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
              <PiAlarm className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              {NUDGE_COPY[nudge.reason].body}
            </p>
          ) : null}
        </div>
      </div>

      {submitted ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
          <PiCheckCircle className="h-3.5 w-3.5" />
          Submitted{review.submittedAt ? ` · ${formatDueLabel(review.submittedAt)}` : ''}
        </span>
      ) : (
        <Link
          href={`/appraisals/reviews/${review._id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#b20202]/30 px-3.5 py-1.5 text-xs font-semibold text-[#b20202] transition-colors hover:bg-[#b20202]/5"
        >
          Give feedback
          <PiArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}
    </motion.div>
  );
}
