'use client';
import { useEffect, useRef } from 'react';
import { PiWarning } from 'react-icons/pi';
import type { ReviewNavigation } from './useReviewNavigation';
export default function ReviewDiscardPrompt({
  intent,
  edited,
  onKeep,
  onDiscard,
}: {
  intent: ReviewNavigation;
  edited: number;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keep.current?.focus();
  }, [intent]);
  return (
    <section
      role="region"
      aria-label="Unsaved review changes"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onKeep();
        }
      }}
      className="max-h-[45dvh] shrink-0 overflow-y-auto border-t border-amber-200 bg-amber-50 px-4 py-4 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <PiWarning size={24} aria-hidden className="shrink-0 text-amber-700" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {intent === 'reload'
                ? 'Reload and discard your edits?'
                : 'Leave this review?'}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
              {edited > 0
                ? `${edited} edited price ${edited === 1 ? 'row has' : 'rows have'} not been saved. `
                : 'Your decline feedback has not been sent. '}
              {intent === 'reload'
                ? 'Reloading replaces your drafts with the latest listing and clears decline feedback.'
                : 'Closing discards your drafts and any unsent decline feedback.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            ref={keep}
            type="button"
            onClick={onKeep}
            className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="min-h-11 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Discard edits and {intent}
          </button>
        </div>
      </div>
    </section>
  );
}
