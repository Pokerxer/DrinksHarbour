// models/Coupon.js

const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'Coupon code must be at least 3 characters'],
      maxlength: [50, 'Coupon code cannot exceed 50 characters'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Coupon name is required'],
      trim: true,
      maxlength: [100, 'Coupon name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: function() {
        return ['percentage', 'fixed_amount'].includes(this.discountType);
      },
      min: [0, 'Discount value cannot be negative'],
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    buyQuantity: {
      type: Number,
      min: 1,
    },
    getQuantity: {
      type: Number,
      min: 1,
    },
    currency: {
      type: String,
      enum: ['NGN', 'USD', 'GBP', 'EUR', 'ZAR'],
      default: 'NGN',
    },
    minimumPurchaseAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum purchase amount cannot be negative'],
    },
    maximumPurchaseAmount: {
      type: Number,
      min: 0,
    },
    minimumItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    maximumItems: {
      type: Number,
      min: 0,
    },
    usageLimit: {
      type: Number,
      min: 1,
      default: null,
    },
    usageLimitPerUser: {
      type: Number,
      min: 1,
      default: 1,
    },
    timesUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired', 'depleted', 'scheduled'],
      default: 'active',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    applicableTo: {
      type: String,
      enum: ['all', 'specific_products', 'specific_categories', 'specific_brands', 'specific_tenants'],
      default: 'all',
    },
    includedProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }],
    excludedProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }],
    includedCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    excludedCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    includedBrands: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
    }],
    excludedBrands: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
    }],
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
    },
    isGlobal: {
      type: Boolean,
      default: false,
    },
    allowedTenants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
    }],
    allowedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    excludedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    allowedUserRoles: [{
      type: String,
      enum: ['customer', 'tenant_admin', 'admin', 'super_admin', 'vip'],
    }],
    firstPurchaseOnly: {
      type: Boolean,
      default: false,
    },
    minimumAccountAge: {
      type: Number,
      min: 0,
    },
    canCombineWithOtherCoupons: {
      type: Boolean,
      default: false,
    },
    canCombineWithSales: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
    },
    autoApply: {
      type: Boolean,
      default: false,
    },
    isReferralCoupon: {
      type: Boolean,
      default: false,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    referralReward: {
      type: Number,
      min: 0,
    },
    usedBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      usedAt: {
        type: Date,
        default: Date.now,
      },
      orderAmount: Number,
      discountApplied: Number,
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
      },
    }],
    totalDiscountGiven: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    conversionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    tags: [String],
    internalNotes: {
      type: String,
      maxlength: 1000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    deletedAt: Date,
    deletedBy: {
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
couponSchema.index({ status: 1, isActive: 1 });
couponSchema.index({ startDate: 1, endDate: 1 });
couponSchema.index({ tenant: 1 });
couponSchema.index({ isGlobal: 1 });
couponSchema.index({ applicableTo: 1 });
couponSchema.index({ autoApply: 1, status: 1 });
couponSchema.index({ status: 1, isActive: 1, startDate: 1, endDate: 1 });
couponSchema.index({ tenant: 1, status: 1, isActive: 1 });

// Virtuals
couponSchema.virtual('isValid').get(function() {
  const now = new Date();
  if (!this.isActive || this.status === 'expired' || this.status === 'depleted') return false;
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  if (this.usageLimit && this.timesUsed >= this.usageLimit) return false;
  return true;
});

couponSchema.virtual('daysUntilExpiration').get(function() {
  if (!this.endDate) return null;
  const now = new Date();
  const diffTime = this.endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

couponSchema.virtual('usagePercentage').get(function() {
  if (!this.usageLimit) return 0;
  return Math.min(100, (this.timesUsed / this.usageLimit) * 100);
});

couponSchema.virtual('remainingUses').get(function() {
  if (!this.usageLimit) return Infinity;
  return Math.max(0, this.usageLimit - this.timesUsed);
});

// Methods
couponSchema.methods.canBeUsedBy = async function(userId) {
  if (!this.isValid) return { canUse: false, reason: 'Coupon is not valid' };
  if (this.allowedUsers.length > 0 && !this.allowedUsers.includes(userId)) return { canUse: false, reason: 'Coupon is not available for this user' };
  if (this.excludedUsers.includes(userId)) return { canUse: false, reason: 'You are not eligible for this coupon' };
  
  const userUsageCount = this.usedBy.filter(u => u.user.toString() === userId.toString()).length;
  if (userUsageCount >= this.usageLimitPerUser) return { canUse: false, reason: `You have already used this coupon ${this.usageLimitPerUser} times` };
  
  if (this.firstPurchaseOnly) {
    const Order = mongoose.model('Order');
    const orderCount = await Order.countDocuments({ customer: userId, status: { $in: ['completed', 'delivered'] } });
    if (orderCount > 0) return { canUse: false, reason: 'This coupon is only for first-time customers' };
  }
  
  if (this.minimumAccountAge) {
    const User = mongoose.model('User');
    const user = await User.findById(userId);
    if (user) {
      const accountAge = Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24));
      if (accountAge < this.minimumAccountAge) return { canUse: false, reason: `Your account must be at least ${this.minimumAccountAge} days old` };
    }
  }
  
  return { canUse: true };
};

couponSchema.methods.calculateDiscount = function(cartTotal, items = []) {
  let discount = 0;
  switch (this.discountType) {
    case 'percentage':
      discount = (cartTotal * this.discountValue) / 100;
      if (this.maxDiscountAmount && discount > this.maxDiscountAmount) discount = this.maxDiscountAmount;
      break;
    case 'fixed_amount':
      discount = Math.min(this.discountValue, cartTotal);
      break;
    case 'free_shipping':
      discount = 0;
      break;
    case 'buy_x_get_y':
      discount = 0;
      break;
    default:
      discount = 0;
  }
  return Math.round(discount * 100) / 100;
};

couponSchema.methods.recordUsage = async function(userId, orderAmount, discountApplied, orderId) {
  this.usedBy.push({
    user: userId,
    usedAt: new Date(),
    orderAmount,
    discountApplied,
    orderId,
  });
  this.timesUsed += 1;
  this.totalDiscountGiven += discountApplied;
  this.totalRevenue += orderAmount;
  this.averageOrderValue = this.totalRevenue / this.timesUsed;
  if (this.usageLimit && this.timesUsed >= this.usageLimit) this.status = 'depleted';
  await this.save({ validateBeforeSave: false });
};

couponSchema.methods.updateStatus = async function() {
  const now = new Date();
  if (this.endDate && now > this.endDate) {
    this.status = 'expired';
    this.isActive = false;
  } else if (this.usageLimit && this.timesUsed >= this.usageLimit) {
    this.status = 'depleted';
    this.isActive = false;
  } else if (this.startDate && now < this.startDate) {
    this.status = 'scheduled';
  } else if (this.isActive) {
    this.status = 'active';
  }
  await this.save({ validateBeforeSave: false });
};

// Statics
couponSchema.statics.findValidCoupon = async function(code, userId = null) {
  const coupon = await this.findOne({ code: code.toUpperCase(), isActive: true })
    .populate('includedProducts', 'name slug')
    .populate('includedCategories', 'name slug')
    .populate('includedBrands', 'name slug')
    .populate('tenant', 'name slug');
  
  if (!coupon) return null;
  await coupon.updateStatus();
  if (!coupon.isValid) return null;
  if (userId) {
    const eligibility = await coupon.canBeUsedBy(userId);
    if (!eligibility.canUse) return null;
  }
  return coupon;
};

couponSchema.statics.getAutoApplyCoupons = async function(filters = {}) {
  const query = {
    autoApply: true,
    isActive: true,
    status: 'active',
    startDate: { $lte: new Date() },
    $or: [{ endDate: { $gte: new Date() } }, { endDate: null }],
  };
  
  if (filters.tenant) {
    query.$or = [{ tenant: filters.tenant }, { isGlobal: true }];
  }
  
  return this.find(query).sort({ priority: -1 });
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
