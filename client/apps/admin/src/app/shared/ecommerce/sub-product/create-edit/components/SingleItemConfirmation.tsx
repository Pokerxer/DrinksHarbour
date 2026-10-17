'use client';

import { Button } from 'rizzui';
import FormDialog from './FormDialog';

export default function SingleItemConfirmation({
  open,
  count,
  onClose,
  onConfirm,
}: {
  open: boolean;
  count: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Sell without size variants?"
      description="Use one price and stock quantity for this item."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Keep size variants
          </Button>
          <Button type="button" onClick={onConfirm}>
            Use single item
          </Button>
        </>
      }
    >
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-gray-700">
        <strong className="text-gray-900">
          {count} configured size variant{count !== 1 ? 's' : ''}
        </strong>{' '}
        will be replaced by a single <strong>Unit</strong> item when you save.
      </div>
      <p className="mt-4 text-sm leading-relaxed text-gray-500">
        Your variants stay in this form until then. Turn size variants back on
        to restore them.
      </p>
    </FormDialog>
  );
}
