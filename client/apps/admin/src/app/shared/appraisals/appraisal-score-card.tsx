'use client';

import { PiSealCheck, PiHourglassMedium, PiInfo } from 'react-icons/pi';
import type {
  AppraisalRelation,
  AppraisalScore,
} from '@/services/appraisal.service';
import { scoreCard } from './score-presenter';

/**
 * The appraisal's final mark.
 *
 * A thin renderer over score-presenter.ts, which owns every decision that can
 * actually be wrong — most of all that an unsubmitted assessment is "not
 * scored yet" and not 0%. Nothing here re-derives a number from `score`; if
 * you find yourself doing arithmetic in this file, it belongs in the presenter
 * where it can be tested.
 */
export default function AppraisalScoreCard({
  score,
  relation,
}: {
  score?: AppraisalScore;
  /**
   * Taken as the viewer's relation rather than the whole `access` object: the
   * subject's view is a separate component precisely so it holds no access
   * flags to read, and one string is all the presenter's gate needs.
   */
  relation?: AppraisalRelation;
}) {
  const card = scoreCard(score, relation ? { relation } : undefined);
  if (card.kind === 'hidden') return null;

  if (card.kind === 'pending') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-5">
        <PiHourglassMedium className="h-5 w-5 shrink-0 text-gray-300" />
        <div>
          <p className="text-sm font-semibold text-gray-600">Not scored yet</p>
          <p className="text-xs text-gray-400">
            The mark appears once the manager submits their assessment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <PiSealCheck className="h-4 w-4 text-emerald-600" />
        Final score
      </p>
      <div className="mt-3 flex items-baseline gap-2.5">
        <span className="text-3xl font-bold tabular-nums text-gray-900">
          {card.pctLabel}
        </span>
        <span className="text-sm tabular-nums text-gray-500">
          {card.pointsLabel} points
        </span>
      </div>
      {/* Stated whenever the manager left anything unscored. Without it the
          percentage reads as a mark on the whole form, when it is a mark on
          the part that was assessed — the skipped criteria are in neither
          side of the fraction. */}
      {card.coverage && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <PiInfo className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          {card.coverage} — this mark is out of {card.possible}, not out of 100.
        </p>
      )}
    </div>
  );
}
