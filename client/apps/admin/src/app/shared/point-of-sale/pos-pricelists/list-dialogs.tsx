'use client';

import React from 'react';
import { PiTag } from 'react-icons/pi';
import ConfirmDialog from '@/app/shared/purchases/pricelists/confirm-dialog';
import type { Pricelist } from './types';

interface Props {
  deleteTarget: Pricelist | null;
  bulkConfirm: boolean;
  checkedCount: number;
  bulkBusy: boolean;
  selected: Pricelist | null;
  onConfirmDelete(): void;
  onCancelDelete(): void;
  onConfirmBulk(): void;
  onCancelBulk(): void;
}

export default function ListDialogs({
  deleteTarget,
  bulkConfirm,
  checkedCount,
  bulkBusy,
  selected,
  onConfirmDelete,
  onCancelDelete,
  onConfirmBulk,
  onCancelBulk,
}: Props) {
  return (
    <>
      {/* Single delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete pricelist?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" and its ${
                deleteTarget.rules?.length ?? 0
              } rule(s) will be permanently removed.`
            : ''
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />

      {/* Bulk delete confirmation */}
      <ConfirmDialog
        open={bulkConfirm}
        title={`Delete ${checkedCount} pricelist${checkedCount === 1 ? '' : 's'}?`}
        message={
          selected && checkedCount === 1
            ? `"${selected.name}" will be permanently removed.`
            : 'All selected pricelists and their rules will be permanently removed.'
        }
        confirmLabel={`Delete ${checkedCount}`}
        tone="danger"
        busy={bulkBusy}
        onConfirm={onConfirmBulk}
        onCancel={onCancelBulk}
      />
    </>
  );
}

export function EmptyPanel() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
        <PiTag className="h-7 w-7 text-gray-300" />
      </div>
      <p className="text-sm font-semibold text-gray-500">Select a pricelist</p>
      <p className="text-xs text-gray-400">Click a row to view and edit rules</p>
    </div>
  );
}
