'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  PiCheckBold,
  PiXCircleBold,
  PiHandCoinsBold,
  PiBankBold,
  PiCreditCardBold,
  PiDeviceMobileBold,
  PiWalletBold,
  PiGiftBold,
  PiArrowBendUpLeftBold,
} from 'react-icons/pi';
import { Button, Textarea } from 'rizzui';
import cn from '@core/utils/class-names';
import { orderService, type Order } from '@/services/order.service';
import { formatCurrency, shortDate, humanize } from './format';
import { Modal } from './confirm-modal';
import { PaymentBadge, Row } from './widgets';
import { useOrderSession } from './permissions';

const METHOD_META: Record<
  string,
  { label: string; Icon: React.ElementType; color: string }
> = {
  cash_on_delivery: {
    label: 'Cash on Delivery',
    Icon: PiHandCoinsBold,
    color: 'text-orange-600 bg-orange-500/10',
  },
  cash: {
    label: 'Cash',
    Icon: PiHandCoinsBold,
    color: 'text-orange-600 bg-orange-500/10',
  },
  bank_transfer: {
    label: 'Bank Transfer',
    Icon: PiBankBold,
    color: 'text-blue-600 bg-blue-500/10',
  },
  card: {
    label: 'Card Payment',
    Icon: PiCreditCardBold,
    color: 'text-violet-600 bg-violet-500/10',
  },
  mobile_money: {
    label: 'Mobile Money',
    Icon: PiDeviceMobileBold,
    color: 'text-green-600 bg-green-500/10',
  },
  wallet: {
    label: 'DH Wallet',
    Icon: PiWalletBold,
    color: 'text-indigo-600 bg-indigo-500/10',
  },
  gift_card: {
    label: 'Gift Card',
    Icon: PiGiftBold,
    color: 'text-pink-600 bg-pink-500/10',
  },
  split: {
    label: 'Split Payment',
    Icon: PiCreditCardBold,
    color: 'text-purple-600 bg-purple-500/10',
  },
};

export default function PaymentPanel({
  order,
  onUpdate,
}: {
  order: Order;
  onUpdate: (o: Order) => void;
}) {
  const { token, canManage } = useOrderSession();
  const [modal, setModal] = useState<'paid' | 'failed' | 'refund' | null>(null);
  const [busy, setBusy] = useState(false);
  const [refField, setRefField] = useState('');
  const [notesField, setNotesField] = useState('');
  const [refundAmt, setRefundAmt] = useState('');

  const method = METHOD_META[order.paymentMethod] ?? {
    label: humanize(order.paymentMethod),
    Icon: PiCreditCardBold,
    color: 'text-gray-600 bg-gray-500/10',
  };
  const { Icon } = method;

  const isPaid = order.paymentStatus === 'paid';
  const isPending = order.paymentStatus === 'pending';
  const isFailed = order.paymentStatus === 'failed';
  const isRefunded = ['refunded', 'partially_refunded'].includes(
    order.paymentStatus
  );
  const isCOD = ['cash_on_delivery', 'cash'].includes(order.paymentMethod);
  const isBank = order.paymentMethod === 'bank_transfer';
  const isAutomatic = order.paymentMethod === 'card'; // confirmed by gateway webhook

  const canMarkPaid = isPending || isFailed;
  const canMarkRefund = isPaid && !isRefunded;
  const canMarkFailed = isPending;

  function closeModal() {
    setModal(null);
    setRefField('');
    setNotesField('');
    setRefundAmt('');
  }

  async function doAction(
    action: 'mark_paid' | 'mark_failed' | 'mark_refunded',
    opts: { reference?: string; notes?: string; amount?: number } = {}
  ) {
    if (!token) return toast.error('Session expired — sign in again');
    setBusy(true);
    try {
      const updated = await orderService.updatePayment(
        token,
        order._id,
        action,
        opts
      );
      onUpdate(updated);
      toast.success(
        action === 'mark_paid'
          ? 'Payment marked as received'
          : action === 'mark_failed'
            ? 'Payment marked as failed'
            : 'Refund recorded'
      );
      closeModal();
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const ref = order.paymentReference || order.paymentDetails?.reference;
  const txId = order.paymentDetails?.transactionId;
  const channel = order.paymentDetails?.channel;
  const paidAt = order.paidAt || order.paymentDetails?.paidAt;
  const splits = order.paymentDetails?.splitPayments ?? [];

  // Refund amount must never exceed what was actually collected.
  const alreadyRefunded =
    (order.refunds ?? []).reduce((s, r) => s + (r.totalRefunded ?? 0), 0) +
    (order.refundDetails?.amount ?? 0);
  const refundable = Math.max(0, (order.totalAmount ?? 0) - alreadyRefunded);
  const refundAmtNum = Number(refundAmt);
  const refundInvalid =
    refundAmt !== '' &&
    (!Number.isFinite(refundAmtNum) ||
      refundAmtNum <= 0 ||
      refundAmtNum > refundable);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-muted bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              method.color
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {method.label}
            </p>
            <p className="text-xs text-gray-500">
              {formatCurrency(order.totalAmount, order.currency)}
            </p>
          </div>
        </div>
        <PaymentBadge status={order.paymentStatus} />
      </div>

      {(ref ||
        txId ||
        paidAt ||
        channel ||
        splits.length > 0 ||
        order.paymentDetails?.notes ||
        order.paymentDetails?.failureReason) && (
        <div className="mt-3 space-y-1.5 rounded-xl border border-muted px-4 py-3">
          {ref && (
            <Row
              label="Reference"
              value={<span className="font-mono">{ref}</span>}
            />
          )}
          {txId && (
            <Row
              label="Transaction ID"
              value={<span className="break-all font-mono">{txId}</span>}
            />
          )}
          {channel && <Row label="Channel" value={humanize(channel)} />}
          {paidAt && <Row label="Paid at" value={shortDate(paidAt)} />}
          {splits.map((s, i) => (
            <Row
              key={i}
              label={`Split · ${humanize(s.method)}`}
              value={formatCurrency(s.amount, order.currency)}
            />
          ))}
          {typeof order.paymentDetails?.change === 'number' &&
            order.paymentDetails.change > 0 && (
              <Row
                label="Change given"
                value={formatCurrency(
                  order.paymentDetails.change,
                  order.currency
                )}
              />
            )}
          {order.paymentDetails?.notes && (
            <Row label="Notes" value={order.paymentDetails.notes} />
          )}
          {order.paymentDetails?.failureReason && (
            <Row
              label="Failure reason"
              value={order.paymentDetails.failureReason}
              tone="text-red-600"
            />
          )}
        </div>
      )}

      {order.refundDetails?.amount ? (
        <div className="mt-3 space-y-1.5 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
            Refund Details
          </p>
          <Row
            label="Amount"
            value={formatCurrency(order.refundDetails.amount, order.currency)}
          />
          {order.refundDetails.reason && (
            <Row label="Reason" value={order.refundDetails.reason} />
          )}
          {order.refundDetails.createdAt && (
            <Row
              label="Processed"
              value={shortDate(order.refundDetails.createdAt)}
            />
          )}
        </div>
      ) : null}

      {alreadyRefunded > 0 && (
        <div className="mt-3 flex justify-between rounded-xl bg-gray-50 px-4 py-2.5 text-xs">
          <span className="text-gray-500">Refunded to date</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(alreadyRefunded, order.currency)} ·{' '}
            {formatCurrency(refundable, order.currency)} remaining
          </span>
        </div>
      )}

      {canManage && (canMarkPaid || canMarkRefund || canMarkFailed) && (
        <div className="mt-4 space-y-2 border-t border-muted pt-4 print:hidden">
          {canMarkPaid && (
            <Button
              className="w-full gap-2"
              onClick={() => setModal('paid')}
              disabled={busy}
            >
              <PiCheckBold className="h-4 w-4" />
              {isCOD
                ? 'Mark Cash Received'
                : isBank
                  ? 'Verify & Mark Paid'
                  : 'Mark as Paid'}
            </Button>
          )}
          {canMarkRefund && refundable > 0 && (
            <Button
              variant="outline"
              className="w-full gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
              onClick={() => setModal('refund')}
              disabled={busy}
            >
              <PiArrowBendUpLeftBold className="h-4 w-4" />
              Issue Refund
            </Button>
          )}
          {canMarkFailed && !isCOD && (
            <Button
              variant="outline"
              className="w-full gap-2 border-red-200 text-red-500 hover:bg-red-50"
              onClick={() => setModal('failed')}
              disabled={busy}
            >
              <PiXCircleBold className="h-4 w-4" />
              Mark as Failed
            </Button>
          )}
        </div>
      )}

      {isCOD && isPending && (
        <p className="mt-3 rounded-lg bg-orange-500/10 px-3 py-2 text-xs text-orange-600 dark:text-orange-400 print:hidden">
          Mark cash as received once the delivery rider confirms collection.
        </p>
      )}
      {isBank && isPending && (
        <p className="mt-3 rounded-lg bg-blue-500/10 px-3 py-2 text-xs text-blue-600 dark:text-blue-400 print:hidden">
          Verify the transfer in your bank portal before confirming payment.
        </p>
      )}
      {isAutomatic && isPending && (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 print:hidden">
          Card payments are confirmed automatically via webhook.
        </p>
      )}

      {modal === 'paid' && (
        <Modal onClose={closeModal}>
          <h3 className="mb-1 text-base font-semibold text-gray-900">
            {isCOD
              ? 'Confirm Cash Received'
              : isBank
                ? 'Verify Payment'
                : 'Mark as Paid'}
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            {isCOD
              ? 'Confirm that cash has been collected from the customer.'
              : isBank
                ? 'Enter the bank reference number to confirm this transfer was received.'
                : 'Manually mark this order as paid.'}
          </p>
          {!isCOD && (
            <input
              type="text"
              value={refField}
              onChange={(e) => setRefField(e.target.value)}
              placeholder={
                isBank
                  ? 'Bank reference / transaction ID'
                  : 'Reference (optional)'
              }
              className="mb-3 w-full rounded-lg border border-muted bg-gray-0 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
            />
          )}
          <Textarea
            value={notesField}
            onChange={(e) => setNotesField(e.target.value)}
            placeholder="Notes (optional)"
            className="mb-4"
            rows={2}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeModal} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                doAction('mark_paid', {
                  reference: refField || undefined,
                  notes: notesField || undefined,
                })
              }
              isLoading={busy}
            >
              Confirm Payment
            </Button>
          </div>
        </Modal>
      )}

      {modal === 'failed' && (
        <Modal onClose={closeModal}>
          <h3 className="mb-1 text-base font-semibold text-gray-900">
            Mark Payment as Failed
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            This flags the payment as failed. The order status stays unchanged.
          </p>
          <Textarea
            value={notesField}
            onChange={(e) => setNotesField(e.target.value)}
            placeholder="Reason for failure (optional)"
            className="mb-4"
            rows={2}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeModal} disabled={busy}>
              Cancel
            </Button>
            <Button
              className="border-0 bg-red-500 text-white hover:bg-red-600"
              onClick={() =>
                doAction('mark_failed', { notes: notesField || undefined })
              }
              isLoading={busy}
            >
              Mark Failed
            </Button>
          </div>
        </Modal>
      )}

      {modal === 'refund' && (
        <Modal onClose={closeModal}>
          <h3 className="mb-1 text-base font-semibold text-gray-900">
            Issue Refund
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            Up to {formatCurrency(refundable, order.currency)} can still be
            refunded on this order. Leave the amount blank for a full refund.
          </p>
          <input
            type="number"
            value={refundAmt}
            onChange={(e) => setRefundAmt(e.target.value)}
            placeholder={`Amount (max ${refundable})`}
            min={0}
            max={refundable}
            aria-invalid={refundInvalid}
            className={cn(
              'mb-1 w-full rounded-lg border bg-gray-0 px-3 py-2 text-sm text-gray-900 focus:outline-none',
              refundInvalid
                ? 'border-red-400'
                : 'border-muted focus:border-primary'
            )}
          />
          {refundInvalid && (
            <p className="mb-2 text-xs text-red-600">
              Enter an amount between 1 and {refundable}.
            </p>
          )}
          <Textarea
            value={notesField}
            onChange={(e) => setNotesField(e.target.value)}
            placeholder="Reason for refund"
            className="mb-4 mt-2"
            rows={2}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeModal} disabled={busy}>
              Cancel
            </Button>
            <Button
              className="border-0 bg-blue-600 text-white hover:bg-blue-700"
              disabled={refundInvalid}
              onClick={() =>
                doAction('mark_refunded', {
                  amount: refundAmt ? refundAmtNum : undefined,
                  notes: notesField || undefined,
                })
              }
              isLoading={busy}
            >
              Confirm Refund
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
