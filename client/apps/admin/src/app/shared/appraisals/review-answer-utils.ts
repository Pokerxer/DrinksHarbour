// shared/appraisals/review-answer-utils.ts — the answer DECISIONS behind
// reviewer-form.tsx and review-question-card.tsx, extracted so they can be
// tested without a DOM.
//
// Same reasoning as comparison-presenter.ts: this admin app's vitest runs with
// `environment: 'node'` and has no jsdom, so the rules that can actually be
// wrong live here as pure functions and the .tsx files are thin renderers.
//
// ── Why "is this answered" is not a one-liner ───────────────────────────────
// A template question carries its type; an answer does not. So every read of
// an answer has to be routed through its question, and the naive check is
// wrong in two specific ways this module exists to prevent:
//
//   * `!answer.rating` treats a real 0 as unanswered. For yes_no, 0 IS "no" —
//     a deliberate, submitted answer. Rating questions are 1-based in the UI,
//     but the schema permits 0, so the same trap applies there.
//   * `!!answer.text` treats a textarea holding only whitespace as answered.
//
// Both of those are silent: the reviewer sees a full progress bar and a submit
// button that lets them through, and the gap only shows up in the report.
import type {
  AppraisalAnswer,
  AppraisalQuestion,
  AppraisalSection,
  FeedbackKind,
} from '@/services/appraisal.service';

/**
 * Question types stored in `answer.rating`. Mirrors the `answerSchema` comment
 * in server/models/AppraisalFeedback.js — `yes_no` is numeric-on-the-wire
 * (1 = yes, 0 = no) even though it renders as two buttons.
 *
 * Deliberately NOT the same set as the server's COMPARABLE_QUESTION_TYPES,
 * which excludes yes_no: "stored as a number" and "averageable" are different
 * questions, and collapsing them is what would put a 1-of-5 bar on the word
 * "no". See the comment on that constant in appraisal.helpers.js.
 */
const NUMERIC_TYPES = new Set(['rating', 'likert', 'scale', 'yes_no']);

export function isNumericQuestion(question: AppraisalQuestion): boolean {
  return NUMERIC_TYPES.has(question.type);
}

/** The 1-based top of a question's scale. 5 when the template omits one. */
export function scaleMaxOf(question: AppraisalQuestion): number {
  const raw = question.scaleMax;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 2) return 5;
  return Math.floor(raw);
}

/**
 * Has this reviewer actually answered this question?
 *
 * `rating: 0` and `selected: []` are the two cases worth stating outright: the
 * first is answered (it is "no", or the bottom of a scale), the second is not
 * (an emptied checkbox group is the reviewer clearing their answer).
 */
export function isAnswered(
  question: AppraisalQuestion,
  answer: AppraisalAnswer | undefined
): boolean {
  if (!answer) return false;
  // "I haven't seen enough to judge this" IS an answer, and counting it as one
  // is the entire point. A required question with no honest way out is what
  // produces the defensive mid-scale 3 that makes every peer average converge
  // on "fine". Checked before the per-type rules because such an answer
  // deliberately carries no value in any of the fields they inspect.
  if (answer.notObserved === true) return true;
  if (question.type === 'choice') {
    return Array.isArray(answer.selected) && answer.selected.length > 0;
  }
  if (question.type === 'text') {
    return typeof answer.text === 'string' && answer.text.trim().length > 0;
  }
  // Every remaining type is numeric. Number.isFinite rejects NaN/Infinity but
  // — unlike a truthiness check — accepts 0.
  return typeof answer.rating === 'number' && Number.isFinite(answer.rating);
}

/** Every question across every section, in render order. */
export function flattenQuestions(
  sections: AppraisalSection[] | undefined
): AppraisalQuestion[] {
  return (sections ?? []).flatMap((s) => s?.questions ?? []);
}

/** Answered vs total across the whole form. */
export function progressOf(
  sections: AppraisalSection[] | undefined,
  answers: Record<string, AppraisalAnswer>
): { answered: number; total: number; pct: number } {
  const questions = flattenQuestions(sections);
  const answered = questions.filter((q) =>
    isAnswered(q, answers[q._id])
  ).length;
  const total = questions.length;
  return {
    answered,
    total,
    pct: total > 0 ? Math.round((answered / total) * 100) : 0,
  };
}

/**
 * Required questions still unanswered, in render order — so the caller can
 * both count them and scroll to the first one.
 */
export function outstandingRequired(
  sections: AppraisalSection[] | undefined,
  answers: Record<string, AppraisalAnswer>
): AppraisalQuestion[] {
  return flattenQuestions(sections).filter(
    (q) => q.required && !isAnswered(q, answers[q._id])
  );
}

/**
 * May this reviewer kind abstain from a question?
 *
 * Peers only, matching the server, which rejects `notObserved` on a self or
 * manager row outright. Self and manager hold the context to answer; letting
 * a manager skip a question they are accountable for is a different feature
 * and not a good one. Rendering the control for them would offer an out the
 * server would then refuse — a worse experience than never showing it.
 */
export function canAbstain(kind: FeedbackKind): boolean {
  return kind === 'peer';
}

/**
 * Toggle a question between an abstention and an ordinary answer.
 *
 * Turning it ON discards whatever value was there. That is deliberate and
 * matches the server, which rebuilds the answer from just the flag: a stored
 * answer must never be both "I can't judge this" and a 5.
 *
 * Turning it OFF clears back to an empty answer rather than restoring the
 * previous value. Reinstating a rating the reviewer had already moved away
 * from would put a score they did not just choose back under their name.
 */
export function toggleNotObserved(
  questionId: string,
  answer: AppraisalAnswer | undefined,
  on: boolean
): AppraisalAnswer {
  if (on) return { questionId, notObserved: true };
  return { questionId };
}

/* ── Answer construction ──────────────────────────────────────────────────── */

/**
 * The next `selected` array after choosing `option`.
 *
 * Single-select REPLACES, and is deliberately idempotent — re-choosing the
 * current option is not a deselect. It cannot be: this runs from a radio's
 * `change` event, and clicking an already-checked radio fires no `change` at
 * all, so a toggle-off written here would simply never run. Backing out of an
 * optional single-select is an explicit "Clear selection" control in
 * review-question-card.tsx instead.
 *
 * Multi-select toggles membership while preserving the template's option ORDER
 * rather than click order, so two reviewers who picked the same options produce
 * identical arrays and the stored answers compare.
 */
export function toggleChoice(
  question: AppraisalQuestion,
  current: string[] | undefined,
  option: string
): string[] {
  const selected = Array.isArray(current) ? current : [];
  if (!question.multiple) return [option];
  const next = selected.includes(option)
    ? selected.filter((o) => o !== option)
    : [...selected, option];
  const order = question.options ?? [];
  return [...next].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/**
 * Prepare the answer map for `PATCH`/`POST` to the server.
 *
 * Three things happen here, each preventing a specific server-side failure:
 *
 *  1. Answers for questions NOT in this form are dropped. The server rejects
 *     the whole request with a 400 listing unknown question ids
 *     (partitionAnswersByAskedQuestions), so one stale entry — from a draft
 *     saved before an `askOf` change — would block every later save with a
 *     message the reviewer can do nothing about.
 *  2. Unanswered entries are dropped, so a question the reviewer touched and
 *     then cleared does not persist as an empty row that later reads as
 *     "answered" to anything counting `answers.length`.
 *  3. Each surviving answer is narrowed to the ONE field its type uses. A
 *     question answered as text and then switched to rating in a new template
 *     version would otherwise carry both, and `isAnswered` would report the
 *     stale field.
 */
export function serializeAnswers(
  sections: AppraisalSection[] | undefined,
  answers: Record<string, AppraisalAnswer>
): AppraisalAnswer[] {
  const out: AppraisalAnswer[] = [];
  for (const q of flattenQuestions(sections)) {
    const answer = answers[q._id];
    if (!isAnswered(q, answer)) continue;
    // Sent as the ONLY field, mirroring what the server stores. It rebuilds
    // such an answer as `{ questionId, notObserved: true }` regardless, so
    // shipping a leftover rating alongside it would be silently discarded —
    // but sending it would make the local dirty-check disagree with what came
    // back, and autosave would then write on every reload.
    if (answer!.notObserved === true) {
      out.push({ questionId: q._id, notObserved: true });
    } else if (q.type === 'choice') {
      out.push({ questionId: q._id, selected: [...(answer!.selected ?? [])] });
    } else if (q.type === 'text') {
      out.push({ questionId: q._id, text: answer!.text!.trim() });
    } else {
      out.push({ questionId: q._id, rating: answer!.rating });
    }
  }
  return out;
}

/** Seed the editable answer map from a saved feedback row. */
export function seedAnswers(
  saved: AppraisalAnswer[] | undefined
): Record<string, AppraisalAnswer> {
  const map: Record<string, AppraisalAnswer> = {};
  for (const a of saved ?? []) {
    if (!a?.questionId) continue;
    map[String(a.questionId)] = { ...a, questionId: String(a.questionId) };
  }
  return map;
}

/**
 * How a submitted answer reads back in the read-only view. Returns null when
 * unanswered so the caller can render "Not answered" rather than an empty
 * string that looks like a rendering bug.
 */
export function formatAnswer(
  question: AppraisalQuestion,
  answer: AppraisalAnswer | undefined
): string | null {
  if (!isAnswered(question, answer)) return null;
  // Distinct from the null "Not answered" above: this reviewer did respond,
  // and said they were not in a position to judge. Reading that back as
  // "Not answered" would misreport a considered abstention as a gap.
  if (answer!.notObserved === true) return 'Not observed';
  if (question.type === 'choice') return answer!.selected!.join(', ');
  if (question.type === 'text') return answer!.text!.trim();
  if (question.type === 'yes_no') return answer!.rating === 1 ? 'Yes' : 'No';
  return `${answer!.rating} of ${scaleMaxOf(question)}`;
}
