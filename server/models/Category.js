// models/Category.js - Updated with Comprehensive Enums

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const categorySchema = new Schema(
  {
    // ════════════════════════════════════════════════════════════
    // CORE IDENTITY
    // ════════════════════════════════════════════════════════════
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters'],
      maxlength: [100, 'Category name cannot exceed 100 characters'],
      index: true,
    },
    
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // index: true removed - unique:true already creates index
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },

    // ════════════════════════════════════════════════════════════
    // BEVERAGE CLASSIFICATION - UPDATED COMPREHENSIVE ENUMS
    // ════════════════════════════════════════════════════════════
    type: {
      type: String,
      enum: [
        // ALCOHOLIC BEVERAGES
        // Beer Categories
        'beer',  'cider',
        
        // Wine Categories
        'wine', 'red_wine', 'white_wine', 'rose_wine', 'sparkling_wine', 'champagne', 'fortified_wine', 'dessert_wine',
        
        // Spirit Categories
        'whiskey', 'scotch', 'bourbon', 'rye_whiskey', 'vodka', 'gin', 'rum', 
        'tequila', 'brandy', 'cognac', 'soju', 'baijiu', 'shochu', 'mezcal',
        
        // Other Alcoholic Categories
        'liqueur', 'aperitif', 'digestif', 'cocktail',
        
        // NON-ALCOHOLIC BEVERAGES
        'coffee', 'tea', 'juice', 'soda', 'water', 'milk', 'yogurt_drink',
        'soft_drink', 'dairy_alternatives', 'functional_drink', 'syrup', 'bitters',
        
        // ACCESSORIES & OTHER
        'glassware', 'bar_tools', 'accessories', 'gift_set', 'subscription', 'other'
      ],
      required: true,
      index: true,
    },
    
    subType: {
      type: String,
      trim: true,
      maxlength: 80,
      index: true,
    },
    
    alcoholCategory: {
      type: String,
      enum: ['alcoholic', 'non_alcoholic', 'low_alcohol', 'alcohol_free', 'mixed'],
      default: 'alcoholic',
      index: true,
    },

    // ════════════════════════════════════════════════════════════
    // DISPLAY & CONTENT
    // ════════════════════════════════════════════════════════════
    displayName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    
    shortDescription: {
      type: String,
      maxlength: 280,
      trim: true,
    },
    
    description: {
      type: String,
      maxlength: 2000,
      trim: true,
    },
    
    tagline: {
      type: String,
      maxlength: 150,
    },
    
    icon: {
      type: String,
    },
    
    color: {
      type: String,
      match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      default: '#6B7280',
    },

    // ════════════════════════════════════════════════════════════
    // MEDIA
    // ════════════════════════════════════════════════════════════
    featuredImage: {
      url: String,
      publicId: String,
      alt: String,
      width: Number,
      height: Number,
      format: String,
      isActive: { type: Boolean, default: true },
    },
    
    bannerImage: {
      url: String,
      publicId: String,
      alt: String,
      width: Number,
      height: Number,
      format: String,
    },
    
    thumbnailImage: {
      url: String,
      publicId: String,
      alt: String,
    },
    
    heroVideo: {
      url: String,
      type: { type: String, enum: ['youtube', 'vimeo', 'direct'] },
      thumbnail: String,
    },

    // ════════════════════════════════════════════════════════════
    // HIERARCHY & NAVIGATION
    // ════════════════════════════════════════════════════════════
    parent: {
      type: ObjectId,
      ref: 'Category',
      default: null,
      sparse: true,
      index: true,
    },
    
    subCategories: [{
      type: ObjectId,
      ref: 'Category',
    }],
    
    level: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    
    path: {
      type: String,
    },
    
    breadcrumb: [{
      name: String,
      slug: String,
      _id: ObjectId,
    }],

    // ════════════════════════════════════════════════════════════
    // VISIBILITY & STATUS
    // ════════════════════════════════════════════════════════════
    status: {
      type: String,
      enum: ['draft', 'published', 'archived', 'hidden', 'coming_soon'],
      default: 'draft',
      index: true,
    },
    
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    isTrending: {
      type: Boolean,
      default: false,
    },
    
    isPopular: {
      type: Boolean,
      default: false,
    },
    
    isNew: {
      type: Boolean,
      default: false,
    },
    
    displayOrder: {
      type: Number,
      default: 999,
      index: true,
    },
    
    showInMenu: {
      type: Boolean,
      default: true,
    },
    
    showOnHomepage: {
      type: Boolean,
      default: false,
    },

    // ════════════════════════════════════════════════════════════
    // SEO & METADATA
    // ════════════════════════════════════════════════════════════
    metaTitle: {
      type: String,
      maxlength: 100,
    },
    
    metaDescription: {
      type: String,
      maxlength: 320,
    },
    
    metaKeywords: [String],
    
    canonicalUrl: String,
    
    ogImage: String,
    twitterImage: String,
    
    structuredData: {
      type: Schema.Types.Mixed,
    },

    // ════════════════════════════════════════════════════════════
    // STATISTICS & ANALYTICS
    // ════════════════════════════════════════════════════════════
    productCount: {
      type: Number,
      default: 0,
      index: true,
    },
    
    activeProductCount: {
      type: Number,
      default: 0,
      index: true,
    },
    
    tenantPresenceCount: {
      type: Number,
      default: 0,
    },
    
    totalRevenue: {
      type: Number,
      default: 0,
    },
    
    totalSales: {
      type: Number,
      default: 0,
    },
    
    averageProductPrice: {
      type: Number,
      default: 0,
    },
    
    viewCount: {
      type: Number,
      default: 0,
    },
    
    clickCount: {
      type: Number,
      default: 0,
    },
    
    conversionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    popularityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // ════════════════════════════════════════════════════════════
    // FILTERING & FACETS
    // ════════════════════════════════════════════════════════════
    availableFilters: {
      brands: [{ type: ObjectId, ref: 'Brand' }],
      priceRanges: [{
        label: String,
        min: Number,
        max: Number,
      }],
      abvRanges: [{
        label: String,
        min: Number,
        max: Number,
      }],
      origins: [String],
      sizes: [String],
    },
    
    defaultSort: {
      type: String,
      enum: ['relevance', 'price_asc', 'price_desc', 'popularity', 'newest', 'name'],
      default: 'relevance',
    },

    // ════════════════════════════════════════════════════════════
    // PROMOTIONAL & SEASONAL
    // ════════════════════════════════════════════════════════════
    seasonal: {
      spring: { type: Boolean, default: false },
      summer: { type: Boolean, default: false },
      fall: { type: Boolean, default: false },
      winter: { type: Boolean, default: false },
    },
    
    occasions: [{
      type: String,
      enum: [
        'christmas', 'new_year', 'valentines', 'easter', 'halloween',
        'thanksgiving', 'black_friday', 'cyber_monday',
        'wedding', 'birthday', 'anniversary', 'graduation',
        'corporate_event', 'party', 'celebration',
      ],
    }],
    
    promotionalBanner: {
      text: String,
      link: String,
      startDate: Date,
      endDate: Date,
      isActive: Boolean,
    },

    // ════════════════════════════════════════════════════════════
    // CONTENT SECTIONS
    // ════════════════════════════════════════════════════════════
    contentSections: [{
      title: String,
      content: String,
      image: String,
      order: Number,
      type: { type: String, enum: ['text', 'image', 'video', 'products', 'brands'] },
    }],
    
    featuredBrands: [{
      type: ObjectId,
      ref: 'Brand',
    }],
    
    relatedCategories: [{
      type: ObjectId,
      ref: 'Category',
    }],

    // ════════════════════════════════════════════════════════════
    // ADMIN & AUDIT
    // ════════════════════════════════════════════════════════════
    createdBy: {
      type: ObjectId,
      ref: 'User',
    },
    
    updatedBy: {
      type: ObjectId,
      ref: 'User',
    },
    
    publishedAt: Date,
    publishedBy: {
      type: ObjectId,
      ref: 'User',
    },
    
    notes: {
      type: String,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ════════════════════════════════════════════════════════════
// VIRTUALS
// ════════════════════════════════════════════════════════════

categorySchema.virtual('isTopLevel').get(function () {
  return !this.parent || this.level === 0;
});

categorySchema.virtual('hasChildren').get(function () {
  return this.subCategories && this.subCategories.length > 0;
});

categorySchema.virtual('isPublished').get(function () {
  return this.status === 'published';
});

categorySchema.virtual('url').get(function () {
  return `/categories/${this.slug}`;
});

// ════════════════════════════════════════════════════════════
// INDEXES
// ════════════════════════════════════════════════════════════

// categorySchema.index({ slug: 1, status: 1 });
// categorySchema.index({ type: 1, status: 1 });
// categorySchema.index({ parent: 1 });
// categorySchema.index({ status: 1, displayOrder: 1, isFeatured: -1 });
// categorySchema.index({ name: 'text', description: 'text', tagline: 'text' });
// categorySchema.index({ level: 1, parent: 1 });
// categorySchema.index({ alcoholCategory: 1, type: 1 });
// categorySchema.index({ isFeatured: 1, isPopular: 1, isTrending: 1 });
// categorySchema.index({ productCount: -1, activeProductCount: -1 });

// ════════════════════════════════════════════════════════════
// METHODS
// ════════════════════════════════════════════════════════════

categorySchema.methods.getFullPath = async function() {
  if (!this.parent) return this.name;
  
  const Category = mongoose.model('Category');
  const ancestors = [];
  let current = this;
  
  while (current.parent) {
    current = await Category.findById(current.parent);
    if (!current) break;
    ancestors.unshift(current.name);
  }
  
  return [...ancestors, this.name].join(' > ');
};

categorySchema.methods.updateStats = async function() {
  const Product = mongoose.model('Product');
  
  const stats = await Product.aggregate([
    { $match: { category: this._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        avgPrice: { $avg: '$averageSellingPrice' },
      }
    }
  ]);
  
  if (stats.length > 0) {
    this.productCount = stats[0].total;
    this.activeProductCount = stats[0].active;
    this.averageProductPrice = stats[0].avgPrice;
    await this.save();
  }
};

categorySchema.methods.incrementViewCount = async function() {
  this.viewCount = (this.viewCount || 0) + 1;
  await this.save();
};

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
module.exports = Category;