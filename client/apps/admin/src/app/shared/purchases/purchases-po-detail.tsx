'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import {
  PiArrowLeft,
  PiPencilSimple,
  PiCheck,
  PiCheckCircle,
  PiPackage,
  PiReceipt,
  PiLock,
  PiLockOpen,
  PiPaperPlaneTilt,
  PiX,
  PiPrinter,
  PiArrowCounterClockwise,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import { vendorReturnService } from '@/services/vendorReturn.service';
import type { VendorReturn } from '@/services/vendorReturn.service';
import type { PurchaseOrder } from './types';
import { STATUS_BADGE, statusLabel } from './types';
import { printPOInvoice } from '@/utils/purchaseInvoice';
import BaseCurrencyEquivalent from './base-currency-equivalent';

export default function PurchasesPODetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const { tenant } = useTenant();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [returns, setReturns] = useState<VendorReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [poRes, returnsRes] = await Promise.all([
        purchaseOrderService.getPurchaseOrder(id, token),
        vendorReturnService
          .getVendorReturns(token, { purchaseOrder: id, limit: 50 })
          .catch(() => null),
      ]);
      setPO(poRes.data);
      if (returnsRes?.data) setReturns(returnsRes.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, msg: string) {
    setActing(true);
    try {
      await fn();
      toast.success(msg);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(false);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Loading…
      </div>
    );
  if (!po)
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-sm text-gray-500">Purchase order not found</p>
        <Link
          href={routes.eCommerce.purchases}
          className="text-sm text-[#b20202] underline"
        >
          Back to list
        </Link>
      </div>
    );

  const canEdit = po.status === 'draft' && !po.isLocked;
  // All POs (not RFQs) start as approvalStatus 'pending'; the server rejects
  // draft → confirmed until approved, so pending drafts get Approve/Reject
  // and only approved drafts get a plain Confirm.
  const needsApproval =
    po.status === 'draft' &&
    po.type !== 'rfq' &&
    (!po.approvalStatus || po.approvalStatus === 'pending');
  const canConfirm =
    po.status === 'draft' &&
    (po.type === 'rfq' || po.approvalStatus === 'approved');
  // Outstanding per line: ordered - received - returned. A PO stays receivable
  // while any line still has outstanding units (it sits at partially_received).
  const lineOutstanding = (i: (typeof po.items)[number]) =>
    i.outstandingQty ??
    Math.max(0, i.quantity - (i.receivedQty ?? 0) - (i.returnedQty ?? 0));
  const anyOutstanding = po.items.some((i) => lineOutstanding(i) > 0);
  const canReceive =
    (po.status === 'confirmed' ||
      po.status === 'partially_received' ||
      po.status === 'received') &&
    anyOutstanding;
  // Validate posts the not-yet-posted received units; available while there is
  // anything received but not fully validated (received / partially_received).
  const canValidate =
    po.status === 'received' || po.status === 'partially_received';
  // Confirmed POs can be billed on ordered quantities (policy chosen on the
  // bill-create page); received/validated bill on received quantities.
  const canBill =
    po.status === 'confirmed' ||
    po.status === 'partially_received' ||
    po.status === 'received' ||
    po.status === 'validated' ||
    po.status === 'done';
  const canReturn =
    po.status !== 'draft' &&
    po.status !== 'cancel' &&
    po.status !== 'cancelled';
  const totalCost = po.items.reduce(
    (s, it) =>
      s +
      (it.totalCost ??
        ((it as any).unitCost ?? it.unitPrice ?? 0) * it.quantity),
    0
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.purchases}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Purchase Orders
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{po.poNumber}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {po.poNumber}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[po.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {statusLabel(po.status)}
            </span>
            {po.isLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                <PiLock className="h-3 w-3" /> Locked
              </span>
            )}
            {po.status === 'draft' &&
              po.type !== 'rfq' &&
              (!po.approvalStatus || po.approvalStatus === 'pending') && (
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Awaiting Approval
                </span>
              )}
            {po.approvalStatus === 'rejected' && (
              <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                Rejected{po.approvalNotes ? ` — ${po.approvalNotes}` : ''}
              </span>
            )}
          </div>
          {po.vendorName && (
            <p className="mt-1 text-sm text-gray-500">
              Vendor: {po.vendorName}
            </p>
          )}
          {typeof po.purchaseAgreement === 'object' &&
            po.purchaseAgreement?._id && (
              <p className="mt-1 text-sm text-gray-500">
                From agreement:{' '}
                <Link
                  href={routes.eCommerce.purchaseAgreementDetails(
                    po.purchaseAgreement._id
                  )}
                  className="font-medium text-[#b20202] hover:underline"
                >
                  {po.purchaseAgreement.agreementNumber ?? 'View agreement'}
                </Link>
                {po.purchaseAgreement.name
                  ? ` · ${po.purchaseAgreement.name}`
                  : ''}
              </p>
            )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => printPOInvoice(po, tenant?.name || 'DrinksHarbour')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <PiPrinter className="h-4 w-4" /> Print / Download
          </button>
          {canEdit && (
            <Link
              href={routes.eCommerce.editPurchase(po._id)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiPencilSimple className="h-4 w-4" /> Edit
            </Link>
          )}
          {needsApproval && (
            <>
              <button
                type="button"
                disabled={acting}
                onClick={() =>
                  act(
                    () => purchaseOrderService.approvePO(id, token),
                    'PO approved and confirmed'
                  )
                }
                className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
              >
                <PiCheck className="h-4 w-4" /> Approve & Confirm
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => {
                  if (
                    confirm('Reject this purchase order? It will be cancelled.')
                  )
                    act(
                      () => purchaseOrderService.rejectPO(id, token),
                      'PO rejected'
                    );
                }}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <PiX className="h-4 w-4" /> Reject
              </button>
            </>
          )}
          {canConfirm && (
            <button
              type="button"
              disabled={acting}
              onClick={() =>
                act(
                  () =>
                    purchaseOrderService.updatePurchaseOrderStatus(
                      id,
                      'confirmed',
                      token
                    ),
                  'Purchase order confirmed'
                )
              }
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" /> Confirm Order
            </button>
          )}
          {canReceive && (
            <Link
              href={`${routes.eCommerce.receivePurchase}?po=${po._id}`}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <PiPackage className="h-4 w-4" /> Receive
            </Link>
          )}
          {canValidate && (
            <Link
              href={routes.eCommerce.purchaseReceipt(po._id)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <PiCheckCircle className="h-4 w-4" /> Validate
            </Link>
          )}
          {canBill && (
            <Link
              href={`${routes.eCommerce.createVendorBill}?po=${po._id}`}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              <PiReceipt className="h-4 w-4" /> Create Bill
            </Link>
          )}
          {canReturn && (
            <Link
              href={`${routes.eCommerce.createVendorReturn}?po=${po._id}`}
              className="flex items-center gap-1.5 rounded-lg border border-orange-300 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
            >
              <PiArrowCounterClockwise className="h-4 w-4" /> Return
            </Link>
          )}
          {!po.isLocked &&
            po.status !== 'draft' &&
            po.status !== 'cancel' &&
            po.status !== 'cancelled' && (
              <button
                type="button"
                disabled={acting}
                onClick={() =>
                  act(() => purchaseOrderService.lockPO(id, token), 'PO locked')
                }
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <PiLock className="h-4 w-4" /> Lock
              </button>
            )}
          {po.isLocked && (
            <button
              type="button"
              disabled={acting}
              onClick={() =>
                act(
                  () => purchaseOrderService.unlockPO(id, token),
                  'PO unlocked'
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <PiLockOpen className="h-4 w-4" /> Unlock
            </button>
          )}
          {po.status !== 'cancel' &&
            po.status !== 'cancelled' &&
            po.status !== 'done' &&
            po.status !== 'validated' && (
              <button
                type="button"
                disabled={acting}
                onClick={() =>
                  act(
                    () => purchaseOrderService.sendPOToVendor(id, token),
                    'Sent to vendor'
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <PiPaperPlaneTilt className="h-4 w-4" /> Send to Vendor
              </button>
            )}
          {po.status === 'draft' && (
            <button
              type="button"
              disabled={acting}
              onClick={() =>
                act(
                  () =>
                    purchaseOrderService.updatePurchaseOrderStatus(
                      id,
                      'cancelled',
                      token
                    ),
                  'Cancelled'
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <PiX className="h-4 w-4" /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Currency', value: po.currency },
          { label: 'Vendor Reference', value: po.vendorReference ?? '—' },
          {
            label: 'Expected Arrival',
            value: po.expectedArrival
              ? new Date(po.expectedArrival).toLocaleDateString()
              : '—',
          },
          {
            label: 'Created',
            value: po.createdAt
              ? new Date(po.createdAt).toLocaleDateString()
              : '—',
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
          <h2 className="text-sm font-semibold text-gray-700">Order Lines</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                SKU
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Qty
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Received
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Outstanding
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Unit Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {po.items.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {(() => {
                    const name =
                      (item as any).subProductName ?? item.productName ?? '';
                    const size = (item as any).sizeName;
                    if (size && !name.includes(size))
                      return `${name} – ${size}`;
                    return name;
                  })()}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {item.sku}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={
                      item.receivedQty >= item.quantity
                        ? 'font-medium text-green-600'
                        : 'text-gray-500'
                    }
                  >
                    {item.receivedQty}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {(() => {
                    const out = lineOutstanding(item);
                    return (
                      <span
                        className={
                          out > 0
                            ? 'font-medium text-amber-600'
                            : 'text-gray-400'
                        }
                      >
                        {out}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {po.currency}{' '}
                  {(
                    (item as any).unitCost ??
                    item.unitPrice ??
                    (item.quantity ? (item.totalCost ?? 0) / item.quantity : 0)
                  ).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {po.currency}{' '}
                  {(
                    item.totalCost ??
                    ((item as any).unitCost ?? item.unitPrice ?? 0) *
                      item.quantity
                  ).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td
                colSpan={6}
                className="px-4 py-3 text-right text-sm font-semibold text-gray-700"
              >
                Total
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                {po.currency} {totalCost.toFixed(2)}
                <div>
                  <BaseCurrencyEquivalent
                    amount={totalCost}
                    currency={po.currency}
                    className="font-normal"
                  />
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {po.notes && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Notes</p>
          <p className="mt-1 text-sm text-gray-700">{po.notes}</p>
        </div>
      )}

      {/* Returns */}
      {returns.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Returns ({returns.length})
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Return #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  Items
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  Total
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  Refund
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.map((r) => {
                const statusColor: Record<string, string> = {
                  draft: 'bg-gray-100 text-gray-600',
                  confirmed: 'bg-blue-100 text-blue-700',
                  requested: 'bg-amber-100 text-amber-700',
                  shipped: 'bg-indigo-100 text-indigo-700',
                  in_transit: 'bg-purple-100 text-purple-700',
                  received: 'bg-green-100 text-green-700',
                  refunded: 'bg-emerald-100 text-emerald-700',
                  rejected: 'bg-red-100 text-red-700',
                  cancelled: 'bg-gray-100 text-gray-500',
                };
                return (
                  <tr key={r._id}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {r.returnNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.returnDate
                        ? new Date(r.returnDate).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.items.reduce((s, i) => s + i.quantity, 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {r.currency} {r.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusColor[r.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.refundStatus && r.refundStatus !== 'none' ? (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                            r.refundStatus === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : r.refundStatus === 'processing'
                                ? 'bg-blue-100 text-blue-700'
                                : r.refundStatus === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {r.refundStatus}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={routes.eCommerce.vendorReturnDetails(r._id)}
                        className="text-xs font-medium text-[#b20202] hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td
                  colSpan={3}
                  className="px-4 py-3 text-right text-sm font-semibold text-gray-700"
                >
                  Total Returned
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  {po.currency}{' '}
                  {returns.reduce((s, r) => s + r.totalAmount, 0).toFixed(2)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
