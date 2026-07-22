// models/SubCategory.js - Updated with Comprehensive Enums

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const subCategorySchema = new Schema(
  {
    // ════════════════════════════════════════════════════════════
    // CORE IDENTITY
    // ════════════════════════════════════════════════════════════
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'SubCategory name must be at least 2 characters'],
      maxlength: [100, 'SubCategory name cannot exceed 100 characters'],
      index: true,
    },
    
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },

    // ════════════════════════════════════════════════════════════
    // PARENT RELATIONSHIP
    // ════════════════════════════════════════════════════════════
    parent: {
      type: ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    
    parentPath: {
      type: String,
    },

    // ════════════════════════════════════════════════════════════
    // BEVERAGE CLASSIFICATION - COMPREHENSIVE UPDATED ENUMS
    // ════════════════════════════════════════════════════════════
    type: {
      type: String,
      trim: true,
      maxlength: 100,
      index: true,
    },
    
    subType: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    
    style: {
      type: String,
      enum: [
        'traditional', 'modern', 'craft', 'artisanal', 'premium', 'luxury', 'budget', 'mid_range',
        'classic', 'innovative', 'experimental', 'organic', 'natural', 'biodynamic',
      ],
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
      maxlength: 20000,
      trim: true,
    },
    
    tagline: {
      type: String,
      maxlength: 150,
    },
    
    icon: String,
    
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
    
    thumbnailImage: {
      url: String,
      publicId: String,
      alt: String,
    },
    
    bannerImage: {
      url: String,
      publicId: String,
      alt: String,
    },

    // ════════════════════════════════════════════════════════════
    // CHARACTERISTICS
    // ════════════════════════════════════════════════════════════
    characteristics: {
      abvRange: {
        min: Number,
        max: Number,
      },
      colorProfile: String,
      bodyStyle: {
        type: String,
        enum: ['light', 'light_medium', 'medium', 'medium_full', 'full', 'very_full', 'light_full', 'varies']
      },
      sweetnessLevel: {
        type: String,
        enum: ['bone_dry', 'dry', 'off_dry', 'dry_off_dry', 'medium_dry', 'medium_sweet', 'sweet', 'very_sweet', 'semi_sweet', 'varies', 'brut', 'extra_brut', 'brut_nature', 'demi_sec', 'sec', 'doux', 'zero']
      },
      bitterness: {
        type: String,
        enum: ['none', 'low', 'medium', 'high', 'very_high', 'varies']
      },
      acidity: {
        type: String,
        enum: ['low', 'medium_low', 'medium', 'medium_high', 'high', 'varies']
      },
      tannins: {
        type: String,
        enum: ['none', 'low', 'low_medium', 'medium', 'medium_high', 'high', 'very_high', 'varies']
      },
      carbonation: {
        type: String,
        enum: ['none', 'low', 'low_medium', 'medium', 'medium_high', 'high', 'very_high', 'varies', 'very_low',
          'fine_persistent', 'fine_elegant', 'fine', 'coarse_vigorous',
          'creamy', 'mousse', 'lively', 'gentle', 'vigorous', 'aggressive', 'effervescent', 'fizzy', 'bubbly', 'sparkling',
          'champagne_like', 'cider_like', 'beer_like', 'wine_like', 'cocktail_like', 'mixed',
          'lively_bubbles', 'fine_bubbles', 'creamy_bubbles', 'light_frothy',
          'still', 'gentle_frizzante', 'fully_sparkling', 'frizzante'
        ]
      },
    },
    
    typicalFlavors: [String],
    commonPairings: [String],

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
    
    displayOrder: {
      type: Number,
      default: 999,
      index: true,
    },
    
    showInMenu: {
      type: Boolean,
      default: true,
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

    // Keyword-rich H1 heading (SEO "3 Kings" — falls back to name when unset)
    seoH1: {
      type: String,
      maxlength: 80,
    },

    canonicalUrl: String,

    // ════════════════════════════════════════════════════════════
    // STATISTICS
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
    
    viewCount: {
      type: Number,
      default: 0,
    },
    
    popularityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // ════════════════════════════════════════════════════════════
    // SEASONAL & PROMOTIONAL
    // ════════════════════════════════════════════════════════════
    seasonal: {
      spring: { type: Boolean, default: false },
      summer: { type: Boolean, default: false },
      fall: { type: Boolean, default: false },
      winter: { type: Boolean, default: false },
    },
    
    peakSeasons: [String],

    // ════════════════════════════════════════════════════════════
    // RELATED CONTENT
    // ════════════════════════════════════════════════════════════
    relatedSubCategories: [{
      type: ObjectId,
      ref: 'SubCategory',
    }],
    
    featuredBrands: [{
      type: ObjectId,
      ref: 'Brand',
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

subCategorySchema.virtual('isPublished').get(function () {
  return this.status === 'published';
});

subCategorySchema.virtual('url').get(function () {
  return `/subcategories/${this.slug}`;
});

// ════════════════════════════════════════════════════════════
// INDEXES
// ════════════════════════════════════════════════════════════

subCategorySchema.index({ parent: 1, slug: 1 }, { unique: true });
subCategorySchema.index({ parent: 1, status: 1, displayOrder: 1 });
subCategorySchema.index({ type: 1, subType: 1, status: 1 });
subCategorySchema.index({ slug: 1, status: 1 });
subCategorySchema.index({ name: 'text', description: 'text' });
subCategorySchema.index({ isFeatured: 1, isPopular: 1, isTrending: 1 });
subCategorySchema.index({ productCount: -1, activeProductCount: -1 });

// ════════════════════════════════════════════════════════════
// METHODS
// ════════════════════════════════════════════════════════════

subCategorySchema.methods.updateStats = async function() {
  const Product = mongoose.model('Product');
  
  const stats = await Product.aggregate([
    { $match: { subCategory: this._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
      }
    }
  ]);
  
  if (stats.length > 0) {
    this.productCount = stats[0].total;
    this.activeProductCount = stats[0].active;
    await this.save();
  }
};

subCategorySchema.methods.incrementViewCount = async function() {
  this.viewCount = (this.viewCount || 0) + 1;
  await this.save();
};

const SubCategory = mongoose.models.SubCategory || mongoose.model('SubCategory', subCategorySchema);
module.exports = SubCategory;