// shared/appraisals/comparison-presenter.ts — the render DECISIONS behind
// appraisal-comparison.tsx, extracted so they can be tested without a DOM.
//
// This admin app's vitest runs with `environment: 'node'` and has no jsdom and
// no @testing-library/react — and it is not getting them for two panels, in a
// build that has already OOM'd at 6 GB once. So the rules that can actually be
// wrong (a 0 rendering as a bar, an n===1 leaking a number, a bucket nobody
// was asked reading as "nobody answered") live here as pure functions, and the
// .tsx is a thin renderer over them.
//
// ── This module must never reference a reviewer ─────────────────────────────
// It feeds the component the SUBJECT renders. `ComparisonRow.peerBreakdown` is
// deliberately not consumed anywhere in this file.
import type { ComparisonRow, FeedbackKind } from '@/services/appraisal.service';

export type ScoreCell =
  /** This question was never asked of this reviewer kind. */
  | { kind: 'notAsked' }
  /** Asked, but no submitted rating. An em dash — NEVER a zero-width bar. */
  | { kind: 'dash' }
  /**
   * Rated. `pct` is null when the question carries no usable `scaleMax`: a
   * scale is never defaulted to 5, so the renderer shows the bare number
   * rather than a bar drawn against an invented denominator.
   */
  | { kind: 'bar'; value: number; pct: number | null };

export type PeerCell =
  | { kind: 'notAsked' }
  /** Asked of peers, and none of them rated it. */
  | { kind: 'none' }
  /**
   * Withheld under the server's small-N gate (`PEER_RELEASE_MIN`). Renders an
   * explanatory line and NO number — with one respondent the "mean" IS that
   * person's score, and the subject can usually name them.
   */
  | { kind: 'single'; n: number }
  | { kind: 'mean'; mean: number; n: number; pct: number | null };

/**
 * Percentage width for a rating on its own question's scale. Null whenever
 * there is nothing honest to draw. Means are never rescaled across questions:
 * 4/5 and 9/10 are arithmetic on two different units.
 */
export function barPercent(
  value: number | null,
  scaleMax: number | null
): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (scaleMax === null || !Number.isFinite(scaleMax) || scaleMax <= 0)
    return null;
  return Math.max(0, Math.min(100, (value / scaleMax) * 100));
}

function asked(row: ComparisonRow, kind: FeedbackKind): boolean {
  // An empty/absent askOf means the server could not say — treat every bucket
  // as asked in that case, so a data gap degrades to the old behaviour (an
  // empty bar) rather than silently hiding a real score.
  if (!Array.isArray(row.askOf) || row.askOf.length === 0) return true;
  return row.askOf.includes(kind);
}

/** The self / manager column for one question. */
export function scoreCell(
  row: ComparisonRow,
  kind: 'self' | 'manager'
): ScoreCell {
  if (!asked(row, kind)) return { kind: 'notAsked' };
  const value = row[kind];
  // `null` only. A rating of 0 is a real answer somebody gave and is rendered
  // as such — which is exactly why this is not a falsy check.
  if (value === null || !Number.isFinite(value)) return { kind: 'dash' };
  return { kind: 'bar', value, pct: barPercent(value, row.scaleMax) };
}

/** The peer column for one question. */
export function peerCell(row: ComparisonRow): PeerCell {
  if (!asked(row, 'peer')) return { kind: 'notAsked' };
  const { mean, n, suppressed } = row.peer;
  // `suppressed` is checked BEFORE `mean`, so a server that ever sent both a
  // mean and suppressed:true still withholds the number here. The gate is the
  // flag, not the absence of data.
  if (suppressed) return n === 0 ? { kind: 'none' } : { kind: 'single', n };
  if (mean === null || !Number.isFinite(mean)) return { kind: 'none' };
  return { kind: 'mean', mean, n, pct: barPercent(mean, row.scaleMax) };
}
