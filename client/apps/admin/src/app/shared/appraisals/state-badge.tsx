'use client';

import type { AppraisalState } from '@/services/appraisal.service';

// Presentational label + colour for each appraisal lifecycle state, following
// the RoleBadge / StatusBadge conventions in employee-profile-form.tsx
// (rounded-full pill, bg class carries both background + text colour).
//
// `nominating` and `pending_peer_approval` are Phase 2 states — unreachable
// today, since Task 1-7's server never puts an appraisal in either state yet
// — but the map is exhaustive over AppraisalState so this keeps compiling
// (and rendering something sane) the moment Phase 2 ships.
const STATE_META: Record<AppraisalState, { label: string; bg: string }> = {
  draft: { label: 'Not started', bg: 'bg-gray-100 text-gray-500' },
  nominating: { label: 'Nominating', bg: 'bg-gray-100 text-gray-500' },
  pending_peer_approval: {
    label: 'Pending approval',
    bg: 'bg-amber-100 text-amber-700',
  },
  collecting: { label: 'In progress', bg: 'bg-blue-100 text-blue-700' },
  summarising: {
    label: 'With your manager',
    bg: 'bg-purple-100 text-purple-700',
  },
  released: { label: 'Ready to review', bg: 'bg-[#b20202]/10 text-[#b20202]' },
  acknowledged: { label: 'Complete', bg: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100 text-gray-400' },
};

export default function AppraisalStateBadge({
  state,
}: {
  state: AppraisalState;
}) {
  const meta = STATE_META[state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.bg}`}
    >
      {meta.label}
    </span>
  );
}
