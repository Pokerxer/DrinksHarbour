'use client';

// The owner's read of employee-authored standing feedback (Phase 5 §9.5).
//
// ── Mounted behind a role check, and that is NOT the boundary ──────────────
// This module has already shipped a fix for an HR-only tab leak caused by a
// panel that was safe only because of where it was mounted. So the server
// gates GET /api/appraisal-feedback/standing at the route (tenant_owner +
// super_admin) AND re-checks the role inside the controller. The
// `canReadStandingFeedback` call in cycle-detail.tsx exists so a tenant_admin
// is not shown a section that would only 403 — it is chrome, not security.
//
// Feedback is ATTRIBUTED, by design. It is written about third parties and
// read by one person; an unattributed report on a named colleague is a rumour,
// and the author was told their name would be on it before they wrote it.

import { useEffect, useState } from 'react';
import { PiLifebuoy, PiThumbsUp, PiUsersThree } from 'react-icons/pi';
import {
  fetchStandingFeedback,
  STANDING_LABELS,
  type PersonRef,
  type StandingReport,
} from '@/services/appraisal.service';

const personName = (p: PersonRef | undefined) =>
  [p?.firstName, p?.lastName].filter(Boolean).join(' ') ||
  p?.email ||
  'Unknown';

export default function CycleStandingFeedback({
  cycleId,
}: {
  cycleId: string;
}) {
  const [rows, setRows] = useState<StandingReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchStandingFeedback(cycleId);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load standing feedback.'
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cycleId]);

  if (error) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }
  if (!rows) return null;

  const entryCount = rows.reduce((n, r) => n + (r.entries?.length || 0), 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
          <PiUsersThree className="h-4.5 w-4.5 text-gray-500" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            Team standing feedback
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Written by employees about colleagues in their own department, as an
            optional step on their self-assessment. Visible to you only — never
            to the person written about, their manager, or HR — and never part
            of anyone’s appraisal.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">
          Nobody has flagged a colleague in this cycle. That is a normal result:
          the step is optional and saying nothing is a legitimate answer.
        </p>
      ) : (
        <>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            {rows.length} {rows.length === 1 ? 'author' : 'authors'} ·{' '}
            {entryCount} {entryCount === 1 ? 'colleague' : 'colleagues'} flagged
          </p>
          <div className="mt-2 flex flex-col gap-3">
            {rows.map((report) => (
              <div
                key={report._id}
                className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3"
              >
                <p className="text-xs font-semibold text-gray-700">
                  {personName(report.author)}
                  {report.department?.name ? (
                    <span className="ms-1.5 font-normal text-gray-400">
                      · {report.department.name}
                    </span>
                  ) : null}
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {(report.entries || []).map((entry, i) => {
                    const good = entry.standing === 'doing_well';
                    return (
                      <div
                        key={`${report._id}-${i}`}
                        className="rounded-lg bg-white px-3 py-2 ring-1 ring-inset ring-gray-100"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">
                            {personName(entry.subject)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                              good
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                                : 'bg-amber-50 text-amber-700 ring-amber-100'
                            }`}
                          >
                            {good ? (
                              <PiThumbsUp className="h-3 w-3" />
                            ) : (
                              <PiLifebuoy className="h-3 w-3" />
                            )}
                            {STANDING_LABELS[entry.standing]}
                          </span>
                        </div>
                        {entry.note ? (
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
                            {entry.note}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
