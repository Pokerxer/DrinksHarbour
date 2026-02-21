// models/Product.js - Enhanced Version

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

// Reusable MediaItem Schema
const MediaItemSchema = new Schema({
  url: { type: String, required: true },
  alt: String,
  isPrimary: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  publicId: String, // Cloudinary
  resourceType: { type: String, enum: ['image', 'video'], default: 'image' },
  format: String, // jpg, png, webp, mp4
  width: Number,
  height: Number,
  size: Number, // bytes
  thumbnail: String, // Cloudinary thumbnail URL
  uploadedBy: { type: ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  tags: [String],
  caption: String,
}, { _id: false });

// Enhanced Product Schema
const productSchema = new Schema(
  {
    // ════════════════════════════════════════════════════════════
    // IDENTIFICATION & DEDUPLICATION
    // ════════════════════════════════════════════════════════════
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      // index: true removed - unique:true already creates index
      trim: true,
    },
    barcode: {
      type: String,
      sparse: true,
      unique: true,
      // index: true removed - unique:true already creates index
      trim: true,
    },
    gtin: {
      type: String,
      sparse: true,
      index: true,
      trim: true,
    },
    upc: {
      type: String,
      sparse: true,
      trim: true,
    },
    sku: {
      type: String,
      sparse: true,
      trim: true,
    },

    // ════════════════════════════════════════════════════════════
    // BEVERAGE-SPECIFIC CORE ATTRIBUTES
    // ════════════════════════════════════════════════════════════
    type: {
      type: String,
      enum: [
        // Alcoholic Beverages
        'beer',
        'lager',
        'ale',
        'stout',
        'porter',
        'ipa', // India Pale Ale
        'pilsner',
        'wheat_beer',
        'sour_beer',
        'craft_beer',
        
        // Wine
        'wine',
        'red_wine',
        'white_wine',
        'rose_wine',
        'sparkling_wine',
        'champagne',
        'prosecco',
        'fortified_wine',
        'dessert_wine',
        'orange_wine',
        'natural_wine',
        
        // Spirits
        'spirit',
        'whiskey',
        'whisky',
        'bourbon',
        'scotch',
        'rye_whiskey',
        'irish_whiskey',
        'japanese_whisky',
        'vodka',
        'gin',
        'rum',
        'white_rum',
        'dark_rum',
        'spiced_rum',
        'tequila',
        'mezcal',
        'brandy',
        'cognac',
        'armagnac',
        'grappa',
        'absinthe',
        'sake',
        'soju',
        
        // Liqueurs & Aperitifs
        'liqueur',
        'cream_liqueur',
        'coffee_liqueur',
        'fruit_liqueur',
        'herbal_liqueur',
        'amaretto',
        'vermouth',
        'aperitif',
        'digestif',
        'bitters',
        
        // Ready-to-Drink
        'cocktail_ready_to_drink',
        'premixed_cocktail',
        'hard_seltzer',
        'alcopop',
        'cooler',
        'cider',
        'perry', // Pear cider
        'mead',
        
        // Non-Alcoholic
        'non_alcoholic',
        'non_alcoholic_beer',
        'non_alcoholic_wine',
        'non_alcoholic_spirit',
        'mocktail',
        
        // Soft Drinks
        'soft_drink',
        'cola',
        'lemon_lime',
        'orange_soda',
        'root_beer',
        'ginger_ale',
        'ginger_beer',
        'tonic_water',
        'club_soda',
        'sparkling_water',
        'flavored_water',
        
        // Juices & Health
        'juice',
        'fruit_juice',
        'vegetable_juice',
        'smoothie',
        'kombucha',
        'probiotic_drink',
        
        // Hot Beverages
        'coffee',
        'espresso',
        'cold_brew',
        'instant_coffee',
        'tea',
        'green_tea',
        'black_tea',
        'herbal_tea',
        'oolong_tea',
        'white_tea',
        'chai',
        'matcha',
        'hot_chocolate',
        
        // Energy & Sports
        'energy_drink',
        'sports_drink',
        'protein_shake',
        'vitamin_drink',
        'electrolyte_drink',
        
        // Water
        'water',
        'mineral_water',
        'spring_water',
        'alkaline_water',
        'coconut_water',
        
        // Mixers
        'mixer',
        'simple_syrup',
        'grenadine',
        'bitters_mixer',
        
        // Milk & Dairy
        'milk',
        'dairy_milk',
        'plant_milk',
        'almond_milk',
        'oat_milk',
        'soy_milk',
        'coconut_milk',
        'milkshake',
        
        // Accessories & Others
        'accessory',
        'glassware',
        'bar_tool',
        'ice',
        'garnish',
        'snack',
        'gift_set',
        'subscription_box',
        'other',
      ],
      required: [true, 'Product type is required'],
      index: true,
    },
    
    subType: {
      type: String,
      trim: true,
      maxlength: 100,
      index: true,
      // Examples: 'Single Malt', 'Blended', 'Cask Strength', 'Small Batch'
    },
    
    isAlcoholic: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    
    abv: {
      type: Number,
      min: [0, 'ABV cannot be negative'],
      max: [100, 'ABV cannot exceed 100%'],
      index: true,
      // Alcohol By Volume percentage
    },
    
    proof: {
      type: Number,
      min: 0,
      max: 200,
      // US proof (ABV * 2)
    },
    
    volumeMl: {
      type: Number,
      min: 1,
      index: true,
    },
    
    standardSizes: [{
      type: String,
      enum: [
        // Wine & Champagne
        '10cl', '18.7cl', '20cl', '25cl', '37.5cl', '50cl',
        '75cl', '100cl', '150cl', // Magnum
        '300cl', // Jeroboam
        '450cl', // Rehoboam
        '600cl', // Methuselah
        '900cl', // Salmanazar
        '1200cl', // Balthazar
        '1500cl', // Nebuchadnezzar
        
        // Spirits
        '5cl', '10cl', '20cl', '35cl', '50cl', '70cl', '1L', '1.5L', '1.75L', '3L',
        
        // Beer & Cider
        '33cl', '35cl', '44cl', '50cl', '56.8cl', '66cl',
        'can-250ml', 'can-330ml', 'can-440ml','can-473ml', 'can-500ml', 'can-568ml',
        'bottle-275ml', 'bottle-330ml', 'bottle-355ml', 'bottle-500ml', 'bottle-600ml', 'bottle-750ml',
        'nip-50ml', 'half-pint', 'pint', 'quart',
        
        // Soft Drinks & Water
        '200ml', '250ml', '300ml', '330ml', '500ml', '600ml', '1L', '1.5L', '2L', '3L', '5L',
        
        // Kegs & Bulk
        '5L', '10L', '20L', '30L', '50L', 'keg', 'mini-keg', 'barrel',
        
        // Packs & Sets
        'pack-4', 'pack-6', 'pack-8', 'pack-12', 'pack-24', 'case-12', 'case-24',
        
        // Coffee & Tea
        '100g', '200g', '250g', '500g', '1kg', 'kg-0.5', 'kg-1',
        
        // Single Items
        'unit-single', 'unit', 'single-serve',
        
        // Sets
        'set-2', 'set-4', 'set-6', 'gift-set',

        // Miniatures
        'miniature-50ml', 'miniature-100ml', 'miniature-200ml', 'miniature-300ml', 'miniature-500ml',
      ],
    }],
    
    servingSize: {
      type: String,
      // e.g., '1 shot (44ml)', '1 glass (150ml)', '1 bottle'
    },
    
    servingsPerContainer: {
      type: Number,
      min: 1,
    },

    // ════════════════════════════════════════════════════════════
    // ORIGIN & PRODUCTION
    // ════════════════════════════════════════════════════════════
    originCountry: {
      type: String,
      index: true,
      trim: true,
    },
    
    region: {
      type: String,
      trim: true,
      index: true,
      // e.g., 'Bordeaux', 'Speyside', 'Napa Valley', 'Cognac'
    },
    
    appellation: {
      type: String,
      trim: true,
      // Protected designation of origin
    },
    
    producer: {
      type: String,
      trim: true,
      // Winery, Distillery, Brewery name
    },
    
    brand: {
      type: ObjectId,
      ref: 'Brand',
      index: true,
    },
    
    vintage: {
      type: Number,
      min: 1800,
      max: new Date().getFullYear() + 1,
      // For wines and aged spirits
    },
    
    age: {
      type: Number,
      min: 0,
      // Age statement in years
    },
    
    ageStatement: {
      type: String,
      // e.g., '12 Year Old', 'NAS (No Age Statement)', 'XO'
    },
    
    distilleryName: {
      type: String,
      trim: true,
    },
    
    breweryName: {
      type: String,
      trim: true,
    },
    
    wineryName: {
      type: String,
      trim: true,
    },
    
    productionMethod: {
      type: String,
      enum: [
        'traditional', 'modern', 'organic', 'biodynamic',
        'pot_still', 'column_still', 'continuous_still',
        'barrel_aged', 'cask_aged', 'oak_aged',
        'cold_brew', 'hot_brew', 'fermented',
        'distilled', 'triple_distilled', 'double_distilled',
        'filtered', 'unfiltered', 'chill_filtered',
        'blended', 'single_malt', 'single_grain',
        'handcrafted', 'small_batch', 'limited_edition',
      ],
    },
    
    caskType: {
      type: String,
      // e.g., 'Bourbon Barrel', 'Sherry Cask', 'Port Cask', 'Virgin Oak'
    },
    
    finish: {
      type: String,
      // Cask finish for spirits
    },

    // ════════════════════════════════════════════════════════════
    // CATEGORIZATION & TAXONOMY
    // ════════════════════════════════════════════════════════════
    category: {
      type: ObjectId,
      ref: 'Category',
      index: true,
    },
    
    subCategory: {
      type: ObjectId,
      ref: 'SubCategory',
      index: true,
    },
    
    tags: [{
      type: ObjectId,
      ref: 'Tag',
    }],
    
    flavors: [{
      type: ObjectId,
      ref: 'Flavor',
    }],
    
    style: {
      type: String,
      enum: [
        // Beer Styles
        'pale_ale', 'brown_ale', 'amber_ale', 'blonde_ale',
        'imperial_stout', 'milk_stout', 'oatmeal_stout',
        'american_ipa', 'english_ipa', 'double_ipa', 'session_ipa',
        'belgian_wit', 'hefeweizen', 'dunkelweizen',
        'gose', 'berliner_weisse', 'lambic', 'gueuze',
        
        // Wine Styles
        'dry', 'semi_dry', 'semi_sweet', 'sweet', 'off_dry',
        'light_bodied', 'medium_bodied', 'full_bodied',
        'crisp', 'creamy', 'oaked', 'unoaked',
        'sparkling', 'still', 'frizzante', 'petillant',
        
        // Spirit Styles
        'smooth', 'bold', 'complex', 'mellow',
        'peated', 'unpeated', 'smoky', 'non_smoky',
        
        // General
        'classic', 'modern', 'traditional', 'innovative',
        'artisanal', 'premium', 'luxury', 'budget_friendly',
      ],
    },

    // ════════════════════════════════════════════════════════════
    // DESCRIPTIVE CONTENT
    // ════════════════════════════════════════════════════════════
    shortDescription: {
      type: String,
      maxlength: 280,
      trim: true,
    },
    
    description: {
      type: String,
      maxlength: 5000,
      trim: true,
    },
    
    aiGeneratedDescription: {
      type: Boolean,
      default: false,
    },
    
    tastingNotes: {
      nose: [String], // For spirits
      aroma: [String],
      palate: [String],
      taste: [String],
      finish: [String],
      mouthfeel: [String],
      appearance: String,
      color: String,
    },
    
    flavorProfile: [{
      type: String,
      enum: [
        // Fruits
        'fruity', 'citrus', 'tropical', 'berry', 'stone_fruit',
        'apple', 'pear', 'peach', 'apricot', 'cherry', 'plum',
        'blackberry', 'raspberry', 'strawberry', 'blueberry',
        'lemon', 'lime', 'orange', 'grapefruit',
        'pineapple', 'mango', 'passion_fruit', 'guava',
        'melon', 'watermelon', 'fig', 'date', 'cassis', 'dark_cherry', 'red_berry',
        'cranberry', 'redcurrant', 'white_peach', 'nectarine', 'lychee', 'banana',
        
        // Sweet & Dessert
        'vanilla', 'caramel', 'toffee', 'butterscotch',
        'chocolate', 'dark_chocolate', 'cocoa',
        'honey', 'maple', 'molasses',
        'sweet', 'sugary', 'candy',
        
        // Spices & Herbs
        'spicy', 'spice', 'peppery', 'cinnamon', 'nutmeg', 'clove',
        'ginger', 'cardamom', 'anise', 'licorice',
        'herbal', 'mint', 'basil', 'thyme', 'rosemary',
        'sage', 'lavender', 'chamomile',
        
        // Floral
        'floral', 'rose', 'jasmine', 'elderflower',
        'honeysuckle', 'violet', 'hibiscus', 'blossom', 'perfumed',
        
        // Wood & Oak
        'oak', 'oaky', 'woody', 'cedar', 'pine',
        'sandalwood', 'tobacco', 'leather',
        'smooth', 
        
        // Nuts & Grain
        'nutty', 'almond', 'hazelnut', 'walnut', 'pecan', 'peanuts',
        'malty', 'grainy', 'biscuit', 'bread', 'toast',
        'coffee', 'espresso', 'roasted',

        // Earth & Mineral
        'earthy', 'mineral', 'slate', 'chalk', 'petrol',
        'mushroom', 'truffle', 'forest_floor', 'wet_stone', 'moss',
        
        // Smoke & Peat
        'smoky', 'peaty', 'charred', 'burnt', 'ash',
        'campfire', 'bacon', 'bbq', 'fire', 'medicinal',
        
        // Cream & Dairy
        'creamy', 'buttery', 'dairy', 'milky', 'yogurt', 'cheese', 'custard', 'cream',
        
        // Other
        'dry', 'bitter', 'sour', 'tart', 'acidic',
        'salty', 'savory', 'umami',
        'clean', 'crisp', 'fresh', 'light',
        'rich', 'full', 'complex', 'balanced',
        'elegant', 'delicate', 'bold', 'intense', 'subtle', 'zesty', 'lively',
        'refreshing', 'soft', 'round', 'velvety', 'tannic', 'astringent', 'bright', 'deep', 'medium',
      ],
    }],
    
    foodPairings: [{
      type: String,
      // e.g., 'Grilled steak', 'Seafood', 'Chocolate desserts'
    }],
    
    servingSuggestions: {
      temperature: String, // e.g., 'Chilled (4-6°C)', 'Room temperature'
      glassware: String, // e.g., 'Tumbler', 'Wine glass', 'Champagne flute'
      garnish: [String], // e.g., ['Lemon twist', 'Orange peel']
      mixers: [String], // Suggested mixers
    },

    // ════════════════════════════════════════════════════════════
    // DIETARY & ALLERGEN INFO
    // ════════════════════════════════════════════════════════════
    isDietary: {
      vegan: { type: Boolean, default: false },
      vegetarian: { type: Boolean, default: false },
      glutenFree: { type: Boolean, default: false },
      dairyFree: { type: Boolean, default: false },
      organic: { type: Boolean, default: false },
      kosher: { type: Boolean, default: false },
      halal: { type: Boolean, default: false },
      sugarFree: { type: Boolean, default: false },
      lowCalorie: { type: Boolean, default: false },
      lowCarb: { type: Boolean, default: false },
    },
    
    allergens: [{
      type: String,
      enum: [
        'gluten', 'wheat', 'barley', 'rye',
        'milk', 'lactose', 'eggs', 'fish',
        'shellfish', 'tree_nuts', 'peanuts',
        'soy', 'sulfites', 'sulfur_dioxide',
      ],
    }],
    
    ingredients: [String],
    
    nutritionalInfo: {
      calories: Number, // per serving
      carbohydrates: Number, // grams
      sugar: Number, // grams
      protein: Number, // grams
      fat: Number, // grams
      sodium: Number, // mg
      caffeine: Number, // mg
    },

    // ════════════════════════════════════════════════════════════
    // CERTIFICATIONS & AWARDS
    // ════════════════════════════════════════════════════════════
    certifications: [{
      name: String,
      issuedBy: String,
      year: Number,
    }],
    
    awards: [{
      title: String,
      organization: String,
      year: Number,
      medal: { type: String, enum: ['gold', 'silver', 'bronze', 'platinum', 'double_gold'] },
      score: Number,
    }],
    
    ratings: {
      wineSpectator: Number,
      robertParker: Number,
      jamesSuckling: Number,
      decanter: Number,
      whiskyAdvocate: Number,
      jimMurray: Number,
      untappd: Number,
    },

    // ════════════════════════════════════════════════════════════
    // MEDIA
    // ════════════════════════════════════════════════════════════
    images: [MediaItemSchema],
    
    videos: [{
      url: String,
      type: { type: String, enum: ['youtube', 'vimeo', 'direct'] },
      thumbnail: String,
      title: String,
      duration: Number,
    }],

    // ════════════════════════════════════════════════════════════
    // PLATFORM / APPROVAL WORKFLOW
    // ════════════════════════════════════════════════════════════
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected', 'archived', 'discontinued'],
      default: 'pending',
      index: true,
    },
    
    publishedAt: { type: Date },
    discontinuedAt: { type: Date },
    rejectedReason: String,
    approvedBy: { type: ObjectId, ref: 'User' },
    submissionSource: {
      type: String,
      enum: ['tenant', 'admin', 'importer', 'api', 'bulk_upload'],
    },
    submittingTenant: {
      type: ObjectId,
      ref: 'Tenant',
      sparse: true,
    },
    adminNotificationSent: {
      type: Boolean,
      default: false,
    },
    adminNotificationSentAt: {
      type: Date,
    },

    // ════════════════════════════════════════════════════════════
    // SEO & DISCOVERABILITY
    // ════════════════════════════════════════════════════════════════════
    metaTitle: String,
    metaDescription: String,
    metaKeywords: [String],
    slug: String,
    canonicalUrl: String,

    // ════════════════════════════════════════════════════════════
    // AGGREGATION / STATS
    // ════════════════════════════════════════════════════════════
    tenantCount: {
      type: Number,
      default: 0,
      index: true,
    },
    averageSellingPrice: Number,
    totalStockAvailable: Number,
    totalSold: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    wishlistCount: { type: Number, default: 0 },
    
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },

    // ════════════════════════════════════════════════════════════
    // AI / SEMANTIC SEARCH
    // ════════════════════════════════════════════════════════════
    embedding: {
      type: [Number],
      select: false, // Don't include in normal queries
    },

    // ════════════════════════════════════════════════════════════
    // RELATIONS
    // ════════════════════════════════════════════════════════════
    subProducts: [{
      type: ObjectId,
      ref: 'SubProduct'
    }],
    
    relatedProducts: [{
      type: ObjectId,
      ref: 'Product'
    }],
    
    externalLinks: [{
      name: String,
      url: String,
      type: { type: String, enum: ['producer', 'review', 'press', 'social', 'other'] },
    }],
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

productSchema.virtual('availabilitySummary').get(function () {
  if (!this.tenantCount) return 'Not available yet';
  if (this.tenantCount === 1) return 'Available from 1 shop';
  return `Available from ${this.tenantCount} shops`;
});

productSchema.virtual('isBeverage').get(function () {
  return !['accessory', 'glassware', 'bar_tool', 'snack', 'gift_set'].includes(this.type);
});

productSchema.virtual('alcoholCategory').get(function () {
  if (!this.isAlcoholic) return 'non_alcoholic';
  if (this.abv < 5) return 'low_alcohol';
  if (this.abv < 15) return 'moderate_alcohol';
  if (this.abv < 40) return 'high_alcohol';
  return 'very_high_alcohol';
});

productSchema.virtual('priceCategory').get(function () {
  if (!this.averageSellingPrice) return 'unknown';
  if (this.averageSellingPrice < 5000) return 'budget';
  if (this.averageSellingPrice < 15000) return 'mid_range';
  if (this.averageSellingPrice < 50000) return 'premium';
  return 'luxury';
});

// ════════════════════════════════════════════════════════════
// INDEXES (removed duplicate - barcode already has index from unique:true)
// ════════════════════════════════════════════════════════════

productSchema.index({ name: 'text', description: 'text', tastingNotes: 'text' });
productSchema.index({ type: 1, subType: 1, originCountry: 1, abv: 1 });
productSchema.index({ status: 1, publishedAt: -1 });
productSchema.index({ slug: 1, status: 1 });
productSchema.index({ type: 1, flavorProfile: 1 });
productSchema.index({ brand: 1, type: 1, status: 1 });
productSchema.index({ category: 1, subCategory: 1, status: 1 });
productSchema.index({ 'isDietary.vegan': 1, 'isDietary.glutenFree': 1 });
productSchema.index({ vintage: 1, age: 1 });
productSchema.index({ region: 1, originCountry: 1 });
productSchema.index({ averageRating: -1, reviewCount: -1 });

// ════════════════════════════════════════════════════════════
// METHODS
// ════════════════════════════════════════════════════════════

productSchema.methods.incrementViewCount = async function() {
  this.viewCount = (this.viewCount || 0) + 1;
  await this.save();
};

productSchema.methods.updateRating = async function(newRating) {
  const Review = mongoose.model('Review');
  const stats = await Review.aggregate([
    { $match: { product: this._id, status: 'approved' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  
  if (stats.length > 0) {
    this.averageRating = Math.round(stats[0].avg * 10) / 10;
    this.reviewCount = stats[0].count;
    await this.save();
  }
};

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
module.exports = Product;