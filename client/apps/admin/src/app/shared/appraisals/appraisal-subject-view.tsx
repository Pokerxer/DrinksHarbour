'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Modal, Text, Textarea, Title } from 'rizzui';
import {
  PiChatCircleText,
  PiCheckCircle,
  PiStar,
  PiUserCircle,
} from 'react-icons/pi';
import {
  acknowledgeAppraisal,
  type Appraisal,
  type AppraisalAnswer,
  type AppraisalFeedback,
  type AppraisalQuestion,
  type AppraisalSection,
  type ComparisonRow,
  type FeedbackKind,
  type PersonRef,
} from '@/services/appraisal.service';
import { formatAnswer, isNumericQuestion } from './review-answer-utils';
import AppraisalStateBadge from './state-badge';
// Only the AGGREGATE view. appraisal-peer-breakdown.tsx is deliberately not
// imported here — see the note below on enforcement by omission.
import AppraisalComparison from './appraisal-comparison';

// ── This component must never read `feedback.reviewer` ─────────────────────
//
// The subject can read `appraisal.manager` (their own manager's identity is
// not a secret — they already know who manages them), but nothing here may
// read a feedback row's `reviewer`. Self and manager feedback are attributed
// by their `kind` alone, never by name; peer feedback renders under the
// neutral "Peer feedback" heading with no identity at all. This is enforced
// by omission, not by a runtime check — see appraisal-detail.tsx for why that
// split is the point.

function personName(person?: PersonRef | null): string {
  if (!person) return 'Unknown';
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return name || person.email || 'Unknown';
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const KIND_HEADING: Record<FeedbackKind, string> = {
  self: 'Your self-assessment',
  manager: 'Your manager’s feedback',
  peer: 'Peer feedback',
};

const QUESTION_GONE_LABEL = 'Question no longer on this form';

/**
 * `GET /api/appraisals/:id` now returns the full template `sections` behind
 * the appraisal's cycle alongside the feedback rows (see
 * appraisal.controller.js#getAppraisal), so each `answers[].questionId` can
 * be resolved to its real `label` instead of a numbered placeholder. A
 * template can be edited after feedback was submitted against it, so a
 * `questionId` on a feedback row may not exist in the current sections —
 * that answer falls back to QUESTION_GONE_LABEL rather than a blank or a
 * fabricated number.
 *
 * Indexed by the whole QUESTION, not just its label: an answer cannot be
 * rendered without knowing its question's type. A `choice` answer carries
 * neither `rating` nor `text`, so a rating-or-text reader shows the subject an
 * em dash where their reviewer actually picked options.
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
  answer: AppraisalAnswer;
}) {
  if (question) {
    const display = formatAnswer(question, answer);
    if (display === null) {
      return <p className="mt-1 text-sm text-gray-300">Not answered</p>;
    }
    return isNumericQuestion(question) ? (
      <p className="mt-1 text-sm font-medium text-gray-900">{display}</p>
    ) : (
      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
        {display}
      </p>
    );
  }
  // Question edited out of the template since submission — type unknowable.
  if (answer.selected?.length) {
    return (
      <p className="mt-1 text-sm text-gray-700">{answer.selected.join(', ')}</p>
    );
  }
  if (typeof answer.rating === 'number') {
    return (
      <p className="mt-1 text-sm font-medium text-gray-900">
        Rating: {answer.rating}
      </p>
    );
  }
  return (
    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
      {answer.text || '—'}
    </p>
  );
}

function FeedbackCard({
  feedback,
  heading,
  questions,
}: {
  feedback: AppraisalFeedback;
  heading: string;
  questions: Map<string, AppraisalQuestion>;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <PiUserCircle className="h-4 w-4 text-gray-400" />
        {heading}
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
            <AnswerValue question={questions.get(a.questionId)} answer={a} />
          </div>
        ))}
        {feedback.answers.length === 0 && (
          <p className="text-sm text-gray-400">No answers were recorded.</p>
        )}
      </div>
    </div>
  );
}

export default function AppraisalSubjectView({
  appraisal,
  feedback,
  // Optional, defaulting to empty, because the caller (appraisal-detail.tsx)
  // is out of scope for this task and does not yet thread the `sections`
  // field that `fetchAppraisal` now returns through to this component. Until
  // that wiring lands, every answer falls back to QUESTION_GONE_LABEL via
  // buildQuestionIndex rather than this component crashing on a missing prop.
  sections = [],
  // Both optional and undefined-checked (not defaulted to 0) because a
  // missing value must suppress the summary line entirely, never render it
  // with "undefined" in place of a count — see the render below.
  approvedPeerCount,
  peerResponseCount,
  // The AGGREGATE comparison only. Every row's `peerBreakdown` is `null` on
  // the subject's copy — the server strips each peer row's reviewer before
  // building it — and AppraisalComparison does not read that field in any
  // case. The named breakdown component is not imported here at all.
  comparison = [],
  onUpdate,
}: {
  appraisal: Appraisal;
  feedback: AppraisalFeedback[];
  sections?: AppraisalSection[];
  approvedPeerCount?: number;
  peerResponseCount?: number;
  comparison?: ComparisonRow[];
  onUpdate: (appraisal: Appraisal) => void;
}) {
  const [response, setResponse] = useState(appraisal.employeeResponse ?? '');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const questions = buildQuestionIndex(sections);
  const selfFeedback = feedback.find((f) => f.kind === 'self');
  const managerFeedback = feedback.find((f) => f.kind === 'manager');
  const peerFeedback = feedback.filter((f) => f.kind === 'peer');

  // Neither count is used to name or count-in a way that could single out an
  // individual reviewer — this is a plain response-rate line, not a reviewer
  // reference (see the file-top note on why `feedback.reviewer` itself is
  // unreachable here).
  const peerSummaryLine =
    typeof approvedPeerCount === 'number' &&
    approvedPeerCount > 0 &&
    typeof peerResponseCount === 'number'
      ? `This summary draws on ${peerResponseCount} peer ${peerResponseCount === 1 ? 'response' : 'responses'}.`
      : null;

  const isReleased = appraisal.state === 'released';
  const isAcknowledged = appraisal.state === 'acknowledged';
  const acknowledgedDate = formatDate(appraisal.acknowledgedAt);

  async function handleAcknowledge() {
    setAcknowledging(true);
    try {
      const updated = await acknowledgeAppraisal(
        appraisal._id,
        response.trim() || undefined
      );
      onUpdate(updated);
      toast.success('Acknowledged');
      setConfirmOpen(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not acknowledge this appraisal'
      );
    } finally {
      setAcknowledging(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Title as="h1" className="text-xl font-semibold text-gray-900">
            {appraisal.cycle?.name || 'Your appraisal'}
          </Title>
          <AppraisalStateBadge state={appraisal.state} />
        </div>
        <p className="mt-1 text-sm text-gray-400">
          Reviewed by {personName(appraisal.manager)}
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <PiChatCircleText className="h-4 w-4 text-[#b20202]" />
          {'Manager’s summary'}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
          {appraisal.summary || 'No summary was written.'}
        </p>
        {typeof appraisal.finalRating === 'number' && (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-gray-900">
            <PiStar className="h-4 w-4 text-amber-500" />
            Final rating: {appraisal.finalRating}
          </p>
        )}
      </div>

      <AppraisalComparison rows={comparison} />

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-700">Feedback</h2>
        {peerSummaryLine && (
          <p className="text-xs text-gray-400">{peerSummaryLine}</p>
        )}
        {selfFeedback && (
          <FeedbackCard
            feedback={selfFeedback}
            heading={KIND_HEADING.self}
            questions={questions}
          />
        )}
        {managerFeedback && (
          <FeedbackCard
            feedback={managerFeedback}
            heading={KIND_HEADING.manager}
            questions={questions}
          />
        )}
        {/* Every card is headed "Peer feedback", with no ordinal.
            The numbering that used to be here read as a neutral label but was
            a stable index into a list the subject wrote themselves: peer rows
            arrived in creation order, which is the order their own nominations
            were approved. The server now also reorders these under a salted
            hash (orderFeedbackForViewer) so position carries nothing — the
            missing number is the second half of that, removing the affordance
            to correlate at all. Cards are separated visually, not by rank. */}
        {peerFeedback.map((f) => (
          <FeedbackCard
            key={f._id}
            feedback={f}
            heading={KIND_HEADING.peer}
            questions={questions}
          />
        ))}
        {feedback.length === 0 && (
          <p className="text-sm text-gray-400">
            No feedback has been submitted yet.
          </p>
        )}
      </div>

      {isReleased && (
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900">
            Your response (optional)
          </p>
          <Textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={4}
            placeholder="Add any comments before acknowledging…"
            className="mt-2"
          />
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => setConfirmOpen(true)}
              className="bg-[#b20202] hover:bg-[#9f0101]"
            >
              Acknowledge
            </Button>
          </div>
        </div>
      )}

      {isAcknowledged && (
        <div className="rounded-xl border border-green-100 bg-green-50 p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
            <PiCheckCircle className="h-4 w-4" />
            Acknowledged{acknowledgedDate ? ` on ${acknowledgedDate}` : ''}
          </p>
          {appraisal.employeeResponse && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-green-900">
              {appraisal.employeeResponse}
            </p>
          )}
        </div>
      )}

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
      >
        <div className="p-6">
          <Title as="h3" className="text-base font-semibold text-gray-900">
            Acknowledge this appraisal?
          </Title>
          <Text className="mt-2 text-sm text-gray-500">
            This records that you have seen this appraisal. It cannot be undone.
          </Text>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={acknowledging}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAcknowledge}
              disabled={acknowledging}
              className="bg-[#b20202] hover:bg-[#9f0101]"
            >
              {acknowledging ? 'Acknowledging…' : 'Acknowledge'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
