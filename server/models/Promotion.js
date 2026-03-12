// models/Promotion.js

const mongoose = require('mongoose');
const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const promotionSchema = new Schema(
  {
    // ════════════════════════════════════════════════════════════
    // CORE IDENTIFIERS
    // ════════════════════════════════════════════════════════════
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
    },

    // ════════════════════════════════════════════════════════════
    // PROMOTION TYPE
    // ════════════════════════════════════════════════════════════
    type: {
      type: String,
      enum: [
        'percentage_discount',    // X% off
        'fixed_discount',         // ₦X off
        'buy_x_get_y',           // Buy X get Y free/discounted
        'bundle',                 // Bundle deal
        'flash_sale',            // Time-limited sale
        'loyalty',               // Loyalty program discount
        'seasonal',              // Seasonal promotion
        'clearance',             // Clearance sale
        'first_purchase',        // First-time buyer discount
        'free_shipping',         // Free shipping
        'gift_with_purchase',    // Free gift
      ],
      required: true,
      default: 'percentage_discount',
    },

    // ════════════════════════════════════════════════════════════
    // DISCOUNT CONFIGURATION
    // ════════════════════════════════════════════════════════════
    discountValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
      // Cap the maximum discount (useful for percentage discounts)
    },
    minPurchaseAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    minQuantity: {
      type: Number,
      min: 1,
      default: 1,
    },

    // ════════════════════════════════════════════════════════════
    // BUY X GET Y CONFIGURATION
    // ════════════════════════════════════════════════════════════
    buyQuantity: {
      type: Number,
      min: 1,
      default: 1,
    },
    getQuantity: {
      type: Number,
      min: 1,
      default: 1,
    },
    getDiscountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 100, // 100 = free
    },

    // ════════════════════════════════════════════════════════════
    // BUNDLE CONFIGURATION
    // ════════════════════════════════════════════════════════════
    bundleItems: [{
      subProduct: {
        type: ObjectId,
        ref: 'SubProduct',
      },
      size: {
        type: ObjectId,
        ref: 'Size',
      },
      sizeName: String,
      quantity: {
        type: Number,
        min: 1,
        default: 1,
      },
      required: {
        type: Boolean,
        default: true,
      },
    }],
    bundlePrice: {
      type: Number,
      min: 0,
    },

    // ════════════════════════════════════════════════════════════
    // APPLICABLE PRODUCTS & SIZES
    // ════════════════════════════════════════════════════════════
    applyTo: {
      type: String,
      enum: ['all', 'specific_products', 'specific_categories', 'specific_brands'],
      default: 'all',
    },
    // Specific SubProducts this promotion applies to
    subProducts: [{
      type: ObjectId,
      ref: 'SubProduct',
    }],
    // Specific Sizes within SubProducts
    sizes: [{
      type: ObjectId,
      ref: 'Size',
    }],
    sizeNames: [String], // Size names like "70cl", "1L" for easier matching
    // Categories and Brands for broader targeting
    categories: [{
      type: ObjectId,
      ref: 'Category',
    }],
    brands: [{
      type: ObjectId,
      ref: 'Brand',
    }],
    // Excluded items
    excludedSubProducts: [{
      type: ObjectId,
      ref: 'SubProduct',
    }],
    excludedSizes: [{
      type: ObjectId,
      ref: 'Size',
    }],

    // ════════════════════════════════════════════════════════════
    // SCHEDULING
    // ════════════════════════════════════════════════════════════
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    isScheduled: {
      type: Boolean,
      default: false,
    },
    recurringSchedule: {
      enabled: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
      },
      daysOfWeek: [Number], // 0-6, Sunday-Saturday
      startTime: String, // "09:00"
      endTime: String, // "21:00"
    },

    // ════════════════════════════════════════════════════════════
    // USAGE LIMITS
    // ════════════════════════════════════════════════════════════
    usageLimit: {
      type: Number,
      min: 0,
      // 0 = unlimited
    },
    usageLimitPerCustomer: {
      type: Number,
      min: 0,
      default: 0,
      // 0 = unlimited
    },
    currentUsageCount: {
      type: Number,
      default: 0,
    },
    remainingQuantity: {
      type: Number,
      // For flash sales with limited stock
    },

    // ════════════════════════════════════════════════════════════
    // CUSTOMER TARGETING
    // ════════════════════════════════════════════════════════════
    customerEligibility: {
      type: String,
      enum: ['all', 'new_customers', 'returning_customers', 'loyalty_members', 'specific_tiers'],
      default: 'all',
    },
    loyaltyTiers: [{
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'vip'],
    }],
    specificCustomers: [{
      type: ObjectId,
      ref: 'User',
    }],

    // ════════════════════════════════════════════════════════════
    // STACKING RULES
    // ════════════════════════════════════════════════════════════
    stackable: {
      type: Boolean,
      default: false,
    },
    stackableWith: [{
      type: ObjectId,
      ref: 'Promotion',
    }],
    excludeFromStacking: [{
      type: ObjectId,
      ref: 'Promotion',
    }],
    priority: {
      type: Number,
      default: 0,
      // Higher = applied first
    },

    // ════════════════════════════════════════════════════════════
    // DISPLAY & MARKETING
    // ════════════════════════════════════════════════════════════
    displayBanner: {
      enabled: { type: Boolean, default: false },
      imageUrl: String,
      backgroundColor: String,
      textColor: String,
      headline: String,
      subheadline: String,
    },
    badge: {
      enabled: { type: Boolean, default: true },
      text: String,
      color: String,
      backgroundColor: String,
    },
    showCountdown: {
      type: Boolean,
      default: false,
    },
    showRemainingStock: {
      type: Boolean,
      default: false,
    },
    highlightOnProductPage: {
      type: Boolean,
      default: true,
    },

    // ════════════════════════════════════════════════════════════
    // STATUS
    // ════════════════════════════════════════════════════════════
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'paused', 'expired', 'cancelled'],
      default: 'draft',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    autoActivate: {
      type: Boolean,
      default: true,
    },
    autoDeactivate: {
      type: Boolean,
      default: true,
    },

    // ════════════════════════════════════════════════════════════
    // ANALYTICS
    // ════════════════════════════════════════════════════════════
    analytics: {
      views: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      totalDiscount: { type: Number, default: 0 },
    },

    // ════════════════════════════════════════════════════════════
    // METADATA
    // ════════════════════════════════════════════════════════════
    createdBy: {
      type: ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: ObjectId,
      ref: 'User',
    },
    notes: String,
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// ════════════════════════════════════════════════════════════
// INDEXES
// ════════════════════════════════════════════════════════════
promotionSchema.index({ tenant: 1, status: 1 });
promotionSchema.index({ tenant: 1, type: 1 });
promotionSchema.index({ tenant: 1, startDate: 1, endDate: 1 });
promotionSchema.index({ tenant: 1, code: 1 }, { unique: true, sparse: true });
promotionSchema.index({ tenant: 1, isActive: 1 });
promotionSchema.index({ subProducts: 1 });
promotionSchema.index({ sizes: 1 });

// ════════════════════════════════════════════════════════════
// VIRTUALS
// ════════════════════════════════════════════════════════════
promotionSchema.virtual('isCurrentlyActive').get(function() {
  if (!this.isActive || this.status !== 'active') return false;
  
  const now = new Date();
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  
  if (this.usageLimit && this.currentUsageCount >= this.usageLimit) return false;
  if (this.remainingQuantity !== undefined && this.remainingQuantity <= 0) return false;
  
  return true;
});

promotionSchema.virtual('timeRemaining').get(function() {
  if (!this.endDate) return null;
  const now = new Date();
  const diff = this.endDate.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return diff;
});

// ════════════════════════════════════════════════════════════
// METHODS
// ════════════════════════════════════════════════════════════
promotionSchema.methods.calculateDiscount = function(originalPrice, quantity = 1) {
  if (!this.isCurrentlyActive) return 0;
  
  let discount = 0;
  
  switch (this.type) {
    case 'percentage_discount':
      discount = originalPrice * (this.discountValue / 100);
      break;
    case 'fixed_discount':
      discount = this.discountValue;
      break;
    case 'buy_x_get_y':
      const freeItems = Math.floor(quantity / this.buyQuantity) * this.getQuantity;
      discount = (originalPrice / quantity) * freeItems * (this.getDiscountPercentage / 100);
      break;
    default:
      discount = originalPrice * (this.discountValue / 100);
  }
  
  // Apply max discount cap
  if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
    discount = this.maxDiscountAmount;
  }
  
  return Math.min(discount, originalPrice);
};

promotionSchema.methods.isApplicableTo = function(subProductId, sizeId = null) {
  // Check if excluded
  if (this.excludedSubProducts?.includes(subProductId)) return false;
  if (sizeId && this.excludedSizes?.includes(sizeId)) return false;
  
  // Check if applies to all
  if (this.applyTo === 'all') return true;
  
  // Check specific products
  if (this.applyTo === 'specific_products') {
    if (!this.subProducts?.includes(subProductId)) return false;
    
    // If sizes are specified, check size too
    if (this.sizes?.length > 0 && sizeId) {
      return this.sizes.includes(sizeId);
    }
    return true;
  }
  
  return false;
};

promotionSchema.methods.incrementUsage = async function() {
  this.currentUsageCount += 1;
  if (this.remainingQuantity !== undefined) {
    this.remainingQuantity -= 1;
  }
  await this.save();
};

// ════════════════════════════════════════════════════════════
// STATICS
// ════════════════════════════════════════════════════════════
promotionSchema.statics.findActivePromotions = function(tenantId, options = {}) {
  const now = new Date();
  const query = {
    tenant: tenantId,
    status: 'active',
    isActive: true,
    startDate: { $lte: now },
    $or: [
      { endDate: null },
      { endDate: { $gt: now } },
    ],
  };
  
  if (options.type) query.type = options.type;
  if (options.subProductId) {
    query.$or = [
      { applyTo: 'all' },
      { subProducts: options.subProductId },
    ];
  }
  
  return this.find(query).sort({ priority: -1 });
};

promotionSchema.statics.findByCode = function(tenantId, code) {
  return this.findOne({
    tenant: tenantId,
    code: code.toUpperCase(),
    status: 'active',
    isActive: true,
  });
};

// ════════════════════════════════════════════════════════════
// PRE-SAVE HOOKS
// ════════════════════════════════════════════════════════════
promotionSchema.pre('save', function(next) {
  // Auto-generate slug
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  // Auto-update status based on dates
  const now = new Date();
  if (this.autoActivate && this.startDate && now >= this.startDate) {
    if (!this.endDate || now < this.endDate) {
      if (this.status === 'scheduled') {
        this.status = 'active';
        this.isActive = true;
      }
    }
  }
  if (this.autoDeactivate && this.endDate && now > this.endDate) {
    if (this.status === 'active') {
      this.status = 'expired';
      this.isActive = false;
    }
  }
  
  next();
});

const Promotion = mongoose.models.Promotion || mongoose.model('Promotion', promotionSchema);
module.exports = Promotion;
