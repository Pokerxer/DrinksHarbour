'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import { cancelSaleReason, lockableSale } from './sales-edit-policy';

const button =
  'min-h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 disabled:opacity-40';

export default function SalesEditControls({
  so,
  token,
  disabled,
  beforeLock,
  onChanged,
  onBusyChange,
}: {
  so: SalesOrder;
  token: string;
  disabled: boolean;
  beforeLock: () => Promise<boolean>;
  onChanged: (doc: SalesOrder) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const reason = cancelSaleReason(so);
  const busy = disabled || Boolean(action) || !token;

  async function run(kind: 'cancel' | 'lock' | 'confirm' | 'availability') {
    if (pending.current || busy || (kind === 'cancel' && reason)) return;
    pending.current = true;
    setAction(kind);
    setError('');
    onBusyChange(true);
    try {
      if ((kind === 'confirm' || (kind === 'lock' && !so.locked)) && !(await beforeLock()))
        throw new Error(
          'Save your pending changes before continuing.',
        );
      const result =
        kind === 'confirm' ? await salesOrderService.confirmReservation(so._id, token)
          : kind === 'availability' ? await salesOrderService.checkAvailability(so._id, token)
          : kind === 'cancel'
          ? await salesOrderService.cancel(so._id, token)
          : await salesOrderService.setLocked(so._id, !so.locked, token);
      setConfirmCancel(false);
      onChanged(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not update this document. Try again.',
      );
    } finally {
      pending.current = false;
      setAction('');
      onBusyChange(false);
    }
  }

  return (
    <section
      aria-label="Order actions"
      className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-white p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        {!so.locked && (so.docType === 'quotation' ? ['draft','sent','accepted'].includes(so.quoteStatus || '') : so.orderStatus === 'draft') && (
          <button type="button" className={button} disabled={busy} onClick={()=>void run('confirm')}>
            {action === 'confirm' ? 'Confirming…' : 'Confirm'}
          </button>
        )}
        {Boolean(so.reservationVersion) && ['confirmed','partially_fulfilled'].includes(so.orderStatus || '') && (
          <button type="button" className={button} disabled={busy} onClick={()=>void run('availability')}>
            {action === 'availability' ? 'Checking…' : 'Check availability'}
          </button>
        )}
        <button
          type="button"
          className={button}
          disabled={busy || !lockableSale(so)}
          onClick={() => void run('lock')}
        >
          {action === 'lock' ? 'Updating lock…' : so.locked ? 'Unlock' : 'Lock'}
        </button>
        <button
          type="button"
          className={button}
          disabled={busy || Boolean(reason)}
          onClick={() => setConfirmCancel(true)}
        >
          {so.docType === 'quotation' ? 'Cancel quotation' : 'Cancel order'}
        </button>
        <span role="status" className="text-xs text-gray-600">
          {so.locked
            ? 'Locked — unlock to change the document. Deliveries remain available.'
            : 'Unlocked — existing lifecycle editing rules apply.'}
        </span>
      </div>
      {reason && (
        <p className="text-xs text-gray-600">
          {reason}{' '}
          {so.docType === 'order' && (
            <>
              <Link
                className="text-brand underline"
                href={`/sales/returns/create?orderId=${so._id}`}
              >
                Review returns
              </Link>
              {' · '}
              <Link
                className="text-brand underline"
                href="/accounting/credit-notes?side=customer"
              >
                Review credits and refunds
              </Link>
            </>
          )}
        </p>
      )}
      {confirmCancel && (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="cancel-sale-title"
          className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3"
        >
          <h2 id="cancel-sale-title" className="text-sm font-semibold">
            Cancel {so.soNumber}?
          </h2>
          <p className="text-xs text-gray-700">
            Unsaved edits will be discarded. This closes the document; it releases unused reservations and does
            not return delivered goods or refund money.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => void run('cancel')}
            >
              {action === 'cancel' ? 'Cancelling…' : 'Confirm cancellation'}
            </button>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => setConfirmCancel(false)}
            >
              Keep document
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
