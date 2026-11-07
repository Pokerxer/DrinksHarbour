const { createHash } = require('node:crypto');
const { round2 } = require('../accounting.helpers');
const id = value => value?._id || value || undefined;
function eligible(source, doc) {
  if (source === 'pos' && doc.venueIdentityVersion === 1 && doc.venueBillForSession) return doc.venueSettlementState === 'settled' && doc.paymentStatus === 'paid' && doc.status === 'delivered';
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
    size: id(item.size), sku: item.sku, name: item.name || item.product?.name || doc.venueBillSnapshot?.acceptedLines?.find(line => String(line.subproduct) === String(id(item.subproduct)) && String(line.size) === String(id(item.size)))?.name || item.sku || 'Product',
    description: item.description, quantity: Number(item.quantity) || 0,
    unitPrice: Number(sales ? item.unitPrice : item.priceAtPurchase) || 0,
    discount: Number(sales ? item.discount : item.discountAmount) || 0,
    discountType: sales ? item.discountType || 'fixed' : 'amount',
    taxRate: Number(item.taxRate) || 0, taxAmount: Number(item.taxAmount) || 0,
    lineTotal: Number(sales ? item.lineTotal : item.itemSubtotal) || 0,
    promoDiscount: Number(item.promoDiscount) || 0, promoName: item.promoName,
    packSize: item.packSize || 1, uom: item.uom,
  }));
  const financial = source === 'pos' && doc.venueIdentityVersion === 1 && doc.venueBillForSession ? doc.venueBillSnapshot?.financialLines || [] : [];
  for (const line of financial) items.push({lineType:'financial_adjustment',product:undefined,subproduct:undefined,size:undefined,sku:undefined,name:line.description,description:line.description,quantity:1,unitPrice:line.amountMinor/100,discount:0,discountType:'amount',taxRate:0,taxAmount:line.taxMinor/100,lineTotal:line.amountMinor/100,promoDiscount:0,promoName:undefined,packSize:1,uom:undefined});
  const result = {
    sourceNumber: sales ? doc.soNumber : doc.receiptNumber || doc.orderNumber,
    customer: id(sales ? doc.customer || customer.customerId : customer.customerId),
    customerSnapshot: { name: sales ? customer.name || 'Walk-in customer'
      : `${customer.firstName || 'Walk-in'} ${customer.lastName || 'customer'}`.trim(),
      phone: customer.phone, email: customer.email, customerId: id(customer.customerId) },
    currency: doc.currency || 'NGN', date: doc.invoiceIssuedAt || doc.placedAt || doc.createdAt,
    dueDate: doc.dueDate, items, subtotal: round2(Number(doc.subtotal || 0) + financial.reduce((n,line)=>n+line.amountMinor/100,0)),
    discountTotal: round2(doc.discountTotal), taxTotal: round2(sales ? doc.taxTotal : doc.taxAmount),
    shippingFee: round2(doc.shippingFee), tipAmount: round2(doc.tipAmount),
    roundingAmount: round2(doc.roundingAmount), total: round2(sales ? doc.total : doc.totalAmount),
    invoiceAddress: doc.invoiceAddress, notes: doc.notes, terms: doc.terms,
    // Channel label: an online sale iff the source SO was bridged from a
    // marketplace checkout (POS receipts are always store sales).
    salesChannel: sales && doc.marketplaceOrderId ? 'online' : 'store',
    promotionTotal: round2(doc.promotionTotal), couponDiscount: round2(doc.couponDiscount),
    pricelistCartDiscount: round2(doc.pricelistCartDiscount), couponCode: doc.couponCode || '',
    loyaltyRedeemed: round2(doc.loyaltyRedeemed),
  };
  result.snapshotHash = createHash('sha256').update(JSON.stringify(result)).digest('hex');
  return result;
}
module.exports = { eligible, snapshot };
