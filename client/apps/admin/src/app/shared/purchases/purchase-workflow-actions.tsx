'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  PiArrowCounterClockwise,
  PiCheck,
  PiCheckCircle,
  PiCopy,
  PiLock,
  PiLockOpen,
  PiPackage,
  PiPaperPlaneTilt,
  PiPrinter,
  PiReceipt,
  PiX,
} from 'react-icons/pi';
import ConfirmDialog from '@/app/shared/confirm-dialog';
import { routes } from '@/config/routes';
import PurchaseDraftActions from './purchase-draft-actions';
import ReturnAllProductsLink from './return-all-products-link';
import type { PurchaseOrder } from './types';
import { getPurchaseWorkflow } from './purchase-workflow-state';

const primary =
  'inline-flex items-center gap-2 rounded-lg bg-[#b20202] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50';
const secondary =
  'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const danger =
  'inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50';

type Action =
  'approve' | 'reject' | 'confirm' | 'cancel' | 'send' | 'lock' | 'unlock';

export default function PurchaseWorkflowActions({
  order,
  busy,
  onAction,
  onPrint,
  onDuplicate,
  onDelete,
}: {
  order: PurchaseOrder;
  busy: boolean;
  onAction: (action: Action) => Promise<void>;
  onPrint: () => void;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState<'cancel' | 'reject' | null>(
    null
  );
  const workflow = getPurchaseWorkflow(order);
  const isRFQ = order.type === 'rfq';
  const cancelLabel = isRFQ ? 'Cancel RFQ' : 'Cancel Order';
  const {
    stage,
    canApprove,
    canConfirm,
    canReceive,
    canValidate,
    canBill,
    canReturn,
    canSend,
    canChangeLock,
    canCancel,
    canEdit,
  } = workflow;
  const query = `?po=${order._id}`;

  return (
    <section
      aria-label="Purchase workflow"
      className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 p-4 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{stage.title}</h2>
          <p className="mt-1 text-sm text-gray-600">{stage.detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canApprove && (
            <button
              type="button"
              className={primary}
              disabled={busy}
              onClick={() => onAction('approve')}
            >
              <PiCheck /> Approve &amp; Confirm
            </button>
          )}
          {canConfirm && (
            <button
              type="button"
              className={primary}
              disabled={busy}
              onClick={() => onAction('confirm')}
            >
              <PiCheck /> Confirm Order
            </button>
          )}
          {canValidate && (
            <Link
              href={
                routes.eCommerce.purchaseReceipt(order._id) + '?mode=validate'
              }
              className={primary}
            >
              <PiCheckCircle /> Validate Receipt
            </Link>
          )}
          {canReceive && (
            <Link
              href={routes.eCommerce.purchaseReceipt(order._id)}
              className={canValidate ? secondary : primary}
            >
              <PiPackage /> Receive Products
            </Link>
          )}
          {canBill && (
            <Link
              href={routes.eCommerce.createVendorBill + query}
              className={canValidate || canReceive ? secondary : primary}
            >
              <PiReceipt /> Create Bill
            </Link>
          )}
          {order.activeVendorBill && (
            <Link
              href={routes.eCommerce.vendorBillDetails(
                order.activeVendorBill._id
              )}
              className={secondary}
            >
              <PiReceipt /> View Bill
            </Link>
          )}
          {canReturn && (
            <Link
              href={routes.eCommerce.createVendorReturn + query}
              className={secondary}
            >
              <PiArrowCounterClockwise /> Return Products
            </Link>
          )}
          {canReturn && <ReturnAllProductsLink purchaseOrderId={order._id} />}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50/60 p-3 sm:px-5">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondary} onClick={onPrint}>
            <PiPrinter /> {isRFQ ? 'Print RFQ' : 'Print / Download'}
          </button>
          <button
            type="button"
            className={secondary}
            disabled={busy}
            onClick={onDuplicate}
          >
            <PiCopy /> Duplicate
          </button>
          {canSend && (
            <button
              type="button"
              className={secondary}
              disabled={busy}
              onClick={() => onAction('send')}
            >
              <PiPaperPlaneTilt /> Send to Vendor
            </button>
          )}
          {canChangeLock && (
            <button
              type="button"
              className={secondary}
              disabled={busy}
              onClick={() => onAction(order.isLocked ? 'unlock' : 'lock')}
            >
              {order.isLocked ? (
                <>
                  <PiLockOpen /> Unlock
                </>
              ) : (
                <>
                  <PiLock /> Lock
                </>
              )}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <PurchaseDraftActions
              orderId={order._id}
              orderNumber={order.poNumber}
              busy={busy}
              onDelete={onDelete}
            />
          )}
          {canApprove && (
            <button
              type="button"
              className={danger}
              disabled={busy}
              onClick={() => setConfirmation('reject')}
            >
              Reject
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              className={danger}
              disabled={busy}
              onClick={() => setConfirmation('cancel')}
            >
              <PiX /> {cancelLabel}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmation !== null}
        title={
          confirmation === 'reject'
            ? 'Reject purchase order?'
            : isRFQ
              ? 'Cancel quotation?'
              : 'Cancel purchase order?'
        }
        message={
          confirmation === 'reject'
            ? `Reject and cancel ${order.poNumber}?`
            : `${order.poNumber} will be marked cancelled and kept in purchase history.`
        }
        confirmLabel={confirmation === 'reject' ? 'Reject Order' : cancelLabel}
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirmation(null);
        }}
        onConfirm={async () => {
          if (!confirmation || busy) return;
          await onAction(confirmation);
          setConfirmation(null);
        }}
      />
    </section>
  );
}
