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

/* ── Scored anchors ───────────────────────────────────────────────────────── */

/**
 * Is this a question whose OPTIONS carry hidden scores?
 *
 * The rater reads five behavioural descriptions and picks one; the score that
 * option is worth is stored as an ordinary `rating` and is never shown to
 * them. That is the whole point — a supervisor rating sheet where the weights
 * are visible invites people to answer the number rather than the behaviour.
 *
 * Requires the two arrays to pair exactly. The server refuses to save a
 * mismatch (validateOptionScores in appraisalTemplate.controller.js), but a
 * stale client or a hand-edited document could still present one, and the safe
 * failure is to fall back to the plain numeric scale rather than render
 * buttons that map to `undefined`.
 *
 * `choice` is excluded deliberately even if it somehow carried scores: a
 * choice answer stores TEXT in `selected`, not a number, so nothing downstream
 * would score it.
 */
export function isScoredOptions(question: AppraisalQuestion): boolean {
  if (!NUMERIC_TYPES.has(question.type) || question.type === 'yes_no')
    return false;
  const options = question.options ?? [];
  const scores = question.optionScores ?? [];
  return options.length > 0 && options.length === scores.length;
}

/** An anchor as the rater sees it: wording, and the score it silently carries. */
export interface ScoredOption {
  label: string;
  score: number;
}

/**
 * FNV-1a, 32-bit, with a murmur3 avalanche finalizer.
 *
 * The server sorts by a sha256 digest (orderFeedbackForViewer), but node's
 * crypto is not available here and SubtleCrypto is async — an ordering that
 * has to be awaited cannot be computed during render. The cryptographic
 * strength is not what the ordering rests on anyway: this hides which anchor
 * is worth 5 from someone reading a form, and the template ships the scores to
 * the browser regardless. What matters is that it is deterministic and
 * well-mixed.
 *
 * The finalizer is NOT optional decoration. FNV-1a alone barely avalanches its
 * LAST byte, and the keys hashed here differ only in a trailing index — the
 * first version of this function reached 20 of the 120 possible orders and put
 * the bottom anchor first 49% of the time, a bias more learnable than the
 * best-first order the shuffle replaced. `scored-options.test.ts` pins the
 * distribution so that cannot come back.
 */
function hash32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // The FNV prime, by shift-and-add: a plain `h * 16777619` overflows into
    // float territory and stops being a 32-bit hash.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  // murmur3 fmix32 — spreads the low bits, where a one-character difference
  // lands, across the whole word.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * The anchors of a scored question in the order THIS rater should see them.
 *
 * ── Why the authored order cannot be the rendered order ────────────────────
 * Scored anchors are written best-first (5/4/3/2/1) because that is how a
 * human composes a rating scale. Rendered that way, "the top one is the good
 * one" is learnable in about four questions, and from then on the rater is
 * picking a POSITION rather than reading a description — which is precisely
 * the behaviour hiding the scores was meant to prevent. A twenty-criterion
 * sheet then measures nothing but how quickly someone spotted the pattern.
 *
 * ── The two properties this has to hold at once ────────────────────────────
 * The order must VARY between raters and questions, and must be STABLE for
 * any one of them. Stability is not a nicety: re-shuffling on re-render moves
 * an option out from under the cursor, and a half-made click then lands on a
 * different anchor than the one the rater was reading — silently, and stored
 * as their considered judgement. It is the same argument, for the same reason,
 * as orderFeedbackForViewer on the server; read its comment on why
 * re-randomising per request is a leak rather than extra safety.
 *
 * So the order is DERIVED, not drawn: hash the salt with the question id and
 * the anchor's authored index, and sort on that. Same rater, same question,
 * same order, forever, with no state to store.
 *
 * `salt` is the reviewer's own feedback row id. Per-rater rather than
 * per-appraisal so the manager's sheet is not in the same order as the one the
 * employee already filled in — otherwise a manager who had read the self
 * assessment could recover the ranking from it.
 *
 * The label and its score move TOGETHER. Shuffling the labels alone would
 * leave answerForScoredOption mapping a clicked position onto whatever score
 * the template had at that index, storing a rating nobody chose — and nothing
 * would throw. Returning pairs rather than a permutation of indices is what
 * makes that mistake unavailable to the caller.
 *
 * Returns `[]` for a question whose arrays do not pair, matching
 * isScoredOptions' safe failure: the caller falls back to the plain numeric
 * scale rather than rendering buttons mapped to `undefined`.
 */
export function shuffledScoredOptions(
  question: AppraisalQuestion,
  salt: string
): ScoredOption[] {
  if (!isScoredOptions(question)) return [];
  const options = question.options ?? [];
  const scores = question.optionScores ?? [];
  return options
    .map((label, index) => ({
      label,
      score: scores[index],
      // Index FIRST: it is the only part that varies within one question, and
      // leading with it means every later byte of the key mixes it further.
      rank: hash32(`${index}:${salt}:${question._id}`),
      index,
    }))
    // Ties break on the authored index so the result is a total order even if
    // two keys collide — without it, sort stability would be the only thing
    // keeping the output deterministic, and that is not a guarantee worth
    // resting a stored rating on.
    .sort((a, b) => a.rank.localeCompare(b.rank) || a.index - b.index)
    .map(({ label, score }) => ({ label, score }));
}

/** The answer produced by picking option `index` — its score, not its index. */
export function answerForScoredOption(
  question: AppraisalQuestion,
  index: number
): AppraisalAnswer {
  return { questionId: question._id, rating: question.optionScores![index] };
}

/**
 * The wording behind a stored rating, or null if it matches no option.
 *
 * This is a reverse lookup by score, which is only unambiguous because the
 * server rejects a question whose options share a score. Without that rule two
 * anchors worth 3 would be indistinguishable once stored, and this would
 * return whichever came first — attributing words to a rater who chose the
 * other one.
 */
export function scoredOptionLabel(
  question: AppraisalQuestion,
  rating: number | undefined
): string | null {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null;
  const i = (question.optionScores ?? []).indexOf(rating);
  return i === -1 ? null : ((question.options ?? [])[i] ?? null);
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
/**
 * Set (or clear) the reviewer's note on an answer — Phase 5 §9.3.
 *
 * A blanked note DELETES the key rather than storing `''`. An empty string
 * would come back from the server as an absent field, so the local map and the
 * saved row would disagree forever and autosave would fire on every reload —
 * the same reasoning `serializeAnswers` already applies to `notObserved`.
 */
export function withComment(
  answer: AppraisalAnswer | undefined,
  comment: string
): AppraisalAnswer | undefined {
  if (!answer) return undefined;
  const text = comment.trim();
  if (!text) {
    const { comment: _dropped, ...rest } = answer;
    return rest;
  }
  return { ...answer, comment: text };
}

/**
 * Carry a note across a change to the VALUE.
 *
 * `applyAnswer` in reviewer-form.tsx deliberately writes the whole answer
 * rather than merging, so a question can never accumulate two mutually
 * exclusive value fields. A comment is not one of those: it sits on a
 * different axis from the rating/text/selected triple, and without this a
 * manager who writes a note and then nudges the score loses the note with no
 * warning.
 *
 * NOT carried onto an abstention: a "can't judge this" answer is rebuilt from
 * scratch by the server as `{questionId, notObserved}`, and a note surviving
 * onto it locally would put the dirty-check permanently out of step with what
 * comes back.
 */
export function carryComment(
  previous: AppraisalAnswer | undefined,
  next: AppraisalAnswer
): AppraisalAnswer {
  if (next.notObserved === true) return next;
  if ('comment' in next) return next;
  const carried = previous?.comment;
  return carried ? { ...next, comment: carried } : next;
}

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
      continue;
    }
    let wire: AppraisalAnswer;
    if (q.type === 'choice') {
      wire = { questionId: q._id, selected: [...(answer!.selected ?? [])] };
    } else if (q.type === 'text') {
      wire = { questionId: q._id, text: answer!.text!.trim() };
    } else {
      wire = { questionId: q._id, rating: answer!.rating };
    }
    // The reviewer's note rides along with the value it annotates. Trimmed and
    // omitted when blank for the same round-trip reason as `withComment`. The
    // server drops it from anything but a manager row, so sending it from a
    // self or peer form is harmless — but nothing here offers the box there.
    const comment = answer!.comment?.trim();
    if (comment) wire.comment = comment;
    out.push(wire);
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
  // A scored anchor reads back as the wording that was chosen. Falling through
  // to the numeric form below would print "4 of 5" — the score the rater was
  // deliberately never shown, surfaced in the one view they are most likely to
  // read. Falls through anyway if the rating matches no option, because a
  // number is still better than silently rendering nothing.
  if (isScoredOptions(question)) {
    const label = scoredOptionLabel(question, answer!.rating);
    if (label !== null) return label;
  }
  return `${answer!.rating} of ${scaleMaxOf(question)}`;
}
