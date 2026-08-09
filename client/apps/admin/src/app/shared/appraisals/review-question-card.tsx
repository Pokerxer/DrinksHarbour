'use client';

import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { PiChatText, PiCheck, PiWarningCircle } from 'react-icons/pi';
import type {
  AppraisalQuestion,
  AppraisalAnswer,
} from '@/services/appraisal.service';
import {
  isAnswered,
  isScoredOptions,
  scaleMaxOf,
  toggleChoice,
} from './review-answer-utils';

/* ── Why every choice here is a native input ──────────────────────────────────
 * Each of these fields is a radio group or a checkbox group, and all six types
 * used to be `<button role="radio">` with no arrow-key handling — which makes
 * every tile its own tab stop and leaves the group unnavigable by keyboard.
 * Native `<input>`s inside a `<fieldset>` get roving focus, arrow keys, form
 * semantics and the group label announced, for free. The inputs are visually
 * hidden (`sr-only`) rather than `hidden`/`appearance-none`, so they stay
 * focusable, and the visible tile is styled off `peer-checked` /
 * `peer-focus-visible`.
 * ────────────────────────────────────────────────────────────────────────── */

/** A rating's colour ramp: low is neutral, mid amber, high green. */
function ratingColor(n: number, max: number): { idle: string; active: string } {
  const ratio = n / max;
  if (ratio <= 0.33) {
    return {
      idle: 'text-gray-500 group-hover:bg-gray-100',
      active:
        'peer-checked:border-gray-700 peer-checked:bg-gray-700 peer-checked:text-white peer-checked:shadow-gray-700/25',
    };
  }
  if (ratio <= 0.66) {
    return {
      idle: 'text-amber-700 group-hover:bg-amber-50',
      active:
        'peer-checked:border-amber-500 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:shadow-amber-500/25',
    };
  }
  return {
    idle: 'text-emerald-700 group-hover:bg-emerald-50',
    active:
      'peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white peer-checked:shadow-emerald-500/25',
  };
}

/**
 * Neutral brand fill, used by every non-`rating` scale.
 *
 * `likert`, `scale`, `choice` and `yes_no` deliberately do NOT get the
 * red/amber/green ramp: their options carry no inherent good-or-bad. "No" is
 * the right answer to "Did this person miss deadlines?", and colouring it red
 * editorialises the question.
 */
const NEUTRAL_ACTIVE =
  'peer-checked:border-[#b20202] peer-checked:bg-[#b20202] peer-checked:text-white peer-checked:shadow-[#b20202]/25';

const FOCUS_RING =
  'peer-focus-visible:ring-2 peer-focus-visible:ring-[#b20202]/40 peer-focus-visible:ring-offset-2';

/* ── Shared question label ──────────────────────────────────────────────── */

function QuestionLabel({
  question,
  as,
}: {
  question: AppraisalQuestion;
  /** `legend` inside a fieldset, `label` for the free-text field. */
  as: 'legend' | 'label';
}) {
  const Tag = as;
  return (
    <Tag
      {...(as === 'label' ? { htmlFor: `q-${question._id}` } : {})}
      className="block p-0 text-sm font-semibold leading-snug text-gray-900"
    >
      {question.label}
      {question.required && (
        <span className="ml-1 text-[#b20202]" aria-hidden="true">
          *
        </span>
      )}
      {question.required && <span className="sr-only"> (required)</span>}
      {question.helpText && (
        <span className="mt-1 block text-xs font-normal leading-relaxed text-gray-400">
          {question.helpText}
        </span>
      )}
    </Tag>
  );
}

/* ── Scored anchors: an ordinal question whose options carry hidden scores ──
 *
 * Renders the five behavioural descriptions as radios and NOTHING ELSE. The
 * score each one carries is deliberately absent from this markup — no number,
 * no ordering hint, no "5 of 5" badge. Showing it would invite the rater to
 * answer the weight instead of the behaviour, which is the entire reason the
 * scores are stored out of sight.
 *
 * Selection is matched on the stored `rating` rather than an index, which is
 * unambiguous only because the server rejects a question whose options share a
 * score (validateOptionScores). The order the options appear in is the
 * template's own, NOT sorted by score: the author writes them best-to-worst
 * and re-ordering them here would silently rewrite the form.
 */
function ScoredOptionsField({
  question,
  value,
  onChange,
  disabled,
}: {
  question: AppraisalQuestion;
  value: number | undefined;
  onChange: (rating: number) => void;
  disabled: boolean;
}) {
  const options = question.options ?? [];
  const scores = question.optionScores ?? [];

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" disabled={disabled}>
      <QuestionLabel question={question} as="legend" />
      <div className="mt-3 flex flex-col gap-2">
        {options.map((opt, i) => {
          const score = scores[i];
          const checked = value === score;
          return (
            <label
              key={`${opt}-${i}`}
              className={`group relative block ${
                disabled ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name={`q-${question._id}`}
                value={opt}
                checked={checked}
                onChange={() => onChange(score)}
                disabled={disabled}
                className="peer sr-only"
              />
              <span
                className={`flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-700 transition-all duration-150 group-hover:bg-gray-50 peer-checked:border-[#b20202]/40 peer-checked:bg-[#b20202]/[0.04] peer-checked:text-gray-900 ${FOCUS_RING} peer-disabled:opacity-60`}
              >
                <span
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-gray-300 bg-white transition-colors peer-checked:group-[]:border-[#b20202] peer-checked:group-[]:bg-[#b20202]"
                />
                <span className="min-w-0 flex-1">{opt}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ── Scale field: rating | likert | scale ───────────────────────────────── */

function ScaleField({
  question,
  value,
  onChange,
  disabled,
}: {
  question: AppraisalQuestion;
  value: number | undefined;
  onChange: (rating: number) => void;
  disabled: boolean;
}) {
  const max = scaleMaxOf(question);
  const steps = Array.from({ length: max }, (_, i) => i + 1);
  const isRating = question.type === 'rating';
  const lowLabel = question.scaleLabels?.low?.trim() || 'Lowest';
  const highLabel = question.scaleLabels?.high?.trim() || 'Highest';

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" disabled={disabled}>
      <QuestionLabel question={question} as="legend" />

      {/* auto-fit keeps a 10-point scale on one row on desktop and reflows it
          to as many rows as it needs on a narrow phone, without a breakpoint
          per scaleMax. */}
      <div
        className="mt-4 grid gap-2"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(2.75rem, 1fr))`,
        }}
      >
        {steps.map((n) => {
          const c = isRating
            ? ratingColor(n, max)
            : {
                idle: 'text-gray-600 group-hover:bg-gray-50',
                active: NEUTRAL_ACTIVE,
              };
          return (
            <label
              key={n}
              className={`group relative block ${
                disabled ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name={`q-${question._id}`}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                disabled={disabled}
                className="peer sr-only"
              />
              <span
                className={`flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-bold tabular-nums transition-all duration-150 peer-checked:shadow-lg ${c.idle} ${c.active} ${FOCUS_RING} peer-disabled:opacity-60`}
              >
                {n}
              </span>
            </label>
          );
        })}
      </div>

      {/* Endpoint labels. The template's own wording when it has any — a
          likert question reading "Strongly disagree → Strongly agree" is the
          whole point of the type. */}
      <div className="mt-2 flex items-start justify-between gap-4 text-[11px] leading-tight text-gray-400">
        <span className="max-w-[45%] text-left">{lowLabel}</span>
        <span className="max-w-[45%] text-right">{highLabel}</span>
      </div>
    </fieldset>
  );
}

/* ── Yes / No ───────────────────────────────────────────────────────────── */

function YesNoField({
  question,
  value,
  onChange,
  disabled,
}: {
  question: AppraisalQuestion;
  value: number | undefined;
  onChange: (rating: number) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" disabled={disabled}>
      <QuestionLabel question={question} as="legend" />
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:max-w-xs">
        {[
          { label: 'Yes', v: 1 },
          { label: 'No', v: 0 },
        ].map((opt) => (
          <label
            key={opt.label}
            className={`group relative block ${
              disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <input
              type="radio"
              name={`q-${question._id}`}
              value={opt.v}
              // `value === opt.v` and not a truthiness test: 0 is a real answer.
              checked={value === opt.v}
              onChange={() => onChange(opt.v)}
              disabled={disabled}
              className="peer sr-only"
            />
            <span
              className={`flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 transition-all duration-150 group-hover:bg-gray-50 peer-checked:shadow-lg ${NEUTRAL_ACTIVE} ${FOCUS_RING} peer-disabled:opacity-60`}
            >
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ── Choice: single (radio) or multiple (checkbox) ──────────────────────── */

function ChoiceField({
  question,
  value,
  onChange,
  disabled,
}: {
  question: AppraisalQuestion;
  value: string[] | undefined;
  onChange: (selected: string[]) => void;
  disabled: boolean;
}) {
  const options = question.options ?? [];
  const selected = value ?? [];
  const multiple = question.multiple === true;

  if (options.length === 0) {
    // A choice question with no options is a template authoring mistake. Say so
    // rather than rendering an empty box the reviewer cannot answer — and, in
    // particular, rather than falling through to a textarea, which is what the
    // old `type === 'rating' ? … : <TextInput>` branch did for every type it
    // did not know about.
    return (
      <div className="min-w-0">
        <QuestionLabel question={question} as="legend" />
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
          This question has no answer options configured.
        </p>
      </div>
    );
  }

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" disabled={disabled}>
      <QuestionLabel question={question} as="legend" />
      <div className="mt-1 flex items-center justify-between gap-3">
        {multiple ? (
          <p className="text-[11px] font-medium text-gray-400">
            Select all that apply
          </p>
        ) : (
          <span />
        )}
        {/* Optional single-select needs a way back to "no answer": a radio
            group cannot be unchecked by clicking, and without this an optional
            question becomes permanently answered the moment it is touched.
            Multi-select already has one — unchecking the last box. */}
        {!multiple &&
          !question.required &&
          selected.length > 0 &&
          !disabled && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] font-semibold text-gray-400 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-[#b20202]"
            >
              Clear selection
            </button>
          )}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((opt, i) => {
          const checked = selected.includes(opt);
          return (
            <label
              key={`${opt}-${i}`}
              className={`group relative block ${
                disabled ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={`q-${question._id}`}
                value={opt}
                checked={checked}
                onChange={() => onChange(toggleChoice(question, selected, opt))}
                disabled={disabled}
                className="peer sr-only"
              />
              <span
                className={`flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-700 transition-all duration-150 group-hover:bg-gray-50 peer-checked:border-[#b20202]/40 peer-checked:bg-[#b20202]/[0.04] peer-checked:text-gray-900 ${FOCUS_RING} peer-disabled:opacity-60`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center border border-gray-300 bg-white text-white transition-all ${multiple ? 'rounded-[5px]' : 'rounded-full'} group-has-[:checked]:border-[#b20202] group-has-[:checked]:bg-[#b20202]`}
                >
                  {multiple ? (
                    <PiCheck className="h-3 w-3" strokeWidth={24} />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
                <span className="min-w-0 flex-1 leading-relaxed">{opt}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ── Free text ──────────────────────────────────────────────────────────── */

function TextField({
  question,
  value,
  onChange,
  disabled,
}: {
  question: AppraisalQuestion;
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, []);

  return (
    <div className="min-w-0">
      <QuestionLabel question={question} as="label" />
      <div className="relative mt-3">
        <textarea
          id={`q-${question._id}`}
          ref={ref}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            resize();
          }}
          onInput={resize}
          disabled={disabled}
          rows={3}
          // maxLength matches the server's `text` maxlength — the field stops
          // accepting input at the limit instead of the save failing after the
          // reviewer has written past it.
          maxLength={5000}
          placeholder="Write your answer here…"
          className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 pb-7 text-sm leading-relaxed text-gray-900 transition-all duration-200 placeholder:text-gray-300 focus:border-[#b20202]/40 focus:outline-none focus:ring-2 focus:ring-[#b20202]/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
        />
        {value.length > 0 && (
          <span
            className={`absolute bottom-2.5 right-3 text-[11px] tabular-nums ${
              value.length > 4750 ? 'text-amber-600' : 'text-gray-300'
            }`}
          >
            {value.length.toLocaleString()} / 5,000
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Exported card ──────────────────────────────────────────────────────── */

export default function ReviewQuestionCard({
  question,
  answer,
  onRatingChange,
  onTextChange,
  onSelectedChange,
  onNotObservedChange,
  onCommentChange,
  canComment,
  canAbstain,
  isMissing,
  readOnly,
  index,
}: {
  question: AppraisalQuestion;
  answer: AppraisalAnswer | undefined;
  onRatingChange: (rating: number) => void;
  onTextChange: (text: string) => void;
  onSelectedChange: (selected: string[]) => void;
  onNotObservedChange: (on: boolean) => void;
  /** Manager forms only — the server strips a comment off any other kind. */
  onCommentChange?: (comment: string) => void;
  /**
   * Whether to offer the per-question note (Phase 5 §9.3). Manager forms only:
   * a comment is the REVIEWER's annotation, and the server drops one written
   * on a self or peer row rather than rejecting the submission — so offering
   * the box anywhere else would be a control that silently does nothing.
   */
  canComment: boolean;
  /** Peer forms only — see canAbstain() in review-answer-utils.ts. */
  canAbstain: boolean;
  isMissing: boolean;
  readOnly: boolean;
  index: number;
}) {
  const answered = isAnswered(question, answer);
  const abstained = answer?.notObserved === true;
  // The field stays MOUNTED and merely disabled while abstaining, rather than
  // being swapped out. Unmounting a textarea would destroy anything typed into
  // it, so a mis-click on the checkbox would silently discard written work the
  // reviewer could not get back by unticking it.
  const fieldDisabled = readOnly || abstained;

  function field() {
    switch (question.type) {
      case 'rating':
      case 'likert':
      case 'scale':
        // Same stored answer either way — a number in `rating`. The only
        // difference is whether the rater picks that number directly or picks
        // a description that carries it.
        if (isScoredOptions(question)) {
          return (
            <ScoredOptionsField
              question={question}
              value={answer?.rating}
              onChange={onRatingChange}
              disabled={fieldDisabled}
            />
          );
        }
        return (
          <ScaleField
            question={question}
            value={answer?.rating}
            onChange={onRatingChange}
            disabled={fieldDisabled}
          />
        );
      case 'yes_no':
        return (
          <YesNoField
            question={question}
            value={answer?.rating}
            onChange={onRatingChange}
            disabled={fieldDisabled}
          />
        );
      case 'choice':
        return (
          <ChoiceField
            question={question}
            value={answer?.selected}
            onChange={onSelectedChange}
            disabled={fieldDisabled}
          />
        );
      case 'text':
      default:
        // `default` falls to text rather than throwing: a template written by a
        // newer server than this bundle should degrade to a usable free-text
        // box, not a blank card.
        return (
          <TextField
            question={question}
            value={answer?.text ?? ''}
            onChange={onTextChange}
            disabled={fieldDisabled}
          />
        );
    }
  }

  return (
    <motion.div
      id={`question-${question._id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.04, 0.3),
        type: 'spring',
        stiffness: 260,
        damping: 26,
      }}
      // scroll-mt clears the sticky header when scrollIntoView targets a
      // missing question.
      className={`group/card relative scroll-mt-24 rounded-2xl border p-4 transition-all duration-200 sm:p-5 ${
        isMissing
          ? 'border-red-300 bg-red-50/50 ring-1 ring-red-200/50'
          : 'border-gray-100 bg-white shadow-sm hover:shadow-md'
      } `}
    >
      {/* Answered dot. Padded away from the label so a long question wrapping
          onto the dot's line does not run underneath it. */}
      {answered && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          aria-hidden="true"
          className="absolute right-4 top-5 block h-2 w-2 rounded-full bg-emerald-400"
        />
      )}

      <div
        className={`${answered ? 'pr-5' : ''} ${
          abstained ? 'pointer-events-none opacity-40' : ''
        }`.trim()}
      >
        {field()}
      </div>

      {/* The honest way out.
          Offered only to peers, and only while the form is editable. A peer who
          did not observe something has, without this, exactly two options: skip
          a required question and be unable to submit, or invent a middle
          answer. They pick the middle answer — which is indistinguishable from
          a considered "adequate" and quietly drags every average toward it. */}
      {canAbstain && !readOnly && (
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-3.5 py-2.5 transition-colors hover:border-gray-300 hover:bg-gray-50">
          <input
            type="checkbox"
            checked={abstained}
            onChange={(e) => onNotObservedChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-[#b20202] focus:ring-2 focus:ring-[#b20202]/30"
          />
          <span className="min-w-0 text-xs leading-relaxed text-gray-500">
            <span className="font-semibold text-gray-700">
              I haven’t seen enough to judge this
            </span>
            <span className="mt-0.5 block text-gray-400">
              Counts as answered and is left out of the averages — a better
              answer than guessing.
            </span>
          </span>
        </label>
      )}

      {/* ── The reviewer's note on THIS answer (Phase 5 §9.3) ──────────────
          Not a second answer: it is the sentence that makes a 3 mean
          something to the person who receives it. Kept beside the score rather
          than pooled into the summary box, because "which of these did you
          mean?" is the question a bare overall comment always leaves open.

          The employee reads it only after release — the same rule as the rest
          of the manager assessment — which the disclosure banner at the top of
          the form already states, so it is not repeated on every question. */}
      {canComment && onCommentChange && !readOnly && (
        <div className="mt-4">
          <label
            htmlFor={`comment-${question._id}`}
            className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
          >
            <PiChatText className="h-3.5 w-3.5" />
            Your note on this answer
            <span className="font-normal normal-case tracking-normal text-gray-300">
              optional
            </span>
          </label>
          <textarea
            id={`comment-${question._id}`}
            rows={2}
            value={answer?.comment ?? ''}
            onChange={(e) => onCommentChange(e.target.value)}
            disabled={abstained}
            maxLength={5000}
            placeholder="Why this score? A specific example helps more than a summary."
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm leading-relaxed text-gray-900 transition-all duration-200 placeholder:text-gray-300 focus:border-[#b20202]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#b20202]/15 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      )}

      {/* The same note on a submitted form, and on the reader's side. */}
      {answer?.comment && (readOnly || !canComment) && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <PiChatText className="h-3.5 w-3.5" />
            Reviewer’s note
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {answer.comment}
          </p>
        </div>
      )}

      {/* Read-only rendering of the same state, for a submitted form. */}
      {abstained && readOnly && (
        <p className="mt-3 text-xs font-medium italic text-gray-400">
          Marked “not observed” by this reviewer.
        </p>
      )}

      {isMissing && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600"
        >
          <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
          This question is required.
        </motion.p>
      )}
    </motion.div>
  );
}
