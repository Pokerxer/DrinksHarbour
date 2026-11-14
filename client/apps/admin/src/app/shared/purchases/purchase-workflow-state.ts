import { canModifyPurchaseDraft, type POItem, type PurchaseOrder } from './types';

export function outstandingPurchaseQuantity(line: POItem): number {
  return Math.max(
    0,
    line.outstandingQty ?? line.quantity - (line.receivedQty ?? 0) - (line.returnedQty ?? 0)
  );
}

const stages = {
  draft: {
    title: 'Prepare purchase',
    detail: 'Review the items and prices before confirming.',
  },
  approval: {
    title: 'Awaiting approval',
    detail: 'Review this purchase order before approving or rejecting it.',
  },
  confirmed: {
    title: 'Awaiting delivery',
    detail: 'Record the products that arrive from the vendor.',
  },
  partial: {
    title: 'Partial delivery',
    detail: 'Continue receiving products as they arrive.',
  },
  toValidate: {
    title: 'Receipt awaiting validation',
    detail: 'Validate the receipt to add the received products to inventory.',
  },
  validated: {
    title: 'Receipt validated',
    detail: 'Manage the vendor bill or return eligible products.',
  },
  billed: {
    title: 'Billed',
    detail: 'Return eligible products from this purchase.',
  },
  received: {
    title: 'Products received',
    detail: 'All ordered quantities have been received.',
  },
  cancelled: {
    title: 'Purchase cancelled',
    detail: 'The document is available for reference.',
  },
  converted: {
    title: 'Converted to a purchase order',
    detail: 'Continue processing from the purchase order.',
  },
  closedQuotation: {
    title: 'Quotation closed',
    detail: 'The document is available for reference.',
  },
  rejected: {
    title: 'Purchase rejected',
    detail: 'The document is available for reference.',
  },
};

export function getPurchaseWorkflow(order: PurchaseOrder) {
  const { status, rfqStatus, type, approvalStatus } = order;
  const isRFQ = type === 'rfq';
  const draft = status === 'draft';
  const confirmed = status === 'confirmed';
  const cancelled =
    ['cancel', 'cancelled'].includes(status) || rfqStatus === 'cancelled';
  const converted = rfqStatus === 'converted';
  const rejected = approvalStatus === 'rejected';
  const closedQuotation = rfqStatus === 'expired' || rfqStatus === 'rejected';
  const closed = cancelled || converted || rejected || closedQuotation;
  const partial = status === 'partially_received';
  const received = status === 'received';
  const validated = status === 'validated' || status === 'done';
  const billed = status === 'billed';
  const products = order.items.filter(
    (line) => line.lineType !== 'section' && line.lineType !== 'note'
  );
  const receivedUnits = products.some((line) => line.receivedQty > 0);
  const hasReceipt =
    partial ||
    received ||
    validated ||
    order.isPartiallyReceived ||
    order.fullyReceivedDate != null ||
    !!order.partialReceipts?.length ||
    products.some(
      (line) =>
        line.receivedQty > 0 ||
        (line.postedQty ?? 0) > 0 ||
        (line.returnedQty ?? 0) > 0
    );
  const awaitingApproval =
    draft && !isRFQ && (!approvalStatus || approvalStatus === 'pending');
  const canValidate =
    !closed &&
    (partial || received) &&
    products.some((line) => line.receivedQty > (line.postedQty ?? 0));
  let stage: keyof typeof stages = 'confirmed';
  if (cancelled) stage = 'cancelled';
  else if (converted) stage = 'converted';
  else if (rejected) stage = 'rejected';
  else if (closedQuotation) stage = 'closedQuotation';
  else if (awaitingApproval) stage = 'approval';
  else if (draft) stage = 'draft';
  else if (canValidate) stage = 'toValidate';
  else if (partial) stage = 'partial';
  else if (billed) stage = 'billed';
  else if (validated) stage = 'validated';
  else if (received) stage = 'received';

  return {
    stage: stages[stage],
    cancelled,
    awaitingApproval: !closed && awaitingApproval,
    canApprove: !closed && awaitingApproval,
    canConfirm: !closed && draft && (isRFQ || approvalStatus === 'approved'),
    canReceive:
      !closed &&
      (confirmed || partial || received) &&
      products.some((line) => outstandingPurchaseQuantity(line) > 0),
    canValidate,
    canBill:
      !closed &&
      !!order.vendor &&
      !order.activeVendorBill &&
      (((received || validated) && receivedUnits) ||
        (!isRFQ &&
          (confirmed || received || validated) &&
          order.billControlPolicy === 'ordered' &&
          products.some((line) => line.quantity > 0))),
    canReturn:
      !closed &&
      !canValidate &&
      (partial || received || validated || billed) &&
      products.some(
        (line) =>
          Math.min(
            line.receivedQty || 0,
            validated || billed ? Infinity : (line.postedQty ?? 0)
          ) > 0
      ),
    canSend: !closed && (draft || confirmed) && !!order.vendor,
    canChangeLock: !closed && (!draft || !!order.isLocked),
    canCancel:
      !cancelled &&
      !converted &&
      !hasReceipt &&
      (draft || (confirmed && isRFQ)),
    canEdit: !closed && canModifyPurchaseDraft(order),
  };
}
