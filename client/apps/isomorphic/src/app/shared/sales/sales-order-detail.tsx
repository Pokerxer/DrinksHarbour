// client/apps/isomorphic/src/app/shared/sales/sales-order-detail.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiArrowLeft,
  PiCreditCard,
  PiTrayArrowDown,
  PiArrowUUpLeft,
  PiReceipt,
  PiX,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import {
  ORDER_STATUS_BADGE,
  orderStatusLabel,
  outstanding,
  paymentTermsLabel,
} from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import SalesInvoiceView from './sales-invoice-view';

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'pos_terminal', label: 'POS Terminal' },
  { value: 'wallet', label: 'Customer Wallet' },
  { value: 'invoice', label: 'Invoice (bill later)' },
  { value: 'other', label: 'Other' },
];

function ConfirmPaymentModal({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: string, amountTendered?: number) => void;
}) {
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState('');

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-gray-900">
            Confirm &amp; Capture Payment
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          Payment Method
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {method === 'cash' && (
          <>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Amount Tendered (optional)
            </label>
            <input
              type="number"
              min={0}
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none"
            />
          </>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onConfirm(method, tendered ? Number(tendered) : undefined)
            }
            className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            {busy ? 'Confirming…' : 'Confirm Order'}
          </button>
        </div>
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [busy, setBusy] = useState(false);

  const status = so.orderStatus ?? 'draft';
  const canConfirm = status === 'draft';
  const canFulfill = status === 'confirmed' || status === 'partially_fulfilled';
  const canReturn = status === 'partially_fulfilled' || status === 'fulfilled';
  const canInvoice = status !== 'draft' && status !== 'cancelled';

  async function handleConfirm(paymentMethod: string, amountTendered?: number) {
    setBusy(true);
    try {
      await salesOrderService.confirm(
        so._id,
        { paymentMethod, amountTendered },
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

  if (showInvoice) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowInvoice(false)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 print:hidden"
        >
          <PiArrowLeft className="h-4 w-4" /> Back to order
        </button>
        <SalesInvoiceView so={so} />
      </div>
    );
  }

  return (
    <div>
      <ConfirmPaymentModal
        open={confirmOpen}
        busy={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />

      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.salesOrders}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Orders
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{so.soNumber}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{so.soNumber}</h1>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE[status]}`}
          >
            {orderStatusLabel(status)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canConfirm && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
            >
              <PiCreditCard className="h-4 w-4" /> Confirm Order
            </button>
          )}
          {canFulfill && (
            <Link
              href={routes.eCommerce.salesFulfillDetails(so._id)}
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
            >
              <PiTrayArrowDown className="h-4 w-4" /> Fulfill
            </Link>
          )}
          {canReturn && (
            <Link
              href={`${routes.eCommerce.createSalesReturn}?orderId=${so._id}`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiArrowUUpLeft className="h-4 w-4" /> Return
            </Link>
          )}
          {canInvoice && (
            <button
              type="button"
              onClick={() => setShowInvoice(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiReceipt className="h-4 w-4" /> Invoice
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Product
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Ordered
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Outstanding
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Unit Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Line Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {so.items.map((item) => {
                  const out = outstanding(item);
                  return (
                    <tr key={item._id}>
                      <td className="px-4 py-3 text-gray-900">
                        {item.name}
                        {item.sku && (
                          <span className="ml-2 font-mono text-xs text-gray-400">
                            {item.sku}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            out > 0
                              ? 'font-medium text-amber-600'
                              : 'text-emerald-600'
                          }
                        >
                          {out}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {fmtCur(item.unitPrice, so.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {fmtCur(item.lineTotal, so.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm">
            <p className="mb-1 text-xs font-semibold text-gray-500">Customer</p>
            <p className="mb-3 text-gray-900">
              {so.customerSnapshot?.name ?? 'Walk-in / none'}
            </p>
            <p className="mb-1 text-xs font-semibold text-gray-500">Payment</p>
            <p className="mb-3 text-gray-900">
              {so.paymentStatus === 'paid'
                ? `Paid via ${so.paymentMethod ?? '—'}`
                : 'Unpaid'}
            </p>
            <p className="mb-1 text-xs font-semibold text-gray-500">
              Payment Terms
            </p>
            <p className="mb-3 text-gray-900">
              {paymentTermsLabel(so.paymentTerms)}
              {so.dueDate && (
                <span className="ml-1 text-gray-500">
                  · due {new Date(so.dueDate).toLocaleDateString()}
                </span>
              )}
            </p>
            <div className="space-y-1 border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Untaxed Amount</span>
                <span>{fmtCur(so.subtotal - so.discountTotal, so.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Tax</span>
                <span>{fmtCur(so.taxTotal ?? 0, so.currency)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 text-base font-semibold text-gray-900">
                <span>Total</span>
                <span>{fmtCur(so.total, so.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
