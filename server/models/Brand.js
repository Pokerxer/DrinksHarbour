// models/Brand.js - Enhanced Version

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const brandSchema = new Schema(
  {
    // ════════════════════════════════════════════════════════════
    // CORE IDENTITY
    // ════════════════════════════════════════════════════════════
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: [2, 'Brand name too short'],
      maxlength: [120, 'Brand name too long'],
      // index: true removed - unique:true already creates index
    },
    
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      // index: true removed - unique:true already creates index
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    
    legalName: {
      type: String,
      trim: true,
      maxlength: 200,
      // Official registered business name
    },
    
    tradingAs: [String],
    // Alternative names, abbreviations

    // ════════════════════════════════════════════════════════════
    // BRAND INFO
    // ════════════════════════════════════════════════════════════
    description: {
      type: String,
      maxlength: 2000,
      trim: true,
    },
    
    shortDescription: {
      type: String,
      maxlength: 280,
      trim: true,
    },
    
    tagline: {
      type: String,
      maxlength: 150,
    },
    
    story: {
      type: String,
      maxlength: 5000,
      // Brand heritage and story
    },
    
    founded: {
      type: Number,
      min: 1000,
      max: new Date().getFullYear(),
    },
    
    founderName: String,

    // ════════════════════════════════════════════════════════════
    // BRAND TYPE & CATEGORY
    // ════════════════════════════════════════════════════════════
    brandType: {
      type: String,
      enum: [
        'brewery', 'microbrewery', 'craft_brewery', 'brewpub',
        'winery', 'vineyard', 'wine_estate',
        'distillery', 'craft_distillery', 'spirits_producer',
        'beverage_company', 'drinks_manufacturer',
        'coffee_roaster', 'tea_company',
        'soft_drink_manufacturer', 'water_brand',
        'importer', 'distributor',
        'private_label', 'house_brand',
        'luxury', 'premium', 'mass_market',
        'other', 'champagne_house', 'coffee_company', 'juice_company'
      ],
      index: true,
    },
    
    primaryCategory: {
      type: String,
      enum: [
        'beer', 'wine', 'spirits', 'liqueurs', 'cocktails',
        'coffee', 'tea', 'soft_drinks', 'water', 'juice',
        'energy_drinks', 'sports_drinks', 'mixers',
        'accessories', 'multi_category', 'other', 'champagne', 
      ],
      index: true,
    },
    
    specializations: [{
      type: String,
      // e.g., "Single Malt Whisky", "Organic Wines", "Craft Gin"
    }],

    // ════════════════════════════════════════════════════════════
    // ORIGIN & LOCATION
    // ════════════════════════════════════════════════════════════
    countryOfOrigin: {
      type: String,
      trim: true,
      maxlength: 100,
      index: true,
    },
    
    region: {
      type: String,
      trim: true,
      maxlength: 100,
      index: true,
      // e.g., "Speyside", "Bordeaux", "Bavaria"
    },
    
    headquarters: {
      city: String,
      state: String,
      country: String,
      address: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    
    productionFacilities: [{
      name: String,
      location: String,
      type: { type: String, enum: ['brewery', 'distillery', 'winery', 'factory', 'warehouse'] },
    }],

    // ════════════════════════════════════════════════════════════
    // MEDIA & BRANDING
    // ════════════════════════════════════════════════════════════
    logo: {
      url: String,
      publicId: String,
      alt: String,
      width: Number,
      height: Number,
      format: String,
    },
    
    logoVariants: {
      primary: String,
      secondary: String,
      white: String,
      black: String,
      icon: String,
    },
    
    featuredImage: {
      url: String,
      publicId: String,
      alt: String,
    },
    
    bannerImage: {
      url: String,
      publicId: String,
      alt: String,
    },
    
    gallery: [{
      url: String,
      publicId: String,
      alt: String,
      caption: String,
      order: Number,
    }],
    
    brandColors: {
      primary: String,
      secondary: String,
      accent: String,
    },
    
    brandVideo: {
      url: String,
      type: { type: String, enum: ['youtube', 'vimeo', 'direct'] },
      thumbnail: String,
      title: String,
    },

    // ════════════════════════════════════════════════════════════
    // CONTACT & SOCIAL
    // ════════════════════════════════════════════════════════════
    website: {
      type: String,
      trim: true,
      match: /^https?:\/\//,
    },
    
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    
    phone: String,
    
    socialMedia: {
      facebook: String,
      instagram: String,
      twitter: String,
      youtube: String,
      linkedin: String,
      tiktok: String,
      pinterest: String,
    },

    // ════════════════════════════════════════════════════════════
    // CERTIFICATIONS & STANDARDS
    // ════════════════════════════════════════════════════════════
    certifications: [{
      name: String,
      issuedBy: String,
      certificateNumber: String,
      validFrom: Date,
      validUntil: Date,
      documentUrl: String,
    }],
    
    awards: [{
      title: String,
      organization: String,
      year: Number,
      category: String,
      medal: { type: String, enum: ['gold', 'silver', 'bronze', 'platinum', 'double_gold'] },
      description: String,
    }],
    
    qualityStandards: [{
      type: String,
      enum: [
        'organic', 'fair_trade', 'sustainable', 'carbon_neutral',
        'bCorps', 'rainforest_alliance', 'utz_certified',
        'kosher', 'halal', 'vegan_certified',
        'iso_certified', 'haccp', 'gmp',
      ],
    }],

    // ════════════════════════════════════════════════════════════
    // STATISTICS & METRICS
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
    
    followersCount: {
      type: Number,
      default: 0,
    },
    
    popularityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    
    marketShare: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // ════════════════════════════════════════════════════════════
    // VISIBILITY & STATUS
    // ════════════════════════════════════════════════════════════
    status: {
      type: String,
      enum: ['active', 'pending', 'archived', 'inactive', 'suspended'],
      default: 'active',
      index: true,
    },
    
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    isPopular: {
      type: Boolean,
      default: false,
    },
    
    isTrending: {
      type: Boolean,
      default: false,
    },
    
    isPremium: {
      type: Boolean,
      default: false,
    },
    
    isCraft: {
      type: Boolean,
      default: false,
    },
    
    isLocal: {
      type: Boolean,
      default: false,
    },
    
    displayOrder: {
      type: Number,
      default: 999,
    },

    // ════════════════════════════════════════════════════════════
    // VERIFICATION
    // ════════════════════════════════════════════════════════════
    verified: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    verifiedBy: {
      type: ObjectId,
      ref: 'User',
      sparse: true,
    },
    
    verifiedAt: Date,
    
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
    },
    
    verificationDocuments: [{
      type: String,
      description: String,
      url: String,
      uploadedAt: Date,
    }],
    
    claimRequests: [{
      user: { type: ObjectId, ref: 'User' },
      status: { type: String, enum: ['pending', 'approved', 'rejected'] },
      requestedAt: Date,
      reviewedAt: Date,
      reviewedBy: { type: ObjectId, ref: 'User' },
      notes: String,
    }],

    // ════════════════════════════════════════════════════════════
    // SEO & METADATA
    // ════════════════════════════════════════════════════════════
    metaTitle: String,
    metaDescription: String,
    metaKeywords: [String],
    canonicalUrl: String,
    
    structuredData: {
      type: Schema.Types.Mixed,
      // JSON-LD for rich snippets
    },

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
    
    owner: {
      type: ObjectId,
      ref: 'User',
      // Brand owner/manager
    },
    
    managedBy: [{
      type: ObjectId,
      ref: 'User',
    }],
    
    notes: {
      type: String,
      maxlength: 2000,
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

brandSchema.virtual('isActive').get(function () {
  return this.status === 'active';
});

brandSchema.virtual('age').get(function () {
  if (!this.founded) return null;
  return new Date().getFullYear() - this.founded;
});

brandSchema.virtual('url').get(function () {
  return `/brands/${this.slug}`;
});

// ════════════════════════════════════════════════════════════
// INDEXES (removed duplicate - slug already has index from unique:true)
// ════════════════════════════════════════════════════════════

brandSchema.index({ name: 'text', description: 'text', tagline: 'text' });
brandSchema.index({ countryOfOrigin: 1, region: 1 });
brandSchema.index({ isFeatured: -1, productCount: -1 });
brandSchema.index({ verified: 1, status: 1 });
brandSchema.index({ primaryCategory: 1, brandType: 1 });
brandSchema.index({ popularityScore: -1 });
brandSchema.index({ isPopular: 1, isTrending: 1, isPremium: 1 });

// ════════════════════════════════════════════════════════════
// METHODS
// ════════════════════════════════════════════════════════════

brandSchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  const stats = await Product.aggregate([
    { $match: { brand: this._id } },
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

brandSchema.methods.incrementViewCount = async function() {
  this.viewCount = (this.viewCount || 0) + 1;
  await this.save();
};

brandSchema.methods.calculatePopularityScore = async function() {
  const productWeight = 0.3;
  const salesWeight = 0.3;
  const viewWeight = 0.2;
  const socialWeight = 0.2;
  
  const maxProducts = 50;
  const maxSales = 10000;
  const maxViews = 50000;
  const maxFollowers = 100000;
  
  const productScore = Math.min(this.activeProductCount / maxProducts, 1) * 100;
  const salesScore = Math.min(this.totalSales / maxSales, 1) * 100;
  const viewScore = Math.min(this.viewCount / maxViews, 1) * 100;
  const socialScore = Math.min(this.followersCount / maxFollowers, 1) * 100;
  
  this.popularityScore = 
    (productScore * productWeight) +
    (salesScore * salesWeight) +
    (viewScore * viewWeight) +
    (socialScore * socialWeight);
  
  this.isPopular = this.popularityScore >= 60;
  await this.save();
};

const Brand = mongoose.models.Brand || mongoose.model('Brand', brandSchema);
module.exports = Brand;