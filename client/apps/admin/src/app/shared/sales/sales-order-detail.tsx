'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiCreditCard,
  PiTrayArrowDown,
  PiArrowUUpLeft,
  PiReceipt,
  PiX,
  PiPencilSimple,
  PiPrinter,
  PiCaretRight,
  PiPackage,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import {
  addressLines,
  orderStatusLabel,
  outstanding,
  paymentTermsLabel,
  addressIsEmpty,
  addressesDiffer,
} from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import SalesInvoiceView from './sales-invoice-view';
import {
  isNonProductLine,
  NonProductLineRow,
  sectionSubtotals,
} from './sales-line-read-rows';
import SalesPrintSheet, { type PrintSheetType } from './sales-print-sheet';

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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
  cancelled: {
    label: 'Cancelled',
    bg: '#fef2f2',
    color: '#b91c1c',
    dot: '#ef4444',
  },
};

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

const FULFILLMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#d97706' },
  in_progress: { label: 'In Progress', color: '#2563eb' },
  done: { label: 'Done', color: '#16a34a' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
};

function ConfirmPaymentModal({
  open,
  busy,
  hasCustomer,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  hasCustomer: boolean;
  onClose: () => void;
  onConfirm: (
    paymentMethod: string,
    amountTendered?: number,
    redeemPoints?: number
  ) => void;
}) {
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState('');
  const [redeem, setRedeem] = useState('');

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b20202]">
              Payment
            </p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">
              Capture Payment
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Payment Method
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#b20202] focus:bg-white focus:outline-none"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {method === 'cash' && (
          <>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Amount Tendered (optional)
            </label>
            <input
              type="number"
              min={0}
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#b20202] focus:bg-white focus:outline-none"
            />
          </>
        )}

        {hasCustomer && (
          <>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Redeem Loyalty Points (optional)
            </label>
            <input
              type="number"
              min={0}
              value={redeem}
              placeholder="0"
              onChange={(e) => setRedeem(e.target.value)}
              className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#b20202] focus:bg-white focus:outline-none"
            />
          </>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onConfirm(
                method,
                tendered ? Number(tendered) : undefined,
                redeem ? Number(redeem) : undefined
              )
            }
            className="flex-1 rounded-xl bg-[#b20202] py-2.5 text-sm font-bold text-white transition-all hover:bg-[#9a0101] active:scale-[0.98] disabled:opacity-50"
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
  const subtotals = sectionSubtotals(so.items);
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [printState, setPrintState] = useState<{ type: PrintSheetType } | null>(
    null
  );

  const status = so.orderStatus ?? 'draft';
  const canConfirm = status === 'draft';
  const canFulfill = status === 'confirmed' || status === 'partially_fulfilled';
  const canReturn = status === 'partially_fulfilled' || status === 'fulfilled';
  const canInvoice = status !== 'draft' && status !== 'cancelled';

  const ship = so.deliveryAddress;
  const hasShipTo =
    ship && !addressIsEmpty(ship) && addressesDiffer(ship, so.invoiceAddress);

  const customerName = so.customerSnapshot?.name ?? 'Walk-in Customer';
  const customerInitial = customerName.charAt(0).toUpperCase();
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

      <ConfirmPaymentModal
        hasCustomer={!!so.customer}
        open={confirmOpen}
        busy={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />

      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.salesOrders}
          className="transition-colors hover:text-gray-700"
        >
          Sales Orders
        </Link>
        <PiCaretRight className="h-3 w-3 text-gray-300" />
        <span className="font-medium text-gray-900">{so.soNumber}</span>
      </nav>

      <div className="flex items-start gap-6">
        {/* ── Main content ── */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Document header */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b20202]">
                  Sales Order
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                  {so.soNumber}
                </h1>
                <p className="mt-1 text-sm text-gray-400">
                  {fmtDate(so.createdAt)}
                </p>
              </div>
              <span
                className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: sc.bg, color: sc.color }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: sc.dot }}
                />
                {sc.label}
              </span>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Sale details */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04]">
              <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                Sale Details
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Order Date</span>
                  <span className="text-sm font-medium text-gray-800">
                    {fmtDate(so.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Payment Terms</span>
                  <span className="text-sm font-medium text-gray-800">
                    {paymentTermsLabel(so.paymentTerms)}
                  </span>
                </div>
                {so.dueDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Due Date</span>
                    <span className="text-sm font-medium text-gray-800">
                      {fmtDate(so.dueDate)}
                    </span>
                  </div>
                )}
                {so.appliedPricelist?.pricelistName && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Pricelist</span>
                    <span className="text-sm font-medium text-gray-800">
                      {so.appliedPricelist.pricelistName}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Payment</span>
                  <span
                    className={`text-sm font-semibold ${so.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}
                  >
                    {so.paymentStatus === 'paid'
                      ? `Paid · ${so.paymentMethod ?? '—'}`
                      : 'Unpaid'}
                  </span>
                </div>
                {(so.loyaltyRedeemed ?? 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Loyalty</span>
                    <span className="text-sm font-medium text-emerald-600">
                      {so.pointsRedeemed} pts · −
                      {fmtCur(so.loyaltyRedeemed ?? 0, so.currency)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04]">
              <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                {hasShipTo ? 'Invoicing & Shipping' : 'Invoicing Address'}
              </h2>
              <div
                className={`grid gap-4 ${hasShipTo ? 'grid-cols-2' : 'grid-cols-1'}`}
              >
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b20202]">
                    Bill To
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {customerName}
                  </p>
                  {addressLines(so.invoiceAddress).map((l) => (
                    <p
                      key={l}
                      className="mt-0.5 text-xs leading-relaxed text-gray-500"
                    >
                      {l}
                    </p>
                  ))}
                </div>
                {hasShipTo && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b20202]">
                      Ship To
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {ship?.name ?? customerName}
                    </p>
                    {addressLines(ship).map((l) => (
                      <p
                        key={l}
                        className="mt-0.5 text-xs leading-relaxed text-gray-500"
                      >
                        {l}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fulfillments */}
          {so.fulfillments?.length > 0 && (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
              <div className="border-b border-gray-100 px-5 py-3.5">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                  Delivery Orders
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {so.fulfillments.map((f, i) => {
                  const fs = FULFILLMENT_STATUS[f.status] ?? {
                    label: f.status,
                    color: '#6b7280',
                  };
                  return (
                    <div
                      key={f._id}
                      className="flex items-center justify-between px-5 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                          <PiPackage className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-mono text-sm font-bold text-[#b20202]">
                            WH/OUT/{String(i + 1).padStart(5, '0')}
                          </p>
                          <p className="text-xs text-gray-400">
                            {fmtDate(f.at)}
                          </p>
                        </div>
                      </div>
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{
                          background: `${fs.color}18`,
                          color: fs.color,
                        }}
                      >
                        {fs.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products table */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
            <div className="border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                Order Lines
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/60">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Product
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Outstanding
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Unit Price
                  </th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {so.items.map((item) => {
                  if (isNonProductLine(item)) {
                    return (
                      <NonProductLineRow
                        key={item._id}
                        item={item}
                        cols={5}
                        subtotal={
                          item.lineType === 'section'
                            ? subtotals.get(item._id)
                            : undefined
                        }
                        currency={so.currency}
                      />
                    );
                  }
                  const out = outstanding(item);
                  return (
                    <tr
                      key={item._id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.name}
                        </p>
                        {item.sku && (
                          <span className="mt-0.5 inline-block rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                            {item.sku}
                          </span>
                        )}
                        {item.description && (
                          <p className="mt-0.5 text-xs text-gray-400">
                            {item.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-medium text-gray-700">
                          {item.quantity}
                        </span>
                        <span className="ml-1 text-xs text-gray-400">
                          units
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`text-sm font-semibold ${out > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
                        >
                          {out > 0 ? out : '✓'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm text-gray-600">
                        {fmtCur(item.unitPrice, so.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-sm font-bold text-gray-900">
                        {fmtCur(item.lineTotal, so.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {so.discountTotal > 0 && (
                  <tr className="border-t border-gray-100 bg-gray-50/50">
                    <td
                      colSpan={4}
                      className="px-5 py-2.5 text-right text-xs font-medium text-gray-500"
                    >
                      Subtotal
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-sm text-gray-700">
                      {fmtCur(so.subtotal, so.currency)}
                    </td>
                  </tr>
                )}
                {so.discountTotal > 0 && (
                  <tr className="bg-gray-50/50">
                    <td
                      colSpan={4}
                      className="px-5 py-2.5 text-right text-xs font-medium text-gray-500"
                    >
                      Discount
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-sm font-semibold text-[#b20202]">
                      −{fmtCur(so.discountTotal, so.currency)}
                    </td>
                  </tr>
                )}
                {(so.taxTotal ?? 0) > 0 && (
                  <tr className="bg-gray-50/50">
                    <td
                      colSpan={4}
                      className="px-5 py-2.5 text-right text-xs font-medium text-gray-500"
                    >
                      Tax
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-sm text-gray-700">
                      {fmtCur(so.taxTotal ?? 0, so.currency)}
                    </td>
                  </tr>
                )}
                <tr className="border-t-2 border-gray-100">
                  <td
                    colSpan={4}
                    className="px-5 py-4 text-right text-sm font-bold text-gray-700"
                  >
                    Total
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-base font-black text-gray-900">
                    {fmtCur(so.total, so.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes / Terms */}
          {(so.notes || so.terms) && (
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04]">
              {so.notes && (
                <div className={so.terms ? 'mb-5' : ''}>
                  <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                    Notes
                  </h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                    {so.notes}
                  </p>
                </div>
              )}
              {so.terms && (
                <div>
                  <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                    Terms &amp; Conditions
                  </h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                    {so.terms}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Dark command sidebar ── */}
        <aside className="sticky top-6 w-[17rem] shrink-0 self-start overflow-hidden rounded-2xl bg-[#0f0e13] print:hidden">
          <div className="p-6">
            {/* Total hero */}
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
              Total Amount
            </p>
            <p
              className="text-[2.25rem] font-bold leading-none text-white"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {fmtCur(so.total, so.currency)}
            </p>
            {so.paymentStatus === 'paid' ? (
              <p className="mt-2 text-xs font-medium text-emerald-400">
                ✓ Paid · {so.paymentMethod ?? '—'}
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-400/80">Awaiting payment</p>
            )}

            {/* Divider */}
            <div className="my-5 h-px bg-white/[0.08]" />

            {/* Actions */}
            <div className="space-y-2">
              {canConfirm && (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#9a0101] active:scale-[0.98]"
                >
                  <PiCreditCard className="h-4 w-4" />
                  Confirm Order
                </button>
              )}
              {canFulfill && (
                <Link
                  href={routes.eCommerce.salesFulfillDetails(so._id)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#9a0101]"
                >
                  <PiTrayArrowDown className="h-4 w-4" />
                  Fulfill Order
                </Link>
              )}
              {canConfirm && (
                <Link
                  href={routes.eCommerce.salesEdit(so._id)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white"
                >
                  <PiPencilSimple className="h-4 w-4" />
                  Edit
                </Link>
              )}
              {canReturn && (
                <Link
                  href={`${routes.eCommerce.createSalesReturn}?orderId=${so._id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white"
                >
                  <PiArrowUUpLeft className="h-4 w-4" />
                  Return
                </Link>
              )}
              {canInvoice && (
                <button
                  type="button"
                  onClick={() => setShowInvoice(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white"
                >
                  <PiReceipt className="h-4 w-4" />
                  Invoice
                </button>
              )}
              <button
                type="button"
                onClick={() => handlePrint('quotation')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white"
              >
                <PiPrinter className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>

          {/* Customer section */}
          {so.customerSnapshot?.name && (
            <div className="border-t border-white/[0.08] p-6">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                Customer
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#b20202] text-sm font-bold text-white">
                  {customerInitial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {customerName}
                  </p>
                  {so.customerSnapshot?.phone && (
                    <p className="mt-0.5 text-xs text-white/40">
                      {so.customerSnapshot.phone}
                    </p>
                  )}
                  {so.customerSnapshot?.email && (
                    <a
                      href={`mailto:${so.customerSnapshot.email}`}
                      className="mt-0.5 block text-xs text-[#b20202] transition-colors hover:text-[#e03030]"
                    >
                      Send message
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer tag */}
          <div className="border-t border-white/[0.06] px-6 py-3">
            <p className="font-mono text-[10px] text-white/20">{so.soNumber}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
