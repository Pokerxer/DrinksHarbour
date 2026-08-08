'use client';

import { PiFlagBannerFold } from 'react-icons/pi';
import type { PriorCommitments } from '@/services/appraisal.service';

/**
 * What this person agreed to last cycle, shown at the top of the next one.
 *
 * This is the half of the commitments feature that makes the other half worth
 * anything. Writing agreed actions at release costs the manager two minutes
 * and changes nothing on its own — the document is filed and the next review
 * starts from a blank form. Replaying them here is what closes the loop: the
 * self-assessment opens on "here is what you said you would do", so the review
 * is a conversation about a period rather than an impression of one.
 *
 * Rendered on self and manager forms only. The server returns null for peers —
 * what a colleague agreed privately with their manager is not peer business —
 * so there is no kind check here; the absence of data IS the rule.
 */
export default function PriorCommitmentsBanner({
  prior,
}: {
  prior: PriorCommitments | null;
}) {
  if (!prior || prior.commitments.length === 0) return null;

  const when = prior.releasedAt
    ? new Date(prior.releasedAt).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <section
      aria-labelledby="prior-commitments-heading"
      className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 via-indigo-50/70 to-sky-50/40 p-5"
    >
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-indigo-100/40 blur-xl" />

      <div className="relative flex items-start gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
          <PiFlagBannerFold className="h-4.5 w-4.5 text-indigo-700" />
        </div>

        <div className="min-w-0 flex-1">
          <h2
            id="prior-commitments-heading"
            className="text-sm font-semibold text-indigo-900"
          >
            Agreed last time
          </h2>
          <p className="mt-0.5 text-[13px] text-indigo-700/80">
            {prior.cycleName ? (
              <>
                From <span className="font-medium">{prior.cycleName}</span>
                {when ? `, ${when}` : ''}. Worth reflecting on before you
                answer.
              </>
            ) : (
              <>
                From the last completed review. Worth reflecting on before you
                answer.
              </>
            )}
          </p>

          <ol className="mt-3 flex flex-col gap-2">
            {prior.commitments.map((c, i) => (
              // Index keys are safe here: the list is read-only, never
              // reordered, and has no stable id of its own.
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-xl bg-white/70 px-3.5 py-2.5"
              >
                <span
                  aria-hidden="true"
                  className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold tabular-nums text-indigo-700"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-gray-700">
                  {c.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
