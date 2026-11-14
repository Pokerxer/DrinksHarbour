'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import { PiArrowLeft, PiLock } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  purchaseOrderService,
  warehouseLabelOf,
} from '@/services/purchaseOrder.service';
import { vendorReturnService } from '@/services/vendorReturn.service';
import type { VendorReturn } from '@/services/vendorReturn.service';
import type { PurchaseOrder } from './types';
import { STATUS_BADGE, statusLabel } from './types';
import { printPOInvoice, printRFQInvoice } from '@/utils/purchaseInvoice';
import PurchaseDetailLines from './purchase-detail-lines';
import PurchaseDetailReturns from './purchase-detail-returns';
import { getPurchaseWorkflow } from './purchase-workflow-state';
import PurchaseWorkflowActions from './purchase-workflow-actions';

export default function PurchasesPODetail({ id }: { id: string }) {
  const router = useRouter();
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
      await load();
    } finally {
      setActing(false);
    }
  }

  async function handleDuplicate() {
    setActing(true);
    try {
      const res = await purchaseOrderService.duplicate(id, token);
      toast.success('Duplicated as new draft');
      router.push(routes.eCommerce.purchaseDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate');
    } finally {
      setActing(false);
    }
  }

  async function handleDelete() {
    setActing(true);
    try {
      await purchaseOrderService.deletePurchaseOrder(id, token);
      toast.success('Purchase order deleted');
      router.replace(routes.eCommerce.purchases);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      await load();
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

  const { cancelled, awaitingApproval } = getPurchaseWorkflow(po);
  const actionHandlers = {
    approve: () =>
      act(
        () => purchaseOrderService.approvePO(id, token),
        'Purchase approved and confirmed'
      ),
    reject: () =>
      act(() => purchaseOrderService.rejectPO(id, token), 'Purchase rejected'),
    confirm: () =>
      act(
        () =>
          purchaseOrderService.updatePurchaseOrderStatus(
            id,
            'confirmed',
            token
          ),
        'Purchase confirmed'
      ),
    cancel: () =>
      act(
        () =>
          purchaseOrderService.updatePurchaseOrderStatus(
            id,
            'cancelled',
            token
          ),
        'Purchase cancelled'
      ),
    send: () =>
      act(
        () => purchaseOrderService.sendPOToVendor(id, token),
        'Sent to vendor'
      ),
    lock: () =>
      act(() => purchaseOrderService.lockPO(id, token), 'Purchase locked'),
    unlock: () =>
      act(() => purchaseOrderService.unlockPO(id, token), 'Purchase unlocked'),
  };
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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {po.poNumber}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[cancelled ? 'cancelled' : po.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {statusLabel(cancelled ? 'cancelled' : po.status)}
            </span>
            {po.isLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                <PiLock className="h-3 w-3" /> Locked
              </span>
            )}
            {awaitingApproval && (
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
      </div>

      <PurchaseWorkflowActions
        order={po}
        busy={acting}
        onAction={(action) => actionHandlers[action]()}
        onPrint={() => {
          const companyName = tenant?.name || 'DrinksHarbour';
          if (po.type === 'rfq') printRFQInvoice(po, companyName);
          else printPOInvoice(po, companyName);
        }}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />

      <div className="mb-5 grid grid-cols-1 overflow-hidden rounded-xl border border-gray-200 bg-white sm:grid-cols-2 xl:grid-cols-5">
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
            label: 'Destination',
            // '' when the PO has none, or when the ref came back unpopulated — an
            // id must never be rendered as if it were a warehouse name.
            value: warehouseLabelOf(po.warehouse) || '—',
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
            className="border-b border-gray-100 p-4 last:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-0.5 font-medium text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <PurchaseDetailLines po={po} />

      {po.notes && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Notes</p>
          <p className="mt-1 text-sm text-gray-700">{po.notes}</p>
        </div>
      )}

      <PurchaseDetailReturns returns={returns} currency={po.currency} />
    </div>
  );
}
