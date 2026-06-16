'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import {
  PiArrowLeft,
  PiCheck,
  PiCurrencyDollar,
  PiWarning,
  PiCheckCircle,
  PiXCircle,
  PiClock,
  PiPrinter,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { vendorBillService } from '@/services/vendorBill.service';
import type { VendorBill } from '@/services/vendorBill.service';
import { printBillInvoice } from '@/utils/purchaseInvoice';
import BaseCurrencyEquivalent from './base-currency-equivalent';

const BILL_STATUS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

const MATCH_STATUS: Record<
  string,
  { cls: string; icon: React.ReactNode; label: string }
> = {
  matched: {
    cls: 'bg-green-50 border-green-200 text-green-700',
    icon: <PiCheckCircle className="h-4 w-4 text-green-500" />,
    label: 'Matched',
  },
  pending: {
    cls: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    icon: <PiClock className="h-4 w-4 text-yellow-500" />,
    label: 'Pending',
  },
  mismatch: {
    cls: 'bg-red-50 border-red-200 text-red-700',
    icon: <PiXCircle className="h-4 w-4 text-red-500" />,
    label: 'Mismatch',
  },
  overreceived: {
    cls: 'bg-orange-50 border-orange-200 text-orange-700',
    icon: <PiWarning className="h-4 w-4 text-orange-500" />,
    label: 'Over-received',
  },
  underreceived: {
    cls: 'bg-orange-50 border-orange-200 text-orange-700',
    icon: <PiWarning className="h-4 w-4 text-orange-500" />,
    label: 'Under-received',
  },
};

const ITEM_MATCH_CLS: Record<string, string> = {
  matched: 'text-green-600',
  price_mismatch: 'text-red-600',
  qty_mismatch: 'text-orange-600',
  missing: 'text-gray-400',
};

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'other', label: 'Other' },
];

function fmt(n: number | undefined, currency: string) {
  return `${currency} ${(n ?? 0).toFixed(2)}`;
}

export default function PurchasesBillDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const { tenant } = useTenant();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [bill, setBill] = useState<VendorBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorBillService.getVendorBill(id, token);
      setBill(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load bill');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleValidate() {
    setActing(true);
    try {
      await vendorBillService.validateBill(id, token);
      toast.success('Bill validated');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to validate');
    } finally {
      setActing(false);
    }
  }

  async function handlePayment() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setActing(true);
    try {
      await vendorBillService.recordPayment(
        id,
        {
          amount,
          date: payDate,
          method: payMethod,
          reference: payRef || undefined,
          notes: payNotes || undefined,
        },
        token
      );
      toast.success('Payment recorded');
      setShowPay(false);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      await load();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to record payment'
      );
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Loading…
      </div>
    );
  }
  if (!bill) {
    return (
      <div className="py-20 text-center text-sm text-gray-500">
        Bill not found
      </div>
    );
  }

  const amountDue = bill.totalAmount - bill.paidAmount;
  const matchInfo =
    MATCH_STATUS[bill.matchingStatus] ?? MATCH_STATUS['pending'];

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.vendorBills}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Vendor Bills
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{bill.billNumber}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">
              {bill.billNumber}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${BILL_STATUS[bill.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {bill.status}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${matchInfo.cls}`}
            >
              {matchInfo.icon}
              {matchInfo.label}
            </span>
          </div>
          {bill.vendorName && (
            <p className="mt-1 text-sm text-gray-500">
              Vendor: {bill.vendorName}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => bill && printBillInvoice(bill, tenant?.name || 'DrinksHarbour')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <PiPrinter className="h-4 w-4" /> Print / Download
          </button>
          {bill.status === 'draft' && (
            <button
              type="button"
              onClick={handleValidate}
              disabled={acting}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" /> Validate Bill
            </button>
          )}
          {(bill.status === 'confirmed' ||
            bill.status === 'partial' ||
            bill.status === 'overdue') &&
            amountDue > 0 && (
              <button
                type="button"
                onClick={() => setShowPay(true)}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                <PiCurrencyDollar className="h-4 w-4" /> Record Payment
              </button>
            )}
        </div>
      </div>

      {/* Payment form */}
      {showPay && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="mb-3 text-sm font-medium text-green-800">
            Record Payment — Due: {fmt(amountDue, bill.currency)}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-green-700">
                Amount *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder={amountDue.toFixed(2)}
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-green-700">
                Payment Date
              </label>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-green-700">
                Method
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-green-700">
                Reference
              </label>
              <input
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="Transaction / cheque no."
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-green-700">
                Notes
              </label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handlePayment}
              disabled={acting}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {acting ? 'Saving…' : 'Confirm Payment'}
            </button>
            <button
              type="button"
              onClick={() => setShowPay(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: 'Bill Date',
            value: bill.billDate
              ? new Date(bill.billDate).toLocaleDateString()
              : '—',
          },
          {
            label: 'Due Date',
            value: bill.dueDate
              ? new Date(bill.dueDate).toLocaleDateString()
              : '—',
          },
          { label: 'Currency', value: bill.currency },
          { label: 'Total', value: fmt(bill.totalAmount, bill.currency) },
          { label: 'Paid', value: fmt(bill.paidAmount, bill.currency) },
          {
            label: 'Balance Due',
            value: amountDue > 0 ? fmt(amountDue, bill.currency) : 'Paid',
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-0.5 truncate font-medium text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* 3-Way Matching */}
      {bill.matchingDetails && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-700">
              3-Way Matching
            </h2>
          </div>

          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label: 'Price', ok: bill.matchingDetails.priceMatch },
              { label: 'Quantity', ok: bill.matchingDetails.quantityMatch },
              { label: 'Received', ok: bill.matchingDetails.receivedMatch },
            ].map(({ label, ok }) => (
              <div key={label} className="px-5 py-3 text-center">
                <p className="text-xs text-gray-500">{label}</p>
                <span
                  className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${ok ? 'text-green-600' : 'text-red-600'}`}
                >
                  {ok ? (
                    <PiCheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <PiXCircle className="h-3.5 w-3.5" />
                  )}
                  {ok ? 'OK' : 'Mismatch'}
                </span>
              </div>
            ))}
          </div>

          {bill.matchingDetails.variance !== 0 && (
            <div className="border-b border-gray-100 bg-orange-50 px-5 py-2.5 text-xs text-orange-700">
              <span className="font-medium">Variance:</span>{' '}
              {fmt(bill.matchingDetails.variance, bill.currency)} —{' '}
              {bill.matchingDetails.varianceReason}
            </div>
          )}

          {bill.matchingDetails.itemComparisons &&
            bill.matchingDetails.itemComparisons.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                        Product
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">
                        Bill Qty
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">
                        PO Ordered
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">
                        PO Received
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">
                        Bill Price
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">
                        PO Price
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bill.matchingDetails.itemComparisons.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">
                            {c.subProductName}
                          </p>
                          {c.sizeName && (
                            <p className="text-xs text-gray-400">
                              {c.sizeName}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {c.billQty}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {c.poOrderedQty}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {c.poReceivedQty}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {fmt(c.billPrice, bill.currency)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {fmt(c.poOrderedPrice, bill.currency)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-xs font-medium capitalize ${ITEM_MATCH_CLS[c.status] ?? 'text-gray-500'}`}
                        >
                          {c.message || c.status.replace(/_/g, ' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* Bill lines */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Bill Lines</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Product
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Qty
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Unit Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Tax %
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bill.items.map((item, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">
                    {item.subProductName ?? '—'}
                  </p>
                  <div className="flex gap-2 text-xs text-gray-400">
                    {item.sizeName && <span>{item.sizeName}</span>}
                    {item.sku && <span>{item.sku}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {fmt(item.unitPrice, bill.currency)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {item.taxRate ?? 0}%
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {fmt(item.amount, bill.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          <div className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{fmt(bill.subtotal, bill.currency)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span>{fmt(bill.taxAmount, bill.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
              <span>Total</span>
              <span>{fmt(bill.totalAmount, bill.currency)}</span>
            </div>
            <div className="flex justify-end">
              <BaseCurrencyEquivalent
                amount={bill.totalAmount}
                currency={bill.currency}
              />
            </div>
            {bill.paidAmount > 0 && (
              <>
                <div className="flex justify-between text-green-600">
                  <span>Paid</span>
                  <span>− {fmt(bill.paidAmount, bill.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold text-gray-900">
                  <span>Balance Due</span>
                  <span
                    className={
                      amountDue > 0 ? 'text-red-600' : 'text-green-600'
                    }
                  >
                    {amountDue > 0 ? fmt(amountDue, bill.currency) : 'Paid'}
                  </span>
                </div>
                <div className="flex justify-end">
                  <BaseCurrencyEquivalent
                    amount={amountDue}
                    currency={bill.currency}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment history */}
      {bill.payments && bill.payments.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Payment History
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                  Date
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                  Method
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                  Reference
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bill.payments.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-700">
                    {new Date(p.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-gray-700">
                    {p.method?.replace(/_/g, ' ') ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {p.reference ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-green-700">
                    {fmt(p.amount, bill.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {bill.notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Notes</p>
          <p className="mt-0.5 text-sm text-gray-700">{bill.notes}</p>
        </div>
      )}

      {/* Override banner */}
      {bill.overrideReason && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          <span className="font-medium">Override applied:</span>{' '}
          {bill.overrideReason}
        </div>
      )}
    </div>
  );
}
