// shared/appraisals/score-presenter.ts — the render DECISIONS behind the final
// score card, extracted so they can be tested without a DOM.
//
// Same reasoning as comparison-presenter.ts: this admin app's vitest runs with
// `environment: 'node'` and has no jsdom, so the rules that can actually be
// wrong live here as pure functions and the .tsx is a thin renderer.
//
// Three of those rules are the whole reason this file exists:
//
//   * `pct` is null before the manager submits. Rendering that as 0% publishes
//     a verdict nobody reached, on the one screen the employee reads.
//   * a skipped question leaves BOTH sides of the fraction, so a partial
//     assessment is out of `possible`, never out of 100. Presenting 74/90 as
//     "74%" would silently mark the manager's abstentions as failures.
//   * a form with no scorable questions scores 0 out of 0. That is not a
//     result — it is a form that was never a rating sheet, and it gets no card.
import type {
  AppraisalAccess,
  AppraisalScore,
} from '@/services/appraisal.service';

export type ScoreCard =
  /** Nothing to show: no scorable questions, no payload, or no business here. */
  | { kind: 'hidden' }
  /**
   * The form scores, but the manager's assessment is not in yet. Renders as
   * "not scored yet" — NEVER as a zero, and never as a running total either:
   * the server only ever scores a submitted manager row, so there is no
   * partial mark for the subject to watch assemble mid-cycle.
   */
  | { kind: 'pending' }
  | {
      kind: 'scored';
      /** e.g. "82%" or "82.5%" — the server's tenth of a percent, kept. */
      pctLabel: string;
      /** e.g. "74 of 90" — out of what was scored, not out of 100. */
      pointsLabel: string;
      /** "18 of 20 criteria scored", or null when the form was completed. */
      coverage: string | null;
      earned: number;
      possible: number;
      counted: number;
      skipped: number;
    };

/**
 * Relations that may be shown a mark at all.
 *
 * The server already guarantees this structurally — `score` is computed from
 * the projected feedback, so a viewer who cannot see the manager's row gets
 * `pct: null` — and it only returns a body once `canRead` is true. This is the
 * second, independent reason: a card is not rendered for a relation that has
 * no business seeing one, rather than relying on the payload happening to be
 * empty for them.
 */
const SCORE_RELATIONS = new Set(['subject', 'manager', 'hr']);

function pctLabelOf(pct: number): string {
  // The server rounds to one decimal. Trailing ".0" is noise on a mark, but a
  // real .5 is not — it is the difference between two anchors on a 20-question
  // sheet, and rounding it away here would make two different assessments
  // print the same number.
  const rounded = Math.round(pct * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

export function scoreCard(
  score: AppraisalScore | undefined,
  access: Pick<AppraisalAccess, 'relation'> | undefined
): ScoreCard {
  if (!score) return { kind: 'hidden' };
  if (!access || !SCORE_RELATIONS.has(access.relation))
    return { kind: 'hidden' };

  const total = score.counted + score.skipped;
  // Not a rating sheet: nothing in the form was ever scorable.
  if (total === 0) return { kind: 'hidden' };

  // `pct === null` only. A pct of 0 is a real mark and is NOT caught by a
  // falsy check — which is exactly why this is written this way.
  if (
    score.pct === null ||
    !Number.isFinite(score.pct) ||
    score.possible <= 0
  ) {
    return { kind: 'pending' };
  }

  return {
    kind: 'scored',
    pctLabel: pctLabelOf(score.pct),
    pointsLabel: `${score.earned} of ${score.possible}`,
    coverage:
      score.skipped > 0 ? `${score.counted} of ${total} criteria scored` : null,
    earned: score.earned,
    possible: score.possible,
    counted: score.counted,
    skipped: score.skipped,
  };
}
