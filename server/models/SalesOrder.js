// models/SalesOrder.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const lineSchema = new Schema({
  // Line discriminator: 'product' (priced line, the default), 'section' (a
  // titled header that groups subsequent lines), or 'note' (a standalone
  // free-text note). Section/note lines carry no product/qty/price and are
  // excluded from order totals. Defaults to 'product' so pre-existing docs are
  // unaffected.
  lineType: { type: String, enum: ['product', 'section', 'note'], default: 'product' },
  product:    { type: ObjectId, ref: 'Product' },
  subproduct: { type: ObjectId, ref: 'SubProduct' },
  size:       { type: ObjectId, ref: 'Size' },
  sku:        { type: String, trim: true },
  name:       { type: String, trim: true },                       // product name, or section title
  description: { type: String, trim: true, maxlength: 1000 }, // operator-entered per-line note shown on the order/invoice
  // required only for product lines — section/note lines have no qty/price.
  quantity:    { type: Number, required: function() { return this.lineType === 'product'; }, min: 0, default: 0 },
  // Units per pack (Size.unitsPerPack snapshot). Quantity stays in sellable
  // units; packSize only drives the "N packs & M bottles" breakdown shown on
  // the order. Default 1 = loose units, so legacy lines are unaffected.
  packSize:    { type: Number, min: 1, default: 1 },
  uom:         { type: String, trim: true },                    // packaging noun for the pack label ('Cases', 'Cartons'…)
  unitPrice:   { type: Number, required: function() { return this.lineType === 'product'; }, min: 0, default: 0 }, // snapshot at line creation
  discount:    { type: Number, default: 0, min: 0 }, // raw operator input; meaning set by discountType
  discountType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' }, // fixed = flat ₦ off the whole line; percentage = % of each unit
  taxRate:     { type: Number, default: 0, min: 0, max: 100 }, // % snapshot from SubProduct.taxRate, editable
  promoDiscount: { type: Number, default: 0, min: 0 },         // ₦ off this line from an auto-applied promotion
  promoName:     { type: String, trim: true },                 // snapshot of the applied promotion's name
  taxAmount:   { type: Number, default: 0, min: 0 },           // tax on this line (post-promo untaxed base * taxRate/100)
  lineTotal:   { type: Number, required: function() { return this.lineType === 'product'; }, min: 0, default: 0 }, // UNTAXED: (unitPrice * quantity) - line discount
  fulfilledQty: { type: Number, default: 0, min: 0 },
  postedQty:    { type: Number, default: 0, min: 0 },
  returnedQty:  { type: Number, default: 0, min: 0 },
  priceOverridden: { type: Boolean, default: false }, // true = operator typed a manual unitPrice; server pricing skips this line
});

// Reusable structured address (billing/shipping). All optional — walk-ins and
// existing orders carry none. No _id so it stays a plain embedded value.
const addressSchema = new Schema({
  name:    { type: String, trim: true },
  phone:   { type: String, trim: true },
  street:  { type: String, trim: true },
  city:    { type: String, trim: true },
  state:   { type: String, trim: true },
  country: { type: String, trim: true },
}, { _id: false });

const fulfillmentSchema = new Schema({
  warehouseId: { type: ObjectId, ref: 'Warehouse' },
  items: [{
    lineId:      { type: String },
    qty:         { type: Number },
    batchNumber: { type: String },
    expiryDate:  { type: Date },
  }],
  // Idempotency key for POS reconciliation: the receipt number of the sale that
  // produced this entry. The offline queue replays an entry whose response was
  // lost, and without this the server cannot tell a replay from a genuine
  // second sale of the same product.
  ref:    { type: String, trim: true },
  status: { type: String, default: 'posted' },
  at:     { type: Date, default: Date.now },
  // Who fulfilled it. `ref` matters: without it this cannot be populated into a
  // name, which is why nothing ever rendered it. req.posUser and req.user are
  // both User documents (pos.middleware.js).
  by:     { type: ObjectId, ref: 'User' },
  // The tender THIS fulfilment took. The order-level paymentMethod is
  // overwritten by each sale, so a cash-then-transfer partial order otherwise
  // claims it was all transfer.
  paymentMethod: { type: String, trim: true },
}, { _id: true });

const SalesOrderSchema = new Schema(
  {
    tenant:   { type: ObjectId, ref: 'Tenant', required: true, index: true },
    soNumber: { type: String, required: true, trim: true },
    docType:  { type: String, enum: ['quotation', 'order'], required: true },

    customer: { type: ObjectId, ref: 'POSCustomer', sparse: true },
    customerSnapshot: {
      name: String, phone: String, email: String,
      customerId: { type: ObjectId, ref: 'POSCustomer' },
    },
    salesperson: { type: String, trim: true },
    pricelist: { type: ObjectId, ref: 'Pricelist', default: null },
    appliedPricelist: { pricelistId: { type: ObjectId, ref: 'Pricelist' }, pricelistName: String },
    currency: { type: String, default: 'NGN', enum: ['NGN', 'USD', 'EUR', 'GBP'] },

    items: [lineSchema],
    subtotal:      { type: Number, default: 0 }, // gross: sum(unitPrice * qty), pre-discount
    discountTotal: { type: Number, default: 0 }, // sum(per-line discount off the whole line)
    promotionTotal:{ type: Number, default: 0 }, // sum(line promoDiscount) from auto-applied promotions
    taxTotal:      { type: Number, default: 0 }, // sum(line taxAmount); untaxed = subtotal - discountTotal - promotionTotal
    total:         { type: Number, default: 0 }, // grand total: max(0, untaxed + tax - couponDiscount - pricelistCartDiscount) + shippingFee

    // Footer adjustments (Odoo-style quotation footer)
    shippingFee:    { type: Number, default: 0, min: 0 }, // flat delivery charge added to the total
    // Cart-level spend-threshold discount from the order's pricelist
    // (cart_threshold rules) — recomputed whenever lines/pricelist change.
    pricelistCartDiscount: { type: Number, default: 0, min: 0 },
    couponCode:     { type: String, default: '' },        // applied Promotion code (uppercased)
    couponName:     { type: String, default: '' },        // snapshot of the promotion's name
    couponDiscount: { type: Number, default: 0, min: 0 }, // ₦ off the untaxed+tax total (snapshot at apply time)
    // Loyalty points the operator plans to redeem — actual redemption still
    // happens at confirm via capturePayment (this only pre-fills the modal).
    plannedRedeemPoints: { type: Number, default: 0, min: 0 },

    // Quotation lifecycle (only when docType === 'quotation')
    quoteStatus: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'],
      default: undefined,
    },
    validUntil: { type: Date },

    // Order lifecycle (only when docType === 'order')
    orderStatus: {
      type: String,
      enum: ['draft', 'confirmed', 'partially_fulfilled', 'fulfilled', 'cancelled'],
      default: undefined,
    },

    // Payment — captured once at confirm for the full total, or accrued across
    // POS sales when an order is fulfilled a few units at a time ('partial').
    paymentMethod: { type: String },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    amountPaid:    { type: Number, default: 0 },
    walletTxRef:   { type: ObjectId, ref: 'WalletTransaction', sparse: true },
    loyaltyEarned: { type: Number, default: 0 },
    loyaltyRedeemed: { type: Number, default: 0 }, // ₦ value redeemed via loyalty points at confirm
    pointsRedeemed:  { type: Number, default: 0 }, // points consumed by that redemption

    fulfillments: [fulfillmentSchema],
    // Default source warehouse for this order — used as fulfill fallback
    warehouseId: { type: ObjectId, ref: 'Warehouse', default: null },

    convertedFrom:  { type: ObjectId, ref: 'SalesOrder' },
    convertedTo:    { type: ObjectId, ref: 'SalesOrder' },
    relatedInvoice: { type: ObjectId, sparse: true },
    relatedSales:   [{ type: ObjectId, ref: 'Sales' }],

    // Payment terms (Odoo-style): named term + its resolved due date
    paymentTerms: {
      type: String,
      enum: ['immediate', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'end_of_month'],
      default: 'immediate',
    },
    dueDate: { type: Date },

    // Billing + shipping addresses (snapshots; optional)
    invoiceAddress:  addressSchema,
    deliveryAddress: addressSchema,

    notes: { type: String, maxlength: 2000 },
    terms: { type: String, maxlength: 2000 },
  },
  { timestamps: true }
);

SalesOrderSchema.index({ tenant: 1, docType: 1, quoteStatus: 1 });
SalesOrderSchema.index({ tenant: 1, orderStatus: 1 });
SalesOrderSchema.index({ tenant: 1, createdAt: -1 });
SalesOrderSchema.index({ tenant: 1, soNumber: 1 }, { unique: true });

module.exports = mongoose.models.SalesOrder || mongoose.model('SalesOrder', SalesOrderSchema);
