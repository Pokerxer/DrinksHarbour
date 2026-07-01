// client/apps/admin/src/app/shared/sales/sales-confirm-modal.tsx
'use client';

import { PiX } from 'react-icons/pi';

export interface SalesConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Generic centered confirmation modal for sales actions. Mirrors the styling
 * language of sales-confirm-payment-modal.tsx.
 */
export default function SalesConfirmModal({
  open,
  title,
  body,
  confirmLabel = 'Ok',
  busy = false,
  onConfirm,
  onClose,
}: SalesConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label={title}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <p className="text-lg font-bold text-gray-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-6 text-sm text-gray-500">{body}</p>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
