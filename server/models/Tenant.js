// models/Tenant.js
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ObjectId } = Schema;

const tenantSchema = new Schema(
  {
    // ────────────────────────────────────────────────
    // Identity & Branding
    // ────────────────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      index: true,
    },

    // Subdomain = slug.drinksharbour.com
    // (enforced via nginx/vercel routing + DNS wildcard)

    logo: {
      url: String,
      publicId: String, // Cloudinary public_id
      alt: String,
    },

    primaryColor: {
      type: String,
      default: "#1a202c", // fallback dark slate
      match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    },

    // ────────────────────────────────────────────────
    // Subscription & Billing
    // ────────────────────────────────────────────────
    plan: {
      type: String,
      enum: ["free_trial", "starter", "pro", "enterprise", "custom"],
      default: "free_trial",
    },

    subscriptionStatus: {
      type: String,
      enum: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "incomplete_expired",
      ],
      default: "trialing",
      index: true,
    },

    stripeCustomerId: {
      type: String,
      sparse: true,
    },

    stripeSubscriptionId: {
      type: String,
      sparse: true,
    },

    trialEndsAt: Date,

    currentPeriodStart: Date,
    currentPeriodEnd: Date,

    // ────────────────────────────────────────────────
    // Revenue / Commission Model (core to DrinksHarbour)
    // ────────────────────────────────────────────────
    revenueModel: {
      type: String,
      enum: ["markup", "commission"],
      default: "markup",
      required: true,
    },

    markupPercentage: {
      type: Number,
      min: 0,
      max: 500, // extreme cases allowed
      default: 40,
    },

    commissionPercentage: {
      type: Number,
      min: 0,
      max: 50,
      default: 12,
    },

    // Platform markup percentage (applied to all tenants)
    platformMarkupPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 15,
    },

    // Optional override – some tenants might have hybrid or custom logic
    customPricingNote: String,

    // ────────────────────────────────────────────────
    // Operational & Regional Defaults
    // ────────────────────────────────────────────────
    defaultCurrency: {
      type: String,
      enum: ["NGN", "USD", "EUR", "GBP"],
      default: "NGN",
    },

    supportedCurrencies: [
      {
        type: String,
        enum: ["NGN", "USD", "EUR", "GBP"],
      },
    ],

    country: {
      type: String,
      default: "Nigeria",
    },

    // ────────────────────────────────────────────────
    // Physical / Pickup Address
    // ────────────────────────────────────────────────
    address: {
      street:    { type: String, trim: true },
      city:      { type: String, trim: true },
      lga:       { type: String, trim: true },   // Local Government Area
      state:     { type: String, trim: true },   // raw input e.g. "Lagos", "FCT - Abuja"
      zipCode:   { type: String, trim: true },
      country:   { type: String, default: "Nigeria" },
      formatted: { type: String },               // full address string (set by geocoder)
    },

    // Canonical state name — normalised for shipping zone lookups
    // Populated automatically from address.state via pre-save hook
    normalizedState: {
      type: String,
      trim: true,
      index: true,
    },

    // GPS coordinates — auto-populated when address is saved
    location: {
      lat:         { type: Number, default: null },
      lon:         { type: Number, default: null },
      geocodedAt:  { type: Date,   default: null },
      source:      { type: String, enum: ['google', 'manual'], default: null },
    },

    enforceAgeVerification: {
      type: Boolean,
      default: true, // most tenants sell alcohol
    },

    // ────────────────────────────────────────────────
    // Status & Onboarding Workflow
    // ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended", "archived"],
      default: "pending",
      index: true,
    },

    isSystemTenant: {
      type: Boolean,
      default: false,
      index: true,
    },

    approvedAt: Date,
    approvedBy: { type: ObjectId, ref: "User" }, // super-admin

    rejectionReason: String,

    onboardedAt: Date,

    // ────────────────────────────────────────────────
    // Soft stats (updated via background jobs / aggregation)
    // ────────────────────────────────────────────────
    productCount: {
      type: Number,
      default: 0,
    },

    activeSubProductCount: {
      type: Number,
      default: 0,
    },

    totalOrders: {
      type: Number,
      default: 0,
    },

    totalRevenue: {
      type: Number,
      default: 0,
    },

    // ────────────────────────────────────────────────
    // Admin / Support
    // ────────────────────────────────────────────────
    notes: String, // internal admin notes

    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    contactPhone: String,

    // ────────────────────────────────────────────────
    // Bank / Payment Accounts (shown on POS invoices)
    // ────────────────────────────────────────────────
    bankAccounts: [
      {
        bankName:      { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        accountName:   { type: String, trim: true },
      },
    ],

    // ────────────────────────────────────────────────
    // Purchase Settings
    // ────────────────────────────────────────────────
    purchaseSettings: {
      // When false, POs skip the approval step and can be confirmed directly
      requirePOApproval: { type: Boolean, default: true },
      // Require approval only when PO total >= threshold (0 = all POs)
      approvalThreshold: { type: Number, min: 0, default: 0 },
      // Auto-lock POs against edits once confirmed
      lockConfirmedOrders: { type: Boolean, default: false },
      // Default bill control policy for new POs (overridable per bill)
      defaultBillControlPolicy: {
        type: String,
        enum: ['ordered', 'received'],
        default: 'received',
      },
      // Enable 3-way matching on vendor bills
      enable3WayMatching: { type: Boolean, default: true },
      // Auto-generate a draft vendor bill when a PO is validated
      autoGenerateBill: { type: Boolean, default: false },
      // Allow receiving less than the ordered quantity
      allowPartialReceipts: { type: Boolean, default: true },
      // Default quotation validity window; 0 disables the default
      rfqValidityDays: { type: Number, min: 0, max: 365, default: 30 },
      defaultCurrency: {
        type: String,
        enum: ['NGN', 'USD', 'EUR', 'GBP'],
        default: 'NGN',
      },
      defaultLeadTimeDays: { type: Number, min: 0, max: 365, default: 7 },
      defaultPaymentTerms: { type: String, default: 'Net 30' },
      defaultReceivingLocation: { type: String, default: '' },
    },

    // ────────────────────────────────────────────────
    // POS Settings
    // ────────────────────────────────────────────────
    posSettings: {
      // Allow adding out-of-stock products to cart and processing the order
      allowOverselling: { type: Boolean, default: false },

      // ── Restaurant mode ───────────────────────────────────────────────────────
      isBarRestaurant: { type: Boolean, default: false },

      // ── Payment options ───────────────────────────────────────────────────────
      autoValidateOrder:   { type: Boolean, default: false },
      cashRounding:        { type: Boolean, default: false },
      maxDifferenceEnabled:{ type: Boolean, default: false },
      tipsEnabled:         { type: Boolean, default: false },

      // ── POS interface options ─────────────────────────────────────────────────
      loginWithEmployees: { type: Boolean, default: false },
      largeScrollbars:    { type: Boolean, default: false },
      shareOpenOrders:    { type: Boolean, default: false },
      hidePictures:       { type: Boolean, default: false },
      showProductImages:  { type: Boolean, default: true  },
      showCategoryImages: { type: Boolean, default: true  },

      // ── Product & POS categories ──────────────────────────────────────────────
      restrictCategories:  { type: Boolean, default: false },
      showMarginsAndCosts: { type: Boolean, default: false },
      sortCartByCategory:  { type: Boolean, default: false },

      // ── Pricing ───────────────────────────────────────────────────────────────
      flexiblePricelists:  { type: Boolean, default: false },
      priceControl:        { type: Boolean, default: false },
      productPriceDisplay: { type: String, enum: ['tax_excluded', 'tax_included'], default: 'tax_included' },
      lineDiscounts:       { type: Boolean, default: true  },
      globalDiscounts:     { type: Boolean, default: false },
      promotionsEnabled:   { type: Boolean, default: true  },

      // ── Sales controls ────────────────────────────────────────────────────────
      maxDiscountPct: { type: Number, default: 100, min: 0, max: 100 },

      // ── Session controls ──────────────────────────────────────────────────────
      requireOpeningCash: { type: Boolean, default: false },

      // ── Payment methods ───────────────────────────────────────────────────────
      enabledPaymentMethods: {
        type: [{ type: String, enum: ['cash', 'card', 'bank_transfer', 'mobile_money'] }],
        default: ['cash', 'card', 'bank_transfer', 'mobile_money'],
      },

      // ── Receipt ───────────────────────────────────────────────────────────────
      receiptHeader:          { type: String, default: '', trim: true, maxlength: 200 },
      receiptFooter:          { type: String, default: '', trim: true, maxlength: 200 },
      showTaxOnReceipt:       { type: Boolean, default: false },
      taxRate:                { type: Number,  default: 7.5, min: 0, max: 100 },
      autoPrintReceipt:       { type: Boolean, default: false },
      receiptCopies:          { type: Number,  default: 1, min: 1, max: 5 },
      smsReceiptEnabled:      { type: Boolean, default: false },
      selfServiceInvoicing:   { type: Boolean, default: false },
      basicReceipt:           { type: Boolean, default: false },
      whatsappReceiptEnabled: { type: Boolean, default: false },

      // ── Payment terminals ─────────────────────────────────────────────────────
      enabledPaymentTerminals: {
        type: [{ type: String, enum: ['adyen','stripe','six','viva_wallet','paytm','razorpay','mercado_pago'] }],
        default: [],
      },

      // ── Connected devices ─────────────────────────────────────────────────────
      eposPrinter:     { type: Boolean, default: false },
      customerDisplay: { type: Boolean, default: false },
      iotBox:          { type: Boolean, default: false },

      // ── Preparation ───────────────────────────────────────────────────────────
      preparationPrinters: { type: Boolean, default: false },
      preparationDisplay:  { type: Boolean, default: false },
      internalNotes:       { type: Boolean, default: false },

      // ── Inventory ─────────────────────────────────────────────────────────────
      allowShipLater: { type: Boolean, default: false },
      barcodes:       { type: Boolean, default: false },

      // ── Customers ─────────────────────────────────────────────────────────────
      requireCustomer:              { type: Boolean, default: false },
      showLoyaltyBalanceAtCheckout: { type: Boolean, default: true  },
      customerPhoneSearch:          { type: Boolean, default: true  },

      // ── Order management ──────────────────────────────────────────────────────
      allowOrderNotes:     { type: Boolean, default: true  },
      holdOrders:          { type: Boolean, default: false },
      splitPayments:       { type: Boolean, default: false },
      minimumOrderAmount:  { type: Number,  default: 0     },

      // ── Refunds & returns ─────────────────────────────────────────────────────
      allowRefunds:                  { type: Boolean, default: true  },
      refundWindowDays:              { type: Number,  default: 30    },
      requireManagerApprovalForRefund: { type: Boolean, default: false },
      defaultRestockOnRefund:        { type: Boolean, default: true  },

      // ── Security ──────────────────────────────────────────────────────────────
      sessionTimeoutMins:          { type: Number,  default: 0     },
      requirePINOnUnlock:          { type: Boolean, default: true  },
      requireManagerPINForDiscount:{ type: Boolean, default: false },

      // ── Currency & number format ───────────────────────────────────────────────
      currencySymbol:   { type: String, default: '₦'      },
      currencyPosition: { type: String, enum: ['before', 'after'], default: 'before' },
      decimalPlaces:    { type: Number, default: 2         },

      // ── Receipt extras ────────────────────────────────────────────────────────
      showCashierName:     { type: Boolean, default: true  },
      showOrderNumber:     { type: Boolean, default: true  },
      receiptNumberPrefix: { type: String,  default: ''    },

      // ── Loyalty programme ─────────────────────────────────────────────────────
      loyaltyEnabled:           { type: Boolean, default: false },
      loyaltyPointsPerNaira:    { type: Number,  default: 0.01  }, // 1pt per ₦100
      loyaltyPointsValue:       { type: Number,  default: 1     }, // 1pt = ₦1
      loyaltyMaxRedemptionPct:  { type: Number,  default: 50    }, // cap 50% of item

      // ── POS Shops (named terminals beyond the built-in retail/wholesale) ────────
      shops: [{
        name:        { type: String, required: true, trim: true },
        mode:        { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
        color:       { type: String, default: '#b20202' },
        description: { type: String, default: '' },
        active:      { type: Boolean, default: true },
        createdAt:   { type: Date, default: Date.now },
      }],

      // ── Quick discount programs ────────────────────────────────────────────────
      discountPrograms: [{
        name:          { type: String, required: true, trim: true },
        description:   { type: String, default: '' },
        type:          { type: String, enum: ['pct', 'fixed'], default: 'pct' },
        value:         { type: Number, required: true, min: 0 },
        active:        { type: Boolean, default: true },
        color:         { type: String, default: '' },
        minOrderValue: { type: Number, default: 0, min: 0 },
      }],

      // ── Shared sub-schemas ────────────────────────────────────────────────────
      // availability and reward are reused across coupons/codes/promotions/bxgy

      // ── Coupons ───────────────────────────────────────────────────────────────
      coupons: [{
        code:            { type: String, required: true, trim: true, uppercase: true },
        name:            { type: String, required: true, trim: true },
        description:     { type: String, default: '' },
        pricelistIds:        [{ type: ObjectId, ref: 'Pricelist' }],
        applyTo: { products: [{ type: ObjectId, ref: 'Product' }], categories: [{ type: ObjectId, ref: 'Category' }], brands: [{ type: ObjectId, ref: 'Brand' }] },
        availableOn:     { pos: { type: Boolean, default: true }, sales: { type: Boolean, default: false }, website: { type: Boolean, default: false } },
        rules:           { minQty: { type: Number, default: 0 }, minOrderValue: { type: Number, default: 0 } },
        reward:          { discountType: { type: String, enum: ['pct','fixed'], default: 'pct' }, discountValue: { type: Number, default: 0 }, applyOn: { type: String, enum: ['order','cheapest','most_expensive'], default: 'order' }, maxDiscount: { type: Number, default: 0 } },
        type:            { type: String, enum: ['pct', 'fixed'], default: 'pct' },
        value:           { type: Number, required: true, min: 0 },
        minOrderValue:   { type: Number, default: 0 },
        maxUsage:        { type: Number, default: 0 },
        usageCount:      { type: Number, default: 0 },
        validFrom:       { type: Date, default: null },
        validTo:         { type: Date, default: null },
        active:          { type: Boolean, default: true },
        onePerOrder:     { type: Boolean, default: false },
      }],

      // ── Discount Codes ────────────────────────────────────────────────────────
      discountCodes: [{
        code:               { type: String, required: true, trim: true, uppercase: true },
        name:               { type: String, required: true, trim: true },
        description:        { type: String, default: '' },
        pricelistIds:       [{ type: ObjectId, ref: 'Pricelist' }],
        applyTo: { products: [{ type: ObjectId, ref: 'Product' }], categories: [{ type: ObjectId, ref: 'Category' }], brands: [{ type: ObjectId, ref: 'Brand' }] },
        availableOn:        { pos: { type: Boolean, default: true }, sales: { type: Boolean, default: false }, website: { type: Boolean, default: false } },
        rules:              { minQty: { type: Number, default: 0 }, minOrderValue: { type: Number, default: 0 } },
        reward:             { discountType: { type: String, enum: ['pct','fixed'], default: 'pct' }, discountValue: { type: Number, default: 0 }, applyOn: { type: String, enum: ['order','cheapest','most_expensive'], default: 'order' }, maxDiscount: { type: Number, default: 0 } },
        type:               { type: String, enum: ['pct', 'fixed'], default: 'pct' },
        value:              { type: Number, required: true, min: 0 },
        minOrderValue:      { type: Number, default: 0 },
        validFrom:          { type: Date, default: null },
        validTo:            { type: Date, default: null },
        maxUsage:           { type: Number, default: 0 },
        usageCount:         { type: Number, default: 0 },
        color:              { type: String, default: '#059669' },
        active:             { type: Boolean, default: true },
      }],

      // ── Promotions ────────────────────────────────────────────────────────────
      promotions: [{
        name:               { type: String, required: true, trim: true },
        description:        { type: String, default: '' },
        pricelistIds:       [{ type: ObjectId, ref: 'Pricelist' }],
        applyTo: { products: [{ type: ObjectId, ref: 'Product' }], categories: [{ type: ObjectId, ref: 'Category' }], brands: [{ type: ObjectId, ref: 'Brand' }] },
        availableOn:        { pos: { type: Boolean, default: true }, sales: { type: Boolean, default: false }, website: { type: Boolean, default: false } },
        rules:              { minQty: { type: Number, default: 0 }, minOrderValue: { type: Number, default: 0 } },
        reward:             { discountType: { type: String, enum: ['pct','fixed'], default: 'pct' }, discountValue: { type: Number, default: 0 }, applyOn: { type: String, enum: ['order','cheapest','most_expensive'], default: 'order' }, maxDiscount: { type: Number, default: 0 } },
        type:               { type: String, enum: ['pct', 'fixed'], default: 'pct' },
        value:              { type: Number, required: true, min: 0 },
        startDate:          { type: Date, default: null },
        endDate:            { type: Date, default: null },
        maxUsage:           { type: Number, default: 0 },
        usageCount:         { type: Number, default: 0 },
        color:              { type: String, default: '#d97706' },
        stackable:          { type: Boolean, default: false },
        priority:           { type: Number, default: 0 },
        active:             { type: Boolean, default: true },
      }],

      // ── Buy X Get Y ───────────────────────────────────────────────────────────
      buyXGetY: [{
        name:               { type: String, required: true, trim: true },
        description:        { type: String, default: '' },
        pricelistIds:       [{ type: ObjectId, ref: 'Pricelist' }],
        buyProducts:        [{ type: ObjectId, ref: 'Product' }],
        getProducts:        [{ type: ObjectId, ref: 'Product' }],
        availableOn:        { pos: { type: Boolean, default: true }, sales: { type: Boolean, default: false }, website: { type: Boolean, default: false } },
        buyQty:             { type: Number, required: true, min: 1 },
        getQty:             { type: Number, required: true, min: 1 },
        getDiscountPct:     { type: Number, required: true, min: 0, max: 100 },
        minOrderValue:      { type: Number, default: 0 },
        maxUsage:           { type: Number, default: 0 },
        usageCount:         { type: Number, default: 0 },
        validFrom:          { type: Date, default: null },
        validTo:            { type: Date, default: null },
        color:              { type: String, default: '#7c3aed' },
        stackable:          { type: Boolean, default: false },
        active:             { type: Boolean, default: true },
      }],

      // ── Loyalty Card Config ───────────────────────────────────────────────────
      loyaltyCard: {
        enabled:        { type: Boolean, default: false },
        cardPrefix:     { type: String,  default: 'DH-' },
        earnMultiplier: { type: Number,  default: 1 },
        welcomeBonus:   { type: Number,  default: 0 },
        pointsExpiry:        { type: Number,  default: 0 },   // days; 0 = never
        minRedemption:       { type: Number,  default: 0 },   // min points to redeem
        doublePointsDays:    [{ type: Number, min: 0, max: 6 }], // 0=Sun…6=Sat
        bonusMultiplierDays: { type: Number,  default: 2 },
        tiers: [{
          name:         { type: String, required: true },
          minPoints:    { type: Number, default: 0, min: 0 },
          multiplier:   { type: Number, default: 1, min: 0.1 },
          color:        { type: String, default: '#d97706' },
          benefits:     { type: String, default: '' },
        }],
      },

      // ── Next Order Coupon Config ──────────────────────────────────────────────
      nextOrderCoupon: {
        enabled:           { type: Boolean, default: false },
        type:              { type: String, enum: ['pct', 'fixed'], default: 'pct' },
        value:             { type: Number, default: 10 },
        validDays:         { type: Number, default: 30 },
        minOrderForCoupon: { type: Number, default: 0 },
        minRedeemOrder:    { type: Number, default: 0 },
        codePrefix:        { type: String, default: 'NOC-' },
        color:             { type: String, default: '#be185d' },
        oneUse:            { type: Boolean, default: true },
        availableOn:       { pos: { type: Boolean, default: true }, sales: { type: Boolean, default: false }, website: { type: Boolean, default: false } },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ────────────────────────────────────────────────
// Virtuals / Helpers
// ────────────────────────────────────────────────

tenantSchema.virtual("subdomain").get(function () {
  return `${this.slug}.drinksharbour.com`;
});

tenantSchema.virtual("isActive").get(function () {
  return (
    this.status === "approved" &&
    ["active", "trialing"].includes(this.subscriptionStatus)
  );
});

// ────────────────────────────────────────────────
// Indexes
// ────────────────────────────────────────────────

tenantSchema.index({ slug: 1, status: 1 });
tenantSchema.index({ status: 1, subscriptionStatus: 1 });
tenantSchema.index({ normalizedState: 1, status: 1 });    // shipping lookups
tenantSchema.index({ 'location.lat': 1, 'location.lon': 1 }); // geo queries

// ────────────────────────────────────────────────
// State normalisation helper (mirrors shipping-zones logic)
// ────────────────────────────────────────────────

function normaliseState(raw) {
  if (!raw) return '';
  const s = raw.trim();
  if (/federal capital territory|fct/i.test(s) || /\babuja\b/i.test(s)) return 'FCT - Abuja';
  // Strip trailing " State" if present
  return s.replace(/\s+state$/i, '').trim();
}

// ────────────────────────────────────────────────
// Auto-geocode address on save (non-blocking)
// ────────────────────────────────────────────────

async function geocodeAddress(tenant) {
  const a = tenant.address;
  if (!a?.street && !a?.city && !a?.state) return; // nothing to geocode

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
  if (!apiKey) return;

  const parts = [a.street, a.lga, a.city, a.state, a.country || 'Nigeria'].filter(Boolean);
  const query  = parts.join(', ');

  try {
    const params = new URLSearchParams({
      address:    query,
      components: 'country:NG',
      key:        apiKey,
    });
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.[0]) return;

    const result    = data.results[0];
    const { lat, lng } = result.geometry.location;

    tenant.location.lat        = lat;
    tenant.location.lon        = lng;
    tenant.location.geocodedAt = new Date();
    tenant.location.source     = 'google';
    tenant.address.formatted   = result.formatted_address;
  } catch (err) {
    console.warn('[Tenant] Geocoding failed for', query, '—', err.message);
  }
}

// ── Pre-save: normalise state + geocode if address changed ───────────────────

tenantSchema.pre('save', async function () {
  // Always keep normalizedState in sync with address.state
  if (this.address?.state) {
    this.normalizedState = normaliseState(this.address.state);
  }

  // Re-geocode only when address fields actually changed
  const addressChanged = ['address.street', 'address.city', 'address.lga', 'address.state']
    .some(path => this.isModified(path));

  if (addressChanged) {
    await geocodeAddress(this);
  }
});

// ── Pre-findOneAndUpdate: normalise state in $set operations ─────────────────

tenantSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  const state  = update?.$set?.['address.state'] || update?.address?.state;
  if (state) {
    if (!update.$set) update.$set = {};
    update.$set.normalizedState = normaliseState(state);
  }
});

// ────────────────────────────────────────────────
// Instance method — manually trigger geocoding
// ────────────────────────────────────────────────

tenantSchema.methods.geocode = async function () {
  await geocodeAddress(this);
  return this.save();
};

const Tenant = mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);

module.exports = Tenant;
