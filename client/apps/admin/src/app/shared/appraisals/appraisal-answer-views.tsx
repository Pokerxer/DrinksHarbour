'use client';

// shared/appraisals/appraisal-answer-views.tsx — how a submitted answer is
// rendered for a viewer who is allowed to see who wrote it.
//
// ── NOT FOR THE SUBJECT ─────────────────────────────────────────────────────
//
// `ReviewerCard` reads `feedback.reviewer`. That is correct for the manager,
// for HR, and for the cycle roster's drawer — all three have
// `canSeeReviewerNames: true`. It is NOT correct for
// appraisal-subject-view.tsx, which must never import from this file. Keeping
// the reviewer read in one place that names its audience is the point: the
// subject's render path has no code that could leak a name, rather than a
// conditional that currently happens not to.
//
// Extracted from appraisal-manager-view.tsx when the cycle roster grew a
// per-employee drawer. Two copies of "how do you render an answer" would drift,
// and the drift would be silent — an answer rendered as an em dash looks like
// an unanswered question, not like a bug.

import {
  type AppraisalAnswer,
  type AppraisalFeedback,
  type AppraisalQuestion,
  type AppraisalSection,
  type PersonRef,
} from '@/services/appraisal.service';
import { PiUserCircle } from 'react-icons/pi';
import { formatAnswer, isNumericQuestion } from './review-answer-utils';

export const QUESTION_GONE_LABEL = 'Question no longer on this form';

export function personName(person?: PersonRef | null): string {
  if (!person) return 'Unknown';
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return name || person.email || 'Unknown';
}

/**
 * `GET /api/appraisals/:id` returns the full template `sections` behind the
 * appraisal's cycle (every `askOf` kind, unfiltered — a manager legitimately
 * reads self/manager/peer answers side by side) alongside the feedback rows,
 * so each `answers[].questionId` can be resolved to its real label instead of
 * a numbered placeholder. A template can be edited after feedback was
 * submitted against it, so a `questionId` on a feedback row may not exist in
 * the current sections — that answer falls back to QUESTION_GONE_LABEL rather
 * than a blank or numbered guess.
 *
 * Indexed by the whole QUESTION, not just its label: an answer cannot be
 * rendered without knowing its question's type. `selected: ['A','B']` and
 * `rating: 0` are both invisible to a rating-or-text reader — the first falls
 * through to an em dash, the second reads as "Rating: 0" where the reviewer
 * clicked "No".
 */
export function buildQuestionIndex(
  sections: AppraisalSection[]
): Map<string, AppraisalQuestion> {
  const index = new Map<string, AppraisalQuestion>();
  sections.forEach((s) => s.questions.forEach((q) => index.set(q._id, q)));
  return index;
}

export function AnswerValue({
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

/**
 * Self and manager answers to the same questionId placed in one row, so the
 * comparison the shared id exists to enable (see AppraisalQuestion.askOf in
 * the template model) is actually visible rather than two lists a reader has
 * to cross-reference by hand.
 *
 * Two columns on a wide screen, stacked on a narrow one. Stacked, each answer
 * carries its own "Self" / "Manager" label — without them the second block is
 * an unattributed paragraph, and a manager's criticism read as the employee's
 * self-assessment is the worst possible way to get this wrong.
 */
export function SideBySideComparison({
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
      <div className="hidden grid-cols-2 border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:grid">
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
            <div key={id} className="grid grid-cols-1 sm:grid-cols-2">
              <div className="px-4 py-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {questions.get(id)?.label ?? QUESTION_GONE_LABEL}
                </p>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-600 sm:hidden">
                  Self
                </p>
                <AnswerValue question={questions.get(id)} answer={selfAnswer} />
              </div>
              <div className="border-t border-gray-50 px-4 py-3 sm:border-l sm:border-t-0 sm:border-gray-100">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#b20202] sm:hidden">
                  Manager
                </p>
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

/**
 * A reviewer-attributed feedback row for anyone other than self/manager (peer,
 * in Phase 2). Reading `feedback.reviewer` here is exactly what this file's
 * audience grant is for — see the header.
 */
export function ReviewerCard({
  feedback,
  questions,
}: {
  feedback: AppraisalFeedback;
  questions: Map<string, AppraisalQuestion>;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <PiUserCircle className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="min-w-0 truncate">
          {personName(feedback.reviewer)}
        </span>
        <span className="shrink-0 text-xs font-normal capitalize text-gray-400">
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
