'use client';

// shared/appraisals/cycle-employee-drawer.tsx — one employee's scores and
// responses, opened by clicking their row in the cycle roster.
//
// ── HR-ONLY, BY MOUNT POINT ─────────────────────────────────────────────────
//
// Renders reviewer NAMES (ReviewerCard, AppraisalPeerBreakdown). It is mounted
// only from cycle-roster.tsx, which is itself HR-only by mount point, and the
// data it renders comes from `GET /api/appraisals/:id` — which projects the
// payload per viewer, so an HR user gets peer rows with reviewers attached and
// the subject would not. Do not mount this anywhere an employee can reach.
//
// READ-ONLY on purpose. Writing the summary, releasing, approving peers and
// backfilling all still live on /appraisals/[id] (AppraisalManagerView). This
// is the "let me look at where this person got to" surface: HR scanning a
// roster of forty wants to read one, not to be one click away from releasing
// it by accident. Every path out of here is an explicit link.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Drawer } from 'rizzui';
import {
  PiArrowClockwise,
  PiArrowSquareOut,
  PiChatCircleText,
  PiStar,
  PiWarningCircle,
  PiX,
} from 'react-icons/pi';
import {
  fetchAppraisal,
  type Appraisal,
  type AppraisalFeedback,
  type AppraisalQuestion,
  type AppraisalSection,
  type ComparisonRow,
} from '@/services/appraisal.service';
import AppraisalStateBadge from './state-badge';
import AppraisalComparison from './appraisal-comparison';
import AppraisalPeerBreakdown from './appraisal-peer-breakdown';
import {
  ReviewerCard,
  SideBySideComparison,
  buildQuestionIndex,
  personName,
} from './appraisal-answer-views';
import { askedQuestionIds } from './cycle-detail-utils';

interface DrawerData {
  appraisal: Appraisal;
  feedback: AppraisalFeedback[];
  sections: AppraisalSection[];
  comparison: ComparisonRow[];
  approvedPeerCount: number;
  peerResponseCount: number;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
      <div className="h-20 animate-pulse rounded-xl bg-gray-50" />
      <div className="h-44 animate-pulse rounded-xl bg-gray-50" />
      <div className="h-44 animate-pulse rounded-xl bg-gray-50" />
    </div>
  );
}

export default function CycleEmployeeDrawer({
  appraisalId,
  employeeLabel,
  onClose,
}: {
  /** `null` closes the drawer. The id doubles as the open/closed signal. */
  appraisalId: string | null;
  /**
   * The name already on the roster row, shown in the header while the fetch is
   * in flight. Without it the drawer opens onto an anonymous spinner and HR
   * cannot tell whether they clicked the row they meant to.
   */
  employeeLabel: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DrawerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Bumped by "Try again". Retrying through the same effect as the initial
   * load — rather than a second fetch helper beside it — means the
   * cancelled-guard and the clear-first rule below cover the retry too,
   * instead of being one copy that has them and one that does not.
   */
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!appraisalId) return;
    // Cleared on every id change, not merged: showing the previous employee's
    // answers under the new employee's name for the length of a fetch is the
    // one failure mode this drawer must not have.
    setData(null);
    setError(null);
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await fetchAppraisal(appraisalId);
        if (cancelled) return;
        setData(result);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load this appraisal'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appraisalId, reloadNonce]);

  const appraisal = data?.appraisal;
  const questions: Map<string, AppraisalQuestion> = data
    ? buildQuestionIndex(data.sections)
    : new Map();
  const self = data?.feedback.find((f) => f.kind === 'self');
  const manager = data?.feedback.find((f) => f.kind === 'manager');
  // Everyone who is neither the subject nor their manager, and who actually
  // answered. A declined or expired row has no answers to render, and an empty
  // card reads as "this peer said nothing" rather than "this peer declined".
  const others = (data?.feedback ?? []).filter(
    (f) => f.kind !== 'self' && f.kind !== 'manager' && f.answers.length > 0
  );
  const declined = (data?.feedback ?? []).filter(
    (f) => f.status === 'declined'
  );

  return (
    <Drawer
      isOpen={appraisalId !== null}
      onClose={onClose}
      placement="right"
      // `full` below sm so a phone gets the whole viewport instead of a
      // 30rem panel squeezed against the edge; xl from sm up, which is where
      // the side-by-side answer grid earns its second column.
      size="xl"
      containerClassName="w-full sm:w-auto"
    >
      <div className="flex h-full flex-col bg-gray-50/60">
        {/* Sticky header: the roster this was opened from can be 50 rows, and
            the drawer body is long. Scrolling to the bottom of one person's
            peer feedback must not cost HR the way back out. */}
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-gray-900">
                {appraisal ? personName(appraisal.employee) : employeeLabel}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {appraisal && <AppraisalStateBadge state={appraisal.state} />}
                {appraisal?.manager && (
                  <span className="text-xs text-gray-400">
                    Manager: {personName(appraisal.manager)}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-me-1 shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <PiX className="h-4 w-4" />
            </button>
          </div>

          {appraisalId && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={`/appraisals/${appraisalId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#b20202]/30 bg-[#b20202]/[0.04] px-2.5 py-1 text-xs font-semibold text-[#b20202] transition-colors hover:bg-[#b20202]/[0.08]"
              >
                <PiArrowSquareOut className="h-3.5 w-3.5" />
                Open full appraisal
              </Link>
              <span className="text-[11px] text-gray-400">
                Writing the summary and releasing happen there.
              </span>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading && !data ? (
            <DrawerSkeleton />
          ) : error ? (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-gray-100 bg-white p-5">
              <p className="flex items-center gap-1.5 text-sm text-gray-500">
                <PiWarningCircle className="h-4 w-4 shrink-0 text-gray-400" />
                {error}
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => setReloadNonce((n) => n + 1)}
              >
                <PiArrowClockwise className="me-1.5 h-3.5 w-3.5" />
                Try again
              </Button>
            </div>
          ) : data && appraisal ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                  label="Self"
                  value={self?.status === 'submitted' ? 'Submitted' : 'Waiting'}
                />
                <Stat
                  label="Manager"
                  value={
                    manager?.status === 'submitted' ? 'Submitted' : 'Waiting'
                  }
                />
                <Stat
                  label="Peers"
                  value={`${data.peerResponseCount} / ${data.approvedPeerCount}`}
                />
                <Stat
                  label="Final rating"
                  value={
                    typeof appraisal.finalRating === 'number'
                      ? `${appraisal.finalRating} / 10`
                      : 'Not set'
                  }
                />
              </div>

              {/* Released outcome first: when it exists it is the answer to
                  "what happened to this person", and everything below is the
                  working that produced it. */}
              {appraisal.summary && (
                <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <PiChatCircleText className="h-4 w-4 text-gray-400" />
                    Manager&rsquo;s summary
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                    {appraisal.summary}
                  </p>
                </div>
              )}

              {appraisal.commitments && appraisal.commitments.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <PiStar className="h-4 w-4 text-gray-400" />
                    Agreed for next period
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {appraisal.commitments.map((c, i) => (
                      <li
                        key={`${c.text}-${i}`}
                        className="flex gap-2 text-sm text-gray-700"
                      >
                        <span className="text-gray-300">{i + 1}.</span>
                        <span className="min-w-0">{c.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Scores. Returns null on a form with no rating questions, so
                  an all-text template shows responses only rather than an
                  empty "Ratings" card. */}
              <AppraisalComparison rows={data.comparison} />
              <AppraisalPeerBreakdown rows={data.comparison} />

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900">
                  Responses
                </p>
                {self || manager ? (
                  <SideBySideComparison
                    questionIds={askedQuestionIds(self, manager, data.sections)}
                    questions={questions}
                    self={self}
                    manager={manager}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center">
                    <p className="text-sm text-gray-400">
                      Neither the employee nor their manager has submitted yet.
                    </p>
                  </div>
                )}
              </div>

              {others.length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-gray-900">
                    Peer feedback
                  </p>
                  {others.map((f) => (
                    <ReviewerCard key={f._id} feedback={f} questions={questions} />
                  ))}
                </div>
              )}

              {declined.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold text-amber-700">
                    {declined.length} reviewer
                    {declined.length === 1 ? '' : 's'} declined
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {declined.map((f) => (
                      <li key={f._id} className="text-xs text-amber-800">
                        {personName(f.reviewer)}{' '}
                        <span className="capitalize text-amber-600">
                          ({f.kind})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}
