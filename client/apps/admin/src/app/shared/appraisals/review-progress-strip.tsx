'use client';

import { motion } from 'framer-motion';
import {
  PiAlarm,
  PiCalendarBlank,
  PiCheckCircle,
  PiClock,
  PiNotePencil,
  PiCrown,
  PiUsersThree,
} from 'react-icons/pi';
import { Title } from 'rizzui';
import type { FeedbackKind } from '@/services/appraisal.service';
import { deadlineTone, formatDueLabel } from './my-appraisals-utils';

const KIND_META: Record<
  FeedbackKind,
  { icon: typeof PiNotePencil; label: string; color: string; bg: string }
> = {
  self: {
    icon: PiNotePencil,
    label: 'Self-assessment',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
  manager: {
    icon: PiCrown,
    label: 'Manager review',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
  },
  peer: {
    icon: PiUsersThree,
    label: 'Peer review',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
};

function DeadlinePill({ deadline }: { deadline: string | null }) {
  if (!deadline) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <PiCalendarBlank className="h-3.5 w-3.5" />
        No deadline
      </span>
    );
  }
  const tone = deadlineTone(deadline);
  if (tone === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-red-200/60">
        <PiAlarm className="h-3 w-3" />
        Overdue · {formatDueLabel(deadline)}
      </span>
    );
  }
  if (tone === 'soon') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-200/60">
        <PiClock className="h-3 w-3" />
        Due soon · {formatDueLabel(deadline)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-0.5 text-xs text-gray-500 ring-1 ring-gray-200/60">
      <PiCalendarBlank className="h-3 w-3" />
      Due {formatDueLabel(deadline)}
    </span>
  );
}

export default function ReviewProgressStrip({
  kind,
  subjectName,
  cycleName,
  deadline,
  answered,
  total,
}: {
  kind: FeedbackKind;
  subjectName: string;
  cycleName: string;
  deadline: string | null;
  answered: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const allDone = answered === total && total > 0;
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  const heading =
    kind === 'self'
      ? 'Your self-assessment'
      : `Reviewing ${subjectName}`;

  return (
    <div className="space-y-4">
      {/* Heading row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Title as="h1" className="text-xl font-bold tracking-tight text-gray-900">
            {heading}
          </Title>
          <p className="mt-0.5 text-sm text-gray-500">{cycleName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.bg} ${meta.color}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
          <DeadlinePill deadline={deadline} />
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-600">Progress</span>
          <span className="font-semibold text-gray-900">
            {answered} of {total} answered
          </span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-gray-100">
          <motion.div
            className={`h-full rounded-full ${
              allDone
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                : 'bg-gradient-to-r from-[#b20202] to-[#d40404]'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5">
          {allDone && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"
            >
              <PiCheckCircle className="h-3.5 w-3.5" />
              All questions answered
            </motion.span>
          )}
          {!allDone && (
            <span className="text-[11px] text-gray-400">
              {pct}% complete
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
