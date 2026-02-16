// models/FlashSale.js

const mongoose = require('mongoose');

const flashSaleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Flash sale title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    type: {
      type: String,
      enum: ['flash_sale', 'deal_of_the_day', 'bundle_offer', 'clearance', 'limited_time'],
      default: 'flash_sale',
    },

    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'paused', 'expired', 'ended'],
      default: 'draft',
    },

    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },

    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },

    discountType: {
      type: String,
      enum: ['percentage', 'fixed', 'bogo', 'mixed'],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
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

    bannerImage: {
      url: {
        type: String,
        required: true,
      },
      alt: String,
      mobileUrl: String,
    },

    backgroundColor: {
      type: String,
      default: '#DC2626',
    },

    textColor: {
      type: String,
      default: '#FFFFFF',
    },

    products: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
      salePrice: {
        type: Number,
        required: true,
      },
      originalPrice: {
        type: Number,
        required: true,
      },
      stockAllocation: {
        type: Number,
        default: 0,
      },
      soldCount: {
        type: Number,
        default: 0,
      },
      maxPerCustomer: {
        type: Number,
        default: 10,
      },
    }],

    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],

    brands: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
    }],

    totalStockAllocation: {
      type: Number,
      default: 0,
    },

    totalSold: {
      type: Number,
      default: 0,
    },

    usageLimitPerCustomer: {
      type: Number,
      default: 1,
    },

    totalUsageLimit: {
      type: Number,
      default: 0,
    },

    currentUsageCount: {
      type: Number,
      default: 0,
    },

    priority: {
      type: Number,
      default: 0,
    },

    showCountdown: {
      type: Boolean,
      default: true,
    },

    showProgressBar: {
      type: Boolean,
      default: true,
    },

    showSoldCount: {
      type: Boolean,
      default: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    termsAndConditions: {
      type: String,
      trim: true,
    },

    seoTitle: {
      type: String,
      trim: true,
      maxlength: [60, 'SEO title cannot exceed 60 characters'],
    },

    seoDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'SEO description cannot exceed 160 characters'],
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

// Indexes
flashSaleSchema.index({ status: 1, startDate: 1, endDate: 1 });
flashSaleSchema.index({ type: 1 });
flashSaleSchema.index({ isFeatured: 1, status: 1 });
flashSaleSchema.index({ startDate: 1, endDate: 1 });
flashSaleSchema.index({ tenant: 1 });

// Virtual for is currently active
flashSaleSchema.virtual('isActive').get(function () {
  const now = new Date();
  
  if (this.status !== 'active') {
    return false;
  }

  if (this.startDate && now < this.startDate) {
    return false;
  }

  if (this.endDate && now > this.endDate) {
    return false;
  }

  return true;
});

// Virtual for time remaining
flashSaleSchema.virtual('timeRemaining').get(function () {
  if (!this.endDate) {
    return null;
  }

  const now = new Date();
  const distance = this.endDate - now;

  if (distance < 0) {
    return { expired: true };
  }

  return {
    expired: false,
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((distance % (1000 * 60)) / 1000),
    totalMs: distance,
  };
});

// Virtual for progress percentage
flashSaleSchema.virtual('progressPercentage').get(function () {
  if (this.totalStockAllocation === 0) {
    return 0;
  }
  return Math.min(100, Math.round((this.totalSold / this.totalStockAllocation) * 100));
});

// Virtual for remaining stock
flashSaleSchema.virtual('remainingStock').get(function () {
  return Math.max(0, this.totalStockAllocation - this.totalSold);
});

// Virtual for formatted discount
flashSaleSchema.virtual('formattedDiscount').get(function () {
  switch (this.discountType) {
    case 'percentage':
      return `${this.discountValue}% OFF`;
    case 'fixed':
      return `₦${this.discountValue.toLocaleString()} OFF`;
    case 'bogo':
      return 'BUY 1 GET 1 FREE';
    case 'mixed':
      return 'UP TO 70% OFF';
    default:
      return 'SPECIAL OFFER';
  }
});

// Method to check if sale is valid
flashSaleSchema.methods.isValid = function () {
  const now = new Date();
  
  if (this.status !== 'active') {
    return { valid: false, message: 'Flash sale is not active' };
  }

  if (this.startDate && now < this.startDate) {
    return { valid: false, message: 'Flash sale has not started yet' };
  }

  if (this.endDate && now > this.endDate) {
    return { valid: false, message: 'Flash sale has ended' };
  }

  if (this.totalUsageLimit && this.currentUsageCount >= this.totalUsageLimit) {
    return { valid: false, message: 'Flash sale usage limit reached' };
  }

  if (this.totalStockAllocation > 0 && this.totalSold >= this.totalStockAllocation) {
    return { valid: false, message: 'Sold out!' };
  }

  return { valid: true };
};

// Method to check product availability
flashSaleSchema.methods.checkProductAvailability = function (productId, quantity = 1) {
  const productSale = this.products.find(
    p => p.product.toString() === productId.toString()
  );

  if (!productSale) {
    return { available: false, message: 'Product not in this flash sale' };
  }

  if (productSale.stockAllocation > 0 && productSale.soldCount + quantity > productSale.stockAllocation) {
    return { 
      available: false, 
      maxQuantity: Math.max(0, productSale.stockAllocation - productSale.soldCount),
      message: `Only ${Math.max(0, productSale.stockAllocation - productSale.soldCount)} left` 
    };
  }

  return { available: true, maxQuantity: productSale.maxPerCustomer };
};

// Method to calculate discount
flashSaleSchema.methods.calculateDiscount = function (originalPrice, productId = null) {
  let discountAmount = 0;

  if (productId) {
    const productSale = this.products.find(
      p => p.product.toString() === productId.toString()
    );
    
    if (productSale) {
      discountAmount = productSale.originalPrice - productSale.salePrice;
    } else {
      // Use general discount
      if (this.discountType === 'percentage') {
        discountAmount = (originalPrice * this.discountValue) / 100;
      } else if (this.discountType === 'fixed') {
        discountAmount = this.discountValue;
      }
    }
  } else {
    if (this.discountType === 'percentage') {
      discountAmount = (originalPrice * this.discountValue) / 100;
    } else if (this.discountType === 'fixed') {
      discountAmount = this.discountValue;
    }
  }

  // Apply maximum discount cap
  if (this.maximumDiscount && discountAmount > this.maximumDiscount) {
    discountAmount = this.maximumDiscount;
  }

  // Don't exceed original price
  if (discountAmount > originalPrice) {
    discountAmount = originalPrice;
  }

  return {
    originalPrice,
    discountAmount,
    salePrice: originalPrice - discountAmount,
    savingsPercentage: Math.round((discountAmount / originalPrice) * 100),
  };
};

// Update status based on dates
flashSaleSchema.methods.updateStatus = async function () {
  const now = new Date();

  if (!this.isActive) {
    this.status = this.status === 'draft' ? 'draft' : 'paused';
  } else if (this.startDate && now < this.startDate) {
    this.status = 'scheduled';
  } else if (this.endDate && now > this.endDate) {
    this.status = 'expired';
  } else if (this.status === 'scheduled' || this.status === 'expired') {
    this.status = 'active';
  }

  await this.save();
};

// Static method to get active sales
flashSaleSchema.statics.getActiveSales = async function (options = {}) {
  const { type, featured, limit = 10, tenant } = options;
  const now = new Date();

  const filter = {
    status: 'active',
    startDate: { $lte: now },
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gte: now } },
    ],
  };

  if (type) {
    filter.type = type;
  }

  if (featured) {
    filter.isFeatured = true;
  }

  if (tenant) {
    filter.$or = [
      { tenant },
      { isGlobal: true },
    ];
  }

  return this.find(filter)
    .populate('products.product', 'name slug images price')
    .sort({ priority: -1, startDate: -1 })
    .limit(limit);
};

// Static method to get upcoming sales
flashSaleSchema.statics.getUpcomingSales = async function (limit = 5) {
  const now = new Date();

  return this.find({
    status: 'scheduled',
    startDate: { $gt: now },
  })
    .sort({ startDate: 1 })
    .limit(limit);
};

// Pre-save middleware
flashSaleSchema.pre('save', async function () {
  // Calculate total stock allocation from products
  if (this.products && this.products.length > 0) {
    this.totalStockAllocation = this.products.reduce(
      (sum, p) => sum + (p.stockAllocation || 0),
      0
    );
  }

  // Update status based on dates
  if (this.isModified('startDate') || this.isModified('endDate') || this.isModified('isActive')) {
    await this.updateStatus();
  }
});

const FlashSale = mongoose.model('FlashSale', flashSaleSchema);

module.exports = FlashSale;
