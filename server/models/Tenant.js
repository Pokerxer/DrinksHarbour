// models/Tenant.js
const mongoose = require('mongoose');
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
      publicId: String,       // Cloudinary public_id
      alt: String,
    },

    primaryColor: {
      type: String,
      default: '#1a202c',     // fallback dark slate
      match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    },

    // ────────────────────────────────────────────────
    // Subscription & Billing
    // ────────────────────────────────────────────────
    plan: {
      type: String,
      enum: ['free_trial', 'starter', 'pro', 'enterprise', 'custom'],
      default: 'free_trial',
    },

    subscriptionStatus: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired'],
      default: 'trialing',
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
      enum: ['markup', 'commission'],
      default: 'markup',
      required: true,
    },

    markupPercentage: {
      type: Number,
      min: 0,
      max: 500,               // extreme cases allowed
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
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
      default: 'NGN',
    },

    supportedCurrencies: [{
      type: String,
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
    }],

    country: {
      type: String,
      default: 'Nigeria',
    },

    city: String,
    state: String,            // e.g. "Lagos", "Abuja FCT"

    enforceAgeVerification: {
      type: Boolean,
      default: true,          // most tenants sell alcohol
    },

    // ────────────────────────────────────────────────
    // Status & Onboarding Workflow
    // ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended', 'archived'],
      default: 'pending',
      index: true,
    },

    isSystemTenant: {
      type: Boolean,
      default: false,
      index: true,
    },

    approvedAt: Date,
    approvedBy: { type: ObjectId, ref: 'User' }, // super-admin

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
    notes: String,              // internal admin notes

    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    contactPhone: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ────────────────────────────────────────────────
// Virtuals / Helpers
// ────────────────────────────────────────────────

tenantSchema.virtual('subdomain').get(function () {
  return `${this.slug}.drinksharbour.com`;
});

tenantSchema.virtual('isActive').get(function () {
  return this.status === 'approved' && 
         ['active', 'trialing'].includes(this.subscriptionStatus);
});

// Compound index examples – very useful in practice
tenantSchema.index({ slug: 1, status: 1 });
tenantSchema.index({ stripeCustomerId: 1 });
tenantSchema.index({ status: 1, subscriptionStatus: 1 });

const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema);

module.exports = Tenant;