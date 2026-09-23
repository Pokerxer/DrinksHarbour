'use client';
import React from 'react';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Description,
} from '@headlessui/react';
export type DetailAction = 'archive' | 'restore' | 'delete';
export default function DetailActionDialog({
  action,
  name,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  action: DetailAction | null;
  name: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!action) return null;
  const label =
    action === 'delete'
      ? 'Delete'
      : action === 'restore'
        ? 'Restore'
        : 'Archive';
  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      className="relative z-[100]"
    >
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          aria-busy={busy}
        >
          <DialogTitle className="text-lg font-semibold">
            {label} product?
          </DialogTitle>
          <Description className="mt-2 break-words text-sm text-gray-600">
            {action === 'delete'
              ? `Delete your selling instance of “${name}”? This cannot be undone.`
              : action === 'restore'
                ? `Restore “${name}” to your active products?`
                : `Archive “${name}” from your active products? You can restore it later.`}
          </Description>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              data-autofocus
              disabled={busy}
              onClick={onClose}
              className="min-h-11 rounded-lg border px-4 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className={`min-h-11 rounded-lg px-4 text-white disabled:opacity-50 ${action === 'delete' ? 'bg-red-600' : 'bg-gray-900'}`}
            >
              {busy ? 'Working…' : label}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
