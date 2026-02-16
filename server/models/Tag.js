// models/Tag.js - Enhanced Version

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const tagSchema = new Schema(
  {
    // ════════════════════════════════════════════════════════════
    // CORE IDENTITY
    // ════════════════════════════════════════════════════════════
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      minlength: 2,
      maxlength: 60,
      index: true,
    },
    
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    
    displayName: {
      type: String,
      trim: true,
      maxlength: 80,
      // Capitalized or formatted display name
    },

    // ════════════════════════════════════════════════════════════
    // CATEGORIZATION
    // ════════════════════════════════════════════════════════════
    type: {
      type: String,
      enum: [
        // Flavor & Taste
        'flavor', 'taste_profile', 'aroma',
        
        // Style & Method
        'style', 'brewing_method', 'production_method', 'aging_method',
        
        // Occasion & Use
        'occasion', 'event', 'season', 'time_of_day',
        'pairing', 'serving_suggestion',
        
        // Dietary & Health
        'dietary', 'health', 'allergen', 'nutrition',
        
        // Origin & Geography
        'region', 'country', 'terroir', 'appellation',
        
        // Marketing & Trend
        'trend', 'lifestyle', 'premium', 'craft',
        
        // Award & Recognition
        'award', 'certification', 'rating',
        
        // Product Attribute
        'attribute', 'feature', 'characteristic',
        
        // User Experience
        'experience', 'mood', 'ambiance',
        
        // General
        'general', 'other',
      ],
      default: 'general',
      index: true,
    },
    
    category: {
      type: String,
      enum: [
        'alcoholic', 'non_alcoholic', 'beverage', 'accessory',
        'seasonal', 'promotional', 'lifestyle', 'other',
      ],
      index: true,
    },

    // ════════════════════════════════════════════════════════════
    // DESCRIPTION
    // ════════════════════════════════════════════════════════════
    description: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    
    shortDescription: {
      type: String,
      maxlength: 150,
      trim: true,
    },
    
    synonyms: [String],
    
    relatedTags: [{
      type: ObjectId,
      ref: 'Tag',
    }],

    // ════════════════════════════════════════════════════════════
    // VISUAL & UI
    // ════════════════════════════════════════════════════════════
    color: {
      type: String,
      match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      default: '#6B7280',
    },
    
    backgroundColor: {
      type: String,
      match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    },
    
    textColor: {
      type: String,
      match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    },
    
    icon: String,
    emoji: String,
    
    image: {
      url: String,
      publicId: String,
      alt: String,
    },
    
    badgeStyle: {
      type: String,
      enum: ['solid', 'outline', 'subtle', 'gradient'],
      default: 'solid',
    },

    // ════════════════════════════════════════════════════════════
    // USAGE & POPULARITY
    // ════════════════════════════════════════════════════════════
    productCount: {
      type: Number,
      default: 0,
      index: true,
    },
    
    activeProductCount: {
      type: Number,
      default: 0,
    },
    
    isPopular: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    isTrending: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    isNewArrival: {
      type: Boolean,
      default: false,
    },
    
    popularityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    
    trendScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    searchBoost: {
      type: Number,
      default: 1.0,
      min: 0.1,
      max: 5.0,
      // Search ranking boost multiplier
    },
    
    usageCount: {
      type: Number,
      default: 0,
      // How many times tag has been applied
    },
    
    clickCount: {
      type: Number,
      default: 0,
      // How many times tag has been clicked
    },
    
    searchCount: {
      type: Number,
      default: 0,
      // How many times tag appears in searches
    },

    // ════════════════════════════════════════════════════════════
    // SEASONAL & TEMPORAL
    // ════════════════════════════════════════════════════════════
    seasonal: {
      spring: { type: Boolean, default: false },
      summer: { type: Boolean, default: false },
      fall: { type: Boolean, default: false },
      winter: { type: Boolean, default: false },
    },
    
    timeRelevant: {
      startDate: Date,
      endDate: Date,
      // For time-limited tags (e.g., "Black Friday 2026")
    },
    
    isTimeSensitive: {
      type: Boolean,
      default: false,
    },

    // ════════════════════════════════════════════════════════════
    // FILTERING & FACETS
    // ════════════════════════════════════════════════════════════
    isFilterable: {
      type: Boolean,
      default: true,
      // Should this tag appear in filter UI?
    },
    
    isSearchable: {
      type: Boolean,
      default: true,
      // Should this tag be searchable?
    },
    
    showInAutocomplete: {
      type: Boolean,
      default: true,
    },
    
    filterGroup: {
      type: String,
      // Group tags in filter UI (e.g., "Dietary", "Style", "Origin")
    },
    
    displayOrder: {
      type: Number,
      default: 999,
    },

    // ════════════════════════════════════════════════════════════
    // SEO & METADATA
    // ════════════════════════════════════════════════════════════
    metaTitle: String,
    metaDescription: String,
    canonicalUrl: String,
    
    seoKeywords: [String],

    // ════════════════════════════════════════════════════════════
    // ANALYTICS
    // ════════════════════════════════════════════════════════════
    analytics: {
      totalRevenue: { type: Number, default: 0 },
      totalSales: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
    },
    
    insights: {
      peakUsageMonth: String,
      growthRate: Number,
      demographics: Schema.Types.Mixed,
    },

    // ════════════════════════════════════════════════════════════
    // STATUS & MODERATION
    // ════════════════════════════════════════════════════════════
    status: {
      type: String,
      enum: ['active', 'pending', 'rejected', 'archived', 'deprecated'],
      default: 'active',
      index: true,
    },
    
    isVerified: {
      type: Boolean,
      default: false,
    },
    
    verifiedBy: {
      type: ObjectId,
      ref: 'User',
    },
    
    verifiedAt: Date,
    
    moderationNotes: String,

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
    
    source: {
      type: String,
      enum: ['admin', 'user_suggestion', 'import', 'ai_generated', 'system'],
      default: 'admin',
    },
    
    approvedBy: {
      type: ObjectId,
      ref: 'User',
    },
    
    approvedAt: Date,
    
    rejectedReason: String,
    
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

tagSchema.virtual('displayLabel').get(function () {
  return this.displayName || this.name.charAt(0).toUpperCase() + this.name.slice(1);
});

tagSchema.virtual('isActive').get(function () {
  return this.status === 'active';
});

tagSchema.virtual('url').get(function () {
  return `/tags/${this.slug}`;
});

// ════════════════════════════════════════════════════════════
// INDEXES
// ════════════════════════════════════════════════════════════

tagSchema.index({ name: 1 });
tagSchema.index({ slug: 1 });
tagSchema.index({ type: 1, productCount: -1 });
tagSchema.index({ status: 1, isPopular: 1 });
tagSchema.index({ popularityScore: -1 });
tagSchema.index({ trendScore: -1 });
tagSchema.index({ name: 'text', description: 'text' });
tagSchema.index({ isFilterable: 1, type: 1 });
tagSchema.index({ category: 1, type: 1 });

// ════════════════════════════════════════════════════════════
// METHODS
// ════════════════════════════════════════════════════════════

tagSchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  const count = await Product.countDocuments({
    tags: this._id,
    status: 'approved',
  });
  this.productCount = count;
  this.activeProductCount = count;
  await this.save();
};

tagSchema.methods.incrementUsage = async function() {
  this.usageCount = (this.usageCount || 0) + 1;
  await this.save();
};

tagSchema.methods.incrementClick = async function() {
  this.clickCount = (this.clickCount || 0) + 1;
  await this.save();
};

tagSchema.methods.calculatePopularityScore = async function() {
  const productWeight = 0.4;
  const clickWeight = 0.3;
  const searchWeight = 0.3;
  
  const maxProducts = 100;
  const maxClicks = 1000;
  const maxSearches = 1000;
  
  const productScore = Math.min(this.productCount / maxProducts, 1) * 100;
  const clickScore = Math.min(this.clickCount / maxClicks, 1) * 100;
  const searchScore = Math.min(this.searchCount / maxSearches, 1) * 100;
  
  this.popularityScore = 
    (productScore * productWeight) +
    (clickScore * clickWeight) +
    (searchScore * searchWeight);
  
  this.isPopular = this.popularityScore >= 60;
  await this.save();
};

const Tag = mongoose.models.Tag || mongoose.model('Tag', tagSchema);
module.exports = Tag;