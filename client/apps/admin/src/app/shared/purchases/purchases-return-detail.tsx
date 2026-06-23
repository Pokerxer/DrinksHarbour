'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiArrowLeft, PiCheck, PiCurrencyDollar, PiX, PiTrash, PiWarning, PiClock, PiPackage, PiShippingContainer,
  PiDotsNine, PiHandArrowDown, PiXCircle, PiCheckCircle, PiPrinter,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { useTenant } from '@/context/TenantContext';
import { vendorReturnService } from '@/services/vendorReturn.service';
import { vendorBillService } from '@/services/vendorBill.service';
import type { VendorReturn } from '@/services/vendorReturn.service';
import type { VendorBill } from '@/services/vendorBill.service';
import { STATUS_BADGE, returnStatusLabel } from './types';
import { fmtCur } from './purchases-analytics-helpers';
import { printReturnInvoice } from '@/utils/purchaseInvoice';

const REFUND_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

const CONDITION_BADGE: Record<string, string> = {
  damaged: 'bg-red-100 text-red-700',
  defective: 'bg-amber-100 text-amber-700',
  expired: 'bg-gray-200 text-gray-700',
  wrong_item: 'bg-blue-100 text-blue-700',
  over_supplied: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-600',
};

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-5 h-6 w-48 rounded bg-gray-100" />
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 h-3 w-16 rounded bg-gray-100" />
            <div className="h-5 w-20 rounded bg-gray-100" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-xl border border-gray-200 bg-white" />
    </div>
  );
}

function TimelineStep({ active, done, icon, label, date }: {
  active: boolean; done: boolean; icon: React.ReactNode; label: string; date?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
          done ? 'bg-emerald-100 text-emerald-600' : active ? 'bg-[#b20202]/10 text-[#b20202]' : 'bg-gray-100 text-gray-400'
        }`}>
          {done ? <PiCheckCircle className="h-4 w-4" /> : icon}
        </div>
        <div className={`mt-1 h-full w-0.5 ${done ? 'bg-emerald-200' : 'bg-gray-200'}`} style={{ minHeight: 8 }} />
      </div>
      <div className="pb-6">
        <p className={`text-sm font-medium ${done ? 'text-gray-900' : active ? 'text-[#b20202]' : 'text-gray-400'}`}>
          {label}
        </p>
        {date && <p className="text-xs text-gray-400">{new Date(date).toLocaleDateString()}</p>}
      </div>
    </div>
  );
}

function ConfirmDialog({ open, title, message, onClose, onConfirm, loading, confirmLabel = 'Confirm', danger = false }: {
  open: boolean; title: string; message: string; onClose: () => void; onConfirm: () => void;
  loading: boolean; confirmLabel?: string; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
            {danger ? <PiWarning className="h-5 w-5 text-red-600" /> : <PiCheck className="h-5 w-5 text-amber-600" />}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{title}</p>
            <p className="text-sm text-gray-500">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#b20202] hover:bg-[#9a0101]'
          }`}>
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchasesReturnDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [ret, setRet] = useState<VendorReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const { tenant } = useTenant();
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('bank_transfer');
  const [refundRef, setRefundRef] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => Promise<void>; confirmLabel: string; danger: boolean } | null>(null);
  const [bill, setBill] = useState<VendorBill | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorReturnService.getVendorReturn(id, token);
      setRet(res.data);

      // Load linked vendor bill to determine refund eligibility
      const poId = typeof res.data.purchaseOrder === 'object'
        ? (res.data.purchaseOrder as { _id: string })._id
        : res.data.purchaseOrder;
      if (poId) {
        const billsRes = await vendorBillService
          .getVendorBills(token, { purchaseOrder: poId, limit: 5 })
          .catch(() => null);
        if (billsRes?.data?.length) {
          const paidBill = billsRes.data.find(
            (b: VendorBill) => b.status === 'paid' || b.status === 'partial'
          );
          if (paidBill) setBill(paidBill);
        }
      }
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
      await vendorReturnService.updateReturnStatus(id, 'confirmed', undefined, token);
      toast.success('Return confirmed');
      setConfirmAction(null);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm return');
    } finally {
      setActing(false);
    }
  }

  async function handleReceive() {
    setActing(true);
    try {
      await vendorReturnService.updateReturnStatus(id, 'received', undefined, token);
      toast.success('Return marked as received');
      setConfirmAction(null);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    setActing(true);
    try {
      await vendorReturnService.updateReturnStatus(id, 'cancelled', undefined, token);
      toast.success('Return cancelled');
      setConfirmAction(null);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel return');
    } finally {
      setActing(false);
    }
  }

  async function handleDelete() {
    setActing(true);
    try {
      await vendorReturnService.deleteVendorReturn(id, token);
      toast.success('Return deleted');
      setConfirmAction(null);
      router.push(routes.eCommerce.vendorReturns);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete return');
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
        { amount, method: refundMethod, reference: refundRef || undefined, notes: refundNotes || undefined },
        token
      );
      toast.success('Refund recorded');
      setShowRefund(false);
      setRefundAmount('');
      setRefundRef('');
      setRefundNotes('');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record refund');
    } finally {
      setActing(false);
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (!ret) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <PiWarning className="h-10 w-10 text-gray-300" />
        <p className="text-sm text-gray-500">Return not found</p>
        <Link href={routes.eCommerce.vendorReturns} className="text-sm font-medium text-[#b20202] hover:underline">
          Back to Vendor Returns
        </Link>
      </div>
    );
  }

  const total = ret.totalAmount ?? ret.items.reduce((s, i) => s + i.amount, 0);
  const totalQty = ret.items.reduce((s, i) => s + i.quantity, 0);
  const cur = ret.currency ?? 'NGN';

  const timelineSteps = [
    { key: 'created', label: 'Created', icon: <PiClock className="h-4 w-4" />, done: true, date: ret.createdAt },
    { key: 'confirmed', label: 'Confirmed', icon: <PiCheck className="h-4 w-4" />, done: !!ret.confirmedAt || ['confirmed', 'received', 'refunded'].includes(ret.status), date: ret.confirmedAt, active: ret.status === 'draft' },
    { key: 'requested', label: 'Requested', icon: <PiPackage className="h-4 w-4" />, done: !!ret.requestedDate || ['requested', 'shipped', 'in_transit', 'received', 'refunded'].includes(ret.status), date: ret.requestedDate, active: ret.status === 'confirmed' },
    { key: 'shipped', label: 'Shipped', icon: <PiShippingContainer className="h-4 w-4" />, done: !!ret.shippedDate || ['shipped', 'in_transit', 'received', 'refunded'].includes(ret.status), date: ret.shippedDate, active: ret.status === 'requested' },
    { key: 'in_transit', label: 'In Transit', icon: <PiDotsNine className="h-4 w-4" />, done: ['in_transit', 'received', 'refunded'].includes(ret.status), active: ret.status === 'shipped' },
    { key: 'received', label: 'Received', icon: <PiHandArrowDown className="h-4 w-4" />, done: !!ret.receivedDate || ['received', 'refunded'].includes(ret.status), date: ret.receivedDate, active: ret.status === 'in_transit' },
    { key: 'refunded', label: 'Refunded', icon: <PiCurrencyDollar className="h-4 w-4" />, done: ret.status === 'refunded', date: ret.refundedDate, active: ret.status === 'received' },
  ];

  return (
    <div>
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ''}
        message={confirmAction?.message ?? ''}
        onClose={() => setConfirmAction(null)}
        onConfirm={async () => { await confirmAction?.onConfirm(); }}
        loading={acting}
        confirmLabel={confirmAction?.confirmLabel ?? 'Confirm'}
        danger={confirmAction?.danger ?? false}
      />

      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.vendorReturns} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Vendor Returns
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{ret.returnNumber}</span>
      </div>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{ret.returnNumber}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[ret.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {returnStatusLabel(ret.status)}
            </span>
          </div>
          {ret.vendorName && <p className="mt-1 text-sm text-gray-500">Vendor: {ret.vendorName}</p>}
          {ret.poNumber && <p className="text-xs text-gray-400">PO: {ret.poNumber}</p>}
          {ret.receivedByName && <p className="text-xs text-gray-400">Received by: {ret.receivedByName}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => printReturnInvoice(ret, tenant?.name || 'DrinksHarbour')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <PiPrinter className="h-4 w-4" /> Print
          </button>
          {ret.status === 'draft' && (
            <>
              <button
                type="button"
                onClick={() => setConfirmAction({
                  title: 'Confirm Return', message: 'This will mark the return as confirmed.',
                  onConfirm: handleConfirm, confirmLabel: 'Confirm', danger: false,
                })}
                className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
              >
                <PiCheck className="h-4 w-4" /> Confirm Return
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction({
                  title: 'Delete Return', message: 'This action cannot be undone.',
                  onConfirm: handleDelete, confirmLabel: 'Delete', danger: true,
                })}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <PiTrash className="h-4 w-4" /> Delete
              </button>
            </>
          )}
          {ret.status === 'confirmed' && (
            <>
              <button
                type="button"
                onClick={() => setConfirmAction({
                  title: 'Mark as Received', message: 'Mark this return as received from vendor.',
                  onConfirm: handleReceive, confirmLabel: 'Mark Received', danger: false,
                })}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <PiPackage className="h-4 w-4" /> Mark Received
              </button>
              {bill && (
                <button
                  type="button"
                  onClick={() => setShowRefund(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <PiCurrencyDollar className="h-4 w-4" /> Record Refund
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmAction({
                  title: 'Cancel Return', message: 'This will cancel the return request.',
                  onConfirm: handleCancel, confirmLabel: 'Cancel Return', danger: true,
                })}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <PiX className="h-4 w-4" /> Cancel
              </button>
            </>
          )}
          {ret.status === 'received' && bill && (
            <button
              type="button"
              onClick={() => setShowRefund(true)}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              <PiCurrencyDollar className="h-4 w-4" /> Record Refund
            </button>
          )}
        </div>
      </div>

      {/* Refund form */}
      {showRefund && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="mb-3 text-sm font-medium text-green-800">Record Refund</p>
          {bill && (
            <div className="mb-3 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-green-700">
              Linked Bill: <strong>{bill.billNumber || bill._id}</strong> &middot;
              Paid: <strong>{fmtCur(bill.paidAmount || 0, cur)}</strong>
              {bill.status === 'paid' ? ' (Fully Paid)' : ' (Partially Paid)'}
              &middot; Max Refund: <strong>{fmtCur(Math.min(total, bill.paidAmount || 0), cur)}</strong>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-green-700">Amount *</label>
              <input
                type="number" min="0" step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={fmtCur(Math.min(total, bill?.paidAmount ?? total), cur)}
                max={Math.min(total, bill?.paidAmount ?? total)}
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
              <div className="mt-1 flex gap-1">
                {[25, 50, 75, 100].map((pct) => {
                  const capped = Math.min(total, bill?.paidAmount ?? total);
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setRefundAmount(((capped * pct) / 100).toFixed(2))}
                      className="rounded border border-green-300 px-1.5 py-0.5 text-[10px] text-green-700 hover:bg-green-100"
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-green-700">Method</label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              >
                {REFUND_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-green-700">Reference</label>
              <input
                type="text" value={refundRef}
                onChange={(e) => setRefundRef(e.target.value)}
                placeholder="Transaction / cheque no."
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-green-700">Notes</label>
              <input type="text" value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={handleRefund} disabled={acting}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {acting ? 'Saving…' : 'Confirm Refund'}
            </button>
            <button type="button" onClick={() => setShowRefund(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content grid: Timeline + Stats + Items */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Timeline */}
        {ret.status !== 'cancelled' && ret.status !== 'rejected' && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Timeline</h2>
            <div className="space-y-0">
              {timelineSteps.map((step, i) => (
                <TimelineStep
                  key={step.key}
                  active={step.active ?? false}
                  done={step.done}
                  icon={step.icon}
                  label={step.label}
                  date={step.date}
                />
              ))}
            </div>
          </div>
        )}

        {/* Cancelled/Rejected status display */}
        {(ret.status === 'cancelled' || ret.status === 'rejected') && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <PiXCircle className="mx-auto mb-2 h-8 w-8 text-red-400" />
            <p className="font-semibold text-red-700">
              {ret.status === 'cancelled' ? 'Return Cancelled' : 'Return Rejected'}
            </p>
          </div>
        )}

        {/* Stats cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Return Date', value: ret.returnDate ? new Date(ret.returnDate).toLocaleDateString() : '—' },
            { label: 'Currency', value: cur },
            { label: 'Total Qty', value: String(totalQty) },
            { label: 'Total', value: fmtCur(total, cur) },
            {
              label: 'Refund',
              value: ret.refundAmount > 0
                ? fmtCur(ret.refundAmount, cur)
                : ret.status === 'refunded' ? 'Refunded' : ret.status === 'cancelled' ? '—' : 'Pending',
            },
            { label: 'Created', value: ret.createdAt ? new Date(ret.createdAt).toLocaleDateString() : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-0.5 font-medium text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Return lines */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Return Lines</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Size</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Unit Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Reason</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Condition</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ret.items.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{item.subProductName ?? '—'}</p>
                  {item.sku && <p className="text-xs text-gray-500">{item.sku}</p>}
                </td>
                <td className="px-4 py-3 text-center text-xs text-gray-500">
                  {item.sizeName ?? '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                <td className="px-4 py-3 text-right text-gray-700">{fmtCur(item.unitPrice, cur)}</td>
                <td className="px-4 py-3 capitalize text-gray-600">
                  {item.reason?.replace(/_/g, ' ') ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {item.condition ? (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${CONDITION_BADGE[item.condition] ?? 'bg-gray-100 text-gray-600'}`}>
                      {item.condition.replace(/_/g, ' ')}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCur(item.amount, cur)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td colSpan={2} className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Total</td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{totalQty}</td>
              <td colSpan={3} />
              <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmtCur(total, cur)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      {ret.notes && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Notes</p>
          <p className="mt-0.5 text-sm text-gray-700">{ret.notes}</p>
        </div>
      )}

      {/* Refund info */}
      {ret.refundAmount > 0 && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium text-green-700">Refund Information</p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-green-600">Amount</p>
              <p className="font-medium text-green-900">{fmtCur(ret.refundAmount, cur)}</p>
            </div>
            {ret.refundMethod && (
              <div>
                <p className="text-xs text-green-600">Method</p>
                <p className="font-medium text-green-900 capitalize">{ret.refundMethod.replace(/_/g, ' ')}</p>
              </div>
            )}
            {ret.refundReference && (
              <div>
                <p className="text-xs text-green-600">Reference</p>
                <p className="font-medium text-green-900">{ret.refundReference}</p>
              </div>
            )}
            {ret.refundDate && (
              <div>
                <p className="text-xs text-green-600">Date</p>
                <p className="font-medium text-green-900">{new Date(ret.refundDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
