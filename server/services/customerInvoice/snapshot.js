const { createHash } = require('node:crypto');
const { round2 } = require('../accounting.helpers');
const id = value => value?._id || value || undefined;
function eligible(source, doc) {
  return source === 'sales'
    ? !!doc.invoiceIssuedAt || doc.docType === 'order' &&
      (doc.orderStatus === 'fulfilled' || doc.paymentStatus === 'paid')
    : doc.source === 'pos' && !doc.tableServiceBooking && doc.status !== 'hold' &&
      (['paid', 'partially_refunded', 'refunded'].includes(doc.paymentStatus) || doc.status === 'delivered');
}
function snapshot(source, doc) {
  const sales = source === 'sales';
  const customer = sales ? doc.customerSnapshot || {} : doc.paymentDetails?.customer || {};
  const items = (doc.items || []).map(item => ({
    lineType: item.lineType || 'product', product: id(item.product), subproduct: id(item.subproduct),
    size: id(item.size), sku: item.sku, name: item.name || item.product?.name || item.sku || 'Product',
    description: item.description, quantity: Number(item.quantity) || 0,
    unitPrice: Number(sales ? item.unitPrice : item.priceAtPurchase) || 0,
    discount: Number(sales ? item.discount : item.discountAmount) || 0,
    discountType: sales ? item.discountType || 'fixed' : 'amount',
    taxRate: Number(item.taxRate) || 0, taxAmount: Number(item.taxAmount) || 0,
    lineTotal: Number(sales ? item.lineTotal : item.itemSubtotal) || 0,
    promoDiscount: Number(item.promoDiscount) || 0, promoName: item.promoName,
    packSize: item.packSize || 1, uom: item.uom,
  }));
  const result = {
    sourceNumber: sales ? doc.soNumber : doc.receiptNumber || doc.orderNumber,
    customer: id(sales ? doc.customer || customer.customerId : customer.customerId),
    customerSnapshot: { name: sales ? customer.name || 'Walk-in customer'
      : `${customer.firstName || 'Walk-in'} ${customer.lastName || 'customer'}`.trim(),
      phone: customer.phone, email: customer.email, customerId: id(customer.customerId) },
    currency: doc.currency || 'NGN', date: doc.invoiceIssuedAt || doc.placedAt || doc.createdAt,
    dueDate: doc.dueDate, items, subtotal: round2(doc.subtotal),
    discountTotal: round2(doc.discountTotal), taxTotal: round2(sales ? doc.taxTotal : doc.taxAmount),
    shippingFee: round2(doc.shippingFee), tipAmount: round2(doc.tipAmount),
    roundingAmount: round2(doc.roundingAmount), total: round2(sales ? doc.total : doc.totalAmount),
    invoiceAddress: doc.invoiceAddress, notes: doc.notes, terms: doc.terms,
    promotionTotal: round2(doc.promotionTotal), couponDiscount: round2(doc.couponDiscount),
    pricelistCartDiscount: round2(doc.pricelistCartDiscount), couponCode: doc.couponCode || '',
    loyaltyRedeemed: round2(doc.loyaltyRedeemed),
  };
  result.snapshotHash = createHash('sha256').update(JSON.stringify(result)).digest('hex');
  return result;
}
module.exports = { eligible, snapshot };
