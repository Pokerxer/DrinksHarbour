// models/SalesOrder.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const lineSchema = new Schema({
  product:    { type: ObjectId, ref: 'Product' },
  subproduct: { type: ObjectId, ref: 'SubProduct' },
  size:       { type: ObjectId, ref: 'Size' },
  sku:        { type: String, trim: true },
  name:       { type: String, trim: true },
  quantity:    { type: Number, required: true, min: 1 },
  unitPrice:   { type: Number, required: true, min: 0 }, // snapshot at line creation
  discount:    { type: Number, default: 0, min: 0 },
  taxRate:     { type: Number, default: 0, min: 0, max: 100 }, // % snapshot from SubProduct.taxRate, editable
  taxAmount:   { type: Number, default: 0, min: 0 },           // tax on this line (untaxed lineTotal * taxRate/100)
  lineTotal:   { type: Number, required: true, min: 0 },       // UNTAXED: (unitPrice - discount) * quantity
  fulfilledQty: { type: Number, default: 0, min: 0 },
  postedQty:    { type: Number, default: 0, min: 0 },
  returnedQty:  { type: Number, default: 0, min: 0 },
});

const fulfillmentSchema = new Schema({
  warehouseId: { type: ObjectId, ref: 'Warehouse' },
  items: [{
    lineId:      { type: String },
    qty:         { type: Number },
    batchNumber: { type: String },
    expiryDate:  { type: Date },
  }],
  status: { type: String, default: 'posted' },
  at:     { type: Date, default: Date.now },
  by:     { type: ObjectId },
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
    pricelist: { type: ObjectId, ref: 'Pricelist', default: null },
    appliedPricelist: { pricelistId: { type: ObjectId, ref: 'Pricelist' }, pricelistName: String },
    currency: { type: String, default: 'NGN', enum: ['NGN', 'USD', 'EUR', 'GBP'] },

    items: [lineSchema],
    subtotal:      { type: Number, default: 0 }, // gross: sum(unitPrice * qty), pre-discount
    discountTotal: { type: Number, default: 0 }, // sum(discount * qty)
    taxTotal:      { type: Number, default: 0 }, // sum(line taxAmount); untaxed = subtotal - discountTotal
    total:         { type: Number, default: 0 }, // grand total: (subtotal - discountTotal) + taxTotal

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

    // Payment — captured once at confirm, full total
    paymentMethod: { type: String },
    paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    amountPaid:    { type: Number, default: 0 },
    walletTxRef:   { type: ObjectId, ref: 'WalletTransaction', sparse: true },
    loyaltyEarned: { type: Number, default: 0 },

    fulfillments: [fulfillmentSchema],

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
