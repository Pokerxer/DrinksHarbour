// models/Size.js - Enhanced Version

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const MediaItemSchema = new Schema({
  url: { type: String, required: true },
  alt: String,
  isPrimary: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  publicId: String,
  resourceType: { type: String, enum: ['image', 'video'], default: 'image' },
  format: String,
  width: Number,
  height: Number,
  size: Number,
  thumbnail: String,
  uploadedBy: { type: ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  tags: [String],
  caption: String,
}, { _id: false });

const sizeSchema = new Schema(
  {
    // ════════════════════════════════════════════════════════════
    // CORE IDENTITY
    // ════════════════════════════════════════════════════════════
    subproduct: {
      type: ObjectId,
      ref: 'SubProduct',
      required: true,
      index: true,
    },

    // ════════════════════════════════════════════════════════════
    // SIZE SPECIFICATION
    // ════════════════════════════════════════════════════════════
    size: {
      type: String,
      required: true,
      enum: [
        // Wine & Champagne Bottles
        '10cl', '18.7cl', '20cl', '25cl', '37.5cl', '50cl', '75cl', '100cl',
        '150cl',  // Magnum (2 bottles)
        '300cl',  // Jeroboam (4 bottles) / Double Magnum
        '450cl',  // Rehoboam (6 bottles)
        '600cl',  // Methuselah / Imperial (8 bottles)
        '900cl',  // Salmanazar (12 bottles)
        '1200cl', // Balthazar (16 bottles)
        '1500cl', // Nebuchadnezzar (20 bottles)
        '1800cl', // Melchior (24 bottles)
        
        // Spirits Standard Sizes
        '5cl', '10cl', '20cl', '35cl', '50ml', '70cl', '1L', '1.5L', '1.75L', '3L',
        'nip-50ml', 'miniature-50ml', 'half-pint-200ml', 'pint-473ml',
        
        // Beer & Cider Bottles
        '27.5cl', '33cl', '35cl', '44cl', '50cl', '56.8cl', '66cl',
        'bottle-275ml', 'bottle-330ml', 'bottle-355ml', 'bottle-500ml', 
        'bottle-568ml', 'bottle-600ml', 'bottle-650ml', 'bottle-750ml',
        
        // Beer Cans
        'can-200ml', 'can-250ml', 'can-330ml', 'can-355ml', 'can-440ml', 
        'can-473ml', 'can-500ml', 'can-568ml',
        
        // Soft Drinks & Water
        '200ml', '250ml', '300ml', '330ml', '355ml', '500ml', '600ml', 
        '750ml', '1L', '1.25L', '1.5L', '2L', '2.5L', '3L', '5L',
        
        // Kegs & Bulk Containers
        '5L', '10L', '15L', '20L', '30L', '50L', '58.7L',
        'keg-5L', 'keg-20L', 'keg-30L', 'keg-50L',
        'mini-keg', 'pony-keg', 'quarter-barrel', 'half-barrel', 'full-barrel',
        'cornelius-keg',
        
        // Multi-Packs
        'pack-4', 'pack-6', 'pack-8', 'pack-10', 'pack-12', 'pack-18', 
        'pack-24', 'pack-30', 'pack-36',
        'case-6', 'case-12', 'case-24',
        
        // Coffee & Tea (Weight-based)
        '50g', '100g', '125g', '200g', '250g', '340g', '500g', '1kg', '2kg',
        'kg-0.5', 'kg-1', 'kg-2',
        'lb-0.5', 'lb-1', 'lb-2', 'lb-5',
        
        // Pods & Capsules
        'pod-10', 'pod-16', 'pod-30', 'pod-50', 'pod-100',
        'capsule-10', 'capsule-30', 'capsule-50',
        
        // Sachets & Singles
        'sachet-single', 'sachet-10', 'sachet-25', 'sachet-50',
        
        // Tea Bags
        'teabag-20', 'teabag-25', 'teabag-40', 'teabag-50', 'teabag-100',
        
        // Powder/Concentrate
        'jar-100g', 'jar-200g', 'jar-500g', 'jar-1kg',
        'tub-500g', 'tub-1kg', 'tub-2kg',
        
        // Single Serve
        'unit-single', 'unit', 'single-serve', 'individual',
        'shot-25ml', 'shot-35ml', 'shot-50ml',
        
        // Gift Sets & Bundles
        'set-2', 'set-3', 'set-4', 'set-6', 'set-12',
        'gift-set', 'tasting-set', 'variety-pack',
        
        // Accessories
        'piece-single', 'pair', 'set-barware',
        
        // Custom/Other
        'custom', 'variable', 'assorted',
      ],
      index: true,
    },
    
    displayName: {
      type: String,
      trim: true,
      maxlength: 100,
      // e.g., "750ml Premium Bottle", "6-Pack Cans"
    },
    
    sizeCategory: {
      type: String,
      enum: [
        'miniature', 'single_serve', 'standard', 'large', 'extra_large',
        'multi_pack', 'bulk', 'gift_set', 'variety_pack', 'keg',
      ],
      index: true,
    },

    // ════════════════════════════════════════════════════════════
    // UNIT TYPE & MEASUREMENTS
    // ════════════════════════════════════════════════════════════
    unitType: {
      type: String,
      enum: [
        'volume_ml', 'volume_cl', 'volume_l', 'volume_oz', 'volume_gallon',
        'weight_g', 'weight_kg', 'weight_lb', 'weight_oz',
        'count_unit', 'count_pack', 'count_case',
        'pod', 'capsule', 'sachet', 'teabag',
        'set', 'piece', 'serving',
      ],
      default: 'volume_ml',
    },
    
    volumeMl: {
      type: Number,
      min: 0,
      // Calculated volume in ml for beverages
    },
    
    weightGrams: {
      type: Number,
      min: 0,
      // For coffee, tea, powder products
    },
    
    servingsPerUnit: {
      type: Number,
      min: 1,
      // How many servings in this size
    },
    
    unitsPerPack: {
      type: Number,
      min: 1,
      default: 1,
      // For multi-packs: how many individual units
    },

    // ════════════════════════════════════════════════════════════
    // PRICING
    // ════════════════════════════════════════════════════════════
    sellingPrice: {
      type: Number,
      min: 0,
      required: true,
    },
    costPrice: {
      type: Number,
      min: 0,
      required: true,
    },
    compareAtPrice: {
      type: Number,
      min: 0,
      // MSRP / Original price
    },
    wholesalePrice: {
      type: Number,
      min: 0,
      // B2B pricing
    },
    currency: {
      type: String,
      default: 'NGN',
      enum: ['NGN', 'USD', 'EUR', 'GBP', 'ZAR', 'KES', 'GHS'],
    },
    
    pricePerUnit: {
      type: Number,
      min: 0,
      // For multi-packs: price per individual unit
    },
    
    pricePerMl: {
      type: Number,
      min: 0,
      // For beverages: price per ml for comparison
    },

    // ════════════════════════════════════════════════════════════
    // INVENTORY & AVAILABILITY
    // ════════════════════════════════════════════════════════════
    stock: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} must be an integer',
      },
    },
    
    reservedStock: {
      type: Number,
      default: 0,
      min: 0,
      // Stock reserved for pending orders
    },
    
    availableStock: {
      type: Number,
      default: 0,
      min: 0,
      // stock - reservedStock
    },
    
    lowStockThreshold: {
      type: Number,
      default: 6,
      min: 0,
    },
    
    reorderLevel: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    reorderQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    availability: {
      type: String,
      enum: [
        'available',
        'low_stock',
        'out_of_stock',
        'pre_order',
        'coming_soon',
        'discontinued',
        'backorder',
        'limited_stock',
      ],
      default: 'available',
      index: true,
    },
    
    stockLocation: {
      warehouse: String,
      zone: String,
      aisle: String,
      shelf: String,
      bin: String,
    },

    // ════════════════════════════════════════════════════════════
    // IDENTIFICATION & BARCODES
    // ════════════════════════════════════════════════════════════
    sku: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    
    barcode: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
    },
    
    gtin: {
      type: String,
      sparse: true,
      trim: true,
    },
    
    upc: {
      type: String,
      sparse: true,
      trim: true,
    },
    
    ean: {
      type: String,
      sparse: true,
      trim: true,
    },

    // ════════════════════════════════════════════════════════════
    // PRODUCT SPECIFICATIONS
    // ════════════════════════════════════════════════════════════
    dimensions: {
      length: Number, // cm
      width: Number,  // cm
      height: Number, // cm
      diameter: Number, // cm (for bottles)
    },
    
    packaging: {
      type: { 
        type: String, 
        enum: [
          'bottle', 'can', 'glass_bottle', 'plastic_bottle', 'tetra_pak',
          'keg', 'barrel', 'box', 'bag', 'pouch', 'carton',
          'jar', 'tin', 'tub', 'pod', 'capsule', 'sachet',
        ]
      },
      material: String,
      recyclable: Boolean,
      returnableDeposit: Number,
    },
    
    shippingWeight: {
      type: Number,
      min: 0,
      // Total weight including packaging (grams)
    },

    // ════════════════════════════════════════════════════════════
    // DISCOUNTS & PROMOTIONS
    // ════════════════════════════════════════════════════════════
    discountValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ['fixed', 'percentage', null],
      default: null,
    },
    discountStart: Date,
    discountEnd: Date,
    
    bulkPricing: [{
      minQuantity: { type: Number, required: true },
      maxQuantity: Number,
      price: { type: Number, required: true },
      discountPercentage: Number,
    }],
    
    memberPrice: {
      type: Number,
      min: 0,
      // Special price for members/subscribers
    },

    // ════════════════════════════════════════════════════════════
    // SHELF LIFE & COMPLIANCE
    // ════════════════════════════════════════════════════════════
    isExpiryRequired: {
      type: Boolean,
      default: false,
    },
    expiryDate: Date,
    
    isProductionDateRequired: {
      type: Boolean,
      default: false,
    },
    productionDate: Date,
    
    shelfLifeDays: {
      type: Number,
      min: 0,
      // Expected shelf life
    },
    
    bestBeforeDate: Date,
    
    batchNumber: String,
    lotNumber: String,

    // ════════════════════════════════════════════════════════════
    // MEDIA
    // ════════════════════════════════════════════════════════════
    image: MediaItemSchema,
    
    images: [MediaItemSchema],

    // ════════════════════════════════════════════════════════════
    // ORDER CONSTRAINTS
    // ════════════════════════════════════════════════════════════
    minOrderQuantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxOrderQuantity: {
      type: Number,
      min: 1,
    },
    
    orderIncrement: {
      type: Number,
      default: 1,
      min: 1,
      // Must order in multiples of this number
    },
    
    requiresAgeVerification: {
      type: Boolean,
      default: false,
    },
    
    requiresPrescription: {
      type: Boolean,
      default: false,
      // For certain supplements
    },

    // ════════════════════════════════════════════════════════════
    // ANALYTICS & TRACKING
    // ════════════════════════════════════════════════════════════
    totalSold: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    lastSoldDate: Date,
    
    forecastedDemand: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    salesVelocity: {
      type: Number,
      default: 0,
      // Units per day
    },
    
    turnoverRate: {
      type: Number,
      default: 0,
      // Days to sell current stock
    },
    
    viewCount: {
      type: Number,
      default: 0,
    },
    
    addToCartCount: {
      type: Number,
      default: 0,
    },
    
    conversionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // ════════════════════════════════════════════════════════════
    // POPULARITY & RANKING
    // ════════════════════════════════════════════════════════════
    popularityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    
    isPopularSize: {
      type: Boolean,
      default: false,
    },
    
    rank: {
      type: Number,
      min: 1,
      // Rank among sizes for this SubProduct
    },

    // ════════════════════════════════════════════════════════════
    // STATUS & FLAGS
    // ════════════════════════════════════════════════════════════
    status: {
      type: String,
      enum: ['active', 'inactive', 'discontinued', 'seasonal', 'limited_edition'],
      default: 'active',
      index: true,
    },
    
    isDefault: {
      type: Boolean,
      default: false,
      // Is this the default size for the SubProduct?
    },
    
    isFeatured: {
      type: Boolean,
      default: false,
    },
    
    isLimitedEdition: {
      type: Boolean,
      default: false,
    },
    
    isOnSale: {
      type: Boolean,
      default: false,
    },
    
    notes: {
      type: String,
      maxlength: 500,
      // Internal notes
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

sizeSchema.virtual('isLowStock').get(function () {
  return this.stock > 0 && this.stock <= this.lowStockThreshold;
});

sizeSchema.virtual('effectivePrice').get(function () {
  const now = new Date();
  if (!this.discountValue || !this.discountType || 
      (this.discountStart && now < this.discountStart) || 
      (this.discountEnd && now > this.discountEnd)) {
    return this.sellingPrice;
  }
  if (this.discountType === 'fixed') {
    return Math.max(0, this.sellingPrice - this.discountValue);
  } else if (this.discountType === 'percentage') {
    const discount = this.sellingPrice * (this.discountValue / 100);
    return Math.max(0, this.sellingPrice - discount);
  }
  return this.sellingPrice;
});

sizeSchema.virtual('stockStatus').get(function () {
  if (this.stock <= 0) return 'out_of_stock';
  if (this.isLowStock) return 'low_stock';
  return 'in_stock';
});

sizeSchema.virtual('profitMargin').get(function () {
  if (!this.costPrice || this.costPrice === 0) return 0;
  return ((this.sellingPrice - this.costPrice) / this.costPrice) * 100;
});

sizeSchema.virtual('savingsAmount').get(function () {
  if (!this.compareAtPrice || this.compareAtPrice <= this.sellingPrice) return 0;
  return this.compareAtPrice - this.sellingPrice;
});

sizeSchema.virtual('savingsPercentage').get(function () {
  if (!this.compareAtPrice || this.compareAtPrice <= this.sellingPrice) return 0;
  return ((this.compareAtPrice - this.sellingPrice) / this.compareAtPrice) * 100;
});

// ════════════════════════════════════════════════════════════
// METHODS
// ════════════════════════════════════════════════════════════

sizeSchema.methods.calculatePricePerUnit = function() {
  if (this.volumeMl && this.volumeMl > 0) {
    this.pricePerMl = Number((this.sellingPrice / this.volumeMl).toFixed(2));
  } else if (this.weightGrams && this.weightGrams > 0) {
    this.pricePerUnit = Number((this.sellingPrice / this.weightGrams).toFixed(2));
  }
  return this;
};

sizeSchema.methods.updateAvailableStock = function() {
  this.availableStock = Math.max(0, this.stock - (this.reservedStock || 0));
  
  // Update availability
  if (this.stock === 0) {
    this.availability = 'out_of_stock';
  } else if (this.stock <= this.lowStockThreshold) {
    this.availability = 'low_stock';
  } else {
    this.availability = 'available';
  }
  
  return this;
};

sizeSchema.methods.reserveStock = async function(quantity) {
  if (this.availableStock < quantity) {
    throw new Error('Insufficient stock available');
  }
  this.reservedStock = (this.reservedStock || 0) + quantity;
  this.updateAvailableStock();
  await this.save();
  return this;
};

sizeSchema.methods.releaseStock = async function(quantity) {
  this.reservedStock = Math.max(0, (this.reservedStock || 0) - quantity);
  this.updateAvailableStock();
  await this.save();
  return this;
};

// ════════════════════════════════════════════════════════════
// PRE-SAVE HOOK
// ════════════════════════════════════════════════════════════

sizeSchema.pre('save', function() {
  // Calculate price per unit
  if (this.volumeMl && this.volumeMl > 0 && this.sellingPrice) {
    this.pricePerMl = Number((this.sellingPrice / this.volumeMl).toFixed(2));
  }
  
  // Ensure numeric fields
  this.stock = this.stock || 0;
  this.reservedStock = this.reservedStock || 0;
  this.lowStockThreshold = this.lowStockThreshold || 0;
  
  // Update available stock
  this.availableStock = Math.max(0, this.stock - this.reservedStock);
  
  // Update availability based on stock
  if (this.stock === 0) {
    this.availability = 'out_of_stock';
  } else if (this.stock <= this.lowStockThreshold) {
    this.availability = 'low_stock';
  } else if (!this.availability || this.availability === 'out_of_stock' || this.availability === 'low_stock') {
    this.availability = 'available';
  }
});

// ════════════════════════════════════════════════════════════
// INDEXES
// ════════════════════════════════════════════════════════════

sizeSchema.index({ subproduct: 1, size: 1 }, { unique: true });
sizeSchema.index({ sku: 1 });
sizeSchema.index({ barcode: 1 });
// Remove duplicate index: sizeSchema.index({ availability: 1 });
sizeSchema.index({ stock: 1 });
sizeSchema.index({ subproduct: 1, totalSold: -1 });
// Remove duplicate: sizeSchema.index({ sizeCategory: 1 });

const Size = mongoose.models.Size || mongoose.model('Size', sizeSchema);
module.exports = Size;