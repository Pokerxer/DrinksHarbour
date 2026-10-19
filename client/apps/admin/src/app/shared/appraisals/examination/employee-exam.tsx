'use client';
import { useRef, useState } from 'react';
import AnswerProgress from './answer-progress';
import SubmissionReview from './submission-review';
import useEmployeeExam from './use-employee-exam';
import { clockText } from './use-exam-clock';
export default function EmployeeExam({ cycleId }: { cycleId: string }) {
  return <ExamPaper key={cycleId} cycleId={cycleId} />;
}
function ExamPaper({ cycleId }: { cycleId: string }) {
  const s = useEmployeeExam(cycleId),
    { exam } = s;
  const [reviewing, setReviewing] = useState(false);
  const questionRefs = useRef<(HTMLFieldSetElement | null)[]>([]);
  function navigate(index: number) {
    const target = questionRefs.current[index];
    target?.scrollIntoView?.({ behavior: 'auto', block: 'center' });
    target?.focus({ preventScroll: true });
  }
  const needsStart = Boolean(
    exam?.durationMinutes && !exam.startedAt && !exam.submittedAt
  );
  return (
    <section
      className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"
      aria-label="Your examination"
    >
      <h2 className="text-lg font-semibold">Employee examination</h2>
      {s.error && (
        <div role="alert" className="space-y-2 text-sm text-red-700">
          <p>
            {s.error}{' '}
            {s.expired
              ? 'Time has ended; only answers saved before the deadline can earn marks.'
              : 'Your selected answers remain on this screen.'}
          </p>
          {exam && !s.expired && (
            <button disabled={s.busy} onClick={s.retry} className="underline">
              Reload saved examination
            </button>
          )}
          {s.expired && (
            <button
              disabled={s.busy}
              onClick={s.finalize}
              className="underline"
            >
              Retry finalization
            </button>
          )}
        </div>
      )}
      {!exam && !s.error && <p role="status">Loading examination…</p>}
      {!exam && s.error && (
        <button className="text-sm underline" onClick={s.retry}>
          Retry examination
        </button>
      )}
      {exam &&
        (!exam.assigned ? (
          <p className="text-sm text-gray-500">
            No examination is assigned to you. Your combined score uses
            appraisal and attendance equally.
          </p>
        ) : exam.submittedAt ? (
          <div>
            <p className="text-sm text-gray-500">Your examination score</p>
            <p className="mt-2 text-2xl font-semibold">
              {exam.score?.toFixed(2)} / 100
            </p>
            {exam.earnedMarks !== undefined && exam.maxMarks !== undefined && (
              <p className="mt-1 text-sm font-medium">
                {exam.earnedMarks} / {exam.maxMarks} marks
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {exam.correctCount} of {exam.questionCount} correct. Final bonus
              also includes appraisal and attendance.
            </p>
            {exam.timedOut && (
              <p className="mt-3 text-sm text-amber-800">
                Time expired. Saved answers were marked; unanswered questions
                received zero.
              </p>
            )}
          </div>
        ) : needsStart ? (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
            <p className="text-base font-semibold">
              {exam.questionCount} questions · {exam.maxMarks} marks ·{' '}
              {exam.durationMinutes}{' '}
              {exam.durationMinutes === 1 ? 'minute' : 'minutes'}
            </p>
            <p className="text-sm leading-6 text-gray-600">
              Your timer starts when you begin. It keeps running if you leave or
              refresh. Answers save automatically; when time ends, saved answers
              are marked and unanswered questions receive zero.
            </p>
            <button
              disabled={s.busy || exam.status !== 'collecting'}
              onClick={s.start}
              className="rounded-lg bg-[#b20202] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {s.busy ? 'Starting…' : 'Start examination'}
            </button>
          </div>
        ) : (
          <>
            {s.remaining !== null && (
              <div
                className={`sticky top-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 ${s.remaining <= 60000 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-gray-200 bg-white text-gray-800'}`}
              >
                <div>
                  <p className="text-xs">Time remaining</p>
                  <p
                    className="font-mono text-2xl font-semibold tabular-nums"
                    aria-label="Time remaining"
                  >
                    {clockText(s.remaining)}
                  </p>
                </div>
                <span className="text-xs">
                  {s.busy
                    ? 'Saving…'
                    : s.saved
                      ? 'Answers saved'
                      : 'Unsaved answers'}
                </span>
              </div>
            )}
            <p className="text-sm leading-6 text-gray-500">
              Choose one answer per question. Each question shows its marks.
              Your assigned paper stays the same when you return. Submitted
              answers cannot be changed.
            </p>
            {s.expired && (
              <p role="status" className="text-sm text-amber-800">
                Time expired. Loading your final score…
              </p>
            )}
            <AnswerProgress
              questions={exam.questions ?? []}
              answers={s.answers}
              onNavigate={navigate}
              disabled={
                s.expired || s.submitting || exam.status !== 'collecting'
              }
            />
            {(exam.questions ?? []).map((q, i) => (
              <fieldset
                key={q.question}
                ref={(node) => {
                  questionRefs.current[i] = node;
                }}
                tabIndex={-1}
                aria-label={`Question ${i + 1}`}
                disabled={
                  s.expired || s.submitting || exam.status !== 'collecting'
                }
                className="min-w-0 scroll-mt-32 space-y-2 rounded-xl border border-gray-200 p-4 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#b20202]"
              >
                <legend className="px-1 text-sm font-medium">
                  {i + 1}. {q.prompt}
                </legend>
                <p className="pb-1 text-xs font-medium text-gray-500">
                  {q.marks ?? exam.marksPerQuestion ?? 1}{' '}
                  {(q.marks ?? exam.marksPerQuestion ?? 1) === 1
                    ? 'mark'
                    : 'marks'}
                </p>
                {q.options.map((option, j) => (
                  <label
                    key={j}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${s.answers[q.question] === j ? 'border-red-200 bg-red-50 font-medium text-[#790505]' : 'border-transparent hover:border-gray-200 hover:bg-gray-50'}`}
                  >
                    <input
                      type="radio"
                      className="border-gray-300 text-[#b20202] accent-[#b20202] focus:ring-[#b20202]"
                      name={`exam-${q.question}`}
                      checked={s.answers[q.question] === j}
                      onChange={() => s.choose(q.question, j)}
                    />
                    {option}
                  </label>
                ))}
              </fieldset>
            ))}
            {exam.status === 'collecting' && !s.expired && !reviewing && (
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={s.busy}
                  onClick={() => s.persist(false)}
                  className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
                >
                  Save examination draft
                </button>
                <button
                  disabled={s.busy || !s.complete}
                  onClick={() => setReviewing(true)}
                  className="rounded-lg bg-[#b20202] px-4 py-2 text-sm text-white disabled:opacity-40"
                >
                  Submit examination
                </button>
              </div>
            )}
            {reviewing &&
              s.complete &&
              !s.expired &&
              exam.status === 'collecting' && (
                <SubmissionReview
                  count={(exam.questions ?? []).length}
                  maxMarks={
                    exam.maxMarks ??
                    (exam.questions ?? []).reduce(
                      (n, q) => n + (q.marks ?? exam.marksPerQuestion ?? 1),
                      0
                    )
                  }
                  busy={s.busy}
                  onConfirm={() => s.persist(true)}
                  onBack={() => {
                    setReviewing(false);
                    navigate(0);
                  }}
                />
              )}
          </>
        ))}
      {s.message && (
        <p role="status" className="text-sm text-green-700">
          {s.message}
        </p>
      )}
    </section>
  );
}
