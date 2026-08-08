'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Button,
  Input,
  Modal,
  MultiSelect,
  Text,
  Textarea,
  Title,
} from 'rizzui';
import {
  PiCheckCircle,
  PiChatCircleText,
  PiFlagBannerFold,
  PiStar,
  PiTrash,
  PiUserCircle,
  PiUsersThree,
  PiWarningCircle,
} from 'react-icons/pi';
import {
  ApiError,
  backfillPeers,
  getEligiblePeers,
  releaseAppraisal,
  saveSummary,
  type Appraisal,
  type AppraisalAccess,
  type AppraisalFeedback,
  type AppraisalSection,
  type ComparisonRow,
  type PersonRef,
} from '@/services/appraisal.service';
import {
  QUESTION_GONE_LABEL,
  ReviewerCard,
  SideBySideComparison,
  buildQuestionIndex,
  personName,
} from './appraisal-answer-views';
import { askedQuestionIds } from './cycle-detail-utils';
import { useUnsavedChangesGuard } from './use-unsaved-changes-guard';
import AppraisalStateBadge from './state-badge';
import AppraisalPeerApproval from './appraisal-peer-approval';
import AppraisalComparison from './appraisal-comparison';
// Named per-peer ratings. Imported HERE and nowhere else — the manager and HR
// see reviewer names, the employee never does, and that is enforced by which
// view imports this file rather than by a conditional inside it.
import AppraisalPeerBreakdown from './appraisal-peer-breakdown';

/** Inclusive bounds of the final rating, matching the input's min/max. */
const RATING_MIN = 0;
const RATING_MAX = 10;

/**
 * Mirrors MAX_COMMITMENTS in server/services/appraisal.helpers.js. Kept as a
 * literal rather than imported — this bundle does not import from the server —
 * so the two must be changed together; the server is the one that enforces it.
 */
const MAX_COMMITMENTS = 8;

/**
 * Validate the final-rating box.
 *
 * Blank is legal — a summary may be released without a score, and the report's
 * histogram is explicitly captioned "N released, M scored" for exactly that
 * case. Anything else must be a real number inside the bounds: `Number('')` is
 * 0 and `Number('abc')` is NaN, and NaN serialises to `null` over JSON, so an
 * unvalidated box silently sent "no rating" for a typo instead of saying so.
 */
export function parseFinalRating(
  raw: string
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: undefined };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'The final rating must be a number.' };
  }
  if (value < RATING_MIN || value > RATING_MAX) {
    return {
      ok: false,
      error: `The final rating must be between ${RATING_MIN} and ${RATING_MAX}.`,
    };
  }
  return { ok: true, value };
}

/** Fingerprint of the editable summary fields, for the unsaved-work guard. */
function savedSignatureOf(
  summary: string,
  finalRating: string,
  commitments: string[]
): string {
  // Blank rows are excluded so an empty "add another" line the manager never
  // typed into does not read as unsaved work and block release behind a save
  // that would change nothing.
  return JSON.stringify([
    summary,
    finalRating.trim(),
    commitments.map((c) => c.trim()).filter(Boolean),
  ]);
}

/** Rows the server would keep — see normaliseCommitments on the server. */
function meaningfulCommitments(rows: string[]): { text: string }[] {
  return rows
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

export default function AppraisalManagerView({
  appraisal,
  feedback,
  // Optional, defaulting to empty: appraisal-detail.tsx does thread the
  // `sections` field that `fetchAppraisal` returns through to this component,
  // but the default keeps this component safe against any other caller that
  // doesn't — every answer falls back to QUESTION_GONE_LABEL via
  // buildQuestionIndex rather than this component crashing on a missing prop.
  sections = [],
  access,
  // Carries a populated `peerBreakdown` only when the server judged this
  // viewer allowed to see reviewer names (`canSeeReviewerNames === true`);
  // otherwise every row's is `null` and AppraisalPeerBreakdown renders
  // nothing. Defaulted to empty for the same reason `sections` is.
  comparison = [],
  onUpdate,
  onRefresh,
}: {
  appraisal: Appraisal;
  feedback: AppraisalFeedback[];
  sections?: AppraisalSection[];
  access: AppraisalAccess;
  comparison?: ComparisonRow[];
  onUpdate: (appraisal: Appraisal) => void;
  /**
   * Re-fetches the whole detail payload (appraisal + feedback + access) —
   * see appraisal-detail.tsx#refresh. Passed through to AppraisalPeerApproval
   * as `onDone`, and called directly after a successful backfill, because
   * both approvePeers and backfillPeers change `access` (state moves) and
   * `feedback` (new peer rows appear) in ways `onUpdate` alone cannot patch.
   */
  onRefresh: () => void | Promise<void>;
}) {
  const [summary, setSummary] = useState(appraisal.summary ?? '');
  const [finalRating, setFinalRating] = useState(
    typeof appraisal.finalRating === 'number'
      ? String(appraisal.finalRating)
      : ''
  );
  /**
   * What the server holds, so navigating away with an unsaved summary asks
   * first. A manager's summary is the longest single piece of prose anyone
   * types in this module and it had no protection at all.
   */
  /**
   * The actions agreed for the next period. At least one is required to
   * release — see the server's NO_COMMITMENTS_AGREED. Seeded with one empty
   * row on a fresh appraisal so the field reads as something to fill in rather
   * than an empty area with an "add" button the manager has to discover.
   */
  const [commitments, setCommitments] = useState<string[]>(() => {
    const stored = (appraisal.commitments ?? []).map((c) => c.text);
    return stored.length > 0 ? stored : [''];
  });
  const [savedSignature, setSavedSignature] = useState(() =>
    savedSignatureOf(
      appraisal.summary ?? '',
      typeof appraisal.finalRating === 'number'
        ? String(appraisal.finalRating)
        : '',
      (appraisal.commitments ?? []).map((c) => c.text)
    )
  );
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  // Set only when releaseAppraisal rejects with code === 'LOW_PEER_RESPONSE_COUNT'
  // — any other 400 (or any other error) is surfaced as a plain toast instead,
  // never through this dialog. See handleRelease.
  const [releaseConfirm, setReleaseConfirm] = useState<{
    approvedPeerCount: number;
    submittedPeerCount: number;
    threshold: number;
  } | null>(null);

  const [backfillSelected, setBackfillSelected] = useState<string[]>([]);
  const [backfillOptionPeople, setBackfillOptionPeople] = useState<PersonRef[]>(
    []
  );
  const [loadingBackfillPeers, setLoadingBackfillPeers] = useState(false);
  const [backfillSubmitting, setBackfillSubmitting] = useState(false);

  const selfFeedback = feedback.find((f) => f.kind === 'self');
  const managerFeedback = feedback.find((f) => f.kind === 'manager');
  // 'submitted' only: once access.canBackfillPeers admits declined rows into
  // `feedback` too (see appraisal.controller.js#getAppraisal), this section
  // must not render an empty ReviewerCard for a peer who never answered.
  const peerFeedback = feedback.filter(
    (f) => f.kind === 'peer' && f.status === 'submitted'
  );
  // A declined row is distinct from an expired one — that distinction is the
  // whole point of the decline feature (a manager who can tell "refused"
  // from "went quiet" can backfill a replacement in time). Only 'declined'
  // gates backfill, never 'expired'.
  const declinedPeerFeedback = feedback.filter(
    (f) => f.kind === 'peer' && f.status === 'declined'
  );
  const showBackfill =
    access.canBackfillPeers && declinedPeerFeedback.length > 0;

  // Already-approved/rejected/proposed peers should not also appear as a
  // backfill "replacement" option — re-adding one is a silent no-op on the
  // server (planPeerRowCreation skips ids already in reviewerIds) rather
  // than an error, so hiding them here avoids a control that looks like it
  // did something but didn't.
  const alreadyNominatedIds = useMemo(
    () => new Set((appraisal.peerNominations ?? []).map((n) => n.user)),
    [appraisal.peerNominations]
  );
  const backfillOptions = backfillOptionPeople
    .filter((p) => !alreadyNominatedIds.has(p._id))
    .map((p) => ({
      label: p.employeeProfile?.work?.jobTitle
        ? `${p.firstName ?? ''} ${p.lastName ?? ''} — ${p.employeeProfile.work.jobTitle}`.trim()
        : `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() ||
          p.email ||
          'Unknown',
      value: p._id,
    }));

  useEffect(() => {
    if (!showBackfill) return;
    let cancelled = false;
    (async () => {
      setLoadingBackfillPeers(true);
      try {
        const eligible = await getEligiblePeers(appraisal._id);
        if (!cancelled) setBackfillOptionPeople(eligible);
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : 'Could not load eligible peers'
          );
        }
      } finally {
        if (!cancelled) setLoadingBackfillPeers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showBackfill, appraisal._id]);

  async function handleBackfillSubmit() {
    if (backfillSelected.length === 0) return;
    setBackfillSubmitting(true);
    try {
      await backfillPeers(appraisal._id, backfillSelected);
      toast.success('Replacement peer added');
      setBackfillSelected([]);
      await onRefresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not add a replacement peer'
      );
    } finally {
      setBackfillSubmitting(false);
    }
  }

  const questions = useMemo(() => buildQuestionIndex(sections), [sections]);
  // Template order, not ObjectId order — sorting by id scrambles a form HR
  // sequenced deliberately. See askedQuestionIds.
  const comparisonIds = useMemo(
    () => askedQuestionIds(selfFeedback, managerFeedback, sections),
    [selfFeedback, managerFeedback, sections]
  );

  // `access.canSummarise` is false once the appraisal is
  // released/acknowledged/cancelled (see resolveAppraisalAccess) — the editor
  // goes read-only in those states instead of letting a save 403 server-side.
  const readOnly = !access.canSummarise;
  const summaryEmpty = !summary.trim();
  const ratingCheck = parseFinalRating(finalRating);
  const agreedActions = meaningfulCommitments(commitments);
  const isDirty =
    savedSignatureOf(summary, finalRating, commitments) !== savedSignature;
  const releaseDisabledReason = !access.canRelease
    ? 'This appraisal is not ready to release yet.'
    : summaryEmpty
      ? 'Write a summary before releasing.'
      : agreedActions.length === 0
        ? // Mirrors the server's NO_COMMITMENTS_AGREED rather than relying on
          // it: the manager should see why the button is dead before they
          // click it, not after a round trip.
          'Agree at least one action for the next period before releasing.'
        : !ratingCheck.ok
          ? ratingCheck.error
          : // Release sends nothing but the id — it publishes whatever the server
            // already holds. So releasing on top of unsaved edits shows the
            // employee the PREVIOUS summary while this screen displays the new
            // one, and nobody finds out. Saving first is the only honest order.
            isDirty
            ? 'Save your changes before releasing.'
            : null;

  useUnsavedChangesGuard(
    !readOnly && !saving && isDirty,
    'This summary has unsaved changes. Leave without saving?'
  );

  async function handleSave() {
    const parsed = parseFinalRating(finalRating);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    setSaving(true);
    const sending = savedSignatureOf(summary, finalRating, commitments);
    try {
      const updated = await saveSummary(
        appraisal._id,
        summary,
        parsed.value,
        agreedActions
      );
      onUpdate(updated);
      setSavedSignature(sending);
      toast.success('Summary saved');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not save the summary'
      );
    } finally {
      setSaving(false);
    }
  }

  /**
   * `confirmed` is only ever true when re-called from the LOW_PEER_RESPONSE_COUNT
   * dialog below. On the first attempt this rejects with plain HTTP 400s for
   * ordinary validation failures too (e.g. "write a summary first" — though
   * the button is already disabled for that case) — only a body carrying
   * `code === 'LOW_PEER_RESPONSE_COUNT'` opens the dialog; every other error,
   * 400 or otherwise, is a plain toast. Checking the code rather than the
   * status is deliberate: treating every 400 as the gate would let a real
   * validation failure be "confirmed" past instead of surfaced.
   */
  async function handleRelease(confirmed = false) {
    setReleasing(true);
    try {
      // Sent explicitly rather than relying on the server's fallback to what
      // saveSummary stored: release is blocked while `isDirty`, so these match
      // what is persisted, and sending them keeps the request self-describing.
      const updated = await releaseAppraisal(
        appraisal._id,
        confirmed,
        agreedActions
      );
      onUpdate(updated);
      setReleaseConfirm(null);
      toast.success('Released to employee');
      // The release changed `appraisal.state` to 'released', which also
      // changes access.canRelease/canSummarise — onUpdate above only patches
      // the appraisal object, so a full refresh keeps the read-only banner
      // and buttons in sync with the state that was just reached, rather
      // than leaving this screen showing the stale pre-release access.
      await onRefresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'LOW_PEER_RESPONSE_COUNT') {
        setReleaseConfirm({
          approvedPeerCount: e.approvedPeerCount ?? 0,
          submittedPeerCount: e.submittedPeerCount ?? 0,
          threshold: e.threshold ?? 0,
        });
      } else {
        toast.error(
          e instanceof Error ? e.message : 'Could not release this appraisal'
        );
      }
    } finally {
      setReleasing(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Title as="h1" className="text-xl font-semibold text-gray-900">
            {personName(appraisal.employee)} —{' '}
            {appraisal.cycle?.name || 'Appraisal'}
          </Title>
          <AppraisalStateBadge state={appraisal.state} />
        </div>
      </div>

      {access.canApprovePeers && (
        <AppraisalPeerApproval
          appraisalId={appraisal._id}
          nominations={appraisal.peerNominations ?? []}
          onDone={onRefresh}
        />
      )}

      {showBackfill && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <PiUsersThree className="h-4 w-4" />
            Replace a declined peer reviewer
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {declinedPeerFeedback.map((f) => (
              <p
                key={f._id}
                className="flex items-center gap-1.5 text-sm text-amber-900"
              >
                <PiUserCircle className="h-4 w-4 shrink-0 text-amber-500" />
                {personName(f.reviewer)} declined to review this appraisal.
              </p>
            ))}
          </div>
          <div className="mt-4">
            <MultiSelect
              label="Add a replacement"
              options={backfillOptions}
              value={backfillSelected}
              onChange={setBackfillSelected}
              searchable
              clearable
              placeholder="Search for colleagues…"
              disabled={backfillSubmitting || loadingBackfillPeers}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleBackfillSubmit}
              disabled={backfillSubmitting || backfillSelected.length === 0}
              className="bg-[#b20202] hover:bg-[#9f0101]"
            >
              {backfillSubmitting ? 'Adding…' : 'Add replacement'}
            </Button>
          </div>
        </div>
      )}

      {/* Complements the self-vs-manager table below rather than replacing it:
          this one is rating questions only, adds the peer dimension, and
          scales each question against its own scaleMax; that one shows every
          answer verbatim, including the text ones a mean cannot represent. */}
      <AppraisalComparison rows={comparison} />

      <AppraisalPeerBreakdown rows={comparison} />

      {comparisonIds.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Self vs. manager
          </h2>
          <SideBySideComparison
            questionIds={comparisonIds}
            questions={questions}
            self={selfFeedback}
            manager={managerFeedback}
          />
        </div>
      )}

      {peerFeedback.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700">Peer feedback</h2>
          {peerFeedback.map((f) => (
            <ReviewerCard key={f._id} feedback={f} questions={questions} />
          ))}
        </div>
      )}

      {feedback.length === 0 && (
        <p className="text-sm text-gray-400">
          No feedback has been submitted yet.
        </p>
      )}

      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <PiChatCircleText className="h-4 w-4 text-[#b20202]" />
          Summary
        </p>
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={6}
          placeholder="Write the overall summary for this appraisal…"
          className="mt-2"
          disabled={readOnly}
        />
        {/* Agreed actions.
            Sits inside the summary card, above the rating, because it is part
            of writing the review rather than an afterthought bolted onto the
            release dialog — and because the manager should be drafting these
            while the peer input is still in front of them. */}
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <PiFlagBannerFold className="h-4 w-4 text-indigo-600" />
            Agreed actions for the next period
            <span className="text-[#b20202]" aria-hidden="true">
              *
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            At least one is required. These open the next review for{' '}
            {personName(appraisal.employee)}, which is what makes them worth
            writing.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {commitments.map((text, i) => (
              // Index-keyed: rows are positional, and a text-keyed list would
              // remount the input the manager is typing into on every keystroke.
              <div key={i} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold tabular-nums text-indigo-700"
                >
                  {i + 1}
                </span>
                <Input
                  value={text}
                  onChange={(e) =>
                    setCommitments((prev) =>
                      prev.map((c, j) => (j === i ? e.target.value : c))
                    )
                  }
                  maxLength={500}
                  placeholder="e.g. Lead two supplier tastings this quarter"
                  disabled={readOnly}
                  className="flex-1"
                  aria-label={`Agreed action ${i + 1}`}
                />
                {!readOnly && commitments.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCommitments((prev) => prev.filter((_, j) => j !== i))
                    }
                    aria-label={`Remove agreed action ${i + 1}`}
                    className="mt-2 shrink-0 text-gray-300 transition-colors hover:text-[#b20202]"
                  >
                    <PiTrash className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!readOnly && commitments.length < MAX_COMMITMENTS && (
            <button
              type="button"
              onClick={() => setCommitments((prev) => [...prev, ''])}
              className="mt-2.5 text-xs font-semibold text-[#b20202] underline decoration-[#b20202]/30 underline-offset-2 transition-colors hover:decoration-[#b20202]"
            >
              + Add another
            </button>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <PiStar className="h-4 w-4 shrink-0 text-amber-500" />
          <Input
            type="number"
            min={RATING_MIN}
            max={RATING_MAX}
            step="0.1"
            value={finalRating}
            onChange={(e) => setFinalRating(e.target.value)}
            placeholder={`Final rating (${RATING_MIN}–${RATING_MAX})`}
            disabled={readOnly}
            aria-invalid={!ratingCheck.ok}
            error={ratingCheck.ok ? undefined : ratingCheck.error}
            className="w-full max-w-[12rem]"
          />
        </div>
        {/* `min`/`max` on a number input are advisory — the browser will not
            block a typed value, and this form has no submit event for its
            constraint validation to run on. */}
        <p className="mt-1.5 text-xs text-gray-400">
          Optional. Leave blank to release without a score.
        </p>

        {readOnly ? (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
            <PiCheckCircle className="h-3.5 w-3.5" />
            This appraisal is {appraisal.state} and can no longer be edited.
          </p>
        ) : (
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-4">
            {releaseDisabledReason && (
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <PiWarningCircle className="h-3.5 w-3.5" />
                {releaseDisabledReason}
              </p>
            )}
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              onClick={() => handleRelease(false)}
              disabled={releasing || Boolean(releaseDisabledReason)}
              className="bg-[#b20202] hover:bg-[#9f0101]"
            >
              {releasing ? 'Releasing…' : 'Release to employee'}
            </Button>
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(releaseConfirm)}
        onClose={() => setReleaseConfirm(null)}
        size="sm"
      >
        <div className="p-6">
          <Title as="h3" className="text-base font-semibold text-gray-900">
            Release on thin peer input?
          </Title>
          <Text className="mt-2 text-sm text-gray-500">
            This summary rests on {releaseConfirm?.submittedPeerCount ?? 0} of{' '}
            {releaseConfirm?.approvedPeerCount ?? 0} approved peer{' '}
            {releaseConfirm?.approvedPeerCount === 1 ? 'response' : 'responses'}{' '}
            submitted so far — below the usual bar of{' '}
            {releaseConfirm?.threshold ?? 0} submitted{' '}
            {releaseConfirm?.threshold === 1 ? 'response' : 'responses'}. You
            can release it anyway, or wait for more responses first.
          </Text>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setReleaseConfirm(null)}
              disabled={releasing}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleRelease(true)}
              disabled={releasing}
              className="bg-[#b20202] hover:bg-[#9f0101]"
            >
              {releasing ? 'Releasing…' : 'Release anyway'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
