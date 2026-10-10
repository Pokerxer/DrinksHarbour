const { round2 } = require('./tax.helpers');
const keyOf = (item) => `${item.subProductId || ''}:${item.sizeId || ''}`;
const plain = (item) => (item.toObject ? item.toObject() : { ...item });

// Save the original invoice and exact applied quantities alongside the net
// invoice. Payments remain historical; stock returns never erase payments.
async function adjustBillForReturn(tenantId, vendorReturn, action, deps = {}) {
  if (!vendorReturn.purchaseOrder) return;
  const Model = deps.VendorBill || require('../models/VendorBill');
  const bill = await Model.findOne({
    tenant: tenantId,
    purchaseOrder: vendorReturn.purchaseOrder,
    ...(vendorReturn.vendorBill ? { _id: vendorReturn.vendorBill } : {}),
    status: { $in: ['draft', 'confirmed', 'partial', 'paid', 'overdue'] },
  }).sort({ createdAt: -1 });
  if (!bill) return;
  const id = String(vendorReturn._id);
  const entries = bill.returnAdjustments || [];
  const existing = entries.find(
    (entry) => String(entry.vendorReturn) === id && entry.active !== false,
  );
  if (action === 'deduct' && existing) return;
  if (
    action === 'restore' &&
    entries.some((entry) => String(entry.vendorReturn) === id && entry.active === false)
  )
    return;
  if (action === 'deduct' && !bill.originalInvoice?.items?.length)
    bill.originalInvoice = {
      items: bill.items.map(plain),
      subtotal: bill.subtotal,
      taxAmount: bill.taxAmount,
      totalAmount: bill.totalAmount,
    };
  const requested = new Map();
  for (const item of vendorReturn.items)
    requested.set(keyOf(item), (requested.get(keyOf(item)) || 0) + item.quantity);
  const adjustments = [];
  bill.items = bill.items.map((item, itemIndex) => {
    const qty =
      action === 'restore'
        ? existing
          ? existing.lines.find((line) => line.itemIndex === itemIndex)?.quantity || 0
          : requested.get(keyOf(item)) || 0
        : Math.min(item.quantity, requested.get(keyOf(item)) || 0);
    if (action === 'deduct')
      requested.set(keyOf(item), Math.max(0, (requested.get(keyOf(item)) || 0) - qty));
    if (qty > 0) adjustments.push({ itemIndex, quantity: qty });
    const quantity = Math.max(0, item.quantity + (action === 'restore' ? qty : -qty));
    return {
      ...plain(item),
      quantity,
      amount: round2(quantity * (item.unitPrice || 0) * (1 + (item.taxRate || 0) / 100)),
    };
  });
  bill.subtotal = round2(
    bill.items.reduce((sum, item) => sum + item.quantity * (item.unitPrice || 0), 0),
  );
  bill.taxAmount = round2(
    bill.items.reduce(
      (sum, item) => sum + item.quantity * (item.unitPrice || 0) * ((item.taxRate || 0) / 100),
      0,
    ),
  );
  bill.totalAmount = round2(bill.subtotal + bill.taxAmount);
  bill.returnAdjustments =
    action === 'restore'
      ? [
          ...entries.filter((entry) => String(entry.vendorReturn) !== id),
          { vendorReturn: vendorReturn._id, active: false, lines: existing?.lines || adjustments },
        ]
      : [
          ...entries.filter((entry) => String(entry.vendorReturn) !== id),
          { vendorReturn: vendorReturn._id, active: true, lines: adjustments },
        ];
  if (bill.status !== 'draft' && bill.paidAmount > 0)
    bill.status = bill.paidAmount >= bill.totalAmount ? 'paid' : 'partial';
  await bill.save();
}
async function getBillReturns(bill, tenantId, deps = {}) {
  const Model = deps.VendorReturn || require('../models/VendorReturn');
  const ids = (bill.returnAdjustments || []).map((entry) => entry.vendorReturn);
  return Model.find({ tenant: tenantId, $or: [{ vendorBill: bill._id }, { _id: { $in: ids } }] })
    .sort({ createdAt: 1 })
    .lean();
}
module.exports = { adjustBillForReturn, getBillReturns };
