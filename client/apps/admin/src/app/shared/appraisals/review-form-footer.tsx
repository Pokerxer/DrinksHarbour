'use client';

import {
  PiArrowDown,
  PiCheckCircle,
  PiCloudCheck,
  PiSpinnerGap,
  PiWarningCircle,
} from 'react-icons/pi';
import { Button } from 'rizzui';
import type { SaveState } from './review-form-utils';

/**
 * The autosave chip.
 *
 * Deliberately quiet: three of its five states are grey. A reviewer who has to
 * read a status line to find out whether their work survived has already been
 * failed by the design — the chip exists so that the ONE state that needs
 * action ('error') is visible and clickable, and so the reviewer who is
 * wondering can confirm without hunting.
 */
function SaveStatus({
  state,
  label,
  onRetry,
}: {
  state: SaveState;
  label: string | null;
  onRetry: () => void;
}) {
  if (!label) return null;

  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200/60 transition-colors hover:bg-red-100"
      >
        <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
        {label}
      </button>
    );
  }

  const icon =
    state === 'saving' ? (
      <PiSpinnerGap className="h-3.5 w-3.5 shrink-0 animate-spin" />
    ) : state === 'saved' ? (
      <PiCloudCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
    ) : (
      <PiCheckCircle className="h-3.5 w-3.5 shrink-0 text-gray-300" />
    );

  return (
    <span
      // polite, not assertive: this updates on a timer and must not interrupt
      // a screen-reader user mid-question.
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-xs text-gray-400"
    >
      {icon}
      {label}
    </span>
  );
}

export default function ReviewFormFooter({
  canDecline,
  saving,
  submitting,
  answered,
  total,
  saveState,
  saveLabel,
  hasGap,
  onJumpToGap,
  onSaveDraft,
  onSubmit,
  onDecline,
}: {
  canDecline: boolean;
  saving: boolean;
  submitting: boolean;
  answered: number;
  total: number;
  saveState: SaveState;
  saveLabel: string | null;
  /** True while any question is still unanswered — drives the jump control. */
  hasGap: boolean;
  onJumpToGap: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onDecline: () => void;
}) {
  const busy = saving || submitting;
  const allAnswered = answered === total && total > 0;

  return (
    /* The negative margins MUST mirror the parent's horizontal padding
       (reviewer-form: px-4 sm:px-6) so the bar bleeds to the container edge
       and no further — the previous md:-mx-10/lg:-mx-12 overhung a px-6
       container by 1rem a side and spilled the blur outside it.
       At `xl` the form sits in a grid column that carries no padding of its
       own, so the bleed is cancelled there or it would spill into the gap
       between the column and the section rail. */
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 sm:py-4 xl:mx-0 xl:rounded-t-2xl xl:border-x xl:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* Status line. Sits ABOVE the buttons on a phone (the buttons are the
            thumb target and belong at the bottom of the stack) and to their
            left everywhere else. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <SaveStatus
            state={saveState}
            label={saveLabel}
            onRetry={onSaveDraft}
          />

          {/* Jump-to-gap replaces the old dead "N questions remaining" text:
              same information, but it now takes the reviewer there. Hidden
              once the form is full, where it would scroll to nothing. */}
          {hasGap && (
            <button
              type="button"
              onClick={onJumpToGap}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-[#b20202] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PiArrowDown className="h-3 w-3 shrink-0" />
              {total - answered} unanswered
            </button>
          )}

          {canDecline && (
            <button
              type="button"
              onClick={onDecline}
              disabled={busy}
              className="text-xs text-gray-400 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Decline this request
            </button>
          )}
        </div>

        {/* Save + submit. Both grow to fill the row on a phone, where two small
            right-aligned buttons are an awkward thumb target. */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onSaveDraft}
            // Nothing to write and nothing in flight: a button that fires a
            // no-op PATCH and toasts "Draft saved" teaches the reviewer that
            // the word means nothing.
            disabled={busy || saveState === 'saved' || saveState === 'idle'}
            className="flex-1 rounded-xl px-4 text-sm sm:flex-none"
          >
            {saving ? (
              <span className="inline-flex items-center gap-1.5">
                <PiSpinnerGap className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </span>
            ) : (
              'Save draft'
            )}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={busy}
            className={`flex-1 rounded-xl px-5 text-sm font-semibold text-white shadow-md transition-all sm:flex-none ${
              allAnswered
                ? 'bg-[#b20202] shadow-[#b20202]/20 hover:bg-[#9f0101] hover:shadow-lg hover:shadow-[#b20202]/25'
                : 'bg-gray-800 shadow-gray-800/15 hover:bg-gray-900'
            }`}
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
    </div>
  );
}
