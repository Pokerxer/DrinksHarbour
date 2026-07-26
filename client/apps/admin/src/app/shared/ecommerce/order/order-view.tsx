'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiCheckBold,
  PiWarningCircleBold,
  PiClockBold,
  PiSealCheckBold,
  PiGearBold,
  PiTruckBold,
  PiHouseBold,
  PiXCircleBold,
  PiArrowRightBold,
  PiHandCoinsBold,
  PiBankBold,
  PiCreditCardBold,
  PiDeviceMobileBold,
  PiWalletBold,
  PiArrowBendUpLeftBold,
  PiPrinterBold,
  PiStorefrontBold,
  PiPauseCircleBold,
  PiTicketBold,
  PiMapPinBold,
  PiUserBold,
  PiProhibitBold,
} from 'react-icons/pi';
import { Title, Text, Button, Textarea } from 'rizzui';
import cn from '@core/utils/class-names';
import { orderService, type Order } from '@/services/order.service';

function formatCurrency(amount?: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount as number) ? (amount as number) : 0);
}

/** Orders coming from older imports or POS holds can be missing timestamps —
 *  `new Date(undefined)` renders as "Invalid Date" if passed through blindly. */
function parseDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function shortDate(iso?: string | null) {
  const d = parseDate(iso);
  if (!d) return null;
  return `${d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}`;
}

function longDate(iso?: string | null) {
  const d = parseDate(iso);
  if (!d) return null;
  return d.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function humanize(v?: string) {
  return (v ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Ordered lifecycle. Terminal states (cancelled / refunded / hold) are rendered
// as their own card instead — they are not points on this line.
const STATUS_STEPS = [
  {
    key: 'pending',
    label: 'Order Placed',
    description: 'Awaiting confirmation',
    tsKey: 'placedAt',
    Icon: PiClockBold,
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    description: 'Order accepted',
    tsKey: 'confirmedAt',
    Icon: PiSealCheckBold,
  },
  {
    key: 'processing',
    label: 'Processing',
    description: 'Being packed & prepared',
    tsKey: 'processingAt',
    Icon: PiGearBold,
  },
  {
    key: 'shipped',
    label: 'Shipped',
    description: 'Out for delivery',
    tsKey: 'shippedAt',
    Icon: PiTruckBold,
  },
  {
    key: 'delivered',
    label: 'Delivered',
    description: 'Received by customer',
    tsKey: 'deliveredAt',
    Icon: PiHouseBold,
  },
] as const;

/** Statuses that sit off the happy path and get a dedicated card. Without this,
 *  a refunded or on-hold order fell through `findIndex → -1 → 0` and rendered
 *  as though it were still sitting at "Order Placed". */
const TERMINAL_STATES: Record<
  string,
  { label: string; tone: string; Icon: React.ElementType; tsKey?: string }
> = {
  cancelled: {
    label: 'Order Cancelled',
    tone: 'text-red-600',
    Icon: PiXCircleBold,
    tsKey: 'cancelledAt',
  },
  refunded: {
    label: 'Order Refunded',
    tone: 'text-blue-600',
    Icon: PiArrowBendUpLeftBold,
  },
  hold: { label: 'On Hold', tone: 'text-gray-600', Icon: PiPauseCircleBold },
};

const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'processing',
  processing: 'shipped',
  partially_shipped: 'shipped',
  shipped: 'delivered',
};

const NEXT_LABEL: Record<string, string> = {
  pending: 'Confirm Order',
  confirmed: 'Mark Processing',
  processing: 'Mark Shipped',
  partially_shipped: 'Mark Fully Shipped',
  shipped: 'Mark Delivered',
};

function getStatusIndex(status: string) {
  // partially_shipped isn't its own step — it sits at the shipped stage.
  if (status === 'partially_shipped')
    return STATUS_STEPS.findIndex((s) => s.key === 'shipped');
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

// ─── Confirmation modal ──────────────────────────────────────────────────────

function Modal({
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

// ─── Status stepper ──────────────────────────────────────────────────────────

function StatusStepper({
  order,
  onUpdate,
}: {
  order: Order;
  onUpdate: (o: Order) => void;
}) {
  const { data: session } = useSession();
  const [modal, setModal] = useState<'advance' | 'cancel' | null>(null);
  const [busy, setBusy] = useState(false);

  const terminal = TERMINAL_STATES[order.status];
  const currentIdx = getStatusIndex(order.status);
  const nextStatus = NEXT_STATUS[order.status];
  const canCancel = !terminal && order.status !== 'delivered';

  async function doUpdate(status: string, reason?: string) {
    const token = (session?.user as any)?.token;
    if (!token) return toast.error('Session expired — sign in again');
    setBusy(true);
    try {
      const updated = await orderService.updateStatus(
        token,
        order._id,
        status,
        reason
      );
      onUpdate(updated);
      toast.success(`Order marked as ${humanize(status).toLowerCase()}`);
      setModal(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {terminal ? (
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <terminal.Icon className={cn('h-7 w-7', terminal.tone)} />
          </div>
          <p className={cn('text-sm font-semibold', terminal.tone)}>
            {terminal.label}
          </p>
          {terminal.tsKey && shortDate((order as any)[terminal.tsKey]) && (
            <p className="mt-0.5 text-xs text-gray-400">
              {shortDate((order as any)[terminal.tsKey])}
            </p>
          )}
          {order.cancelReason && order.status === 'cancelled' && (
            <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              {order.cancelReason}
            </p>
          )}
          {/* Keep the trail visible so it's clear how far the order got */}
          <div className="mt-4 w-full border-t border-muted pt-3 text-start">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              History
            </p>
            <ul className="space-y-1">
              {STATUS_STEPS.map((s) => {
                const ts = shortDate((order as any)[s.tsKey]);
                if (!ts) return null;
                return (
                  <li key={s.key} className="flex justify-between text-xs">
                    <span className="text-gray-500">{s.label}</span>
                    <span className="text-gray-700">{ts}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : (
        <div>
          {order.status === 'partially_shipped' && (
            <p className="mb-4 rounded-lg bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-600 dark:text-purple-400">
              Partially shipped — some items are still with a vendor.
            </p>
          )}
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentIdx;
            const isActive = idx === currentIdx;
            const isFuture = idx > currentIdx;
            const ts = shortDate((order as any)[step.tsKey]);

            return (
              <div
                key={step.key}
                className="relative flex gap-3 pb-5 last:pb-0"
              >
                {idx < STATUS_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'absolute left-[17px] top-9 h-[calc(100%-20px)] w-0.5',
                      isCompleted ? 'bg-primary' : 'bg-gray-100'
                    )}
                  />
                )}

                <div
                  className={cn(
                    'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                    isCompleted &&
                      'border-primary bg-primary text-primary-foreground',
                    isActive &&
                      'border-primary bg-gray-0 text-primary shadow-md shadow-primary/20',
                    isFuture && 'border-muted bg-gray-50 text-gray-300'
                  )}
                >
                  {isCompleted ? (
                    <PiCheckBold className="h-4 w-4" />
                  ) : (
                    <step.Icon className="h-4 w-4" />
                  )}
                </div>

                <div className="flex-1 pt-1">
                  <p
                    className={cn(
                      'text-sm font-semibold leading-tight',
                      isCompleted || isActive
                        ? 'text-gray-900'
                        : 'text-gray-400'
                    )}
                  >
                    {step.label}
                    {isActive && (
                      <span className="ms-2 inline-block rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        Current
                      </span>
                    )}
                  </p>
                  {ts ? (
                    <p className="mt-0.5 text-[11px] text-gray-400">{ts}</p>
                  ) : (
                    <p
                      className={cn(
                        'mt-0.5 text-[11px]',
                        isFuture ? 'text-gray-300' : 'text-gray-400'
                      )}
                    >
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(nextStatus || canCancel) && (
        <div className="mt-5 space-y-2 border-t border-muted pt-4 print:hidden">
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
          {canCancel && (
            <Button
              variant="outline"
              className="w-full gap-2 border-red-200 text-red-500 hover:bg-red-50"
              onClick={() => setModal('cancel')}
              disabled={busy}
            >
              <PiXCircleBold className="h-4 w-4" />
              Cancel Order
            </Button>
          )}
        </div>
      )}

      {modal === 'advance' && nextStatus && (
        <ConfirmModal
          title={NEXT_LABEL[order.status] ?? 'Update Status'}
          message={`Move this order from "${humanize(order.status)}" to "${humanize(nextStatus)}"?`}
          confirmLabel="Yes, update"
          loading={busy}
          onConfirm={() => doUpdate(nextStatus)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'cancel' && (
        <ConfirmModal
          title="Cancel Order"
          message="This will cancel the order and return the reserved stock. This action cannot be undone."
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

// ─── Layout helpers ──────────────────────────────────────────────────────────

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
        <Title
          as="h3"
          className="mb-3.5 text-base font-semibold @5xl:mb-5 4xl:text-lg"
        >
          {title}
        </Title>
      )}
      <div
        className={cn(
          'rounded-lg border border-muted px-5 @sm:px-7 @5xl:rounded-xl',
          childrenWrapperClass
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="break-words text-sm text-gray-700">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="shrink-0 text-gray-400">{label}</span>
      <span className={cn('text-end font-medium text-gray-700', tone)}>
        {value}
      </span>
    </div>
  );
}

const PAY_STATUS_STYLE: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-600 ring-green-500/20 dark:text-green-400',
  pending:
    'bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-400',
  failed: 'bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400',
  refunded: 'bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400',
  partially_refunded:
    'bg-purple-500/10 text-purple-600 ring-purple-500/20 dark:text-purple-400',
};

function PaymentBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'rounded-3xl px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        PAY_STATUS_STYLE[status] ??
          'bg-gray-500/10 text-gray-600 ring-gray-500/20'
      )}
    >
      {humanize(status)}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse @container">
      <div className="mb-6 h-12 rounded bg-gray-100" />
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

// ─── Payment panel ───────────────────────────────────────────────────────────

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
    label: 'Wallet',
    Icon: PiWalletBold,
    color: 'text-indigo-600 bg-indigo-500/10',
  },
  split: {
    label: 'Split Payment',
    Icon: PiCreditCardBold,
    color: 'text-purple-600 bg-purple-500/10',
  },
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
    const token = (session?.user as any)?.token;
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

      {(canMarkPaid || canMarkRefund || canMarkFailed) && (
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

// ─── Refund history (POS partial returns) ────────────────────────────────────

function RefundHistory({ order }: { order: Order }) {
  const refunds = order.refunds ?? [];
  if (!refunds.length) return null;

  return (
    <div>
      <Title
        as="h3"
        className="mb-3.5 text-base font-semibold @5xl:mb-5 @7xl:text-lg"
      >
        Returns &amp; Refunds
      </Title>
      <div className="space-y-3">
        {refunds.map((r, i) => (
          <div key={i} className="rounded-xl border border-muted px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-gray-900">
                {r.receiptNumber ?? `Refund ${i + 1}`}
              </span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(r.totalRefunded, order.currency)}
              </span>
            </div>
            <div className="space-y-1">
              {shortDate(r.refundedAt) && (
                <Row label="Processed" value={shortDate(r.refundedAt)} />
              )}
              {r.paymentMethod && (
                <Row label="Method" value={humanize(r.paymentMethod)} />
              )}
              {r.reason && <Row label="Reason" value={r.reason} />}
            </div>
            {!!r.items?.length && (
              <ul className="mt-2 space-y-1 border-t border-muted pt-2">
                {r.items.map((line, li) => {
                  const product =
                    order.items[line.orderItemIndex ?? -1]?.product?.name;
                  return (
                    <li key={li} className="flex justify-between gap-3 text-xs">
                      <span className="text-gray-500">
                        {line.quantity ?? 0} ×{' '}
                        {product ?? `Item ${(line.orderItemIndex ?? 0) + 1}`}
                        {line.restock === false && (
                          <span className="ms-1 text-orange-500">
                            (not restocked)
                          </span>
                        )}
                      </span>
                      <span className="font-medium text-gray-700">
                        {formatCurrency(line.amount, order.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

function resolveCustomer(order: Order) {
  const addr = order.shippingAddress;
  const pos = order.paymentDetails?.customer;

  if (addr?.fullName || addr?.email || addr?.phone) {
    return {
      name:
        addr.fullName ||
        (order.user ? `${order.user.firstName} ${order.user.lastName}` : '—'),
      email: addr.email ?? order.user?.email ?? '',
      phone: addr.phone ?? '',
      kind: 'web' as const,
    };
  }
  if (pos?.firstName || pos?.phone) {
    return {
      name:
        [pos.firstName, pos.lastName].filter(Boolean).join(' ') ||
        'Walk-in customer',
      email: '',
      phone: pos.phone ?? '',
      kind: 'pos' as const,
    };
  }
  if (order.user) {
    return {
      name:
        `${order.user.firstName ?? ''} ${order.user.lastName ?? ''}`.trim() ||
        '—',
      email: order.user.email ?? '',
      phone: '',
      kind: 'account' as const,
    };
  }
  return { name: '—', email: '', phone: '', kind: 'unknown' as const };
}

export default function OrderView({
  orderId,
  initialOrder,
}: {
  orderId: string;
  initialOrder?: Order | null;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const [order, setOrder] = useState<Order | null>(initialOrder ?? null);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState<string | null>(null);
  const token = (session?.user as any)?.token;

  useEffect(() => {
    if (initialOrder) return; // server render already supplied the data
    if (sessionStatus === 'loading') return;
    if (!token || !orderId) {
      setLoading(false);
      setError('You are not signed in.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    orderService
      .getOrder(token, orderId)
      .then((o) => !cancelled && setOrder(o))
      .catch(
        (e: any) =>
          !cancelled && setError(e?.message ?? 'Could not load this order.')
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, orderId, initialOrder, sessionStatus]);

  if (loading) return <LoadingSkeleton />;

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <PiWarningCircleBold className="mb-3 h-12 w-12 text-red-500" />
        <Title as="h3" className="mb-1 text-lg font-semibold">
          Order not found
        </Title>
        <Text className="text-gray-500">
          {error ?? 'Could not load this order.'}
        </Text>
      </div>
    );
  }

  const addr = order.shippingAddress;
  const billing = order.billingAddress;
  const customer = resolveCustomer(order);
  const ship = order.shippingInfo;
  const isPOS = order.source === 'pos' || Boolean(order.receiptNumber);
  const placedAt = parseDate(order.placedAt) ?? parseDate(order.createdAt);

  const eta =
    ship?.daysMin != null && ship?.daysMax != null
      ? ship.daysMin === ship.daysMax
        ? `${ship.daysMin} day${ship.daysMin === 1 ? '' : 's'}`
        : `${ship.daysMin}–${ship.daysMax} days`
      : null;

  // Group items by vendor for the payout breakdown
  const vendorMap = new Map<
    string,
    { name: string; revenue: number; payout: number; items: number }
  >();
  for (const item of order.items) {
    const id = item.tenant?._id ?? '__unknown__';
    const name = item.tenant?.name ?? 'Unknown Vendor';
    const prev = vendorMap.get(id) ?? { name, revenue: 0, payout: 0, items: 0 };
    vendorMap.set(id, {
      name,
      revenue: prev.revenue + (item.itemSubtotal ?? 0),
      payout: prev.payout + (item.tenantRevenueShare ?? 0),
      items: prev.items + item.quantity,
    });
  }
  const vendors = Array.from(vendorMap.values());

  return (
    <div className="@container">
      {order.isVoided && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
          <PiProhibitBold className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-semibold text-red-600">
              This order was voided
            </p>
            <p className="text-xs text-gray-500">
              {[shortDate(order.voidedAt), order.voidReason]
                .filter(Boolean)
                .join(' · ') || 'No reason recorded.'}
            </p>
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-center border-b border-t border-muted py-4 font-medium text-gray-700 @5xl:justify-start">
        <span className="my-2 border-e border-muted px-5 py-0.5 first:ps-0 last:border-e-0">
          {placedAt
            ? `${longDate(placedAt.toISOString())} at ${placedAt.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}`
            : 'Date unknown'}
        </span>
        <span className="my-2 border-e border-muted px-5 py-0.5 first:ps-0 last:border-e-0">
          {order.items.length} {order.items.length === 1 ? 'Item' : 'Items'}
        </span>
        <span className="my-2 border-e border-muted px-5 py-0.5 first:ps-0 last:border-e-0">
          Total {formatCurrency(order.totalAmount, order.currency)}
        </span>
        {isPOS && (
          <span className="my-2 border-e border-muted px-5 py-0.5 first:ps-0 last:border-e-0">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <PiStorefrontBold className="h-4 w-4 text-gray-400" />
              POS{order.receiptNumber ? ` · ${order.receiptNumber}` : ''}
            </span>
          </span>
        )}
        <span className="my-2 ms-2">
          <PaymentBadge status={order.paymentStatus} />
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="my-2 ms-auto inline-flex items-center gap-1.5 rounded-lg border border-muted px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-gray-900 print:hidden"
        >
          <PiPrinterBold className="h-4 w-4" /> Print
        </button>
      </div>

      <div className="items-start pt-10 @5xl:grid @5xl:grid-cols-12 @5xl:gap-7 @6xl:grid-cols-10 @7xl:gap-10">
        {/* Left column */}
        <div className="space-y-7 @5xl:col-span-8 @5xl:space-y-10 @6xl:col-span-7">
          <div className="pb-5">
            <Title
              as="h3"
              className="mb-3.5 text-base font-semibold @5xl:mb-5 @7xl:text-lg"
            >
              Order Items
            </Title>
            <div className="overflow-x-auto rounded-lg border border-muted">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left">
                      Product
                    </th>
                    <th scope="col" className="px-5 py-3 text-right">
                      Unit Price
                    </th>
                    <th scope="col" className="px-5 py-3 text-center">
                      Qty
                    </th>
                    <th scope="col" className="px-5 py-3 text-right">
                      Subtotal
                    </th>
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
                                alt=""
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-10 w-10 shrink-0 rounded-md bg-gray-100" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.product?.name ?? '—'}
                            </p>
                            {item.subproduct?.name && (
                              <p className="text-xs text-gray-500">
                                {item.subproduct.name}
                              </p>
                            )}
                            {(item.size?.displayName || item.size?.size) && (
                              <p className="text-xs text-gray-500">
                                Size: {item.size.displayName || item.size.size}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {item.tenant?.name && (
                                <span className="inline-flex rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                  {item.tenant.name}
                                </span>
                              )}
                              {item.packRateApplied && (
                                <span className="inline-flex rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                                  Pack rate
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {formatCurrency(item.priceAtPurchase, order.currency)}
                      </td>
                      <td className="px-5 py-4 text-center font-semibold">
                        {item.quantity}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {formatCurrency(item.itemSubtotal, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {vendors.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Vendor Revenue
                </p>
                <div className="overflow-hidden rounded-xl border border-muted">
                  {vendors.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between border-b border-muted px-4 py-3 last:border-0 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                          {v.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {v.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {v.items} item{v.items === 1 ? '' : 's'} · revenue{' '}
                            {formatCurrency(v.revenue, order.currency)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(v.payout, order.currency)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          vendor payout
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="border-t border-muted pt-7 @5xl:mt-3">
              <div className="ms-auto max-w-lg space-y-4">
                <div className="flex justify-between text-sm font-medium text-gray-700">
                  Subtotal{' '}
                  <span>{formatCurrency(order.subtotal, order.currency)}</span>
                </div>
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-sm font-medium text-green-600">
                    <span>
                      Discount
                      {order.coupon?.code && (
                        <span className="ms-2 inline-flex items-center gap-1 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                          <PiTicketBold className="h-3 w-3" />
                          {order.coupon.code}
                        </span>
                      )}
                    </span>
                    <span>
                      -{formatCurrency(order.discountTotal, order.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium text-gray-700">
                  Shipping{' '}
                  <span>
                    {order.shippingFee === 0
                      ? 'Free'
                      : formatCurrency(order.shippingFee, order.currency)}
                  </span>
                </div>
                {order.taxAmount > 0 && (
                  <div className="flex justify-between text-sm font-medium text-gray-700">
                    Tax{' '}
                    <span>
                      {formatCurrency(order.taxAmount, order.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-muted pt-4 text-base font-semibold text-gray-900">
                  Total{' '}
                  <span>
                    {formatCurrency(order.totalAmount, order.currency)}
                  </span>
                </div>
                {!!order.platformCommissionTotal && (
                  <div className="flex items-center justify-between rounded-lg bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-600 dark:text-violet-400">
                    Platform Profit
                    <span>
                      {formatCurrency(
                        order.platformCommissionTotal,
                        order.currency
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <Title
              as="h3"
              className="mb-3.5 text-base font-semibold @5xl:mb-5 @7xl:text-lg"
            >
              Payment
            </Title>
            <PaymentPanel order={order} onUpdate={setOrder} />
          </div>

          <RefundHistory order={order} />
        </div>

        {/* Right column */}
        <div className="space-y-7 pt-8 @container @5xl:col-span-4 @5xl:space-y-10 @5xl:pt-0 @6xl:col-span-3">
          <WidgetCard title="Order Status" childrenWrapperClass="p-5 @5xl:p-6">
            <StatusStepper order={order} onUpdate={setOrder} />
          </WidgetCard>

          <WidgetCard
            title="Customer Details"
            childrenWrapperClass="py-5 @5xl:py-8"
          >
            <div className="space-y-2.5">
              <Field label="Name" value={customer.name} />
              <Field label="Email" value={customer.email || undefined} />
              <Field label="Phone" value={customer.phone || undefined} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {order.user && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                    <PiUserBold className="h-3 w-3" /> Registered customer
                  </span>
                )}
                {customer.kind === 'pos' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    <PiStorefrontBold className="h-3 w-3" /> In-store
                  </span>
                )}
                {order.ageVerifiedAtOrderTime && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                    <PiSealCheckBold className="h-3 w-3" /> Age verified
                  </span>
                )}
              </div>
            </div>
          </WidgetCard>

          {addr && (addr.addressLine1 || addr.city) && (
            <WidgetCard
              title="Shipping Address"
              childrenWrapperClass="py-5 @5xl:py-6"
            >
              <div className="space-y-2.5">
                <Field
                  label="Address"
                  value={[addr.addressLine1, addr.addressLine2]
                    .filter(Boolean)
                    .join(', ')}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="City" value={addr.city} />
                  <Field label="State" value={addr.state} />
                  <Field label="Postal Code" value={addr.postalCode} />
                  <Field label="Country" value={addr.country} />
                </div>
                <Field label="Landmark" value={addr.landmark} />
                <Field
                  label="Instructions"
                  value={addr.additionalInstructions}
                />

                {(order.shippingMethod ||
                  ship?.zoneLabel ||
                  eta ||
                  ship?.distanceKm != null) && (
                  <div className="space-y-2.5 border-t border-muted pt-2.5">
                    <Field
                      label="Shipping Method"
                      value={
                        order.shippingMethod
                          ? humanize(order.shippingMethod)
                          : undefined
                      }
                    />
                    <Field
                      label="Delivery Zone"
                      value={ship?.zoneLabel ?? undefined}
                    />
                    <Field label="Est. Delivery" value={eta ?? undefined} />
                    <Field
                      label="Distance"
                      value={
                        ship?.distanceKm != null
                          ? `${ship.distanceKm.toFixed(1)} km${ship.stops ? ` · ${ship.stops} stop${ship.stops === 1 ? '' : 's'}` : ''}`
                          : undefined
                      }
                    />
                    {ship?.isFree && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                        Free delivery
                      </span>
                    )}
                    {addr.coordinates?.latitude != null &&
                      addr.coordinates?.longitude != null && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${addr.coordinates.latitude},${addr.coordinates.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 print:hidden"
                        >
                          <PiMapPinBold className="h-3.5 w-3.5" /> View on map
                        </a>
                      )}
                  </div>
                )}
              </div>
            </WidgetCard>
          )}

          {billing && (billing.addressLine1 || billing.city) && (
            <WidgetCard
              title="Billing Address"
              childrenWrapperClass="py-5 @5xl:py-6"
            >
              <div className="space-y-2.5">
                <Field label="Name" value={billing.fullName} />
                <Field
                  label="Address"
                  value={[billing.addressLine1, billing.addressLine2]
                    .filter(Boolean)
                    .join(', ')}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="City" value={billing.city} />
                  <Field label="State" value={billing.state} />
                </div>
              </div>
            </WidgetCard>
          )}

          <WidgetCard title="Order Info" childrenWrapperClass="py-5 space-y-2">
            <Row
              label="Order #"
              value={<span className="font-mono">{order.orderNumber}</span>}
            />
            {order.receiptNumber && (
              <Row
                label="Receipt #"
                value={<span className="font-mono">{order.receiptNumber}</span>}
              />
            )}
            <Row label="Source" value={humanize(order.source ?? 'web')} />
            <Row
              label="Placed"
              value={
                longDate(order.placedAt) ?? longDate(order.createdAt) ?? '—'
              }
            />
            <Row label="Currency" value={order.currency} />
            {order.posStaff && (
              <Row
                label="Cashier"
                value={
                  order.posStaff.posName ||
                  `${order.posStaff.firstName ?? ''} ${order.posStaff.lastName ?? ''}`.trim() ||
                  order.posStaff.email
                }
              />
            )}
            {order.appliedPricelist?.pricelistName && (
              <Row
                label="Pricelist"
                value={order.appliedPricelist.pricelistName}
              />
            )}
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}
