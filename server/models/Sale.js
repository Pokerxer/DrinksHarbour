// models/Sale.js

const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Sale name is required'],
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
      enum: ['flash_sale', 'seasonal', 'clearance', 'bundle', 'bogo', 'percentage_off', 'fixed_off'],
      required: true,
    },

    discountType: {
      type: String,
      enum: ['percentage', 'fixed', 'bogo'],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: [0, 'Discount cannot be negative'],
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

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ['scheduled', 'active', 'ended', 'cancelled'],
      default: 'scheduled',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Products included in this sale
    products: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }],

    // Categories included in this sale
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],

    // Specific subproducts (variants)
    subproducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubProduct',
    }],

    // Exclude certain products
    excludedProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }],

    // Banner/Display
    bannerImage: {
      url: {
        type: String,
        required: true,
      },
      alt: String,
      mobileUrl: String,
    },

    countdownEnabled: {
      type: Boolean,
      default: true,
    },

    // Display settings
    displaySettings: {
      showOnHomepage: {
        type: Boolean,
        default: true,
      },
      homepagePosition: {
        type: Number,
        default: 1,
      },
      cardStyle: {
        type: String,
        enum: ['standard', 'featured', 'compact'],
        default: 'standard',
      },
    },

    // Usage limits
    usageLimit: {
      type: Number,
      min: 0,
    },

    usageLimitPerCustomer: {
      type: Number,
      min: 0,
      default: 1,
    },

    currentUsageCount: {
      type: Number,
      default: 0,
    },

    // Analytics
    viewCount: {
      type: Number,
      default: 0,
    },

    conversionCount: {
      type: Number,
      default: 0,
    },

    totalRevenue: {
      type: Number,
      default: 0,
    },

    // Terms and conditions
    termsAndConditions: {
      type: String,
      trim: true,
    },

    // SEO
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

    // Tenant support
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
saleSchema.index({ status: 1, isActive: 1 });
saleSchema.index({ startDate: 1, endDate: 1 });
saleSchema.index({ type: 1 });
saleSchema.index({ tenant: 1 });
saleSchema.index({ isGlobal: 1, isActive: 1, startDate: 1, endDate: 1 });

// Virtual for is currently active
saleSchema.virtual('isLive').get(function () {
  if (!this.isActive || this.status === 'cancelled') {
    return false;
  }

  const now = new Date();

  if (this.startDate && now < this.startDate) {
    return false;
  }

  if (this.endDate && now > this.endDate) {
    return false;
  }

  return true;
});

// Virtual for time remaining
saleSchema.virtual('timeRemaining').get(function () {
  if (!this.endDate) return null;

  const now = new Date();
  const end = new Date(this.endDate);
  const diff = end - now;

  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
});

// Virtual for formatted discount
saleSchema.virtual('displayDiscount').get(function () {
  switch (this.discountType) {
    case 'percentage':
      return `${this.discountValue}% OFF`;
    case 'fixed':
      return `₦${this.discountValue} OFF`;
    case 'bogo':
      return 'BUY 1 GET 1 FREE';
    default:
      return 'SALE';
  }
});

// Pre-save middleware to update status
saleSchema.pre('save', function (next) {
  const now = new Date();

  // Auto-update status based on dates
  if (this.startDate && this.endDate) {
    if (now < this.startDate) {
      this.status = 'scheduled';
    } else if (now > this.endDate) {
      this.status = 'ended';
    } else {
      this.status = 'active';
    }
  }

  next();
});

// Static method to get active sales
saleSchema.statics.getActiveSales = async function (options = {}) {
  const { tenant, limit = 10, type } = options;
  const now = new Date();

  const query = {
    isActive: true,
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
  };

  if (tenant) {
    query.$or = [
      { tenant },
      { isGlobal: true },
    ];
  }

  if (type) {
    query.type = type;
  }

  return this.find(query)
    .sort({ 'displaySettings.homepagePosition': 1, startDate: -1 })
    .limit(limit)
    .populate('products', 'name slug images')
    .populate('categories', 'name slug');
};

// Static method to apply sale to product
saleSchema.statics.applySaleToProduct = async function (saleId, productId) {
  const sale = await this.findById(saleId);
  if (!sale) {
    throw new Error('Sale not found');
  }

  if (!sale.isLive) {
    throw new Error('Sale is not active');
  }

  // Update product's sale fields
  const Product = require('./Product');
  const SubProduct = require('./SubProduct');

  // Update all subproducts of the product
  await SubProduct.updateMany(
    { product: productId },
    {
      $set: {
        salePrice: null, // Will be calculated
        saleStartDate: sale.startDate,
        saleEndDate: sale.endDate,
        saleType: sale.type,
        saleDiscountValue: sale.discountValue,
        isOnSale: true,
      }
    }
  );

  return sale;
};

const Sale = mongoose.model('Sale', saleSchema);

module.exports = Sale;
