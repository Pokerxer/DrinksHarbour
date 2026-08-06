// shared/appraisals/review-form-utils.ts — the DECISIONS behind the reviewer
// form's shell: what counts as an unsaved change, how far through each section
// the reviewer is, where "jump to the next gap" goes, and what the autosave
// indicator says.
//
// Same split as review-answer-utils.ts, which owns the per-ANSWER rules: this
// app's vitest runs `environment: 'node'` with no jsdom, so anything that can
// actually be wrong lives here as a pure function and the .tsx files stay thin
// renderers.
import type {
  AppraisalAnswer,
  AppraisalQuestion,
  AppraisalSection,
} from '@/services/appraisal.service';
import {
  flattenQuestions,
  isAnswered,
  serializeAnswers,
} from './review-answer-utils';

/**
 * A stable fingerprint of what a save would actually PUT on the wire.
 *
 * Built from serializeAnswers rather than the raw answer map on purpose: that
 * function already drops unanswered and unknown-question entries and narrows
 * each answer to the one field its type uses, so two states that would produce
 * byte-identical requests produce the same signature. Comparing the raw map
 * instead would call a form "dirty" when the reviewer typed a character into a
 * textarea and deleted it again, or when a cleared radio left an empty husk
 * behind — and autosave would then write on every keystroke of a no-op edit.
 *
 * Key order is fixed by flattenQuestions' render order, so this is
 * deterministic without sorting.
 */
export function answersSignature(
  sections: AppraisalSection[] | undefined,
  answers: Record<string, AppraisalAnswer>
): string {
  return JSON.stringify(serializeAnswers(sections, answers));
}

export interface SectionProgress {
  /** Matches the DOM id the form renders, so the nav can scroll to it. */
  id: string;
  title: string;
  answered: number;
  total: number;
  pct: number;
  complete: boolean;
  /** First question id in the section — the scroll target when it has no title. */
  firstQuestionId: string | null;
  /** Required questions in this section that are still unanswered. */
  missingRequired: number;
}

/** Section id used for both the anchor and the nav link. Index-based because
 *  a template may ship two sections with the same title, or none at all. */
export function sectionDomId(index: number): string {
  return `review-section-${index}`;
}

/**
 * Per-section completion, in render order. Drives the desktop section nav and
 * the per-section counter beside each heading.
 */
export function sectionProgress(
  sections: AppraisalSection[] | undefined,
  answers: Record<string, AppraisalAnswer>
): SectionProgress[] {
  return (sections ?? []).map((section, i) => {
    const questions = section?.questions ?? [];
    const answered = questions.filter((q) =>
      isAnswered(q, answers[q._id])
    ).length;
    const total = questions.length;
    const missingRequired = questions.filter(
      (q) => q.required && !isAnswered(q, answers[q._id])
    ).length;
    return {
      id: sectionDomId(i),
      title: section?.title?.trim() || `Section ${i + 1}`,
      answered,
      total,
      pct: total > 0 ? Math.round((answered / total) * 100) : 0,
      // A section with no questions is vacuously complete rather than stuck at
      // 0% forever — filterSectionsForKind should never send one, but the nav
      // must not invent a blocker if it does.
      complete: answered === total,
      firstQuestionId: questions[0]?._id ?? null,
      missingRequired,
    };
  });
}

/**
 * The next unanswered question after `afterId`, wrapping to the start.
 *
 * Wrapping is what makes a single "next unanswered" button usable on a long
 * form: the reviewer who skipped question 2 and is now at the bottom gets sent
 * back up to it instead of the button going dead. Returns null only when
 * nothing is left, which is how the caller knows to hide the control.
 *
 * `requiredOnly` narrows it to the questions that actually block submit.
 */
export function nextUnanswered(
  sections: AppraisalSection[] | undefined,
  answers: Record<string, AppraisalAnswer>,
  opts: { afterId?: string | null; requiredOnly?: boolean } = {}
): AppraisalQuestion | null {
  const questions = flattenQuestions(sections).filter(
    (q) => (!opts.requiredOnly || q.required) && !isAnswered(q, answers[q._id])
  );
  if (questions.length === 0) return null;
  if (!opts.afterId) return questions[0];

  // Compare against the FULL render order, not the filtered list: `afterId` is
  // usually an answered question (the one the reviewer just filled in), so it
  // is absent from `questions` and its index there would be meaningless.
  const order = flattenQuestions(sections).map((q) => q._id);
  const from = order.indexOf(opts.afterId);
  if (from === -1) return questions[0];
  return questions.find((q) => order.indexOf(q._id) > from) ?? questions[0];
}

/* ── Autosave status ──────────────────────────────────────────────────────── */

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * The autosave indicator's copy.
 *
 * Returns null when there is nothing worth saying — a pristine form that has
 * never been edited should not carry a status chip at all, because "Saved"
 * next to a form the reviewer has not touched is a claim about work that does
 * not exist.
 *
 * `now` and `savedAt` are injectable so the relative time is testable.
 */
export function saveStatusLabel(
  state: SaveState,
  savedAt: number | null,
  now = Date.now()
): string | null {
  if (state === 'saving') return 'Saving…';
  if (state === 'error') return 'Not saved — retry';
  if (state === 'dirty') return 'Unsaved changes';
  if (state === 'saved' && savedAt != null) {
    const mins = Math.floor(Math.max(0, now - savedAt) / 60000);
    if (mins < 1) return 'All changes saved';
    if (mins === 1) return 'Saved 1 minute ago';
    if (mins < 60) return `Saved ${mins} minutes ago`;
    const hours = Math.floor(mins / 60);
    return hours === 1 ? 'Saved 1 hour ago' : `Saved ${hours} hours ago`;
  }
  return null;
}
