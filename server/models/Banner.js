// models/Banner.js

const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    // Basic Info
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },

    subtitle: {
      type: String,
      trim: true,
      maxlength: [200, 'Subtitle cannot exceed 200 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Media
    image: {
      url: {
        type: String,
        required: [true, 'Banner image URL is required'],
      },
      publicId: String,
      alt: String,
      width: Number,
      height: Number,
    },

    mobileImage: {
      url: String,
      publicId: String,
      alt: String,
      width: Number,
      height: Number,
    },

    // Banner Type & Placement
    type: {
      type: String,
      enum: ['hero', 'promotional', 'category', 'product', 'seasonal', 'announcement', 'custom'],
      default: 'promotional',
      required: true,
    },

    placement: {
      type: String,
      enum: ['home_hero', 'home_secondary', 'category_top', 'product_page', 'checkout', 'sidebar', 'footer', 'popup', 'header'],
      default: 'home_hero',
      required: true,
    },

    // Display Settings
    displayOrder: {
      type: Number,
      default: 0,
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },

    // Action/CTA
    ctaText: {
      type: String,
      trim: true,
      maxlength: [50, 'CTA text cannot exceed 50 characters'],
    },

    ctaLink: {
      type: String,
      trim: true,
    },

    ctaStyle: {
      type: String,
      enum: ['primary', 'secondary', 'outline', 'text', 'custom'],
      default: 'primary',
    },

    linkType: {
      type: String,
      enum: ['internal', 'external', 'product', 'category', 'brand', 'collection', 'page'],
      default: 'internal',
    },

    // Link References
    targetProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },

    targetCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },

    targetBrand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
    },

    targetCollection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Collection',
    },

    // Styling
    backgroundColor: {
      type: String,
      default: '#FFFFFF',
    },

    textColor: {
      type: String,
      default: '#000000',
    },

    overlayOpacity: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    textAlignment: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'center',
    },

    contentPosition: {
      type: String,
      enum: ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'],
      default: 'center',
    },

    customCSS: {
      type: String,
    },

    // Schedule
    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    isScheduled: {
      type: Boolean,
      default: false,
    },

    // Visibility & Targeting
    isActive: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'paused', 'expired', 'archived'],
      default: 'draft',
    },

    visibleTo: {
      type: String,
      enum: ['all', 'guests', 'authenticated', 'new_customers', 'returning_customers', 'vip'],
      default: 'all',
    },

    targetAudience: {
      countries: [String],
      cities: [String],
      ageGroups: [String],
      interests: [String],
    },

    // Device Targeting
    deviceTargeting: {
      desktop: {
        type: Boolean,
        default: true,
      },
      mobile: {
        type: Boolean,
        default: true,
      },
      tablet: {
        type: Boolean,
        default: true,
      },
    },

    // Multi-tenant Support
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
    },

    isGlobal: {
      type: Boolean,
      default: false,
    },

    // Animation & Effects
    animation: {
      type: {
        type: String,
        enum: ['none', 'fade', 'slide', 'zoom', 'bounce', 'rotate'],
        default: 'none',
      },
      duration: {
        type: Number,
        default: 1000,
      },
      delay: {
        type: Number,
        default: 0,
      },
    },

    autoplay: {
      enabled: {
        type: Boolean,
        default: false,
      },
      interval: {
        type: Number,
        default: 5000,
      },
    },

    // Analytics & Tracking
    impressions: {
      type: Number,
      default: 0,
    },

    clicks: {
      type: Number,
      default: 0,
    },

    clickThroughRate: {
      type: Number,
      default: 0,
    },

    conversionCount: {
      type: Number,
      default: 0,
    },

    conversionRate: {
      type: Number,
      default: 0,
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

    seoKeywords: [String],

    // Metadata
    tags: [String],

    notes: {
      type: String,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    publishedAt: {
      type: Date,
    },

    publishedBy: {
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

// ============================================================
// INDEXES (removed duplicate - slug already has index from unique:true)
// ============================================================

bannerSchema.index({ status: 1, isActive: 1 });
bannerSchema.index({ placement: 1, displayOrder: 1 });
bannerSchema.index({ type: 1 });
bannerSchema.index({ tenant: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });
bannerSchema.index({ isGlobal: 1, isActive: 1 });

// Compound indexes for common queries
bannerSchema.index({ placement: 1, status: 1, isActive: 1, displayOrder: 1 });
bannerSchema.index({ tenant: 1, placement: 1, isActive: 1 });

// ============================================================
// VIRTUALS
// ============================================================

// Check if banner is currently active
bannerSchema.virtual('isCurrentlyActive').get(function () {
  if (!this.isActive || this.status !== 'active') {
    return false;
  }

  const now = new Date();

  if (this.isScheduled) {
    if (this.startDate && now < this.startDate) {
      return false;
    }
    if (this.endDate && now > this.endDate) {
      return false;
    }
  }

  return true;
});

// Days until expiration
bannerSchema.virtual('daysUntilExpiration').get(function () {
  if (!this.endDate) {
    return null;
  }

  const now = new Date();
  const diffTime = this.endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
});

// ============================================================
// METHODS
// ============================================================

// Generate slug from title
bannerSchema.methods.generateSlug = async function () {
  const baseSlug = this.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  let slug = baseSlug;
  let counter = 1;

  while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  this.slug = slug;
};

// Increment impressions
bannerSchema.methods.incrementImpressions = async function () {
  this.impressions += 1;
  await this.save();
};

// Increment clicks and update CTR
bannerSchema.methods.incrementClicks = async function () {
  this.clicks += 1;
  this.clickThroughRate = this.impressions > 0
    ? (this.clicks / this.impressions) * 100
    : 0;
  await this.save();
};

// Increment conversions and update conversion rate
bannerSchema.methods.incrementConversions = async function () {
  this.conversionCount += 1;
  this.conversionRate = this.clicks > 0
    ? (this.conversionCount / this.clicks) * 100
    : 0;
  await this.save();
};

// Update status based on schedule
bannerSchema.methods.updateStatus = async function () {
  const now = new Date();

  if (!this.isScheduled) {
    return;
  }

  if (this.startDate && now < this.startDate) {
    this.status = 'scheduled';
  } else if (this.endDate && now > this.endDate) {
    this.status = 'expired';
  } else if (this.startDate && now >= this.startDate && (!this.endDate || now <= this.endDate)) {
    this.status = 'active';
  }

  await this.save();
};

// ============================================================
// STATICS
// ============================================================

// Get active banners for a specific placement
bannerSchema.statics.getActiveBanners = async function (placement, options = {}) {
  const { tenant, visibleTo, device } = options;

  const query = {
    placement,
    isActive: true,
    status: 'active',
  };

  // Tenant filter
  if (tenant) {
    query.$or = [
      { tenant },
      { isGlobal: true },
    ];
  } else {
    query.isGlobal = true;
  }

  // Visibility filter
  if (visibleTo) {
    query.$or = [
      { visibleTo: 'all' },
      { visibleTo },
    ];
  }

  // Device filter
  if (device) {
    query[`deviceTargeting.${device}`] = true;
  }

  // Schedule filter
  const now = new Date();
  query.$or = [
    { isScheduled: false },
    {
      isScheduled: true,
      $or: [
        { startDate: { $exists: false } },
        { startDate: { $lte: now } },
      ],
      $or: [
        { endDate: { $exists: false } },
        { endDate: { $gte: now } },
      ],
    },
  ];

  const banners = await this.find(query)
    .populate('targetProduct', 'name slug images')
    .populate('targetCategory', 'name slug icon')
    .populate('targetBrand', 'name slug logo')
    .populate('targetCollection', 'name slug')
    .sort({ displayOrder: 1, priority: -1 })
    .lean();

  return banners;
};

// Get banner by slug
bannerSchema.statics.findBySlug = async function (slug) {
  return this.findOne({ slug })
    .populate('targetProduct', 'name slug images priceRange')
    .populate('targetCategory', 'name slug icon')
    .populate('targetBrand', 'name slug logo')
    .populate('targetCollection', 'name slug')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');
};

// ============================================================
// MIDDLEWARE
// ============================================================

// Pre-save: Generate slug if not exists
bannerSchema.pre('save', async function () {
  if (this.isNew || this.isModified('title')) {
    if (!this.slug) {
      await this.generateSlug();
    }
  }

  // Update status based on schedule
  if (this.isScheduled) {
    const now = new Date();

    if (this.startDate && now < this.startDate) {
      this.status = 'scheduled';
    } else if (this.endDate && now > this.endDate) {
      this.status = 'expired';
    } else if (this.startDate && now >= this.startDate && (!this.endDate || now <= this.endDate)) {
      if (this.status === 'draft' || this.status === 'scheduled') {
        this.status = 'active';
      }
    }
  }

  // Set publishedAt if status changes to active
  if (this.isModified('status') && this.status === 'active' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

// Pre-save: Validate schedule dates
bannerSchema.pre('save', async function () {
  if (this.isScheduled && this.startDate && this.endDate) {
    if (this.endDate <= this.startDate) {
      throw new Error('End date must be after start date');
    }
  }
});

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;