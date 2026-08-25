'use client';

import React from 'react';
import { PiX } from 'react-icons/pi';

export default function ModalHeader({
  isEdit,
  hint,
  onClose,
}: {
  isEdit: boolean;
  hint?: string;
  onClose(): void;
}) {
  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <div>
          <p className="text-sm font-bold text-gray-900">
            {isEdit ? 'Edit Price Rule' : 'Add Price Rule'}
          </p>
          <p className="text-[11px] text-gray-400">{hint}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <PiX className="h-4.5 w-4.5" />
        </button>
      </div>
    </>
  );
}
