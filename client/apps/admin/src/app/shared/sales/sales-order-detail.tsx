'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiCreditCard,
  PiTrayArrowDown,
  PiArrowUUpLeft,
  PiReceipt,
  PiPencilSimple,
  PiPrinter,
  PiCaretRight,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';
import { orderStatusLabel, outstanding, fmtDate } from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import SalesInvoiceView from './sales-invoice-view';
import SalesPrintSheet, { type PrintSheetType } from './sales-print-sheet';
import SalesConfirmPaymentModal from './sales-confirm-payment-modal';
import SalesOrderDetailInfo from './sales-order-detail-info';
import SalesOrderDetailLines from './sales-order-detail-lines';

const ORDER_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  draft: { label: 'Draft', bg: '#f4f4f5', color: '#52525b', dot: '#a1a1aa' },
  confirmed: { label: 'Confirmed', bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' },
  partially_fulfilled: { label: 'Partial', bg: '#fffbeb', color: '#92400e', dot: '#f59e0b' },
  fulfilled: { label: 'Fulfilled', bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  cancelled: { label: 'Cancelled', bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444' },
};

export default function SalesOrderDetail({
  so,
  onChanged,
}: {
  so: SalesOrder;
  onChanged: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [printState, setPrintState] = useState<{ type: PrintSheetType } | null>(null);

  const status = so.orderStatus ?? 'draft';
  const canConfirm = status === 'draft';
  const canFulfill = status === 'confirmed' || status === 'partially_fulfilled';
  const canReturn = status === 'partially_fulfilled' || status === 'fulfilled';
  const canInvoice = status !== 'draft' && status !== 'cancelled';

  const customerName = so.customerSnapshot?.name ?? 'Walk-in Customer';
  const customerInitial = customerName.charAt(0).toUpperCase();
  const sc = ORDER_STATUS_CONFIG[status] ?? ORDER_STATUS_CONFIG.draft;

  async function handleConfirm(paymentMethod: string, amountTendered?: number, redeemPoints?: number) {
    setBusy(true);
    try {
      await salesOrderService.confirm(so._id, { paymentMethod, amountTendered, redeemPoints }, token);
      toast.success('Order confirmed and payment captured');
      setConfirmOpen(false);
      onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm order');
    } finally {
      setBusy(false);
    }
  }

  function handlePrint(type: PrintSheetType) {
    setPrintState({ type });
    setTimeout(() => window.print(), 150);
  }

  if (showInvoice) {
    return (
      <div>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {printState && <SalesPrintSheet so={so} type={printState.type} />}

      <SalesConfirmPaymentModal
        hasCustomer={!!so.customer}
        open={confirmOpen}
        busy={busy}
        total={so.total}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />

      <nav className="mb-5 flex items-center gap-1.5 text-sm text-gray-500">
        <Link href={routes.eCommerce.salesOrders} className="transition-colors hover:text-gray-700">
          Sales Orders
        </Link>
        <PiCaretRight className="h-3 w-3 text-gray-300" />
        <span className="font-medium text-gray-900">{so.soNumber}</span>
      </nav>

      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Sales Order</p>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{so.soNumber}</h1>
                <p className="mt-1 text-sm text-gray-400">{fmtDate(so.createdAt)}</p>
              </div>
              <span
                className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: sc.bg, color: sc.color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc.dot }} />
                {sc.label}
              </span>
            </div>
          </div>

          <SalesOrderDetailInfo so={so} />
          <SalesOrderDetailLines so={so} />
        </div>

        <aside className="sticky top-6 w-[17rem] shrink-0 self-start overflow-hidden rounded-2xl bg-[#0f0e13] print:hidden">
          <div className="p-6">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Total Amount</p>
            <p className="text-[2.25rem] font-bold leading-none text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {fmtCur(so.total, so.currency)}
            </p>
            {so.paymentStatus === 'paid' ? (
              <p className="mt-2 text-xs font-medium text-emerald-400">✓ Paid · {so.paymentMethod ?? '—'}</p>
            ) : (
              <p className="mt-2 text-xs text-amber-400/80">Awaiting payment</p>
            )}

            <div className="my-5 h-px bg-white/[0.08]" />

            <div className="space-y-2">
              {canConfirm && (
                <button type="button" onClick={() => setConfirmOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.98]">
                  <PiCreditCard className="h-4 w-4" /> Confirm Order
                </button>
              )}
              {canFulfill && (
                <Link href={routes.eCommerce.salesFulfillDetails(so._id)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-dark">
                  <PiTrayArrowDown className="h-4 w-4" /> Fulfill Order
                </Link>
              )}
              {canConfirm && (
                <Link href={routes.eCommerce.salesEdit(so._id)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white">
                  <PiPencilSimple className="h-4 w-4" /> Edit
                </Link>
              )}
              {canReturn && (
                <Link href={`${routes.eCommerce.createSalesReturn}?orderId=${so._id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white">
                  <PiArrowUUpLeft className="h-4 w-4" /> Return
                </Link>
              )}
              {canInvoice && (
                <button type="button" onClick={() => setShowInvoice(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white">
                  <PiReceipt className="h-4 w-4" /> Invoice
                </button>
              )}
              <button type="button" onClick={() => handlePrint('quotation')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white">
                <PiPrinter className="h-4 w-4" /> Print
              </button>
            </div>
          </div>

          {so.customerSnapshot?.name && (
            <div className="border-t border-white/[0.08] p-6">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Customer</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {customerInitial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{customerName}</p>
                  {so.customerSnapshot?.phone && <p className="mt-0.5 text-xs text-white/40">{so.customerSnapshot.phone}</p>}
                  {so.customerSnapshot?.email && (
                    <a href={`mailto:${so.customerSnapshot.email}`}
                      className="mt-0.5 block text-xs text-brand transition-colors hover:text-[#e03030]">Send message</a>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.06] px-6 py-3">
            <p className="font-mono text-[10px] text-white/20">{so.soNumber}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
