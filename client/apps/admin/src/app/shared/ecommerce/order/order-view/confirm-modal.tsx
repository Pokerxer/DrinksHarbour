'use client';

import React, { useEffect, useState } from 'react';
import { Button, Textarea } from 'rizzui';

export function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:hidden"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-gray-0 p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  withReason,
  reasonPlaceholder,
  loading,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  withReason?: boolean;
  reasonPlaceholder?: string;
  loading: boolean;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal onClose={onClose}>
      <h3 className="mb-1 text-base font-semibold text-gray-900">{title}</h3>
      <p className="mb-4 text-sm text-gray-500">{message}</p>
      {withReason && (
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={reasonPlaceholder ?? 'Add a reason (optional)'}
          className="mb-4"
          rows={3}
        />
      )}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(reason || undefined)}
          isLoading={loading}
          className={
            danger ? 'border-0 bg-red-500 text-white hover:bg-red-600' : ''
          }
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
