'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiCheck, PiCurrencyDollar, PiX } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { vendorReturnService } from '@/services/vendorReturn.service';
import type { VendorReturn } from '@/services/vendorReturn.service';
import { STATUS_BADGE, statusLabel } from './types';

const REFUND_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'other', label: 'Other' },
];

export default function PurchasesReturnDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [ret, setRet] = useState<VendorReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('bank_transfer');
  const [refundRef, setRefundRef] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorReturnService.getVendorReturn(id, token);
      setRet(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load return');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConfirm() {
    setActing(true);
    try {
      await vendorReturnService.updateReturnStatus(
        id,
        'confirmed',
        undefined,
        token
      );
      toast.success('Return confirmed');
      await load();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to confirm return'
      );
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    setActing(true);
    try {
      await vendorReturnService.updateReturnStatus(
        id,
        'cancelled',
        undefined,
        token
      );
      toast.success('Return cancelled');
      await load();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to cancel return'
      );
    } finally {
      setActing(false);
    }
  }

  async function handleRefund() {
    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid refund amount');
      return;
    }
    setActing(true);
    try {
      await vendorReturnService.recordRefund(
        id,
        {
          amount,
          method: refundMethod,
          reference: refundRef || undefined,
          notes: refundNotes || undefined,
        },
        token
      );
      toast.success('Refund recorded');
      setShowRefund(false);
      setRefundAmount('');
      setRefundRef('');
      setRefundNotes('');
      await load();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to record refund'
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
  if (!ret) {
    return (
      <div className="py-20 text-center text-sm text-gray-500">
        Return not found
      </div>
    );
  }

  const total = ret.totalAmount ?? ret.items.reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.vendorReturns}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Vendor Returns
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{ret.returnNumber}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {ret.returnNumber}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[ret.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {statusLabel(ret.status)}
            </span>
          </div>
          {ret.vendorName && (
            <p className="mt-1 text-sm text-gray-500">
              Vendor: {ret.vendorName}
            </p>
          )}
          {ret.poNumber && (
            <p className="text-xs text-gray-400">PO: {ret.poNumber}</p>
          )}
        </div>

        <div className="flex gap-2">
          {ret.status === 'draft' && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={acting}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" /> Confirm Return
            </button>
          )}
          {ret.status === 'confirmed' && (
            <>
              <button
                type="button"
                onClick={() => setShowRefund(true)}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                <PiCurrencyDollar className="h-4 w-4" /> Record Refund
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={acting}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <PiX className="h-4 w-4" /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {showRefund && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="mb-3 text-sm font-medium text-green-800">
            Record Refund
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
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={`${ret.currency} ${total.toFixed(2)}`}
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-green-700">
                Method
              </label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              >
                {REFUND_METHODS.map((m) => (
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
                value={refundRef}
                onChange={(e) => setRefundRef(e.target.value)}
                placeholder="Transaction / cheque no."
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-green-700">
                Notes
              </label>
              <input
                type="text"
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefund}
              disabled={acting}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {acting ? 'Saving…' : 'Confirm Refund'}
            </button>
            <button
              type="button"
              onClick={() => setShowRefund(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Return Date',
            value: ret.returnDate
              ? new Date(ret.returnDate).toLocaleDateString()
              : '—',
          },
          { label: 'Currency', value: ret.currency ?? '—' },
          {
            label: 'Total',
            value: `${ret.currency ?? ''} ${total.toFixed(2)}`,
          },
          {
            label: 'Refund',
            value:
              ret.refundAmount > 0
                ? `${ret.currency ?? ''} ${ret.refundAmount.toFixed(2)}`
                : ret.status === 'refunded'
                  ? 'Refunded'
                  : 'Pending',
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-0.5 font-medium text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Return Lines</h2>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Reason
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ret.items.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">
                    {item.subProductName ?? '—'}
                  </p>
                  {item.sku && (
                    <p className="text-xs text-gray-500">{item.sku}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {ret.currency} {item.unitPrice.toFixed(2)}
                </td>
                <td className="px-4 py-3 capitalize text-gray-600">
                  {item.reason?.replace(/_/g, ' ') ?? '—'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {ret.currency} {item.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td
                colSpan={4}
                className="px-4 py-3 text-right text-sm font-semibold text-gray-700"
              >
                Total
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                {ret.currency} {total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {ret.notes && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Notes</p>
          <p className="mt-0.5 text-sm text-gray-700">{ret.notes}</p>
        </div>
      )}
    </div>
  );
}
