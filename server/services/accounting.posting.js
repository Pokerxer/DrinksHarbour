// services/accounting.posting.js
//
// Auto-posting bridge between document flows and the journal. Mirrors
// tax.service.captureDocumentTax: fire-and-forget from controllers, failures
// log `journalPostFailed` and are repairable by backfill-journal-entries.js.
//
// Account map (seeded by chartOfAccounts.service.DEFAULT_COA):
//   1000 Cash · 1200 Inventory · 1300 Receivables · 1400 Tax Paid
//   2000 Payables · 2100 Tax Collected · 4000 Sales Revenue · 6000 OpEx

const { round2 } = require('./accounting.helpers');

const CODE = {
  CASH: '1000',
  INVENTORY: '1200',
  RECEIVABLES: '1300',
  TAX_PAID: '1400',
  PAYABLES: '2000',
  TAX_COLLECTED: '2100',
  SALES_REVENUE: '4000',
  OPEX: '6000',
};

/**
 * Pure line builders (unit-tested). Each returns balanced lines or [] when
 * the document carries no value worth posting.
 */

/** SO confirm → sales_revenue: Dr Cash/Receivables = total; Cr VAT + Revenue. */
function linesForSalesOrder(doc) {
  const total = round2(doc.total);
  if (total <= 0) return [];
  const tax = round2(doc.taxTotal || doc.taxAmount || 0);
  const revenue = round2(total - tax);
  const debitAccount =
    String(doc.paymentStatus || '') === 'paid' ? CODE.CASH : CODE.RECEIVABLES;
  return [
    { account: debitAccount, debit: total, credit: 0, memo: doc.orderNumber },
    { account: CODE.TAX_COLLECTED, debit: 0, credit: tax, memo: 'Output VAT' },
    { account: CODE.SALES_REVENUE, debit: 0, credit: revenue, memo: 'Sales revenue' },
  ];
}

function poTotals(doc) {
  const items = doc.items || [];
  const subtotal = round2(
    items.reduce((s, i) => s + (i.totalCost ?? (i.unitCost || 0) * (i.quantity || 0)), 0)
  );
  const tax = round2(items.reduce((s, i) => s + (i.taxAmount || 0), 0));
  return { subtotal, tax };
}

/** PO approve → expense_accrual: Dr Inventory + Dr Tax Paid; Cr Payables. */
function linesForPurchaseOrder(doc) {
  const { subtotal, tax } = poTotals(doc);
  const gross = round2(subtotal + tax);
  if (gross <= 0) return [];
  return [
    { account: CODE.INVENTORY, debit: subtotal, credit: 0, memo: doc.poNumber },
    { account: CODE.TAX_PAID, debit: tax, credit: 0, memo: 'Input VAT' },
    { account: CODE.PAYABLES, debit: 0, credit: gross, memo: 'Vendor payable' },
  ];
}

/** Bill validate → expense_accrual: Dr OpEx + Dr Tax Paid; Cr Payables. */
function linesForVendorBill(doc) {
  const subtotal = round2(doc.subtotal);
  const tax = round2(doc.taxAmount);
  const gross = round2(subtotal + tax);
  if (gross <= 0) return [];
  return [
    { account: CODE.OPEX, debit: subtotal, credit: 0, memo: doc.billNumber },
    { account: CODE.TAX_PAID, debit: tax, credit: 0, memo: 'Input VAT' },
    { account: CODE.PAYABLES, debit: 0, credit: gross, memo: 'Vendor payable' },
  ];
}

/** Vendor return refunded → refund: Dr Payables; Cr Inventory + Cr Tax Paid. */
function linesForVendorReturn(doc) {
  const subtotal = round2(doc.subtotal);
  const tax = round2(doc.taxAmount);
  const gross = round2(subtotal + tax);
  if (gross <= 0) return [];
  return [
    { account: CODE.PAYABLES, debit: gross, credit: 0, memo: doc.returnNumber },
    { account: CODE.INVENTORY, debit: 0, credit: subtotal, memo: 'Stock returned to vendor' },
    { account: CODE.TAX_PAID, debit: 0, credit: tax, memo: 'Input VAT reversal' },
  ];
}

const BUILDERS = {
  sales_order: linesForSalesOrder,
  purchase_order: linesForPurchaseOrder,
  vendor_bill: linesForVendorBill,
  vendor_return: linesForVendorReturn,
};

const REF_FIELDS = {
  sales_order: 'SalesOrder',
  purchase_order: 'PurchaseOrder',
  vendor_bill: 'VendorBill',
  vendor_return: 'VendorReturn',
};

/**
 * Post the journal entry for a committed document. Never throws into the host
 * flow — failures log `journalPostFailed`; backfill repairs gaps.
 */
async function postDocumentEntry({ sourceType, doc, postedBy }) {
  try {
    if (!doc?._id) return null;
    const builder = BUILDERS[sourceType];
    if (!builder) return null;
    // Lazy require avoids a circular import at module load time.
    const { postJournalEntry } = require('./journalEntry.service');
    return await postJournalEntry({
      tenantId: doc.tenant,
      date: doc.updatedAt || new Date(),
      lines: builder(doc),
      source: sourceType,
      refDoc: doc._id,
      refDocType: REF_FIELDS[sourceType],
      memo: `${sourceType.replace(/_/g, ' ')} posted automatically`,
      postedBy,
      entryType:
        sourceType === 'sales_order'
          ? 'sales_revenue'
          : sourceType === 'vendor_return'
            ? 'refund'
            : 'expense_accrual',
    });
  } catch (err) {
    console.error('journalPostFailed', { sourceType, sourceId: String(doc?._id), err });
    return null;
  }
}

/**
 * Reverse the entry previously posted for a document (SO cancel paths).
 * Idempotent: no-op when there is nothing to reverse.
 */
async function reverseDocumentEntry({ sourceType, doc, userId }) {
  try {
    if (!doc?._id) return null;
    const { findEntry, reverseEntry } = require('./journalEntry.service');
    const entryType =
      sourceType === 'sales_order'
        ? 'sales_revenue'
        : sourceType === 'vendor_return'
          ? 'refund'
          : 'expense_accrual';
    const original = await findEntry({ tenantId: doc.tenant, refDoc: doc._id, entryType });
    if (!original) return null;
    return await reverseEntry({ tenantId: doc.tenant, entryId: original._id, userId });
  } catch (err) {
    console.error('journalReverseFailed', { sourceType, sourceId: String(doc?._id), err });
    return null;
  }
}

module.exports = {
  CODE,
  BUILDERS,
  linesForSalesOrder,
  linesForPurchaseOrder,
  linesForVendorBill,
  linesForVendorReturn,
  postDocumentEntry,
  reverseDocumentEntry,
};
