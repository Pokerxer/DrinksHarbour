// shared/appraisals/cycle-detail-utils.ts — the arithmetic behind the cycle
// detail header and the employee drawer.
//
// Extracted rather than inlined because the admin vitest setup runs
// `environment: 'node'` — there is no DOM, so components cannot be rendered
// and anything worth asserting has to be a pure function. Everything here is
// one.

import type {
  AppraisalFeedback,
  AppraisalSection,
  AppraisalState,
  CycleProgress,
} from '@/services/appraisal.service';

/**
 * States in which the appraisal has reached the employee. `released` counts:
 * the work of the cycle is done at that point, and whether the employee has
 * clicked acknowledge is a separate (and much smaller) piece of chasing.
 */
const DONE_STATES: AppraisalState[] = ['released', 'acknowledged'];

/**
 * `cancelled` appraisals are neither done nor outstanding — they are out of
 * the cycle. Counting them as outstanding would make a cycle with three
 * cancellations permanently incompletable, and counting them as done would
 * report work that never happened.
 */
const EXCLUDED_STATES: AppraisalState[] = ['cancelled'];

export interface CycleStats {
  /** Appraisals in the cycle, including cancelled ones. */
  total: number;
  /** Appraisals that have reached the employee. */
  done: number;
  /** In the cycle and not yet finished — the number HR is actually working. */
  inFlight: number;
  cancelled: number;
  /**
   * `done / (total - cancelled)`, 0-100 and rounded. Null when there is
   * nothing live to be a percentage OF — a cycle with no appraisals is not 0%
   * complete, it has not started, and a 0% bar says something false about it.
   */
  completionPct: number | null;
  feedbackSubmitted: number;
  feedbackTotal: number;
  /** Null for the same reason as `completionPct`. */
  feedbackPct: number | null;
  stalledCount: number;
}

export function cycleStats(progress: CycleProgress | null): CycleStats {
  const byState = progress?.byState ?? {};
  let total = 0;
  let done = 0;
  let cancelled = 0;

  for (const [state, raw] of Object.entries(byState)) {
    // A count arriving as a non-number (or negative) would poison every total
    // downstream, and `NaN%` on a progress bar is worse than no bar.
    const count = typeof raw === 'number' && raw > 0 ? raw : 0;
    total += count;
    if (DONE_STATES.includes(state as AppraisalState)) done += count;
    if (EXCLUDED_STATES.includes(state as AppraisalState)) cancelled += count;
  }

  const live = total - cancelled;
  const feedbackTotal = progress?.feedbackTotal ?? 0;
  const feedbackSubmitted = progress?.feedbackSubmitted ?? 0;

  return {
    total,
    done,
    inFlight: live - done,
    cancelled,
    completionPct: live > 0 ? Math.round((done / live) * 100) : null,
    feedbackSubmitted,
    feedbackTotal,
    feedbackPct:
      feedbackTotal > 0
        ? Math.round((feedbackSubmitted / feedbackTotal) * 100)
        : null,
    stalledCount: progress?.stalled.length ?? 0,
  };
}

// `deadlineTone` used to live here too, at a 7-day window returning 'ok',
// while my-appraisals-utils.ts had its own at 3 days returning 'normal'. Two
// rules meant one deadline rendering amber on this page and grey on the team
// list. The 7-day window survived; the function now lives in
// my-appraisals-utils.ts alongside `isOverdue` and `formatDueLabel`, which the
// same call sites already import. Import it from there — do not add a third.

/**
 * The question ids to lay self and manager answers out against, in TEMPLATE
 * order rather than ObjectId order.
 *
 * Sorting by id — what this replaced — is arbitrary: it scrambles a form HR
 * deliberately sequenced, so "What went well?" can land after "What should
 * improve?" and a reader loses the thread the form was written to follow.
 *
 * An answer whose question is no longer in the template (edited out after
 * submission) still appears, after the template-ordered ones and sorted among
 * itself so the order is at least stable between renders. Dropping it would
 * silently hide a real answer someone wrote.
 */
export function askedQuestionIds(
  self: AppraisalFeedback | undefined,
  manager: AppraisalFeedback | undefined,
  sections: AppraisalSection[] = []
): string[] {
  const answered = new Set<string>();
  self?.answers.forEach((a) => answered.add(a.questionId));
  manager?.answers.forEach((a) => answered.add(a.questionId));

  const ordered: string[] = [];
  for (const section of sections) {
    for (const question of section.questions) {
      if (answered.has(question._id)) {
        ordered.push(question._id);
        answered.delete(question._id);
      }
    }
  }
  return [...ordered, ...Array.from(answered).sort()];
}
