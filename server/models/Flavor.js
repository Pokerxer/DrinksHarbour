// models/Flavor.js - Enhanced Version

const mongoose = require('mongoose');
const { Schema } = mongoose;

const flavorSchema = new Schema(
  {
    // ════════════════════════════════════════════════════════════
    // CORE IDENTITY
    // ════════════════════════════════════════════════════════════
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: [2, 'Flavor name too short'],
      maxlength: [60, 'Flavor name too long'],
      // index: true removed - unique:true already creates index
    },
    
    value: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      // index: true removed - unique:true already creates index
    },
    
    displayName: {
      type: String,
      trim: true,
      maxlength: 80,
      // Alternative display name
    },

    // ════════════════════════════════════════════════════════════
    // CLASSIFICATION
    // ════════════════════════════════════════════════════════════
    category: {
      type: String,
      enum: [
        'fruit', 'citrus', 'berry', 'tropical', 'stone_fruit', 'orchard_fruit',
        'spice', 'herb', 'floral', 'vegetable',
        'sweet', 'dessert', 'chocolate', 'candy',
        'nut', 'grain', 'cereal',
        'wood', 'oak', 'smoke', 'tobacco',
        'earth', 'mineral', 'petrol',
        'dairy', 'cream', 'butter',
        'coffee', 'tea', 'roasted',
        'chemical', 'medicinal', 'industrial',
        'animal', 'leather', 'game',
        'other',
      ],
      required: true,
      index: true,
    },
    
    subCategory: {
      type: String,
      enum: [
        // Fruits
        'red_fruit', 'black_fruit', 'stone_fruit', 'citrus_fruit',
        'tropical_fruit', 'dried_fruit', 'cooked_fruit',
        
        // Spices & Herbs
        'baking_spice', 'hot_spice', 'fresh_herb', 'dried_herb',
        
        // Sweet
        'caramel', 'vanilla', 'chocolate', 'toffee', 'honey',
        
        // Wood & Smoke
        'oak', 'cedar', 'pine', 'charred', 'smoky', 'peaty',
        
        // Nuts
        'tree_nut', 'seed',
        
        // Other
        'other',
      ],
    },
    
    intensity: {
      type: String,
      enum: ['subtle', 'mild', 'moderate', 'pronounced', 'intense'],
      default: 'moderate',
    },

    // ════════════════════════════════════════════════════════════
    // DESCRIPTORS
    // ════════════════════════════════════════════════════════════
    description: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    
    synonyms: [String],
    
    relatedFlavors: [{
      type: Schema.Types.ObjectId,
      ref: 'Flavor',
    }],
    
    complementaryFlavors: [{
      type: Schema.Types.ObjectId,
      ref: 'Flavor',
    }],
    
    contrastingFlavors: [{
      type: Schema.Types.ObjectId,
      ref: 'Flavor',
    }],

    // ════════════════════════════════════════════════════════════
    // VISUAL & UI
    // ════════════════════════════════════════════════════════════
    color: {
      type: String,
      required: true,
      match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      default: '#6B7280',
    },
    
    icon: String,
    emoji: String,
    
    image: {
      url: String,
      publicId: String,
      alt: String,
    },

    // ════════════════════════════════════════════════════════════
    // BEVERAGE CONTEXT
    // ════════════════════════════════════════════════════════════
    commonIn: {
      beverageTypes: [{
        type: String,
        enum: [
          'beer', 'wine', 'spirit', 'liqueur', 'cocktail',
          'coffee', 'tea', 'juice', 'other',
        ],
      }],
      specificTypes: [String],
      // e.g., ["Single Malt Whisky", "Cabernet Sauvignon", "IPA"]
    },
    
    flavorWheel: {
      primary: String,   // Primary flavor wheel category
      secondary: String, // Secondary flavor wheel category
      tertiary: String,  // Tertiary flavor wheel category
    },

    // ════════════════════════════════════════════════════════════
    // POPULARITY & USAGE
    // ════════════════════════════════════════════════════════════
    productCount: {
      type: Number,
      default: 0,
      index: true,
    },
    
    isPopular: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    isTrending: {
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
    
    searchVolume: {
      type: Number,
      default: 0,
      // Number of searches containing this flavor
    },
    
    viewCount: {
      type: Number,
      default: 0,
    },

    // ════════════════════════════════════════════════════════════
    // SEASONAL & CONTEXTUAL
    // ════════════════════════════════════════════════════════════
    seasonal: {
      spring: { type: Boolean, default: false },
      summer: { type: Boolean, default: false },
      fall: { type: Boolean, default: false },
      winter: { type: Boolean, default: false },
    },
    
    peakSeasons: [String],
    
    occasions: [{
      type: String,
      enum: [
        'everyday', 'celebration', 'holiday', 'summer_party',
        'winter_warming', 'aperitif', 'digestif', 'pairing',
      ],
    }],

    // ════════════════════════════════════════════════════════════
    // PAIRING SUGGESTIONS
    // ════════════════════════════════════════════════════════════
    pairsWith: {
      foods: [String],
      // e.g., ["Grilled steak", "Dark chocolate", "Blue cheese"]
      
      beverages: [String],
      // e.g., ["Coffee", "Port wine", "Whisky"]
    },

    // ════════════════════════════════════════════════════════════
    // STATUS & MODERATION
    // ════════════════════════════════════════════════════════════
    status: {
      type: String,
      enum: ['active', 'pending', 'archived', 'rejected'],
      default: 'active',
      index: true,
    },
    
    isVerified: {
      type: Boolean,
      default: false,
      // Verified by experts/admins
    },
    
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    
    verifiedAt: Date,

    // ════════════════════════════════════════════════════════════
    // ADMIN & AUDIT
    // ════════════════════════════════════════════════════════════
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    
    source: {
      type: String,
      enum: ['admin', 'user_suggestion', 'import', 'ai_generated'],
      default: 'admin',
    },
    
    notes: {
      type: String,
      maxlength: 500,
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

flavorSchema.virtual('displayLabel').get(function () {
  return this.displayName || this.name;
});

flavorSchema.virtual('isActive').get(function () {
  return this.status === 'active';
});

// ════════════════════════════════════════════════════════════
// INDEXES (removed duplicates - name and value already have indexes from unique:true)
// ════════════════════════════════════════════════════════════

flavorSchema.index({ productCount: -1 });
flavorSchema.index({ category: 1, subCategory: 1 });
flavorSchema.index({ status: 1, isPopular: 1 });
flavorSchema.index({ popularityScore: -1 });
flavorSchema.index({ name: 'text', description: 'text' });

// ════════════════════════════════════════════════════════════
// METHODS
// ════════════════════════════════════════════════════════════

flavorSchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  const count = await Product.countDocuments({
    flavors: this._id,
    status: 'approved',
  });
  this.productCount = count;
  await this.save();
};

flavorSchema.methods.calculatePopularityScore = async function() {
  // Score based on product count, search volume, and views
  const productWeight = 0.5;
  const searchWeight = 0.3;
  const viewWeight = 0.2;
  
  const maxProducts = 100;
  const maxSearches = 1000;
  const maxViews = 5000;
  
  const productScore = Math.min(this.productCount / maxProducts, 1) * 100;
  const searchScore = Math.min(this.searchVolume / maxSearches, 1) * 100;
  const viewScore = Math.min(this.viewCount / maxViews, 1) * 100;
  
  this.popularityScore = 
    (productScore * productWeight) +
    (searchScore * searchWeight) +
    (viewScore * viewWeight);
  
  this.isPopular = this.popularityScore >= 60;
  await this.save();
};

const Flavor = mongoose.models.Flavor || mongoose.model('Flavor', flavorSchema);
module.exports = Flavor;