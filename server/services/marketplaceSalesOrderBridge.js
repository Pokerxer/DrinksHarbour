// services/marketplaceSalesOrderBridge.js
//
// When a customer checks out on the main platform, every tenant whose
// SubProducts are in the cart must see that sale in their own back office.
// This bridge creates ONE native SalesOrder per tenant per marketplace
// order — a normal draft order that appears in their Quotations & Orders
// list and flows through the standard confirm → fulfil pipeline
// (confirm reserves stock, fulfil deducts it and writes Sales rows).
//
// Pricing is FROZEN: the customer already paid the marketplace's
// authoritative price, so the pricelist and promotion engines never re-price
// these lines (`frozenPricing` → priceOverridden on every line).
//
// Idempotency is enforced twice — a pre-check findOne (fast path) and the
// unique sparse {tenant, marketplaceOrderId} index (backstop), so a retried
// checkout can never double-create. Runs inside createOrder's fire-and-forget
// block: a bridge failure must never fail an order already paid for.

const SalesOrder = require('../models/SalesOrder');
const salesOrderService = require('./salesOrder.service');

function customerNameOf(customer) {
  return (
    `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() ||
    customer?.email ||
    'Customer'
  );
}

async function bridgeMarketplaceOrder({ order, tenantId, customer }) {
  const ownItems = (order.items || []).filter(
    (i) => String(i.tenant) === String(tenantId)
  );
  if (!ownItems.length) return { ok: false, skipped: true, reason: 'no-lines' };

  // Idempotency fast path — the unique index below is the backstop.
  const existing = await SalesOrder.findOne({
    tenant: tenantId,
    marketplaceOrderId: order._id,
  })
    .select('soNumber')
    .lean();
  if (existing) return { ok: true, skipped: true, soNumber: existing.soNumber };

  // Resolve product names for the line labels (order item lines carry no
  // name snapshot).
  const productIds = [
    ...new Set(ownItems.map((i) => i.product).filter(Boolean).map(String)),
  ];
  const Product = require('../models/Product');
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select('name').lean()
    : [];
  const nameById = new Map(products.map((p) => [String(p._id), p.name]));

  // Shipping (and tax) belong to the merchant slice only when the whole
  // order is this tenant's — mirrors orderAccess.merchantSummary.
  const mixed = (order.items || []).some((i) => String(i.tenant) !== String(tenantId));
  const ownMerchandise =
    Math.round(ownItems.reduce((s, i) => s + (i.itemSubtotal || 0), 0) * 100) / 100;
  const tenantTotal = mixed
    ? ownMerchandise
    : Math.round(
        (ownMerchandise + (order.shippingFee || 0) + (order.taxAmount || 0)) * 100
      ) / 100;

  const so = await salesOrderService.createSalesOrderDoc({
    tenantId,
    frozenPricing: true,
    body: {
      docType: 'order',
      marketplaceOrderId: order._id,
      currency: order.currency || 'NGN',
      paymentMethod: order.paymentMethod || undefined,
      // Money the platform already collected shows as paid on the tenant's
      // slice; COD stays unpaid until the driver collects.
      paymentStatus: order.paymentStatus === 'paid' ? 'paid' : 'unpaid',
      amountPaid: order.paymentStatus === 'paid' ? tenantTotal : 0,
      customerSnapshot: {
        name: customerNameOf(customer),
        email: customer?.email || '',
        phone: customer?.phone || '',
      },
      deliveryAddress: order.shippingAddress
        ? {
            name: order.shippingAddress.fullName,
            phone: order.shippingAddress.phone,
            street: order.shippingAddress.addressLine1,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            country: order.shippingAddress.country,
          }
        : undefined,
      items: ownItems.map((i) => ({
        lineType: 'product',
        product: i.product,
        subproduct: i.subproduct,
        size: i.size,
        sku: i.sku || '',
        name: i.name || i.productName || nameById.get(String(i.product)) || 'Item',
        quantity: i.quantity || 1,
        unitPrice: i.priceAtPurchase || 0,
        discount: i.discountAmount || 0,
        discountType: 'fixed',
      })),
      shippingFee: mixed ? 0 : order.shippingFee || 0,
      notes: `Marketplace order ${order.orderNumber} — placed ${
        order.placedAt ? new Date(order.placedAt).toLocaleDateString('en-NG') : 'today'
      }.`,
    },
  });

  return { ok: true, skipped: false, soNumber: so.soNumber, soId: String(so._id) };
}

module.exports = { bridgeMarketplaceOrder };
