const mongoose = require('mongoose');
const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;
// Operational orders remain editable. Issued financial details live here.
const snapshotFields = ['sourceNumber', 'customer', 'customerSnapshot', 'currency', 'date',
  'dueDate', 'items', 'subtotal', 'discountTotal', 'taxTotal', 'shippingFee',
  'tipAmount', 'roundingAmount', 'total', 'invoiceAddress', 'notes', 'terms', 'snapshotHash',
  'promotionTotal', 'couponDiscount', 'pricelistCartDiscount', 'couponCode', 'loyaltyRedeemed'];
const schema = new Schema({
  tenant: { type: ObjectId, ref: 'Tenant', required: true, immutable: true },
  number: { type: String, required: true, immutable: true },
  source: { type: String, enum: ['sales', 'pos'], required: true, immutable: true },
  sourceId: { type: ObjectId, required: true, immutable: true },
  sourceNumber: String,
  customer: { type: ObjectId, ref: 'POSCustomer' },
  customerSnapshot: { name: String, email: String, phone: String, customerId: ObjectId },
  currency: { type: String, default: 'NGN' },
  date: { type: Date, required: true }, dueDate: Date,
  items: [{ _id: false, lineType: String, product: ObjectId, subproduct: ObjectId,
    size: ObjectId, sku: String, name: String, description: String, quantity: Number,
    unitPrice: Number, discount: Number, discountType: String, taxRate: Number,
    taxAmount: Number, lineTotal: Number, promoDiscount: Number, promoName: String, packSize: Number, uom: String }],
  subtotal: Number, discountTotal: Number, taxTotal: Number, shippingFee: Number,
  tipAmount: Number, roundingAmount: Number, total: { type: Number, required: true },
  promotionTotal: Number, couponDiscount: Number, pricelistCartDiscount: Number,
  couponCode: String, loyaltyRedeemed: Number,
  invoiceAddress: Schema.Types.Mixed, notes: String, terms: String,
  snapshotHash: { type: String, required: true },
  state: { type: String, enum: ['draft', 'posted', 'cancelled'], default: 'draft' },
  postedAt: Date, cancelledAt: Date,
  paymentStatus: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'unpaid' },
  amountPaid: { type: Number, default: 0 }, creditedAmount: { type: Number, default: 0 },
  outstanding: { type: Number, default: 0 },
  refundedAmount: { type: Number, default: 0 }, creditNoteAmount: { type: Number, default: 0 },
  journalEntries: [{ type: ObjectId, ref: 'JournalEntry' }],
  payments: [{ type: ObjectId, ref: 'CustomerPayment' }],
  receipts: [{ type: ObjectId, ref: 'Order' }],
  statements: [{ type: ObjectId, ref: 'CustomerAccountStatement' }],
  reconciliationIssue: { type: String, default: '' }, checkedAt: Date,
}, { timestamps: true });
schema.index({ tenant: 1, source: 1, sourceId: 1 }, { unique: true });
schema.index({ tenant: 1, number: 1 }, { unique: true });
schema.index({ tenant: 1, date: -1, _id: -1 });
schema.index({ tenant: 1, state: 1, outstanding: 1 });
schema.pre('save', async function () {
  if (this.isNew) return;
  const prior = await this.constructor.findOne({ _id: this._id, tenant: this.tenant })
    .select('state').session(this.$session()).lean();
  if (prior && prior.state !== 'draft' && snapshotFields.some(key => this.isModified(key)))
    throw new Error('Issued invoice details cannot be changed');
});
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne']) {
  schema.pre(operation, async function () {
    const update = this.getUpdate();
    const keys = Object.entries(update || {}).flatMap(([operator, fields]) => operator.startsWith('$')
      ? operator === '$setOnInsert' ? [] : Object.keys(fields || {}) : [operator]);
    if (operation === 'replaceOne' || Array.isArray(update) || keys.some(key => snapshotFields.some(field => key === field || key.startsWith(`${field}.`)))) {
      const existing = await this.model.findOne({ ...this.getFilter(), state: { $ne: 'draft' } })
        .session(this.getOptions().session || null).lean();
      if (existing) throw new Error('Issued invoice details cannot be changed');
    }
  });
}
module.exports = mongoose.models.CustomerInvoice || mongoose.model('CustomerInvoice', schema);
