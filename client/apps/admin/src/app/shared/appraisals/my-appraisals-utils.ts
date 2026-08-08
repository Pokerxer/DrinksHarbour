// shared/appraisals/my-appraisals-utils.ts — pure helpers for the
// "My Appraisals" page (subject + feedback-requested-from-me).
//
// Deliberately separate from the components so the date/urgency rules and
// the nudge copy are testable without rendering, and so the two card
// components (appraisal-subject-card.tsx, review-request-row.tsx) share one
// definition instead of drifting copies.
import type {
  AppraisalState,
  NudgeReason,
  PersonRef,
} from '@/services/appraisal.service';

export function personName(person?: PersonRef | null): string {
  if (!person) return 'Unknown';
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return name || person.email || 'Unknown';
}

export function formatDueLabel(value?: string | null): string {
  if (!value) return 'No deadline set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No deadline set';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** True when `value` is a parseable date strictly before `now`. */
export function isOverdue(value?: string | null, now = Date.now()): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  return t < now;
}

export type DeadlineTone = 'overdue' | 'soon' | 'normal' | 'none';

/** The one "soon" window in the appraisals module, in days.
 *
 *  SEVEN, not three. There were briefly two deadlineTone functions — this one
 *  at 3 days and a copy in cycle-detail-utils.ts at 7 — so the same date
 *  rendered amber on the cycle detail page and grey on the team list. Seven
 *  won because of what the amber is FOR: every action these deadlines gate
 *  (write a summary, chase four peer reviewers, collect a self-assessment)
 *  needs more than a long weekend, and a warning that arrives with three days
 *  left arrives too late to change the outcome. A week is also the cadence HR
 *  actually works this module on. The cost is a slightly wider amber band,
 *  which is the cheap direction to be wrong in.
 */
const SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Classify a deadline for display. 'overdue' is past; 'soon' is within the
 * next 7 days (inclusive of the boundary); 'normal' is further out; 'none' is
 * missing/unparseable — never 'overdue', because a red badge driven by a parse
 * failure is HR chasing people who owe nothing.
 *
 * `now` is injectable so tests can pin the clock.
 */
export function deadlineTone(
  value?: string | null,
  now = Date.now()
): DeadlineTone {
  if (!value) return 'none';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return 'none';
  if (t < now) return 'overdue';
  if (t - now <= SOON_WINDOW_MS) return 'soon';
  return 'normal';
}

/**
 * Mirror of the server's `NUDGE_STILL_OUTSTANDING` gate
 * (appraisal.controller.js): a nudge row is only worth rendering while its
 * reason is still actionable for the row's current state. The server already
 * filters this when attaching `nudge`, but re-checking here keeps the banner
 * honest if the row's state changed between fetch and render.
 */
const NUDGE_OPEN: Record<NudgeReason, (state: AppraisalState) => boolean> = {
  nominate: (state) => state === 'nominating',
  approve_peers: (state) => state === 'pending_peer_approval',
  feedback: (state) => state === 'collecting',
  summarise: (state) => state === 'collecting' || state === 'summarising',
  acknowledge: (state) => state === 'released',
};

export function nudgeIsStillOpen(
  reason: NudgeReason,
  state: AppraisalState
): boolean {
  return NUDGE_OPEN[reason]?.(state) ?? false;
}

/** Human copy for each nudge reason, shown on the banner. */
export const NUDGE_COPY: Record<
  NudgeReason,
  { title: string; body: string }
> = {
  nominate: {
    title: 'Nominations needed',
    body: 'Reminder: choose your peer reviewers so your appraisal can move forward.',
  },
  approve_peers: {
    title: 'Peer approval pending',
    body: 'Reminder: peer reviewer nominations are waiting for approval.',
  },
  feedback: {
    title: 'Feedback still waiting',
    body: 'Reminder: this feedback request is still outstanding.',
  },
  summarise: {
    title: 'Summary needed',
    body: 'Reminder: this appraisal is waiting to be summarised.',
  },
  acknowledge: {
    title: 'Awaiting your review',
    body: 'Reminder: please review and acknowledge your appraisal.',
  },
};

/**
 * Subject-first ordering for the "My appraisals" list. An appraisal only
 * needs THIS person's attention while it is `released` (acknowledge it) or
 * `nominating` (choose peers); acknowledged is done; the middle states are
 * waiting on other people; cancelled trails at the end. Ties keep the
 * server's createdAt-desc order (stable sort).
 */
export const SUBJECT_STATE_PRIORITY: Record<AppraisalState, number> = {
  released: 0,
  nominating: 1,
  acknowledged: 2,
  collecting: 3,
  summarising: 4,
  pending_peer_approval: 5,
  draft: 6,
  cancelled: 7,
};

/** Stable subject-first sort; ties keep the incoming (server) order. */
export function sortAppraisalsForSubject<T extends { state: AppraisalState }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) => SUBJECT_STATE_PRIORITY[a.state] - SUBJECT_STATE_PRIORITY[b.state]
  );
}

export interface SubjectStats {
  /** released + nominating appraisals and pending feedback requests. */
  needsAttention: number;
  /** collecting / summarising / pending_peer_approval / draft appraisals. */
  inProgress: number;
  /** acknowledged appraisals + submitted feedback requests. */
  completed: number;
}

/**
 * The three headline numbers for the page's stats strip. Cancelled
 * appraisals count in NONE of them — they are neither actionable, nor in
 * flight, nor completed. `reviews` statuses other than pending/submitted
 * (the server never returns them here, but the types allow them) are
 * ignored rather than miscounted.
 */
export function computeSubjectStats(
  appraisals: Array<{ state: AppraisalState }>,
  reviews: Array<{ status: string }>
): SubjectStats {
  let needsAttention = 0;
  let inProgress = 0;
  let completed = 0;
  for (const a of appraisals) {
    if (a.state === 'released' || a.state === 'nominating') needsAttention += 1;
    else if (a.state === 'acknowledged') completed += 1;
    else if (a.state !== 'cancelled') inProgress += 1;
  }
  for (const r of reviews) {
    if (r.status === 'pending') needsAttention += 1;
    else if (r.status === 'submitted') completed += 1;
  }
  return { needsAttention, inProgress, completed };
}
