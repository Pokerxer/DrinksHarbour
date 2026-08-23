'use client';

import { useEffect } from 'react';
import { PiWarningCircle } from 'react-icons/pi';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'brand';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        disabled={busy}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              tone === 'danger'
                ? 'bg-red-50 text-red-500'
                : 'bg-[#b20202]/10 text-[#b20202]'
            }`}
          >
            <PiWarningCircle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[#2a2420]">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{message}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-[#ece4d6] px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-[#FAF8F3] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
              tone === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#b20202] hover:bg-[#9a0101]'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
