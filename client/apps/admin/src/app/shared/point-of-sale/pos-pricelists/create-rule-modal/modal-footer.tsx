'use client';

import React from 'react';
import { PiSpinner, PiWarning } from 'react-icons/pi';
import { BRAND } from '@/app/shared/point-of-sale/pricelist-constants';

interface Props {
  isEdit: boolean;
  saving: 'close' | 'new' | null;
  errorCount: number;
  onSaveClose(): void;
  onSaveNew(): void;
  onDiscard(): void;
}

export default function ModalFooter({
  isEdit,
  saving,
  errorCount,
  onSaveClose,
  onSaveNew,
  onDiscard,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white px-5 py-3">
      <button
        type="button"
        onClick={onSaveClose}
        disabled={!!saving}
        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: BRAND }}
      >
        {saving === 'close' && <PiSpinner className="h-3.5 w-3.5 animate-spin" />}
        {isEdit ? 'Save Changes' : 'Save & Close'}
      </button>
      {!isEdit && (
        <button
          type="button"
          onClick={onSaveNew}
          disabled={!!saving}
          className="flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-sm font-bold transition-colors hover:bg-opacity-10 disabled:opacity-50"
          style={{ borderColor: BRAND, color: BRAND }}
        >
          {saving === 'new' && <PiSpinner className="h-3.5 w-3.5 animate-spin" />}
          Save &amp; New
        </button>
      )}
      <button
        type="button"
        onClick={onDiscard}
        disabled={!!saving}
        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
      >
        {isEdit ? 'Cancel' : 'Discard'}
      </button>
      {errorCount > 0 && (
        <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-red-500">
          <PiWarning className="h-3.5 w-3.5" />
          {errorCount} error{errorCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
