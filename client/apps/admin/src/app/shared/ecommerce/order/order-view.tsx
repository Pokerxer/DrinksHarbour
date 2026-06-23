'use client';

import Image from 'next/image';
import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiCheckBold, PiWarningCircleBold, PiClockBold, PiSealCheckBold,
  PiGearBold, PiTruckBold, PiHouseBold, PiXCircleBold, PiArrowRightBold,
  PiHandCoinsBold, PiBankBold, PiCreditCardBold, PiDeviceMobileBold,
  PiWalletBold, PiArrowBendUpLeftBold,
} from 'react-icons/pi';
import { Title, Text, Button, Textarea } from 'rizzui';
import cn from '@core/utils/class-names';
import { formatDate } from '@core/utils/format-date';
import { orderService, type Order } from '@/services/order.service';

function formatCurrency(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Ordered steps (excludes terminal states cancelled/refunded)
const STATUS_STEPS = [
  { key: 'pending',    label: 'Order Placed',   description: 'Awaiting confirmation',    tsKey: 'placedAt',     Icon: PiClockBold },
  { key: 'confirmed',  label: 'Confirmed',       description: 'Order accepted',           tsKey: 'confirmedAt',  Icon: PiSealCheckBold },
  { key: 'processing', label: 'Processing',      description: 'Being packed & prepared',  tsKey: 'processingAt', Icon: PiGearBold },
  { key: 'shipped',    label: 'Shipped',         description: 'Out for delivery',         tsKey: 'shippedAt',    Icon: PiTruckBold },
  { key: 'delivered',  label: 'Delivered',       description: 'Received by customer',     tsKey: 'deliveredAt',  Icon: PiHouseBold },
] as const;

type StepKey = typeof STATUS_STEPS[number]['key'];

const NEXT_STATUS: Partial<Record<string, StepKey>> = {
  pending:    'confirmed',
  confirmed:  'processing',
  processing: 'shipped',
  shipped:    'delivered',
};

const NEXT_LABEL: Partial<Record<string, string>> = {
  pending:    'Confirm Order',
  confirmed:  'Mark Processing',
  processing: 'Mark Shipped',
  shipped:    'Mark Delivered',
};

function getStatusIndex(status: string) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

function shortDate(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${formatDate(d, 'MMM D')} · ${formatDate(d, 'h:mm A')}`;
}

// ─── Confirmation modal ──────────────────────────────────────────────────────
function ConfirmModal({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
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
            className={danger ? 'bg-red-500 hover:bg-red-600 text-white border-0' : ''}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Status stepper ──────────────────────────────────────────────────────────
function StatusStepper({
  order,
  onUpdate,
}: {
  order: Order;
  onUpdate: (updated: Order) => void;
}) {
  const { data: session } = useSession();
  const [modal, setModal] = useState<'advance' | 'cancel' | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';
  const isRefunded  = order.status === 'refunded';
  const isTerminal  = isCancelled || isDelivered || isRefunded;
  const currentIdx  = getStatusIndex(order.status);
  const nextStatus  = NEXT_STATUS[order.status];

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function doUpdate(status: string, reason?: string) {
    const token = (session?.user as any)?.token;
    if (!token) return;
    setBusy(true);
    try {
      const updated = await orderService.updateStatus(token, order._id, status, reason);
      onUpdate(updated);
      showToast(`Order marked as ${status}`);
    } catch (e: any) {
      showToast(e.message ?? 'Update failed', false);
    } finally {
      setBusy(false);
      setModal(null);
    }
  }

  return (
    <div>
      {/* Timeline */}
      {isCancelled ? (
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <PiXCircleBold className="h-7 w-7 text-red-500" />
          </div>
          <p className="text-sm font-semibold text-red-600">Order Cancelled</p>
          {order.cancelledAt && (
            <p className="mt-0.5 text-xs text-gray-400">{shortDate(order.cancelledAt)}</p>
          )}
          {order.cancelReason && (
            <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              {order.cancelReason}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-0">
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentIdx;
            const isActive    = idx === currentIdx;
            const isFuture    = idx > currentIdx;
            const ts = (order as any)[step.tsKey] as string | undefined;

            return (
              <div key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                {/* Connector line */}
                {idx < STATUS_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'absolute left-[17px] top-9 h-[calc(100%-20px)] w-0.5',
                      isCompleted ? 'bg-primary' : 'bg-gray-100'
                    )}
                  />
                )}

                {/* Icon */}
                <div
                  className={cn(
                    'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                    isCompleted && 'border-primary bg-primary text-white',
                    isActive    && 'border-primary bg-white text-primary shadow-md shadow-primary/20',
                    isFuture    && 'border-gray-200 bg-gray-50 text-gray-300'
                  )}
                >
                  {isCompleted
                    ? <PiCheckBold className="h-4 w-4" />
                    : <step.Icon className="h-4 w-4" />
                  }
                </div>

                {/* Label */}
                <div className="flex-1 pt-1">
                  <p className={cn(
                    'text-sm font-semibold leading-tight',
                    isCompleted || isActive ? 'text-gray-900' : 'text-gray-400'
                  )}>
                    {step.label}
                    {isActive && (
                      <span className="ms-2 inline-block rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        Current
                      </span>
                    )}
                  </p>
                  {ts ? (
                    <p className="mt-0.5 text-[11px] text-gray-400">{shortDate(ts)}</p>
                  ) : (
                    <p className={cn('mt-0.5 text-[11px]', isFuture ? 'text-gray-300' : 'text-gray-400')}>
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      {!isTerminal && (
        <div className="mt-5 space-y-2 border-t border-muted pt-4">
          {nextStatus && (
            <Button
              className="w-full gap-2"
              onClick={() => setModal('advance')}
              disabled={busy}
            >
              <PiArrowRightBold className="h-4 w-4" />
              {NEXT_LABEL[order.status]}
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full gap-2 border-red-200 text-red-500 hover:bg-red-50"
            onClick={() => setModal('cancel')}
            disabled={busy}
          >
            <PiXCircleBold className="h-4 w-4" />
            Cancel Order
          </Button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl',
          toast.ok ? 'bg-green-600' : 'bg-red-500'
        )}>
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {modal === 'advance' && nextStatus && (
        <ConfirmModal
          title={NEXT_LABEL[order.status] ?? 'Update Status'}
          message={`Move this order from "${order.status}" to "${nextStatus}"?`}
          confirmLabel="Yes, update"
          loading={busy}
          onConfirm={() => doUpdate(nextStatus)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'cancel' && (
        <ConfirmModal
          title="Cancel Order"
          message="This will cancel the order and restore stock. This action cannot be undone."
          confirmLabel="Cancel Order"
          danger
          withReason
          reasonPlaceholder="Reason for cancellation (optional)"
          loading={busy}
          onConfirm={(reason) => doUpdate('cancelled', reason)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function WidgetCard({
  title,
  className,
  children,
  childrenWrapperClass,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
  childrenWrapperClass?: string;
}) {
  return (
    <div className={className}>
      {title && (
        <Title as="h3" className="mb-3.5 text-base font-semibold @5xl:mb-5 4xl:text-lg">
          {title}
        </Title>
      )}
      <div className={cn('rounded-lg border border-muted px-5 @sm:px-7 @5xl:rounded-xl', childrenWrapperClass)}>
        {children}
      </div>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-green-lighter text-green-dark',
    pending: 'bg-yellow-lighter text-yellow-dark',
    failed: 'bg-red-lighter text-red-dark',
    refunded: 'bg-blue-lighter text-blue-dark',
  };
  return (
    <span className={cn('rounded-3xl px-2.5 py-1 text-xs font-medium', map[status] ?? 'bg-gray-100 text-gray-600')}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse @container">
      <div className="h-12 rounded bg-gray-100 mb-6" />
      <div className="@5xl:grid @5xl:grid-cols-12 @5xl:gap-7 @6xl:grid-cols-10 @7xl:gap-10">
        <div className="space-y-4 @5xl:col-span-8 @6xl:col-span-7">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded bg-gray-100" />
          ))}
        </div>
        <div className="space-y-4 pt-8 @5xl:col-span-4 @5xl:pt-0 @6xl:col-span-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Payment panel ──────────────────────────────────────────────────────────

const METHOD_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  cash_on_delivery: { label: 'Cash on Delivery', Icon: PiHandCoinsBold,    color: 'text-amber-600 bg-amber-50'  },
  bank_transfer:    { label: 'Bank Transfer',     Icon: PiBankBold,         color: 'text-blue-600 bg-blue-50'    },
  card:             { label: 'Card Payment',      Icon: PiCreditCardBold,   color: 'text-violet-600 bg-violet-50'},
  mobile_money:     { label: 'Mobile Money',      Icon: PiDeviceMobileBold, color: 'text-green-600 bg-green-50'  },
  wallet:           { label: 'Wallet',            Icon: PiWalletBold,       color: 'text-indigo-600 bg-indigo-50'},
};

const PAY_STATUS_STYLE: Record<string, string> = {
  paid:                'bg-green-50 text-green-700 border-green-200',
  pending:             'bg-amber-50 text-amber-700 border-amber-200',
  failed:              'bg-red-50 text-red-700 border-red-200',
  refunded:            'bg-blue-50 text-blue-700 border-blue-200',
  partially_refunded:  'bg-purple-50 text-purple-700 border-purple-200',
};

function PaymentPanel({
  order,
  onUpdate,
}: {
  order: Order;
  onUpdate: (o: Order) => void;
}) {
  const { data: session } = useSession();
  const [modal, setModal] = useState<'paid' | 'failed' | 'refund' | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [refField, setRefField] = useState('');
  const [notesField, setNotesField] = useState('');
  const [refundAmt, setRefundAmt] = useState('');

  const method = METHOD_META[order.paymentMethod] ?? {
    label: order.paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    Icon: PiCreditCardBold,
    color: 'text-gray-600 bg-gray-50',
  };
  const { Icon } = method;

  const isPaid       = order.paymentStatus === 'paid';
  const isPending    = order.paymentStatus === 'pending';
  const isFailed     = order.paymentStatus === 'failed';
  const isRefunded   = ['refunded', 'partially_refunded'].includes(order.paymentStatus);
  const isCOD        = order.paymentMethod === 'cash_on_delivery';
  const isBank       = order.paymentMethod === 'bank_transfer';
  const isAutomatic  = ['card'].includes(order.paymentMethod); // paid by webhook

  const canMarkPaid    = isPending || isFailed;
  const canMarkRefund  = isPaid && !isRefunded;
  const canMarkFailed  = isPending;

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function doAction(
    action: 'mark_paid' | 'mark_failed' | 'mark_refunded',
    opts: { reference?: string; notes?: string; amount?: number } = {}
  ) {
    const token = (session?.user as any)?.token;
    if (!token) return;
    setBusy(true);
    try {
      const updated = await orderService.updatePayment(token, order._id, action, opts);
      onUpdate(updated);
      showToast(
        action === 'mark_paid'     ? 'Payment marked as received' :
        action === 'mark_failed'   ? 'Payment marked as failed'   :
        'Refund recorded'
      );
    } catch (e: any) {
      showToast(e.message ?? 'Action failed', false);
    } finally {
      setBusy(false);
      setModal(null);
      setRefField('');
      setNotesField('');
      setRefundAmt('');
    }
  }

  const ref = order.paymentReference || order.paymentDetails?.reference;
  const txId = order.paymentDetails?.transactionId;
  const channel = order.paymentDetails?.channel;
  const paidAt = order.paidAt || order.paymentDetails?.paidAt;

  return (
    <div>
      {/* Method + status header */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-muted bg-gray-50/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', method.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{method.label}</p>
            <p className="text-xs text-gray-500">{formatCurrency(order.totalAmount, order.currency)}</p>
          </div>
        </div>
        <span className={cn(
          'rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
          PAY_STATUS_STYLE[order.paymentStatus] ?? 'bg-gray-100 text-gray-600 border-gray-200'
        )}>
          {order.paymentStatus.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Transaction details */}
      {(ref || txId || paidAt || channel || order.paymentDetails?.notes || order.paymentDetails?.failureReason) && (
        <div className="mt-3 space-y-1.5 rounded-xl border border-muted px-4 py-3 text-xs">
          {ref && (
            <div className="flex justify-between">
              <span className="text-gray-400">Reference</span>
              <span className="font-mono font-medium text-gray-700">{ref}</span>
            </div>
          )}
          {txId && (
            <div className="flex justify-between">
              <span className="text-gray-400">Transaction ID</span>
              <span className="font-mono font-medium text-gray-700 break-all text-right max-w-[55%]">{txId}</span>
            </div>
          )}
          {channel && (
            <div className="flex justify-between">
              <span className="text-gray-400">Channel</span>
              <span className="font-medium text-gray-700 capitalize">{channel}</span>
            </div>
          )}
          {paidAt && (
            <div className="flex justify-between">
              <span className="text-gray-400">Paid at</span>
              <span className="font-medium text-gray-700">{shortDate(paidAt)}</span>
            </div>
          )}
          {order.paymentDetails?.notes && (
            <div className="flex justify-between">
              <span className="text-gray-400">Notes</span>
              <span className="font-medium text-gray-700">{order.paymentDetails.notes}</span>
            </div>
          )}
          {order.paymentDetails?.failureReason && (
            <div className="flex justify-between">
              <span className="text-gray-400">Failure reason</span>
              <span className="font-medium text-red-600">{order.paymentDetails.failureReason}</span>
            </div>
          )}
        </div>
      )}

      {/* Refund details */}
      {order.refundDetails && (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-xs">
          <p className="mb-1 font-semibold text-blue-700">Refund Details</p>
          {order.refundDetails.amount && (
            <div className="flex justify-between">
              <span className="text-blue-500">Amount</span>
              <span className="font-medium text-blue-700">{formatCurrency(order.refundDetails.amount, order.currency)}</span>
            </div>
          )}
          {order.refundDetails.reason && (
            <div className="flex justify-between">
              <span className="text-blue-500">Reason</span>
              <span className="font-medium text-blue-700">{order.refundDetails.reason}</span>
            </div>
          )}
          {order.refundDetails.createdAt && (
            <div className="flex justify-between">
              <span className="text-blue-500">Processed</span>
              <span className="font-medium text-blue-700">{shortDate(order.refundDetails.createdAt)}</span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {(canMarkPaid || canMarkRefund || canMarkFailed) && (
        <div className="mt-4 space-y-2 border-t border-muted pt-4">
          {canMarkPaid && (
            <Button className="w-full gap-2" onClick={() => setModal('paid')} disabled={busy}>
              <PiCheckBold className="h-4 w-4" />
              {isCOD  ? 'Mark Cash Received' :
               isBank ? 'Verify & Mark Paid' :
                        'Mark as Paid'}
            </Button>
          )}
          {canMarkRefund && (
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

      {/* COD guidance note */}
      {isCOD && isPending && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Mark cash as received once the delivery rider confirms collection.
        </p>
      )}
      {isBank && isPending && (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Verify the transfer in your bank portal before confirming payment.
        </p>
      )}
      {isAutomatic && isPending && (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Card payments are confirmed automatically via webhook.
        </p>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl',
          toast.ok ? 'bg-green-600' : 'bg-red-500'
        )}>
          {toast.msg}
        </div>
      )}

      {/* ── Mark paid modal ─────────────────────────── */}
      {modal === 'paid' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-semibold text-gray-900">
              {isCOD ? 'Confirm Cash Received' : isBank ? 'Verify Payment' : 'Mark as Paid'}
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              {isCOD
                ? 'Confirm that cash has been collected from the customer.'
                : isBank
                ? 'Enter the bank reference number to confirm this transfer was received.'
                : 'Manually mark this order as paid.'}
            </p>
            {(isBank || !isCOD) && (
              <input
                type="text"
                value={refField}
                onChange={(e) => setRefField(e.target.value)}
                placeholder={isBank ? 'Bank reference / transaction ID' : 'Reference (optional)'}
                className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
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
              <Button variant="outline" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button
                onClick={() => doAction('mark_paid', { reference: refField || undefined, notes: notesField || undefined })}
                isLoading={busy}
              >
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mark failed modal ────────────────────────── */}
      {modal === 'failed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-semibold text-gray-900">Mark Payment as Failed</h3>
            <p className="mb-4 text-sm text-gray-500">This will flag the payment as failed. The order status will remain unchanged.</p>
            <Textarea
              value={notesField}
              onChange={(e) => setNotesField(e.target.value)}
              placeholder="Reason for failure (optional)"
              className="mb-4"
              rows={2}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button
                className="bg-red-500 hover:bg-red-600 text-white border-0"
                onClick={() => doAction('mark_failed', { notes: notesField || undefined })}
                isLoading={busy}
              >
                Mark Failed
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Refund modal ─────────────────────────────── */}
      {modal === 'refund' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-semibold text-gray-900">Issue Refund</h3>
            <p className="mb-4 text-sm text-gray-500">
              Full order total is {formatCurrency(order.totalAmount, order.currency)}. Leave amount blank for a full refund.
            </p>
            <input
              type="number"
              value={refundAmt}
              onChange={(e) => setRefundAmt(e.target.value)}
              placeholder={`Amount (max ${order.totalAmount})`}
              min={0}
              max={order.totalAmount}
              className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <Textarea
              value={notesField}
              onChange={(e) => setNotesField(e.target.value)}
              placeholder="Reason for refund"
              className="mb-4"
              rows={2}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                onClick={() => doAction('mark_refunded', {
                  amount: refundAmt ? Number(refundAmt) : undefined,
                  notes: notesField || undefined,
                })}
                isLoading={busy}
              >
                Confirm Refund
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderView({
  orderId,
  initialOrder,
}: {
  orderId: string;
  initialOrder?: Order | null;
}) {
  const { data: session } = useSession();
  const [order, setOrder] = useState<Order | null>(initialOrder ?? null);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialOrder) return; // server already provided data
    const token = (session?.user as any)?.token;
    if (!token || !orderId) return;
    setLoading(true);
    orderService
      .getOrder(token, orderId)
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [(session?.user as any)?.token, orderId]);

  if (loading) return <LoadingSkeleton />;

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <PiWarningCircleBold className="mb-3 h-12 w-12 text-red-500" />
        <Title as="h3" className="mb-1 text-lg font-semibold">Order not found</Title>
        <Text className="text-gray-500">{error ?? 'Could not load this order.'}</Text>
      </div>
    );
  }

  const addr = order.shippingAddress;

  // Customer info lives in shippingAddress; user is a fallback for logged-in orders
  const customerName =
    addr?.fullName ||
    (order.user ? `${order.user.firstName} ${order.user.lastName}` : '—');
  const customerEmail = addr?.email ?? order.user?.email ?? '—';
  const customerPhone = addr?.phone ?? '—';

  return (
    <div className="@container">
      {/* Header bar */}
      <div className="flex flex-wrap justify-center border-b border-t border-gray-300 py-4 font-medium text-gray-700 @5xl:justify-start">
        <span className="my-2 border-r border-muted px-5 py-0.5 first:ps-0 last:border-r-0">
          {formatDate(new Date(order.placedAt), 'MMMM D, YYYY')} at{' '}
          {formatDate(new Date(order.placedAt), 'h:mm A')}
        </span>
        <span className="my-2 border-r border-muted px-5 py-0.5 first:ps-0 last:border-r-0">
          {order.items.length} {order.items.length === 1 ? 'Item' : 'Items'}
        </span>
        <span className="my-2 border-r border-muted px-5 py-0.5 first:ps-0 last:border-r-0">
          Total {formatCurrency(order.totalAmount, order.currency)}
        </span>
        <span className="my-2 ms-2">
          <PaymentBadge status={order.paymentStatus} />
        </span>
      </div>

      <div className="items-start pt-10 @5xl:grid @5xl:grid-cols-12 @5xl:gap-7 @6xl:grid-cols-10 @7xl:gap-10">
        {/* Left column */}
        <div className="space-y-7 @5xl:col-span-8 @5xl:space-y-10 @6xl:col-span-7">
          {/* Items table */}
          <div className="pb-5">
            <Title as="h3" className="mb-3.5 text-base font-semibold @5xl:mb-5 @7xl:text-lg">
              Order Items
            </Title>
            <div className="overflow-x-auto rounded-lg border border-muted">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3 text-left">Product</th>
                    <th className="px-5 py-3 text-right">Unit Price</th>
                    <th className="px-5 py-3 text-center">Qty</th>
                    <th className="px-5 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted">
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {item.product?.images?.[0]?.url ? (
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
                              <Image
                                src={item.product.images[0].url}
                                alt={item.product?.name ?? ''}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-10 w-10 shrink-0 rounded-md bg-gray-100" />
                          )}
                          <div>
                            <p className="font-medium text-gray-800">{item.product?.name ?? '—'}</p>
                            {item.subproduct?.name && (
                              <p className="text-xs text-gray-500">{item.subproduct.name}</p>
                            )}
                            {item.size?.name && (
                              <p className="text-xs text-gray-500">Size: {item.size.name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">{formatCurrency(item.priceAtPurchase, order.currency)}</td>
                      <td className="px-5 py-4 text-center font-semibold">{item.quantity}</td>
                      <td className="px-5 py-4 text-right">{formatCurrency(item.itemSubtotal, order.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vendor Revenue Breakdown */}
            {(() => {
              // Group items by tenant
              const vendorMap = new Map<string, { name: string; revenue: number; payout: number; items: number }>();
              for (const item of order.items) {
                const id   = item.tenant?._id   ?? '__unknown__';
                const name = item.tenant?.name  ?? 'Unknown Vendor';
                const existing = vendorMap.get(id) ?? { name, revenue: 0, payout: 0, items: 0 };
                vendorMap.set(id, {
                  name,
                  revenue: existing.revenue + item.itemSubtotal,
                  payout:  existing.payout  + (item.tenantRevenueShare ?? 0),
                  items:   existing.items   + item.quantity,
                });
              }
              const vendors = [...vendorMap.values()];
              if (vendors.length === 0) return null;
              return (
                <div className="mt-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Vendor Revenue</p>
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    {vendors.map((v, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 bg-white hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-[11px] font-bold shrink-0">
                            {v.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{v.name}</p>
                            <p className="text-xs text-gray-400">{v.items} item{v.items !== 1 ? 's' : ''} · revenue {formatCurrency(v.revenue, order.currency)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-700">{formatCurrency(v.payout, order.currency)}</p>
                          <p className="text-[10px] text-gray-400">vendor payout</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Totals */}
            <div className="border-t border-muted pt-7 @5xl:mt-3">
              <div className="ms-auto max-w-lg space-y-4">
                <div className="flex justify-between text-sm font-medium text-gray-700">
                  Subtotal <span>{formatCurrency(order.subtotal, order.currency)}</span>
                </div>
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-sm font-medium text-green-600">
                    Discount <span>-{formatCurrency(order.discountTotal, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium text-gray-700">
                  Shipping <span>{order.shippingFee === 0 ? 'Free' : formatCurrency(order.shippingFee, order.currency)}</span>
                </div>
                {order.taxAmount > 0 && (
                  <div className="flex justify-between text-sm font-medium text-gray-700">
                    Tax <span>{formatCurrency(order.taxAmount, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-muted pt-4 text-base font-semibold">
                  Total <span>{formatCurrency(order.totalAmount, order.currency)}</span>
                </div>
                {order.platformCommissionTotal != null && order.platformCommissionTotal > 0 && (
                  <div className="flex justify-between items-center rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
                    Platform Profit
                    <span>{formatCurrency(order.platformCommissionTotal, order.currency)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment */}
          <div>
            <Title as="h3" className="mb-3.5 text-base font-semibold @5xl:mb-5 @7xl:text-lg">
              Payment
            </Title>
            <PaymentPanel order={order} onUpdate={setOrder} />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-7 pt-8 @container @5xl:col-span-4 @5xl:space-y-10 @5xl:pt-0 @6xl:col-span-3">
          {/* Order Status */}
          <WidgetCard title="Order Status" childrenWrapperClass="p-5 @5xl:p-6">
            <StatusStepper order={order} onUpdate={setOrder} />
          </WidgetCard>

          {/* Customer */}
          <WidgetCard title="Customer Details" childrenWrapperClass="py-5 @5xl:py-8">
            <div className="space-y-2.5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Name</p>
                <p className="text-sm font-medium text-gray-800">{customerName}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Email</p>
                <p className="break-all text-sm text-gray-700">{customerEmail}</p>
              </div>
              {customerPhone !== '—' && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Phone</p>
                  <p className="text-sm text-gray-700">{customerPhone}</p>
                </div>
              )}
              {order.user && (
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                    Registered customer
                  </span>
                </div>
              )}
            </div>
          </WidgetCard>

          {/* Shipping Address */}
          {addr && (
            <WidgetCard title="Shipping Address" childrenWrapperClass="@5xl:py-6 py-5">
              <div className="space-y-2.5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Address</p>
                  <p className="text-sm text-gray-700">
                    {[addr.addressLine1, addr.addressLine2].filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {addr.city && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">City</p>
                      <p className="text-sm text-gray-700">{addr.city}</p>
                    </div>
                  )}
                  {addr.state && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">State</p>
                      <p className="text-sm text-gray-700">{addr.state}</p>
                    </div>
                  )}
                  {addr.postalCode && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Postal Code</p>
                      <p className="text-sm text-gray-700">{addr.postalCode}</p>
                    </div>
                  )}
                  {addr.country && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Country</p>
                      <p className="text-sm text-gray-700">{addr.country}</p>
                    </div>
                  )}
                </div>
                {order.shippingMethod && (
                  <div className="border-t border-muted pt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Shipping Method</p>
                    <p className="text-sm text-gray-700 capitalize">{order.shippingMethod.replace(/_/g, ' ')}</p>
                  </div>
                )}
                {order.shippingInfo?.estimatedDelivery && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Est. Delivery</p>
                    <p className="text-sm text-gray-700">{order.shippingInfo.estimatedDelivery}</p>
                  </div>
                )}
              </div>
            </WidgetCard>
          )}

          {/* Order Number */}
          <WidgetCard title="Order Info" childrenWrapperClass="py-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Order #</span>
              <span className="font-medium">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Placed</span>
              <span className="font-medium">{formatDate(new Date(order.placedAt), 'MMM D, YYYY')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Currency</span>
              <span className="font-medium">{order.currency}</span>
            </div>
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}
