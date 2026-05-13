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
    // Purchase Settings (Odoo-style)
    // ────────────────────────────────────────────────
    purchaseSettings: {
      // Bill Control Policy
      billControlPolicy: {
        type: String,
        enum: ["ordered", "received"],
        default: "received",
      },
      // Enable 3-way matching
      enable3WayMatching: {
        type: Boolean,
        default: true,
      },
      // Require approval for all POs
      requirePOApproval: {
        type: Boolean,
        default: true,
      },
      // Approval threshold amount (0 = all POs require approval)
      approvalThreshold: {
        type: Number,
        default: 0,
        min: 0,
      },
      // Default payment terms for POs
      defaultPaymentTerms: {
        type: String,
        default: "Net 30",
      },
      // Auto-generate vendor bill when goods received
      autoGenerateBill: {
        type: Boolean,
        default: false,
      },
      // Allow partial receipts
      allowPartialReceipts: {
        type: Boolean,
        default: true,
      },
      // Default receiving location/warehouse
      defaultReceivingLocation: String,
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

tenantSchema.pre('save', async function (next) {
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

  next();
});

// ── Pre-findOneAndUpdate: normalise state in $set operations ─────────────────

tenantSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const state  = update?.$set?.['address.state'] || update?.address?.state;
  if (state) {
    if (!update.$set) update.$set = {};
    update.$set.normalizedState = normaliseState(state);
  }
  next();
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
