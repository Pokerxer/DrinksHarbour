'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  PiAlarm,
  PiArrowRight,
  PiCalendarBlank,
  PiCheckCircle,
  PiClock,
  PiStar,
} from 'react-icons/pi';
import type { Appraisal, AppraisalState } from '@/services/appraisal.service';
import AppraisalStateBadge from './state-badge';
import {
  deadlineTone,
  formatDueLabel,
  nudgeIsStillOpen,
  NUDGE_COPY,
} from './my-appraisals-utils';

// The subject cannot open an appraisal before it is released (the server
// 403s the detail route), so the card shows a plain hint instead of a link
// that would predictably fail. `nominating` is the one exception: it has its
// own purpose-built route the subject CAN open at that state.
const STATE_HINT: Partial<Record<AppraisalState, string>> = {
  collecting: "Feedback is being collected — it'll come to you once released.",
  summarising: 'Being summarised by your manager.',
  pending_peer_approval: 'Peer reviewers are being approved.',
  draft: 'Not started yet.',
};

function DeadlineRow({ appraisal }: { appraisal: Appraisal }) {
  const deadline = appraisal.cycle?.feedbackDeadline;
  const tone = deadlineTone(deadline);

  if (tone === 'none') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-gray-400">
        <PiCalendarBlank className="h-3.5 w-3.5 shrink-0" />
        No deadline set
      </p>
    );
  }

  if (tone === 'overdue') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
        <PiAlarm className="h-3.5 w-3.5 shrink-0" />
        Overdue · {formatDueLabel(deadline)}
      </p>
    );
  }

  if (tone === 'soon') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
        <PiClock className="h-3.5 w-3.5 shrink-0" />
        Due soon · {formatDueLabel(deadline)}
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-gray-400">
      <PiCalendarBlank className="h-3.5 w-3.5 shrink-0" />
      Due {formatDueLabel(deadline)}
    </p>
  );
}

function NudgeBanner({ appraisal }: { appraisal: Appraisal }) {
  const nudge = appraisal.nudge;
  if (!nudge || !nudgeIsStillOpen(nudge.reason, appraisal.state)) return null;
  const copy = NUDGE_COPY[nudge.reason];
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <PiAlarm className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-amber-800">{copy.title}</p>
        <p className="text-[11px] leading-relaxed text-amber-700">{copy.body}</p>
      </div>
    </div>
  );
}

export default function AppraisalSubjectCard({
  appraisal,
  index,
}: {
  appraisal: Appraisal;
  index: number;
}) {
  const { state } = appraisal;
  const cancelled = state === 'cancelled';
  const readable = state === 'released' || state === 'acknowledged';
  const needsAcknowledge = state === 'released';
  const needsNomination = state === 'nominating';
  const hasRating = readable && typeof appraisal.finalRating === 'number';

  const actionHref = needsNomination
    ? `/appraisals/${appraisal._id}/nominate`
    : `/appraisals/${appraisal._id}`;
  const actionLabel = needsNomination
    ? 'Nominate peer reviewers'
    : needsAcknowledge
      ? 'Review & acknowledge'
      : 'View';

  const completionDate = needsAcknowledge
    ? appraisal.releasedAt
    : appraisal.acknowledgedAt || appraisal.releasedAt;
  const hint = STATE_HINT[state];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        // Cap the stagger so a long list doesn't leave the last cards
        // hanging — everything is in by ~half a second.
        delay: Math.min(index * 0.06, 0.48),
        type: 'spring',
        stiffness: 260,
        damping: 26,
      }}
      className={`group relative flex flex-col justify-between gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        cancelled
          ? 'border-gray-100 opacity-60 saturate-50'
          : 'border-gray-200'
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold leading-snug text-gray-900">
            {appraisal.cycle?.name || 'Appraisal cycle'}
          </p>
          <AppraisalStateBadge state={state} />
        </div>

        <DeadlineRow appraisal={appraisal} />

        {hasRating && typeof appraisal.finalRating === 'number' && (
          <p className="inline-flex w-fit items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
            <PiStar className="h-3.5 w-3.5" />
            Final rating {appraisal.finalRating}/10
          </p>
        )}

        {completionDate && (
          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <PiCheckCircle className="h-3.5 w-3.5 shrink-0" />
            {needsAcknowledge ? 'Released' : 'Completed'}{' '}
            {formatDueLabel(completionDate)}
          </p>
        )}

        <NudgeBanner appraisal={appraisal} />
      </div>

      {needsNomination || readable ? (
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101]"
        >
          {actionLabel}
          <PiArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-gray-400">{hint}</p>
      ) : cancelled ? (
        <p className="text-xs text-gray-300">This appraisal was cancelled.</p>
      ) : null}
    </motion.div>
  );
}
