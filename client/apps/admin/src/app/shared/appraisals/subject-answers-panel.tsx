'use client';

// The employee's own self-assessment, shown to the person writing their
// manager assessment (Phase 5 §9.3).
//
// ── Why the "not yet submitted" state is the point ─────────────────────────
// The server returns `selfSubmitted: false` and NO answers while the employee
// is still working. Rendering that as an empty comparison would read as though
// they answered nothing — and a manager who believes that writes a different,
// worse review. So the empty case gets its own explicit copy rather than
// falling through to a bare list with nothing in it.
//
// This panel renders only what the SUBJECT wrote. It never touches peer
// feedback and takes no `reviewer` anywhere, so it cannot leak an identity;
// the manager reads peer input on the appraisal detail page, not here.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PiCaretRight, PiUser } from 'react-icons/pi';
import {
  fetchSubjectAnswers,
  type SubjectAnswers,
} from '@/services/appraisal.service';
import { formatAnswer } from './review-answer-utils';

export default function SubjectAnswersPanel({
  appraisalId,
  subjectName,
}: {
  appraisalId: string;
  subjectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SubjectAnswers | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetched on first expand, not on mount: most of the time the manager is
  // simply filling their own form, and a 403 or a slow read must not delay it.
  useEffect(() => {
    if (!open || data || loading) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchSubjectAnswers(appraisalId);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load the self-assessment.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, data, loading, appraisalId]);

  const byQuestion = new Map(
    (data?.answers || []).map((a) => [String(a.questionId), a])
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
          <PiUser className="h-4 w-4 text-gray-500" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900">
            What {subjectName} said about themselves
          </span>
          <span className="mt-0.5 block text-xs text-gray-400">
            Their self-assessment, so you are assessing against the same
            questions they answered.
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="shrink-0 text-gray-400"
        >
          <PiCaretRight className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 px-4 py-4 sm:px-5">
              {loading ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : error ? (
                <p className="text-xs text-red-600">{error}</p>
              ) : !data ? null : !data.selfSubmitted ? (
                // The whole reason this endpoint reports a flag rather than an
                // empty array: "hasn't finished yet" and "answered nothing"
                // are different facts, and only one of them is a judgement.
                <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-800">
                    Not submitted yet
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700">
                    {subjectName} has not finished their self-assessment. This
                    is not the same as having answered nothing — you can still
                    complete your own form, and their answers will appear here
                    once submitted.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {data.sections.map((section) => (
                    <div key={section.title}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {section.title}
                      </p>
                      <div className="flex flex-col gap-2.5">
                        {section.questions.map((q) => {
                          const answer = byQuestion.get(String(q._id));
                          return (
                            <div
                              key={q._id}
                              className="rounded-xl border border-gray-100 bg-gray-50/60 px-3.5 py-2.5"
                            >
                              <p className="text-xs font-medium text-gray-700">
                                {q.label}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                                {/* formatAnswer owns the per-type rendering —
                                    including that a rating of 0 is a real
                                    score, not a blank. */}
                                {answer ? (
                                  formatAnswer(q, answer)
                                ) : (
                                  <span className="text-gray-300">
                                    Not answered
                                  </span>
                                )}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
