// shared/appraisals/template-option-scores.ts — authoring scored anchors.
//
// A scored-anchor question shows the rater N behavioural descriptions and
// stores the score the chosen one carries as an ordinary `rating`. The score
// is never shown: a rating sheet with visible weights invites people to answer
// the number rather than the behaviour.
//
// `optionScores` is a THIRD array running parallel to `options` and to the
// editor's row keys, paired strictly BY POSITION. Every add, edit and remove
// has to move all three in lockstep, and getting that wrong fails silently —
// an option whose index has no score maps to `undefined`, and the answer saves
// with no rating at all. That is why the array surgery lives here as pure
// functions instead of inline in the .tsx: this admin app's vitest runs with
// `environment: 'node'`, no jsdom, so a component's handlers cannot be tested
// but these can. Same reasoning as comparison-presenter.ts.

/**
 * Types whose stored answer is an ordinal number that scoring reads back.
 *
 * `choice` is excluded even though it is the type that visually resembles a
 * scored sheet: it stores option TEXT in `selected`, is outside the server's
 * COMPARABLE_QUESTION_TYPES, and nothing downstream would ever score it.
 *
 * `yes_no` is excluded although it is numeric: it stores 1/0 while carrying the
 * schema's default `scaleMax: 5`, so scoreAppraisal skips it. Offering scores
 * on one would author a question that silently contributes nothing.
 */
const SCORABLE_TYPES = new Set(['rating', 'likert', 'scale']);

export function supportsOptionScores(type: string | undefined): boolean {
  return SCORABLE_TYPES.has(String(type));
}

/** The schema's ceiling, defaulted the same way the server defaults it. */
export function scaleMaxOrDefault(scaleMax: number | undefined): number {
  return typeof scaleMax === 'number' && Number.isFinite(scaleMax)
    ? scaleMax
    : 5;
}

/** The minimal question shape this module reads. */
interface ScorableQuestion {
  type?: string;
  scaleMax?: number;
  options?: string[];
  optionScores?: number[];
}

/**
 * Is scoring switched ON for this question?
 *
 * Deliberately looser than `isScoredOptions` in review-answer-utils.ts, which
 * requires the arrays to pair before it will RENDER anchors. Here a mismatched
 * pair still counts as on, so the editor shows the author the problem rather
 * than reading their half-finished sheet as an ordinary rating question and
 * dropping the scores they had typed.
 */
export function hasOptionScores(question: ScorableQuestion): boolean {
  if (!supportsOptionScores(question.type)) return false;
  return Array.isArray(question.optionScores);
}

/**
 * The highest score in `0..max` that no row already uses, or NaN when the
 * scale has nothing distinct left to give.
 *
 * Never invents a duplicate to fill a row. Two anchors worth the same are
 * indistinguishable once stored — see `optionScoreProblem`.
 */
function nextFreeScore(used: number[], max: number): number {
  const taken = new Set(used);
  for (let n = Math.floor(max); n >= 0; n -= 1) {
    if (!taken.has(n)) return n;
  }
  return Number.NaN;
}

/**
 * Turn scoring on: keep whatever options exist and score them best-first from
 * the top of the scale, which is the ordering every scored sheet in use has.
 * A question with no options yet gets the two blank rows the sheet needs.
 */
export function enableOptionScores(question: ScorableQuestion): {
  options: string[];
  optionScores: number[];
} {
  const max = scaleMaxOrDefault(question.scaleMax);
  const existing = question.options ?? [];
  const options = existing.length >= 2 ? [...existing] : ['', ''];
  const optionScores: number[] = [];
  for (let i = 0; i < options.length; i += 1) {
    optionScores.push(nextFreeScore(optionScores, max));
  }
  return { options, optionScores };
}

/* ── Row state ────────────────────────────────────────────────────────────── */

/**
 * The three arrays the editor keeps in step. `keys` is client-side identity
 * only and never goes on the wire: options are bare strings, so there is no id
 * to key a row by, and two rows may legitimately read the same while being
 * typed.
 */
export interface ScoredRows {
  options: string[];
  optionScores: number[];
  keys: number[];
}

function nextKey(keys: number[]): number {
  return keys.length > 0 ? Math.max(...keys) + 1 : 0;
}

/**
 * Resize a key list to `length`, preserving the keys of surviving rows.
 *
 * Needed because options can arrive from outside the row editor entirely — an
 * AI options run, a preset, an undo — and reconciling those by index would
 * leave the caret in a row that now holds a different option's text.
 */
export function syncScoredKeys(keys: number[], length: number): number[] {
  if (keys.length === length) return keys;
  const base = nextKey(keys);
  return Array.from({ length }, (_, i) => keys[i] ?? base + i);
}

export function addScoredRow(rows: ScoredRows, scaleMax: number): ScoredRows {
  return {
    options: [...rows.options, ''],
    optionScores: [
      ...rows.optionScores,
      nextFreeScore(rows.optionScores, scaleMaxOrDefault(scaleMax)),
    ],
    keys: [...rows.keys, nextKey(rows.keys)],
  };
}

export function removeScoredRow(rows: ScoredRows, index: number): ScoredRows {
  const drop = <T>(arr: T[]) => arr.filter((_, i) => i !== index);
  return {
    options: drop(rows.options),
    optionScores: drop(rows.optionScores),
    keys: drop(rows.keys),
  };
}

export function setScoredLabel(
  rows: ScoredRows,
  index: number,
  label: string
): ScoredRows {
  return {
    ...rows,
    options: rows.options.map((o, i) => (i === index ? label : o)),
  };
}

export function setScoredScore(
  rows: ScoredRows,
  index: number,
  raw: string
): ScoredRows {
  const value = parseScore(raw);
  return {
    ...rows,
    optionScores: rows.optionScores.map((s, i) => (i === index ? value : s)),
  };
}

/**
 * A typed score, or NaN for a box the author has emptied.
 *
 * Blank must not read as 0: zero is a real score an author could mean (the
 * bottom anchor of a 0–4 sheet), and defaulting an untyped box to it would
 * quietly author a valid-looking sheet nobody intended.
 */
export function parseScore(raw: string): number {
  const text = String(raw ?? '').trim();
  if (!text) return Number.NaN;
  const n = Number(text);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** What the number input shows. A blank score is an empty box, never "NaN". */
export function scoreInputValue(score: number | undefined): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) return '';
  return String(score);
}

/* ── Validation ───────────────────────────────────────────────────────────── */

/**
 * The author-facing mirror of `validateOptionScores` in
 * server/controllers/appraisalTemplate.controller.js. The server is still the
 * authority; this exists so the problem is visible while it is being made
 * rather than as a 400 after a long form is written.
 *
 * Returns the FIRST problem, because they compound: a sheet with a blank score
 * usually also has a duplicate, and listing both is noise.
 */
export function optionScoreProblem(
  options: string[],
  optionScores: number[],
  scaleMax: number | undefined
): string | null {
  const max = scaleMaxOrDefault(scaleMax);
  if (options.length !== optionScores.length) {
    return 'Every option needs exactly one score.';
  }
  if (options.length < 2) {
    return 'A scored question needs at least two options.';
  }
  if (optionScores.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    return 'Every option needs a score.';
  }
  if (optionScores.some((n) => n < 0 || n > max)) {
    return `Scores must be between 0 and ${max}.`;
  }
  // The stored answer is a bare number, so the score is also the IDENTITY of
  // the anchor that was chosen — it is what the read-back view looks the
  // wording up by. Two anchors worth the same would attribute one option's
  // words to a rater who picked the other.
  if (new Set(optionScores).size !== optionScores.length) {
    return 'Each option needs a distinct score — the score is what records which option was picked.';
  }
  return null;
}

interface DraftShape {
  title?: string;
  questions?: (ScorableQuestion & { label?: string })[];
}

/**
 * The first scored question in the draft that could not be saved, named so the
 * author can find it. Null when every scored question is sound — including a
 * draft with no scored questions at all.
 */
export function firstOptionScoreProblem(
  sections: DraftShape[] | undefined
): string | null {
  const list = sections ?? [];
  for (let i = 0; i < list.length; i += 1) {
    const questions = list[i]?.questions ?? [];
    for (let j = 0; j < questions.length; j += 1) {
      const q = questions[j];
      if (!q || !hasOptionScores(q)) continue;
      const problem = optionScoreProblem(
        q.options ?? [],
        q.optionScores ?? [],
        q.scaleMax
      );
      if (!problem) continue;
      const label = (q.label ?? '').trim();
      const where = label
        ? `“${label}”`
        : `Section ${i + 1}, question ${j + 1}`;
      return `${where}: ${problem}`;
    }
  }
  return null;
}
