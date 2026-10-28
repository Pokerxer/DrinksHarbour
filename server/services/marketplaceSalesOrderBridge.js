// services/marketplaceSalesOrderBridge.js
//
// When a customer checks out on the main platform, every tenant whose
// SubProducts are in the cart must see that sale in their own back office.
// This bridge creates ONE native SalesOrder per tenant per marketplace
// order — a normal draft order that appears in their Quotations & Orders
// list and flows through the standard confirm → fulfil pipeline
// (confirm reserves stock, fulfil deducts it and writes Sales rows).
//
// PRICING: the SalesOrder records the tenant's WHOLESALE leg — the price
// the tenant sold the goods to the platform for (the per-line
// `tenantRevenueShare` payout), NOT the customer retail price. The platform
// owns the retail spread (its commission/markup) and the customer's
// shipping fee.
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

  // Shipping (and tax) belong to the platform's customer leg, never to the
  // tenant's sale. The tenant's slice is purely their PAYOUT: what they sold
  // it to the platform for (per-LINE tenantRevenueShare — markup model:
  // cost×qty; commission model: their share of the merchandise subtotal).
  const tenantTotal =
    Math.round(ownItems.reduce((s, i) => s + (i.tenantRevenueShare || 0), 0) * 100) / 100;

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
      items: ownItems.map((i) => {
        // The SO records the WHOLESALE leg: unit price = the tenant's
        // per-unit payout (tenantRevenueShare is the per-LINE total).
        const qty = i.quantity || 1;
        const share = i.tenantRevenueShare ?? 0;
        const unitPayout = qty > 0 ? Math.round((share / qty) * 100) / 100 : 0;
        return {
          lineType: 'product',
          product: i.product,
          subproduct: i.subproduct,
          size: i.size,
          sku: i.sku || '',
          name: i.name || i.productName || nameById.get(String(i.product)) || 'Item',
          quantity: qty,
          unitPrice: unitPayout,
          discount: 0,
          discountType: 'fixed',
        };
      }),
      shippingFee: 0,
      notes: `Marketplace order ${order.orderNumber} — placed ${
        order.placedAt ? new Date(order.placedAt).toLocaleDateString('en-NG') : 'today'
      }. Priced at the tenant's payout to the platform.`,
    },
  });

  return { ok: true, skipped: false, soNumber: so.soNumber, soId: String(so._id) };
}

module.exports = { bridgeMarketplaceOrder };
