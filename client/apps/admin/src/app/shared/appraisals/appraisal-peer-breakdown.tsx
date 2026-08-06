// shared/appraisals/appraisal-peer-breakdown.tsx — named per-peer ratings.
//
// ── MANAGER / HR ONLY. NEVER IMPORT THIS FROM THE SUBJECT'S VIEW ────────────
//
// The module's privacy asymmetry is deliberate and the user's explicit choice:
// the manager and HR see peer reviewer names, the employee never does. Peers
// are told exactly that before they write, by the disclosure banner in
// reviewer-form.tsx — so if this policy ever changes, that banner changes in
// the same edit.
//
// The server is the actual gate: `buildComparison` populates `peerBreakdown`
// only when `access.canSeeReviewerNames === true` (strict `===`, so truthy
// junk fails closed), and sends `null` — never `[]` — to everyone else,
// because an empty array reads as "no peers responded", a different fact. This
// component therefore has nothing to render for the subject even if it were
// mounted there by mistake. That is defence in depth, not the guarantee: the
// guarantee is that appraisal-subject-view.tsx does not import this file.

import type { ComparisonRow } from '@/services/appraisal.service';
import { personName } from './my-appraisals-utils';

export default function AppraisalPeerBreakdown({
  rows,
}: {
  rows: ComparisonRow[];
}) {
  // `null` (may not see names) and `[]` (may, but nobody rated it) both mean
  // there is no table to draw for that question.
  const withNames = (rows || []).filter(
    (row) => row.peerBreakdown !== null && row.peerBreakdown.length > 0
  );
  if (withNames.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <p className="text-sm font-semibold text-gray-900">
        Peer ratings by reviewer
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Visible to you and HR only — the employee sees the peer average, never
        who gave which score.
      </p>

      <div className="mt-3 flex flex-col gap-4">
        {withNames.map((row) => (
          <div key={String(row.questionId)}>
            <p className="text-sm font-medium text-gray-800">
              {row.label || 'Untitled question'}
            </p>
            {row.sectionTitle && (
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">
                {row.sectionTitle}
              </p>
            )}
            <table className="mt-2 w-full text-left">
              <tbody className="divide-y divide-gray-50">
                {(row.peerBreakdown || []).map((entry, i) => (
                  <tr key={`${entry.reviewer?._id ?? 'unknown'}-${i}`}>
                    <td className="py-1.5 text-sm text-gray-700">
                      {personName(entry.reviewer)}
                    </td>
                    <td className="py-1.5 text-right text-sm font-semibold text-gray-900">
                      {entry.rating}
                      {row.scaleMax === null ? '' : ` / ${row.scaleMax}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
