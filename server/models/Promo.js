// models/Promo.js

const mongoose = require('mongoose');

const promoSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Promo code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'Code must be at least 3 characters'],
      maxlength: [20, 'Code cannot exceed 20 characters'],
    },

    name: {
      type: String,
      required: [true, 'Promo name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    type: {
      type: String,
      enum: ['percentage', 'fixed', 'bogo', 'free_shipping', 'bundle'],
      required: true,
    },

    discountValue: {
      type: Number,
      min: [0, 'Discount value cannot be negative'],
    },

    maximumDiscount: {
      type: Number,
      min: [0, 'Maximum discount cannot be negative'],
    },

    minimumOrderValue: {
      type: Number,
      min: [0, 'Minimum order value cannot be negative'],
      default: 0,
    },

    usageLimit: {
      type: Number,
      min: [0, 'Usage limit cannot be negative'],
    },

    usageLimitPerCustomer: {
      type: Number,
      min: [0, 'Per customer limit cannot be negative'],
      default: 1,
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'expired', 'disabled'],
      default: 'draft',
    },

    applicableProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }],

    applicableCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],

    applicableBrands: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
    }],

    excludedProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }],

    applicableUserTypes: {
      type: String,
      enum: ['all', 'new_customers', 'returning_customers', 'vip'],
      default: 'all',
    },

    paymentMethods: [{
      type: String,
      enum: ['card', 'bank', 'cod', 'bank_transfer', 'mobile_money', 'cash_on_delivery', 'wallet'],
    }],

    bannerImage: {
      url: String,
      alt: String,
    },

    priority: {
      type: Number,
      default: 0,
    },

    termsAndConditions: {
      type: String,
      trim: true,
    },

    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
    },

    isGlobal: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes (removed duplicate - code already has index from unique:true)
promoSchema.index({ status: 1, isActive: 1 });
promoSchema.index({ startDate: 1, endDate: 1 });
promoSchema.index({ type: 1 });
promoSchema.index({ tenant: 1 });

// Virtual for is currently valid
promoSchema.virtual('isCurrentlyValid').get(function () {
  if (!this.isActive || this.status === 'disabled') {
    return false;
  }

  const now = new Date();

  if (this.status === 'expired') {
    return false;
  }

  if (this.startDate && now < this.startDate) {
    return false;
  }

  if (this.endDate && now > this.endDate) {
    return false;
  }

  if (this.usageLimit && this.usedCount >= this.usageLimit) {
    return false;
  }

  return true;
});

// Virtual for remaining uses
promoSchema.virtual('remainingUses').get(function () {
  if (!this.usageLimit) {
    return null;
  }
  return Math.max(0, this.usageLimit - this.usedCount);
});

// Virtual for display discount
promoSchema.virtual('displayDiscount').get(function () {
  switch (this.type) {
    case 'percentage':
      return `${this.discountValue}% OFF`;
    case 'fixed':
      return `₦${this.discountValue} OFF`;
    case 'bogo':
      return 'BUY 1 GET 1 FREE';
    case 'free_shipping':
      return 'FREE SHIPPING';
    case 'bundle':
      return 'BUNDLE DEAL';
    default:
      return 'SPECIAL OFFER';
  }
});

// Generate slug from code
promoSchema.methods.generateSlug = async function () {
  return this.code.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

// Check if promo is valid for a given order
promoSchema.methods.isValidForOrder = async function (orderData) {
  if (!this.isCurrentlyValid) {
    return { valid: false, message: 'This promo code has expired or is no longer active' };
  }

  if (this.minimumOrderValue && orderData.subtotal < this.minimumOrderValue) {
    return { valid: false, message: `Minimum order value of ₦${this.minimumOrderValue} required` };
  }

  return { valid: true };
};

// Increment usage count
promoSchema.methods.incrementUsage = async function () {
  this.usedCount += 1;
  await this.save();
};

// Update status based on schedule
promoSchema.methods.updateStatus = async function () {
  const now = new Date();

  if (!this.isActive) {
    this.status = 'disabled';
  } else if (this.startDate && now < this.startDate) {
    this.status = 'scheduled';
  } else if (this.endDate && now > this.endDate) {
    this.status = 'expired';
  } else {
    this.status = 'active';
  }

  await this.save();
};

// Static method to find valid promo
promoSchema.statics.findValidPromo = async function (code) {
  const now = new Date();

  const promo = await this.findOne({
    code: code.toUpperCase(),
    isActive: true,
    status: { $in: ['active', 'scheduled'] },
    $or: [
      { startDate: { $exists: false } },
      { startDate: { $lte: now } },
    ],
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gte: now } },
    ],
    $or: [
      { usageLimit: { $exists: false } },
      { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
    ],
  });

  return promo;
};

// Pre-save middleware
promoSchema.pre('save', async function () {
  if (this.isModified('status') || this.isNew) {
    if (this.isActive && this.status === 'draft') {
      this.status = 'active';
    }
  }

  if (this.isModified('startDate') || this.isModified('endDate')) {
    await this.updateStatus();
  }
});

const Promo = mongoose.model('Promo', promoSchema);

module.exports = Promo;
