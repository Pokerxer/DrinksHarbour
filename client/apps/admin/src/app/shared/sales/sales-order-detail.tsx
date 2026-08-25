// client/apps/admin/src/app/shared/sales/sales-order-detail.tsx
// Sales-order document view. Chrome lives in sales-detail-shell; this file
// owns what an ORDER specifically does: capture payment, hand off to
// fulfillment, invoice, print, and cancel a live order that will never ship.

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiCreditCard,
  PiTrayArrowDown,
  PiArrowUUpLeft,
  PiReceipt,
  PiPencilSimple,
  PiPrinter,
  PiProhibit,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import { useTenant } from '@/context/TenantContext';
import {
  printProformaInvoice,
  printSalesInvoice,
} from '@/utils/salesInvoice';
import type { SalesDocVariant } from '@/utils/print/so-print';
import SalesConfirmPaymentModal from './sales-confirm-payment-modal';
import SalesInvoiceView from './sales-invoice-view';
import SalesDetailShell, { type DetailAction } from './sales-detail-shell';
import SalesOrderDetailInfo from './sales-order-detail-info';
import SalesOrderDetailLines from './sales-order-detail-lines';
import { canCancelOrder, fulfilmentProgress } from './sales-detail-logic';

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string; dot: string }
> = {
  draft: { label: 'Draft', bg: '#f4f4f5', color: '#52525b', dot: '#a1a1aa' },
  confirmed: {
    label: 'Confirmed',
    bg: '#eff6ff',
    color: '#1d4ed8',
    dot: '#3b82f6',
  },
  partially_fulfilled: {
    label: 'Partial',
    bg: '#fffbeb',
    color: '#92400e',
    dot: '#f59e0b',
  },
  fulfilled: {
    label: 'Fulfilled',
    bg: '#f0fdf4',
    color: '#15803d',
    dot: '#22c55e',
  },
  cancelled: { label: 'Cancelled', bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444' },
};

/** Shipped-vs-ordered bar — a "Partial" pill alone never said how partial. */
function FulfilmentProgress({ so }: { so: SalesOrder }) {
  const { ordered, delivered, pct } = fulfilmentProgress(so.items ?? []);
  if (delivered <= 0 || ordered <= 0) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-600">
          {delivered} of {ordered} units delivered
        </span>
        <span className="font-semibold text-gray-500 tabular-nums">{pct}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Fulfillment progress"
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SalesOrderDetail({
  so,
  onChanged,
}: {
  so: SalesOrder;
  onChanged: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const { tenant } = useTenant();
  const tenantName = tenant?.name || 'DrinksHarbour';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  const status = so.orderStatus ?? 'draft';
  const sc = ORDER_STATUS_CONFIG[status] ?? ORDER_STATUS_CONFIG.draft;

  async function handleConfirm(
    paymentMethod: string,
    amountTendered?: number,
    redeemPoints?: number
  ) {
    setBusy(true);
    try {
      await salesOrderService.confirm(
        so._id,
        { paymentMethod, amountTendered, redeemPoints },
        token
      );
      toast.success('Order confirmed and payment captured');
      setConfirmOpen(false);
      onChanged();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to confirm order'
      );
    } finally {
      setBusy(false);
    }
  }

  // The server refuses to cancel anything already fulfilled/cancelled; the
  // button simply never shows for those states (canCancelOrder).
  async function handleCancel() {
    if (
      !window.confirm(
        `Cancel ${so.soNumber}? Stock reservations are released and this cannot be undone.`
      )
    )
      return;
    setBusy(true);
    try {
      await salesOrderService.cancel(so._id, token);
      toast.success('Order cancelled');
      onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setBusy(false);
    }
  }

  // Branded PDF like the purchase documents; the selected fulfilment warehouse
  // is the issuing entity on paper. Orders print as Sales Order / Pro-Forma.
  function handlePrint(type: SalesDocVariant) {
    (type === 'proforma' ? printProformaInvoice : printSalesInvoice)(
      so,
      tenantName
    );
  }

  if (showInvoice) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button
          type="button"
          onClick={() => setShowInvoice(false)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 print:hidden"
        >
          ← Back to order
        </button>
        <SalesInvoiceView so={so} />
      </div>
    );
  }

  const canConfirm = status === 'draft';
  const canFulfill = status === 'confirmed' || status === 'partially_fulfilled';
  const canReturn = status === 'partially_fulfilled' || status === 'fulfilled';

  const customerName = so.customerSnapshot?.name ?? 'Walk-in Customer';
  const actions: DetailAction[] = [
    canConfirm && {
      key: 'confirm',
      label: 'Confirm Order',
      icon: <PiCreditCard className="h-4 w-4" />,
      onClick: () => setConfirmOpen(true),
      variant: 'primary',
      disabled: busy,
    },
    canFulfill && {
      key: 'fulfill',
      label: 'Fulfill Order',
      icon: <PiTrayArrowDown className="h-4 w-4" />,
      href: routes.eCommerce.salesFulfillDetails(so._id),
      variant: 'primary',
    },
    canConfirm && {
      key: 'edit',
      label: 'Edit',
      icon: <PiPencilSimple className="h-4 w-4" />,
      href: routes.eCommerce.salesEdit(so._id),
    },
    canReturn && {
      key: 'return',
      label: 'Return',
      icon: <PiArrowUUpLeft className="h-4 w-4" />,
      href: `${routes.eCommerce.createSalesReturn}?orderId=${so._id}`,
    },
    status !== 'draft' &&
      status !== 'cancelled' && {
        key: 'invoice',
        label: 'Invoice',
        icon: <PiReceipt className="h-4 w-4" />,
        onClick: () => setShowInvoice(true),
      },
    {
      key: 'print',
      label: 'Print',
      icon: <PiPrinter className="h-4 w-4" />,
      onClick: () => handlePrint('quotation'),
    },
    canCancelOrder(status) &&
      status !== 'draft' && {
        key: 'cancel',
        label: 'Cancel Order',
        icon: <PiProhibit className="h-4 w-4" />,
        onClick: handleCancel,
        variant: 'quiet-danger',
        disabled: busy,
      },
  ].filter(Boolean) as DetailAction[];

  return (
    <>
      <SalesConfirmPaymentModal
        hasCustomer={!!so.customer}
        open={confirmOpen}
        busy={busy}
        total={so.total}
        initialRedeemPoints={so.plannedRedeemPoints}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />

      <SalesDetailShell
        backHref={routes.eCommerce.salesOrders}
        backLabel="Sales Orders"
        eyebrow="Sales Order"
        soNumber={so.soNumber}
        createdAt={so.createdAt}
        statusPill={sc}
        total={fmtCur(so.total, so.currency)}
        banner={<FulfilmentProgress so={so} />}
        totalSubline={
          so.paymentStatus === 'paid' ? (
            <p className="font-medium text-emerald-400">
              ✓ Paid · {so.paymentMethod ?? '—'}
            </p>
          ) : so.paymentStatus === 'partial' ? (
            // Part-fulfilled through the POS. Showing "Awaiting payment" here
            // would hide money the till has already taken.
            <p className="font-medium text-amber-400">
              {fmtCur(so.amountPaid ?? 0, so.currency)} paid ·{' '}
              {fmtCur(Math.max(0, so.total - (so.amountPaid ?? 0)), so.currency)}{' '}
              outstanding
            </p>
          ) : (
            <p className="text-amber-400/80">Awaiting payment</p>
          )
        }
        actions={actions}
        customer={{
          name: customerName,
          phone: so.customerSnapshot?.phone,
          email: so.customerSnapshot?.email,
        }}
      >
        <SalesOrderDetailInfo so={so} />
        <SalesOrderDetailLines so={so} />
      </SalesDetailShell>
    </>
  );
}
