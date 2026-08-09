'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MotionConfig, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Button, Modal, Text, Textarea, Title } from 'rizzui';
import {
  PiArrowLeft,
  PiArrowClockwise,
  PiCheckCircle,
  PiSpinnerGap,
  PiWarningCircle,
} from 'react-icons/pi';
import {
  declineFeedback,
  fetchReviewerForm,
  saveFeedbackDraft,
  submitFeedback,
  type AppraisalAnswer,
  type AppraisalQuestion,
  type ReviewerForm as ReviewerFormData,
} from '@/services/appraisal.service';
import { useUnsavedChangesGuard } from './use-unsaved-changes-guard';
import ReviewProgressStrip from './review-progress-strip';
import PriorCommitmentsBanner from './prior-commitments-banner';
import SubjectAnswersPanel from './subject-answers-panel';
import StandingFeedbackStep from './standing-feedback-step';
import ReviewDisclosureBanner from './review-disclosure-banner';
import ReviewQuestionCard from './review-question-card';
import ReviewFormFooter from './review-form-footer';
import ReviewSectionNav from './review-section-nav';
import {
  canAbstain,
  carryComment,
  isAnswered,
  outstandingRequired,
  progressOf,
  seedAnswers,
  serializeAnswers,
  toggleNotObserved,
  withComment,
} from './review-answer-utils';
import {
  answersSignature,
  nextUnanswered,
  saveStatusLabel,
  sectionDomId,
  sectionProgress,
  type SaveState,
} from './review-form-utils';

/** How long the reviewer must pause before an edit is written. Long enough not
 *  to PATCH per keystroke in a textarea, short enough that a reviewer who
 *  closes the tab after answering a question has almost certainly been saved. */
const AUTOSAVE_IDLE_MS = 2500;

/**
 * Backoff for a failed autosave, in milliseconds, then every 30s.
 *
 * A failure used to be terminal: the debounce re-arms only when `isDirty` or
 * `persistDraft` changes, and after a rejected PATCH neither does — so a
 * reviewer who lost connectivity mid-form kept typing into a page that had
 * quietly stopped saving, with a footer label as the only clue.
 */
const AUTOSAVE_RETRY_MS = [3_000, 8_000, 20_000, 30_000];

function formatDeadline(deadline?: string | null): string | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function personName(
  person?: { firstName?: string; lastName?: string; email?: string } | null
): string {
  if (!person) return 'this person';
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return name || person.email || 'this person';
}

/** Scroll an anchor into view, respecting a reduced-motion preference. */
function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({
    behavior: reduced ? 'auto' : 'smooth',
    block: 'center',
  });
}

export default function ReviewerForm({ feedbackId }: { feedbackId: string }) {
  const [form, setForm] = useState<ReviewerFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AppraisalAnswer>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [outstanding, setOutstanding] = useState<AppraisalQuestion[]>([]);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);
  const [declinedAt, setDeclinedAt] = useState<string | null>(null);

  /* ── Autosave state ──────────────────────────────────────────────────────
   * `savedSignature` is the fingerprint of what the SERVER currently holds,
   * seeded from the loaded draft. Everything about dirtiness is derived by
   * comparing it against the live one, so there is no separate `isDirty` flag
   * to fall out of step — and an edit that round-trips back to the saved value
   * correctly stops being a change. */
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState(0);
  /** The last question jumped to, so repeated presses walk forward. */
  const lastJumpRef = useRef<string | null>(null);
  /** True while a draft PATCH is open — see persistDraft. */
  const inFlightRef = useRef(false);
  /** An edit arrived mid-request and still needs writing. */
  const saveQueuedRef = useRef(false);
  /** How many consecutive autosaves have failed, indexing AUTOSAVE_RETRY_MS. */
  const retryCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadFailed(null);
      try {
        const data = await fetchReviewerForm(feedbackId);
        if (cancelled) return;
        const seeded = seedAnswers(data.feedback.answers);
        // Per-form, not per-session: carried over, a form opened after one
        // whose autosave had failed four times would start its first retry at
        // the longest backoff instead of the shortest.
        retryCountRef.current = 0;
        inFlightRef.current = false;
        saveQueuedRef.current = false;
        setForm(data);
        setAnswers(seeded);
        // Seeded from what came back, so a form opened and not edited is not
        // immediately "unsaved".
        setSavedSignature(answersSignature(data.sections, seeded));
        setSaveState('idle');
        setSavedAt(null);
      } catch (e) {
        if (cancelled) return;
        const message =
          e instanceof Error ? e.message : 'Failed to load this form';
        setLoadFailed(message);
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feedbackId, reloadKey]);

  const { answered: answeredCount, total: questionCount } = useMemo(
    () => progressOf(form?.sections, answers),
    [form?.sections, answers]
  );

  const sectionRows = useMemo(
    () => sectionProgress(form?.sections, answers),
    [form?.sections, answers]
  );

  const isReadOnly = form ? form.feedback.status !== 'pending' : false;
  const canDecline =
    form?.kind === 'peer' && form.feedback.status === 'pending';

  /** What a save would put on the wire right now. */
  const signature = useMemo(
    () => answersSignature(form?.sections, answers),
    [form?.sections, answers]
  );
  const isDirty =
    !isReadOnly && savedSignature !== null && signature !== savedSignature;

  /**
   * The single write path for a draft.
   *
   * Captures the signature it is SENDING and only records that as saved on
   * success, so an edit made while the request was in flight is still counted
   * as unsaved when it lands — the alternative marks the form clean while
   * holding changes the server never received.
   */
  const persistDraft = useCallback(
    async (opts: { toastOnSuccess?: boolean } = {}) => {
      if (!form || isReadOnly) return;
      // One write at a time. Without this, an edit made while a PATCH was in
      // flight started a second concurrent one, and whichever response landed
      // last won — so a stale request completing out of order could record an
      // older signature as "what the server holds" and silently mark the form
      // clean while holding newer answers.
      if (inFlightRef.current) {
        saveQueuedRef.current = true;
        return;
      }
      inFlightRef.current = true;
      const sending = answersSignature(form.sections, answers);
      setSaving(true);
      setSaveState('saving');
      try {
        await saveFeedbackDraft(
          feedbackId,
          serializeAnswers(form.sections, answers)
        );
        setSavedSignature(sending);
        setSavedAt(Date.now());
        setSaveState('saved');
        retryCountRef.current = 0;
        if (opts.toastOnSuccess) toast.success('Draft saved');
      } catch (e) {
        setSaveState('error');
        if (opts.toastOnSuccess) {
          toast.error(e instanceof Error ? e.message : 'Could not save draft');
        }
      } finally {
        inFlightRef.current = false;
        setSaving(false);
        // An edit arrived while this request was open; it has not been sent.
        if (saveQueuedRef.current) {
          saveQueuedRef.current = false;
          setSaveState((s) => (s === 'error' ? s : 'dirty'));
        }
      }
    },
    [answers, feedbackId, form, isReadOnly]
  );

  /* Debounced autosave. Every edit restarts the timer, so a burst of typing
     produces one PATCH after the reviewer stops — not one per keystroke. */
  useEffect(() => {
    if (!isDirty) return;
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
    const t = setTimeout(() => {
      void persistDraft();
    }, AUTOSAVE_IDLE_MS);
    return () => clearTimeout(t);
    // `persistDraft` changes with every answer edit, which is exactly the
    // signal we want to debounce on.
  }, [isDirty, persistDraft]);

  /* Retry a failed autosave on a backoff rather than waiting for the next
     keystroke. Re-armed by `saveState` returning to 'error' after each failed
     attempt, and torn down the moment one succeeds. */
  useEffect(() => {
    if (saveState !== 'error' || !isDirty) return;
    const delay =
      AUTOSAVE_RETRY_MS[
        Math.min(retryCountRef.current, AUTOSAVE_RETRY_MS.length - 1)
      ];
    const t = setTimeout(() => {
      retryCountRef.current += 1;
      void persistDraft();
    }, delay);
    return () => clearTimeout(t);
  }, [saveState, isDirty, persistDraft]);

  /* Last line of defence for a closed tab, a hard reload, or — the case that
     actually happens here — a client-side navigation out of the form via the
     appraisals section nav, which never fires `beforeunload`. Only armed while
     something is genuinely unwritten. */
  useUnsavedChangesGuard(
    isDirty || saveState === 'error',
    'Your answers have not been saved yet. Leave without saving?'
  );

  /* Keeps "Saved 3 minutes ago" honest without re-rendering the whole form on
     a timer forever — it only runs while there is a relative time on screen. */
  useEffect(() => {
    if (saveState !== 'saved') return;
    const id = setInterval(() => setClockTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [saveState]);

  const saveLabel = useMemo(
    () => saveStatusLabel(saveState, savedAt, Date.now()),
    // clockTick is the whole point of this dependency: it re-derives the
    // relative label on the interval above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saveState, savedAt, clockTick]
  );

  /** Walk the reviewer to the next unanswered question, wrapping at the end. */
  function handleJumpToGap() {
    const target = nextUnanswered(form?.sections, answers, {
      afterId: lastJumpRef.current,
    });
    if (!target) return;
    lastJumpRef.current = target._id;
    scrollToId(`question-${target._id}`);
  }

  /**
   * The one write path for an answer.
   *
   * Writes the WHOLE answer rather than merging into the previous one, so a
   * question cannot accumulate two fields — `serializeAnswers` narrows on the
   * way out too, but keeping the in-memory map clean is what keeps
   * `isAnswered` honest while the reviewer is still typing.
   *
   * It also retires the question's "required" warning as soon as the answer
   * satisfies it, instead of leaving the card red until the next submit
   * attempt — but only if it actually satisfies it. Emptying a multi-select or
   * blanking a textarea leaves the warning up, because the question is once
   * again unanswered.
   */
  function applyAnswer(questionId: string, answer: AppraisalAnswer) {
    setAnswers((prev) => ({
      ...prev,
      // carryComment is the ONE exception to "write the whole answer": a
      // reviewer's note sits on a different axis from the value, so nudging a
      // score must not silently discard what they wrote about it.
      [questionId]: carryComment(prev[questionId], answer),
    }));
    setOutstanding((prev) =>
      prev.length === 0
        ? prev
        : prev.filter((q) => q._id !== questionId || !isAnswered(q, answer))
    );
  }

  function setRating(questionId: string, rating: number) {
    applyAnswer(questionId, { questionId, rating });
  }
  function setText(questionId: string, text: string) {
    applyAnswer(questionId, { questionId, text });
  }
  function setSelected(questionId: string, selected: string[]) {
    applyAnswer(questionId, { questionId, selected });
  }
  function setComment(questionId: string, comment: string) {
    setAnswers((prev) => {
      const next = withComment(prev[questionId], comment);
      // A note typed before anything was answered has nothing to attach to.
      // serializeAnswers would drop it either way, so it never becomes state.
      if (!next) return prev;
      return { ...prev, [questionId]: next };
    });
  }

  function setNotObserved(questionId: string, on: boolean) {
    // toggleNotObserved owns the rule that an abstention replaces the value
    // outright in both directions — see review-answer-utils.ts.
    applyAnswer(
      questionId,
      toggleNotObserved(questionId, answers[questionId], on)
    );
  }

  function handleSaveDraft() {
    void persistDraft({ toastOnSuccess: true });
  }

  function handleSubmitClick() {
    const missing = outstandingRequired(form?.sections, answers);
    if (missing.length > 0) {
      setOutstanding(missing);
      toast.error(
        `Please answer ${missing.length} required question${
          missing.length === 1 ? '' : 's'
        } before submitting.`
      );
      // Walking the reviewer to the problem instead of only colouring it: on a
      // long form the first unanswered question is usually off-screen, and a
      // toast that names a count without a location is a dead end.
      lastJumpRef.current = missing[0]._id;
      scrollToId(`question-${missing[0]._id}`);
      return;
    }
    setOutstanding([]);
    setConfirmOpen(true);
  }

  async function handleConfirmSubmit() {
    if (!form) return;
    setSubmitting(true);
    try {
      const updated = await submitFeedback(
        feedbackId,
        serializeAnswers(form.sections, answers)
      );
      setForm((prev) => (prev ? { ...prev, feedback: updated } : prev));
      // Submit persists the same answers a draft save would, so the form is
      // now clean — leaving it dirty would arm the beforeunload guard on a
      // reviewer who is finished and trying to leave.
      setSavedSignature(answersSignature(form.sections, answers));
      setSaveState('idle');
      toast.success('Feedback submitted');
      setConfirmOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not submit feedback');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    try {
      const result = await declineFeedback(
        feedbackId,
        declineReason.trim() || undefined
      );
      setForm((prev) =>
        prev
          ? { ...prev, feedback: { ...prev.feedback, status: result.status } }
          : prev
      );
      setDeclinedAt(result.declinedAt);
      // A declined request is no longer editable, so nothing is pending a
      // write — disarm the unsaved-changes guard.
      setSaveState('idle');
      setSavedSignature(signature);
      toast.success('You have declined this request.');
      setDeclineOpen(false);
      setDeclineReason('');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not decline this request'
      );
    } finally {
      setDeclining(false);
    }
  }

  /* ── Loading skeleton ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="space-y-4">
          <div className="h-6 w-48 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-4 w-32 animate-pulse rounded bg-gray-50" />
          <div className="h-24 animate-pulse rounded-2xl bg-gray-50" />
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-gray-50"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── Error state ───────────────────────────────────────────────────────── */
  if (!form) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
          <PiWarningCircle className="h-7 w-7 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">
          This feedback request could not be loaded.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {loadFailed ??
            'It may have been removed, or you may not have access.'}
        </p>
        {/* A transient network failure used to end here, with reloading the
            whole app as the only way forward. */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => setReloadKey((n) => n + 1)}
            className="rounded-xl"
          >
            <PiArrowClockwise className="me-1.5 h-4 w-4" />
            Try again
          </Button>
          <Link href="/appraisals">
            <Button variant="text" className="rounded-xl text-gray-500">
              Back to my appraisals
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  /* ── Submitted / declined / expired banner ─────────────────────────────── */
  const statusBanner = isReadOnly && (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 ${
        form.feedback.status === 'declined'
          ? 'border-gray-200 bg-gray-50'
          : form.feedback.status === 'submitted'
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          form.feedback.status === 'declined'
            ? 'bg-gray-100'
            : form.feedback.status === 'submitted'
              ? 'bg-emerald-100'
              : 'bg-amber-100'
        }`}
      >
        {form.feedback.status === 'declined' ? (
          <PiWarningCircle className="h-4.5 w-4.5 text-gray-500" />
        ) : (
          <PiCheckCircle
            className={`h-4.5 w-4.5 ${
              form.feedback.status === 'submitted'
                ? 'text-emerald-600'
                : 'text-amber-600'
            }`}
          />
        )}
      </div>
      <p
        className={`text-sm font-medium ${
          form.feedback.status === 'declined'
            ? 'text-gray-600'
            : form.feedback.status === 'submitted'
              ? 'text-emerald-700'
              : 'text-amber-700'
        }`}
      >
        {form.feedback.status === 'submitted'
          ? 'Submitted — your answers cannot be changed.'
          : form.feedback.status === 'declined'
            ? `You declined this request${
                declinedAt ? ` on ${formatDeadline(declinedAt)}` : ''
              }.`
            : 'This request has expired and can no longer be answered.'}
      </p>
      {/* Every read-only state used to be a dead end: the footer unmounts, so
          the page offered no way onward except the browser's back button. */}
      <Link
        href="/appraisals"
        className="ms-auto hidden shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-gray-500 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-gray-900 sm:inline-flex"
      >
        <PiArrowLeft className="h-3 w-3" />
        My appraisals
      </Link>
    </div>
  );

  const subjectName = personName(form.subject);

  /* ── Main render ───────────────────────────────────────────────────────── */
  return (
    <MotionConfig reducedMotion="user">
      {/* Two columns from `xl` up, where there is room for the section rail
          beside a form column that stays at a readable measure. Below that it
          collapses to exactly the single column it was — a review form is read
          top-to-bottom and does not benefit from being stretched. */}
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10 xl:max-w-[62rem]">
        <div className="xl:grid xl:grid-cols-[13rem_minmax(0,42rem)] xl:justify-center xl:gap-10">
          <aside className="hidden xl:block">
            <ReviewSectionNav
              sections={sectionRows}
              answered={answeredCount}
              total={questionCount}
              onJump={scrollToId}
            />
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            {/* Header + progress */}
            <ReviewProgressStrip
              kind={form.kind}
              subjectName={subjectName}
              cycleName={form.cycleName}
              deadline={form.deadline}
              answered={answeredCount}
              total={questionCount}
            />

            {statusBanner}

            <ReviewDisclosureBanner
              namedTo={form.visibility.namedTo}
              anonymousTo={form.visibility.anonymousTo}
              withheldFrom={form.visibility.withheldFrom}
              kind={form.kind}
            />

            {/* Null on peer forms and on a first-ever appraisal. */}
            <PriorCommitmentsBanner prior={form.priorCommitments} />

            {/* Self forms only (Phase 5 §9.5): an optional step where the
                employee flags colleagues in their own department. The server
                refuses it on any other kind, and the component hides itself
                when the author has no colleagues to write about. */}
            {form.kind === 'self' ? (
              <StandingFeedbackStep
                feedbackId={form.feedback._id}
                readOnly={isReadOnly}
              />
            ) : null}

            {/* Manager forms only (Phase 5 §9.3). The server independently
                requires relation manager/hr AND a submitted self row, so this
                condition is an affordance, not the boundary — a peer who
                reached the endpoint by hand still gets a 403. */}
            {form.kind === 'manager' && form.appraisalId ? (
              <SubjectAnswersPanel
                appraisalId={form.appraisalId}
                subjectName={
                  [form.subject?.firstName, form.subject?.lastName]
                    .filter(Boolean)
                    .join(' ') || 'this employee'
                }
              />
            ) : null}

            {/* Question sections.
                Not wrapped in AnimatePresence: sections are never conditionally
                removed, and `mode="wait"` around a .map of siblings is a
                framer-motion misuse — it expects one keyed child at a time. */}
            {form.sections.map((section, sIdx) => {
              const row = sectionRows[sIdx];
              return (
                <motion.section
                  key={section.title ? `${section.title}-${sIdx}` : sIdx}
                  id={sectionDomId(sIdx)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: Math.min(sIdx * 0.06, 0.3),
                    type: 'spring',
                    stiffness: 260,
                    damping: 26,
                  }}
                  // Clears the app's sticky header when the rail jumps here.
                  className="flex scroll-mt-24 flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                      {section.title}
                    </h2>
                    <div className="h-px flex-1 bg-gray-100" />
                    {/* Per-section count, so progress is legible where the
                        reviewer actually is rather than only at the top. */}
                    {row && row.total > 0 && (
                      <span
                        className={`shrink-0 text-[11px] font-semibold tabular-nums ${
                          row.complete ? 'text-emerald-500' : 'text-gray-400'
                        }`}
                      >
                        {row.answered}/{row.total}
                      </span>
                    )}
                  </div>
                  {section.questions.map((q, qIdx) => (
                    <ReviewQuestionCard
                      key={q._id}
                      question={q}
                      answer={answers[q._id]}
                      onRatingChange={(v) => setRating(q._id, v)}
                      onTextChange={(v) => setText(q._id, v)}
                      onSelectedChange={(v) => setSelected(q._id, v)}
                      onNotObservedChange={(on) => setNotObserved(q._id, on)}
                      onCommentChange={(v) => setComment(q._id, v)}
                      // Manager forms only. The server strips a comment off any
                      // other kind, so offering the box elsewhere would be a
                      // control that silently does nothing.
                      canComment={form.kind === 'manager'}
                      canAbstain={canAbstain(form.kind)}
                      isMissing={outstanding.some((o) => o._id === q._id)}
                      readOnly={isReadOnly}
                      index={sIdx * 10 + qIdx}
                      // Scored anchors are shown in an order derived from THIS
                      // reviewer's row, so self and manager get different ones
                      // — a manager who has read the self assessment must not
                      // be able to recover the ranking from its layout.
                      shuffleSalt={form.feedback._id}
                    />
                  ))}
                </motion.section>
              );
            })}

            {/* Footer (only when editable) */}
            {!isReadOnly && (
              <ReviewFormFooter
                canDecline={canDecline}
                saving={saving}
                submitting={submitting}
                answered={answeredCount}
                total={questionCount}
                saveState={saveState}
                saveLabel={saveLabel}
                hasGap={answeredCount < questionCount}
                onJumpToGap={handleJumpToGap}
                onSaveDraft={handleSaveDraft}
                onSubmit={handleSubmitClick}
                onDecline={() => setDeclineOpen(true)}
              />
            )}
          </div>
        </div>
      </div>
      {/* Modals sit outside the grid — they portal to the body anyway, and
          nesting them in a column that becomes a sticky-footer context only
          invites stacking surprises. */}
      {/* ── Submit confirmation modal ────────────────────────────────── */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
      >
        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b20202]/10">
            <PiCheckCircle className="h-6 w-6 text-[#b20202]" />
          </div>
          <Title as="h3" className="text-base font-semibold text-gray-900">
            Submit this feedback?
          </Title>
          <Text className="mt-2 text-sm text-gray-500">
            Once submitted, your answers cannot be changed. You&rsquo;ll still
            be able to view your responses.
          </Text>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              disabled={submitting}
              className="rounded-xl bg-[#b20202] text-white shadow-md shadow-[#b20202]/20 hover:bg-[#9f0101]"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-1.5">
                  <PiSpinnerGap className="h-3.5 w-3.5 animate-spin" />
                  Submitting…
                </span>
              ) : (
                'Submit feedback'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Decline modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={declineOpen}
        onClose={() => setDeclineOpen(false)}
        size="sm"
      >
        <div className="p-6">
          <Title as="h3" className="text-base font-semibold text-gray-900">
            Decline this request?
          </Title>
          <Text className="mt-2 text-sm text-gray-500">
            You won&rsquo;t be asked to complete this feedback. A reason is
            optional.
          </Text>
          <Textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
            placeholder="Reason (optional)"
            className="mt-4"
            disabled={declining}
          />
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setDeclineOpen(false)}
              disabled={declining}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDecline}
              disabled={declining}
              color="danger"
              className="rounded-xl"
            >
              {declining ? (
                <span className="inline-flex items-center gap-1.5">
                  <PiSpinnerGap className="h-3.5 w-3.5 animate-spin" />
                  Declining…
                </span>
              ) : (
                'Decline'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </MotionConfig>
  );
}
