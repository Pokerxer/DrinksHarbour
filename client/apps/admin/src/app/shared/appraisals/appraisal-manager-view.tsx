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
  PiStar,
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
  type AppraisalAnswer,
  type AppraisalFeedback,
  type AppraisalQuestion,
  type AppraisalSection,
  type ComparisonRow,
  type PersonRef,
} from '@/services/appraisal.service';
import { formatAnswer, isNumericQuestion } from './review-answer-utils';
import AppraisalStateBadge from './state-badge';
import AppraisalPeerApproval from './appraisal-peer-approval';
import AppraisalComparison from './appraisal-comparison';
// Named per-peer ratings. Imported HERE and nowhere else — the manager and HR
// see reviewer names, the employee never does, and that is enforced by which
// view imports this file rather than by a conditional inside it.
import AppraisalPeerBreakdown from './appraisal-peer-breakdown';

const QUESTION_GONE_LABEL = 'Question no longer on this form';

function personName(person?: PersonRef | null): string {
  if (!person) return 'Unknown';
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return name || person.email || 'Unknown';
}

/**
 * `GET /api/appraisals/:id` now returns the full template `sections` behind
 * the appraisal's cycle (every `askOf` kind, unfiltered — a manager
 * legitimately reads self/manager/peer answers side by side) alongside the
 * feedback rows, so each `answers[].questionId` can be resolved to its real
 * label instead of a numbered placeholder. A template can be edited after
 * feedback was submitted against it, so a `questionId` on a feedback row may
 * not exist in the current sections — that answer falls back to
 * QUESTION_GONE_LABEL rather than a blank or numbered guess.
 *
 * Indexed by the whole QUESTION, not just its label: an answer cannot be
 * rendered without knowing its question's type. `selected: ['A','B']` and
 * `rating: 0` are both invisible to a rating-or-text reader — the first falls
 * through to an em dash, the second reads as "Rating: 0" where the reviewer
 * clicked "No".
 */
function buildQuestionIndex(
  sections: AppraisalSection[]
): Map<string, AppraisalQuestion> {
  const index = new Map<string, AppraisalQuestion>();
  sections.forEach((s) => s.questions.forEach((q) => index.set(q._id, q)));
  return index;
}

function AnswerValue({
  question,
  answer,
}: {
  question: AppraisalQuestion | undefined;
  answer: AppraisalAnswer | undefined;
}) {
  if (!answer) return <p className="text-sm text-gray-300">Not answered</p>;

  // The question survives in the current template: render it by its real type.
  if (question) {
    const display = formatAnswer(question, answer);
    if (display === null) {
      return <p className="text-sm text-gray-300">Not answered</p>;
    }
    return isNumericQuestion(question) ? (
      <p className="text-sm font-medium text-gray-900">{display}</p>
    ) : (
      <p className="whitespace-pre-wrap text-sm text-gray-700">{display}</p>
    );
  }

  // The question was edited out of the template after this answer was
  // submitted (see QUESTION_GONE_LABEL). Its type is unknowable, so fall back
  // to whichever field carries data — including `selected`, which the old
  // rating-or-text fallback silently rendered as an em dash.
  if (answer.selected?.length) {
    return (
      <p className="text-sm text-gray-700">{answer.selected.join(', ')}</p>
    );
  }
  if (typeof answer.rating === 'number') {
    return (
      <p className="text-sm font-medium text-gray-900">
        Rating: {answer.rating}
      </p>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-sm text-gray-700">
      {answer.text || '—'}
    </p>
  );
}

// Self and manager answers to the same questionId are placed in one row so
// the comparison the shared id exists to enable (see AppraisalQuestion.askOf
// in the template model) is actually visible, rather than two lists a reader
// has to cross-reference by hand.
function SideBySideComparison({
  questionIds,
  questions,
  self,
  manager,
}: {
  questionIds: string[];
  questions: Map<string, AppraisalQuestion>;
  self: AppraisalFeedback | undefined;
  manager: AppraisalFeedback | undefined;
}) {
  if (questionIds.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="grid grid-cols-2 border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <p className="px-4 py-2.5">Self-assessment</p>
        <p className="border-l border-gray-100 px-4 py-2.5">Manager</p>
      </div>
      <div className="divide-y divide-gray-50">
        {questionIds.map((id) => {
          const selfAnswer = self?.answers.find((a) => a.questionId === id);
          const managerAnswer = manager?.answers.find(
            (a) => a.questionId === id
          );
          return (
            <div key={id} className="grid grid-cols-2">
              <div className="px-4 py-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {questions.get(id)?.label ?? QUESTION_GONE_LABEL}
                </p>
                <AnswerValue question={questions.get(id)} answer={selfAnswer} />
              </div>
              <div className="border-l border-gray-100 px-4 py-3">
                <AnswerValue
                  question={questions.get(id)}
                  answer={managerAnswer}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A reviewer-attributed feedback row for anyone other than self/manager
// (peer, in Phase 2). This relation has canSeeReviewerNames: true, so
// reading `feedback.reviewer` here is exactly what the access grant is for —
// unlike appraisal-subject-view.tsx, which must never do this.
function ReviewerCard({
  feedback,
  questions,
}: {
  feedback: AppraisalFeedback;
  questions: Map<string, AppraisalQuestion>;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <PiUserCircle className="h-4 w-4 text-gray-400" />
        {personName(feedback.reviewer)}
        <span className="text-xs font-normal capitalize text-gray-400">
          ({feedback.kind})
        </span>
      </p>
      <div className="flex flex-col gap-3">
        {feedback.answers.map((a) => (
          <div
            key={a.questionId}
            className="border-t border-gray-50 pt-3 first:border-t-0 first:pt-0"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {questions.get(a.questionId)?.label ?? QUESTION_GONE_LABEL}
            </p>
            <div className="mt-1">
              <AnswerValue question={questions.get(a.questionId)} answer={a} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
  const comparisonIds = useMemo(() => {
    const ids = new Set<string>();
    selfFeedback?.answers.forEach((a) => ids.add(a.questionId));
    managerFeedback?.answers.forEach((a) => ids.add(a.questionId));
    return Array.from(ids).sort();
  }, [selfFeedback, managerFeedback]);

  // `access.canSummarise` is false once the appraisal is
  // released/acknowledged/cancelled (see resolveAppraisalAccess) — the editor
  // goes read-only in those states instead of letting a save 403 server-side.
  const readOnly = !access.canSummarise;
  const summaryEmpty = !summary.trim();
  const releaseDisabledReason = !access.canRelease
    ? 'This appraisal is not ready to release yet.'
    : summaryEmpty
      ? 'Write a summary before releasing.'
      : null;

  async function handleSave() {
    setSaving(true);
    try {
      const rating = finalRating.trim() ? Number(finalRating) : undefined;
      const updated = await saveSummary(appraisal._id, summary, rating);
      onUpdate(updated);
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
      const updated = await releaseAppraisal(appraisal._id, confirmed);
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
        <div className="mt-4 flex items-center gap-2">
          <PiStar className="h-4 w-4 shrink-0 text-amber-500" />
          <Input
            type="number"
            min={0}
            max={10}
            value={finalRating}
            onChange={(e) => setFinalRating(e.target.value)}
            placeholder="Final rating (0–10)"
            disabled={readOnly}
            className="w-full max-w-[12rem]"
          />
        </div>

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
