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
      enum: [
        // BEER SUB-CATEGORIES
        // Ales
        'pale_ale', 'india_pale_ale', 'american_pale_ale', 'english_bitter', 'brown_ale', 'ipa', 'west_coast_ipa', 'hazy_ipa',
        'amber_ale', 'blonde_ale', 'red_ale', 'scottish_ale', 'belgian_dubbel', 'belgian_tripel', 
        'belgian_quad', 'saison', 'farmhouse_ale', 'barleywine', 'winter_warmer', 'scotch_ale',
        
        // Stouts & Porters
        'stout', 'imperial_stout', 'milk_stout', 'oatmeal_stout', 'coffee_stout', 'porter', 
        'baltic_porter', 'robust_porter',
        
        // Lagers
        'lager', 'pilsner', 'helles', 'dunkel', 'bock', 'doppelbock', 'märzen', 'oktoberfest',
        'vienna_lager', 'schwarzbier', 'american_adjunct_lager',
        
        // Wheat Beers
        'wheat_beer', 'hefeweizen', 'witbier', 'dunkelweizen',
        
        // Hybrids & Alternatives
        'kolsch', 'altbier', 'cream_ale', 'steam_beer',
        
        // Sour Beers
        'sour_beer', 'berliner_weisse', 'gose', 'flanders_red', 'oud_bruin', 'lambic', 'gueuze',
        
        // CIDER & PERRY SUB-CATEGORIES
        'cider', 'dry_cider', 'sweet_cider', 'sparkling_cider', 'ice_cider', 'cidre_bouche',
        'new_world_cider', 'perry', 'fruit_cider', 'hopped_cider', 'spiced_cider',
        
        // WINE SUB-CATEGORIES
        // Red Wines
        'cabernet_sauvignon', 'merlot', 'pinot_noir', 'syrah', 'shiraz', 'malbec', 'zinfandel',
        'sangiovese', 'tempranillo', 'grenache', 'nebbiolo', 'cabernet_franc', 'gamay',
        'barbera', 'petit_verdot', 'montepulciano',
        
        // White Wines
        'chardonnay', 'sauvignon_blanc', 'pinot_grigio', 'riesling', 'chenin_blanc', 'viognier',
        'gewurztraminer', 'moscato', 'albarino', 'torrontes', 'semillon', 'gruner_veltliner',
        
        // Rosé Wines
        'provencal_rose', 'tavel_rose', 'white_zinfandel', 'saignee', 'rosato', 'italian_rosato', 'spanish_rosado',

        // Scotch
        'single_malt', 'blended_malt', 'single_grain', 'blended_grain', 'islay_whisky', 'highland_whisky', 'speyside_whisky', 'lowland_whisky', 'campbeltown_whisky',

        // Bourbon 
        'bourbon', 'small_batch', 'single_barrel', 'wheated_bourbon', 'rye_bourbon', 'high_rye_bourbon', 'high_proof_bourbon', 'cask_strength_bourbon', 'bottled_in_bond',

        // Rye
        'rye_whiskey', 'high_rye', 'canadian_rye', 'bottled_in_bond_rye',
        
        // Sparkling Wines
        'prosecco', 'cava', 'cremant', 'lambrusco', 'franciacorta', 'sekt', 'american_sparkling', 'pet_nat', 'asti', 

        // Champagne
        'non_vintage_champagne', 'vintage_champagne', 'rose_champagne', 'blanc_de_blancs', 'blanc_de_noirs', 'prestige_cuvee', 'brut_nature', 'extra_brut', 'sec', 'demi_sec', 'doux', 
        
        // Fortified & Dessert Wines
        'port', 'sherry', 'madeira', 'marsala', 'vermouth', 'ice_wine', 'late_harvest',
        
        // Fruit Wines
        'fruit_wine', 'cherry_wine', 'blackberry_wine', 'plum_wine',
        
        // SAKE SUB-CATEGORIES
        'junmai_daiginjo', 'daiginjo', 'junmai_ginjo', 'ginjo', 'junmai', 'honjozo',
        'namazake', 'genshu', 'nigori', 'koshu', 'taruzake',
        
        // MEAD SUB-CATEGORIES
        'traditional_mead', 'melomel', 'cyser', 'pyment', 'metheglin', 'braggot',
        
        // WHISKEY SUB-CATEGORIES
        'single_malt', 'blended_malt', 'single_grain', 'blended_grain', 'bourbon', 'rye_whiskey',
        'tennessee_whiskey', 'canadian_whisky', 'irish_whiskey', 'japanese_whisky',
        'islay_whisky', 'highland_whisky', 'speyside_whisky', 'lowland_whisky', 'campbeltown_whisky',
        
        // VODKA SUB-CATEGORIES
        'premium_vodka', 'flavored_vodka', 'grain_vodka', 'potato_vodka', 'corn_vodka', 'classic_vodka', 'rye_vodka', 'citrus_vodka',
        
        // GIN SUB-CATEGORIES
        'london_dry_gin', 'old_tom_gin', 'navy_strength_gin', 'contemporary_gin', 'plymouth_gin', 'sloe_gin',
        
        // RUM SUB-CATEGORIES
        'white_rum', 'gold_rum', 'dark_rum', 'black_rum', 'spiced_rum', 'agricole_rum', 'cachaca', 'aged_rum', 'rhum_agricole',
        
        // TEQUILA SUB-CATEGORIES
        'blanco_tequila', 'reposado_tequila', 'anejo_tequila', 'extra_anejo_tequila', 'joven_tequila', 'crema_tequila',
        
        // MEZCAL SUB-CATEGORIES
        'espadin_mezcal', 'tobola_mezcal', 'tepeztate_mezcal', 'joven_mezcal', 'reposado_mezcal',
        
        // BRANDY SUB-CATEGORIES
        'cognac', 'armagnac', 'grape_brandy', 'fruit_brandy', 'pisco', 'calvados', 'applejack', 'spanish_brandy', 'american_brandy', 'grappa', 'metaxa', 'german_weinbrand', 'south_african_brandy',
        
        // SOJU SUB-CATEGORIES
        'traditional_soju', 'diluted_soju', 'flavored_soju',
        
        // BAIJIU SUB-CATEGORIES
        'sauce_aroma_baijiu', 'strong_aroma_baijiu', 'light_aroma_baijiu', 'rice_aroma_baijiu',
        
        // SHOCHU SUB-CATEGORIES
        'barley_shochu', 'sweet_potato_shochu', 'rice_shochu', 'soba_shochu',

        // cider
        'dry_cider', 'new_england_cider', 'french_cidre', 'spanish_sidra', 'sweet_cider', 'fruit_cider', 'hopped_cider', 'spiced_cider', 'ice_cider', 'perry', 'cyser',
        
        // LIQUEUR SUB-CATEGORIES
        'cream_liqueur', 'coffee_liqueur', 'orange_liqueur', 'herbal_liqueur', 'fruit_liqueur',
        'nut_liqueur', 'amaretto', 'limoncello', 'sambuca', 'ouzo', 'triple_sec', 'cointreau',
        'grand_marnier', 'maraschino', 'jagermeister', 'chartreuse', 'drambuie', 'baileys',
        
        // HARD SELTZER SUB-CATEGORIES
        'hard_seltzer', 'cocktail_inspired_seltzer', 'caffeinated_seltzer',
        
        // PRE-MIXED COCKTAIL SUB-CATEGORIES
        'classic_cocktail_rtd', 'highball_rtd', 'novelty_rtd',
        
        // NON-ALCOHOLIC SUB-CATEGORIES
        // Coffee
        'drip_coffee', 'pour_over', 'french_press', 'cold_brew', 'espresso', 'americano',
        'cappuccino', 'latte', 'flat_white', 'macchiato', 'mocha', 'nitro_coffee',
        
        // Tea
        'green_tea', 'black_tea', 'oolong_tea', 'white_tea', 'pu_erh_tea', 'matcha',
        'earl_grey', 'english_breakfast', 'darjeeling', 'assam', 'sencha', 'jasmine',
        
        // Herbal Tea
        'herbal_tea', 'rooibos', 'chamomile', 'peppermint', 'hibiscus', 'ginger_tea',
        
        // Hot Chocolate
        'drinking_chocolate', 'hot_cocoa', 'mexican_hot_chocolate',
        
        // Water
        'spring_water', 'mineral_water', 'sparkling_water', 'flavored_water', 'alkaline_water', 'still_water', 'distilled_water',
        
        // Juice
        'orange_juice', 'apple_juice', 'cranberry_juice', 'grapefruit_juice', 'pomegranate_juice',
        'tomato_juice', 'carrot_juice', 'vegetable_juice', 'nectar',
        
        // Soda & Soft Drinks
        'cola', 'lemon_lime_soda', 'orange_soda', 'ginger_ale', 'root_beer', 'cream_soda',
        
        
        // Lemonade
        'lemonade', 'limeade', 'pink_lemonade', 'sparkling_lemonade', 'strawberry_lemonade',
        
        // Milk & Alternatives
        'whole_milk', 'skim_milk', 'lactose_free_milk', 'chocolate_milk', 'almond_milk',
        'soy_milk', 'oat_milk', 'coconut_milk', 'rice_milk', 'cashew_milk',
        
        // Functional Drinks
        'sports_drink', 'energy_drink', 'vitamin_water', 'electrolyte_water', 'kombucha',
        'probiotic_drink', 'meal_replacement_shake',
        
        // Non-Alcoholic Alternatives
        'non_alcoholic_beer', 'non_alcoholic_wine', 'mocktail', 'shrub_mocktail',
        
        // OTHER
        'other'
      ],
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
      maxlength: 2000,
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
        enum: ['light', 'light_medium', 'medium', 'medium_full', 'full', 'very_full', 'light_full']
      },
      sweetnessLevel: {
        type: String,
        enum: ['bone_dry', 'dry', 'off_dry', 'medium_dry', 'medium_sweet', 'sweet', 'very_sweet', 'semi_sweet', 'varies', 'brut', 'extra_brut', 'brut_nature', 'bone_dry']
      },
      bitterness: {
        type: String,
        enum: ['none', 'low', 'medium', 'high', 'very_high']
      },
      acidity: {
        type: String,
        enum: ['low', 'medium_low', 'medium', 'medium_high', 'high']
      },
      tannins: {
        type: String,
        enum: ['none', 'low', 'low_medium', 'medium', 'medium_high', 'high', 'very_high']
      },
      carbonation: {
        type: String,
        enum: ['none', 'low', 'low_medium','medium', 'medium_high', 'high', 'very_high', 'varies', 'very_low','fine_persistent', 'fine_elegant', 'fine', 'coarse_vigorous',
          'creamy', 'mousse', 'lively', 'gentle', 'vigorous', 'aggressive', 'effervescent', 'fizzy', 'bubbly', 'sparkling', 'champagne_like', 'cider_like', 'beer_like', 'wine_like', 'cocktail_like', 'mixed',
          'lively_bubbles', 'fine_bubbles', 'creamy_bubbles', 'light_frothy'
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