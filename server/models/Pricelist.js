// models/Pricelist.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const priceRuleSchema = new Schema({
  subProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct', required: false },
  appliedOn:  { type: String, default: '' }, // display label

  priceType: {
    type: String,
    enum: ['fixed', 'formula', 'discount', 'flash_sale', 'bundle'],
    default: 'fixed',
  },

  // ── fixed ─────────────────────────────────────────────────────────────────
  // Sets baseSellingPrice directly; clears any active sale discount.
  fixedPrice: { type: Number, min: 0, default: 0 },

  // ── formula ───────────────────────────────────────────────────────────────
  // baseSellingPrice = costPrice * (1 + markupPercentage / 100)
  markupPercentage: { type: Number, min: 0, default: 0 },

  // ── discount ──────────────────────────────────────────────────────────────
  // Sets saleDiscountValue + saleType on SubProduct (regular always-on discount).
  discountType:       { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  discountPercentage: { type: Number, min: 0, max: 100, default: 0 }, // used when discountType='percentage'
  discountAmount:     { type: Number, min: 0, default: 0 },           // used when discountType='fixed'

  // ── flash_sale ────────────────────────────────────────────────────────────
  // Sets flashSale.isActive + discountPercentage + optional date window + qty cap.
  // Priority: pricing engine checks flash sale BEFORE regular discount.
  flashSalePercentage: { type: Number, min: 0, max: 100, default: 0 },
  flashSaleQty:        { type: Number, min: 0, default: 0 }, // 0 = unlimited

  // ── bundle ────────────────────────────────────────────────────────────────
  // Adds a bundleDeal entry: buy N → get discountType/discount off.
  bundleName:         { type: String, default: '' },
  bundleQuantity:     { type: Number, min: 2, default: 2 },
  bundleDiscount:     { type: Number, min: 0, default: 10 },
  bundleDiscountType: { type: String, enum: ['percentage', 'fixed', 'markup_on_cost', 'no_discount'], default: 'percentage' },
  // Cross-product bundle target: when set, the bundle is "buy N of subProduct
  // (trigger), get discount on bundleTargetSubProduct (target)". Null = same-
  // product bundle (existing behavior).
  bundleTargetSubProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct', required: false },

  // ── shared ────────────────────────────────────────────────────────────────
  minQuantity: { type: Number, default: 0, min: 0 },
  startDate:   { type: Date },
  endDate:     { type: Date },
  sequence:     { type: Number, default: 0, min: 0 },
  ruleCategory: {
    type: String,
    enum: ['permanent', 'dynamic'],
    default: function() {
      return ['fixed', 'formula'].includes(this.priceType) ? 'permanent' : 'dynamic';
    },
  },
}, { _id: true });

const pricelistSchema = new Schema({
  name:          { type: String, required: true, trim: true },
  currency:      { type: String, default: 'NGN' },
  countryGroups: [{ type: String }],
  website:       { type: String, default: '' },
  isSelectable:  { type: Boolean, default: false },
  tenant:        { type: Schema.Types.ObjectId, ref: 'Tenant', required: false },

  // ── Resolution bindings (POS shop/warehouse → pricelist) ───────────────────
  // `shops` holds string ids: custom posSettings.shops subdoc ids AND the
  // built-in virtual shop ids 'retail' / 'wholesale'. Empty shops+warehouses
  // with isSelectable=true means "unscoped" — offered everywhere as a manual
  // option but never auto-resolved.
  shops:         [{ type: String }],
  warehouses:    [{ type: Schema.Types.ObjectId, ref: 'Warehouse' }],
  // Customer-group targeting: when non-empty, this pricelist only resolves for
  // customers whose POSCustomer.tags intersect. Empty = unscoped (all customers).
  customerTags:  [{ type: String }],
  isDefault:     { type: Boolean, default: false },

  rules:         [priceRuleSchema],
}, { timestamps: true });

pricelistSchema.index({ tenant: 1, name: 1 });
pricelistSchema.index({ tenant: 1, isDefault: 1 });

module.exports = mongoose.model('Pricelist', pricelistSchema);
