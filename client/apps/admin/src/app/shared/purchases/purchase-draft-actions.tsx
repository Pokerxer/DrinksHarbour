'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PiPencilSimple, PiTrash } from 'react-icons/pi';
import ConfirmDialog from '@/app/shared/confirm-dialog';
import { routes } from '@/config/routes';

export default function PurchaseDraftActions({
  orderId,
  orderNumber,
  busy,
  onDelete,
}: {
  orderId: string;
  orderNumber: string;
  busy: boolean;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Link
        href={routes.eCommerce.editPurchase(orderId)}
        aria-disabled={busy}
        onClick={(event) => {
          if (busy) event.preventDefault();
        }}
        className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] aria-disabled:opacity-50"
      >
        <PiPencilSimple className="h-4 w-4" /> Edit
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <PiTrash className="h-4 w-4" /> Delete
      </button>
      <ConfirmDialog
        open={confirming}
        title="Delete purchase order?"
        message={`Permanently delete ${orderNumber}?`}
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirming(false);
        }}
        onConfirm={async () => {
          await onDelete();
          setConfirming(false);
        }}
      />
    </>
  );
}
