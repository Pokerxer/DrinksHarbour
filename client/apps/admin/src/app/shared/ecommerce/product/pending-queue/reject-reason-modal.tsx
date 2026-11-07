'use client';

/**
 * Reason-gathering modal for rejecting a pending central product.
 *
 * The server records the reason verbatim on the product and the audit log
 * (`justification`), so the queue never sends fewer than three trimmed
 * characters: submitting the form stays disabled until a real reason exists.
 * The field starts empty — no prefilled excuse — matching every other
 * destructive-confirmation dialog in the app.
 *
 * Accessibility: Escape + backdrop close (blocked while submitting), focus is
 * trapped inside the dialog so keyboard users never tab behind the overlay,
 * and validation/server errors announce politely (aria-live) next to the
 * reason field they belong to.
 */

import { useEffect, useRef, useState } from 'react';

const MIN_REASON_LENGTH = 3;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function RejectReasonModal({
  isOpen,
  productName,
  inFlight = false,
  errorMessage,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  productName: string;
  inFlight?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Re-open with a clean slate every time a new row is targeted.
  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !inFlight) onClose();
      if (e.key === 'Tab' && panelRef.current) {
        // Simple focus trap: cycle between the dialog's first/last focusables
        // so keyboard order never escapes the overlay beneath.
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panelRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    if (isOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, inFlight, onClose]);

  if (!isOpen) return null;
  const valid = reason.trim().length >= MIN_REASON_LENGTH;
  const tooShort = reason.trim().length > 0 && !valid;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={() => {
        if (!inFlight) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Reject product"
        aria-describedby="pending-queue-rejection-help"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-gray-900">Reject product</h2>
        <p className="mt-1 text-sm text-gray-500">
          Tell the submitting business why “{productName}” is being declined.
          They will see this reason.
        </p>

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid || inFlight) return;
            onSubmit(reason.trim());
          }}
        >
          <div>
            <label
              htmlFor="pending-queue-rejection-reason"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Rejection reason
            </label>
            <textarea
              id="pending-queue-rejection-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              aria-invalid={tooShort || undefined}
              placeholder="e.g. Duplicate of Cape Chardonnay"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-all focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/20"
            />
            {!tooShort && (
              <p
                id="pending-queue-rejection-help"
                className="mt-1.5 text-xs text-gray-500"
              >
                Be specific — the submitting business sees this text and a copy
                is saved to the product record.
              </p>
            )}
            {tooShort && (
              <p
                aria-live="polite"
                className="mt-1.5 text-xs text-red-600"
              >
                A reason of at least {MIN_REASON_LENGTH} characters is required
                before you can send it.
              </p>
            )}
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
            >
              {errorMessage}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              disabled={inFlight}
              onClick={onClose}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-[#b20202] disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid || inFlight}
              className="rounded-xl bg-[#b20202] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#7f1d1d] focus-visible:ring-2 focus-visible:ring-[#b20202] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {inFlight ? 'Rejecting…' : 'Reject product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
