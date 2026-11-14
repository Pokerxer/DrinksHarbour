// models/Size.js - Enhanced Version

const { extraSizeCodes } = require('../constants/businessSizePresets');
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

    tenant: {
      type: ObjectId,
      ref: 'Tenant',
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
        ...extraSizeCodes,
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
        '50g', '100g', '125g', '200g', '240g', '250g', '340g', '500g', '1kg', '2kg',
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
        
        // Accessories, Glassware & Barware (count / piece / set based)
        'piece-single', 'pair', 'set-barware', 
        'set-5', 'set-8', 'set-10', 'set-16', 'set-24',
        'pack-2', 'pack-3', 'pack-5',
        'kit-3', 'kit-5', 'kit-8', 'kit-10',

        // Gifts, Lifestyle & Snacks (ckay taxonomy — keepsake boxes, bar-packed
        // confectionery, weight-based snacks and luxury tins)
        'bar-single', 'bar-2',
        'box-single',
        'bag-100g', 'bag-200g', 'bag-250g', 'bag-500g', 'bag-1kg',
        'tin-single', 'tin-200g', 'tin-500g',

        // Cigars & Smoking
        'cigar-single', 'sampler-5', 'sampler-6',
        'box-5', 'box-10', 'box-20', 'box-24', 'box-25', 'box-50',

        // Vapes & E-liquids (bottle volumes)
        '10ml', '15ml', '30ml', '60ml', '100ml', '120ml',
        // Vape pods / cartridges
        'pod-1', 'pod-2', 'pod-4',
        // Disposable vapes (measured in puffs)
        'puffs-600', 'puffs-800', 'puffs-1500', 'puffs-2500',
        'puffs-3500', 'puffs-5000', 'puffs-6000', 'puffs-10000',
        // Nicotine pouches (per can)
        'pouch-20',

        // Custom/Other
        'custom', 'variable', 'assorted', 'venue_serving',

        // ── Non-beverage verticals — appends only ───────────────────────
        // The SECOND variant dimension for non-beverage listings lives ON
        // Size (size + colorName/colorHexCode below), never a per-listing
        // color array on SubProduct. Beverage entries above are untouched;
        // these are pure appends. Appended at the tail — including after the
        // Custom/Other catch-alls — so no existing entry changes position
        // (per-tenant SKU uniqueness contract resumed work against the
        // enum as-is; reordering risks no behavioral change but zero need).
        //
        // Apparel: letter sizes — 'one_size' covers listings sold as a
        // single universal cut.
        'xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', 'one_size',

        // Fashion sizing systems (2026-11-03): numeric US dress/top sizes,
        // jeans waist codes, inseam lengths, kids ages — additive; mirrored
        // in constants/productTypes.js STANDARD_SIZES (NUMERIC_US/WAIST/
        // INSEAM/KIDS_AGE) and the admin size pickers.
        'us-0', 'us-2', 'us-4', 'us-6', 'us-8', 'us-10', 'us-12', 'us-14',
        'us-16', 'us-18',
        'w28', 'w30', 'w32', 'w34', 'w36', 'w38', 'w40',
        'l30', 'l32', 'l34', 'l36',
        'kids-2-3', 'kids-4-5', 'kids-6-7', 'kids-8-9', 'kids-10-11',
        'kids-12-13',

        // Shoes: EU (35–47) and US men's / US women's codes.
        'eu-35', 'eu-36', 'eu-37', 'eu-38', 'eu-39', 'eu-40', 'eu-41',
        'eu-42', 'eu-43', 'eu-44', 'eu-45', 'eu-46', 'eu-47',
        'us-m-6', 'us-m-7', 'us-m-8', 'us-m-8.5', 'us-m-9', 'us-m-10',
        'us-m-11', 'us-m-12', 'us-m-13',
        'us-w-4', 'us-w-5', 'us-w-6', 'us-w-7', 'us-w-8', 'us-w-9',
        'us-w-10', 'us-w-11', 'us-w-12',

        // Electronics sizing systems (2026-11-03): screen inches, RAM, battery
        // capacity (+ the 4TB storage tier) — additive; mirrored in
        // constants/productTypes.js (SCREEN_INCH/RAM/BATTERY/STORAGE).
        'screen-24', 'screen-32', 'screen-43', 'screen-50', 'screen-55',
        'screen-65', 'screen-75', 'screen-85',
        // Portable display sizes share the screen-<inches> code format.
        'screen-7', 'screen-8', 'screen-8.7', 'screen-9', 'screen-10.1', 'screen-10.9',
        'screen-11', 'screen-12.4', 'screen-12.5', 'screen-12.9', 'screen-13', 'screen-13.3',
        'screen-14', 'screen-15', 'screen-15.6', 'screen-16', 'screen-17.3', 'screen-18',
        'ram-4gb', 'ram-8gb', 'ram-16gb', 'ram-32gb', 'ram-64gb',
        'battery-5000mah', 'battery-10000mah', 'battery-20000mah',
        'battery-26800mah',
        'storage-4tb',

        // Electronics: device storage tiers (phones/tablets/laptops).
        'storage-16gb', 'storage-32gb', 'storage-64gb', 'storage-128gb',
        'storage-256gb', 'storage-512gb', 'storage-1tb', 'storage-2tb',
      ],
      index: true,
    },
    
    displayName: {
      type: String,
      trim: true,
      maxlength: 100,
      // e.g., "750ml Premium Bottle", "6-Pack Cans"
    },
    
    // Venue labels reuse retail prices and measurements, never retail identity.
    servingSchemaVersion: { type: Number, enum: [1, 2], default: 1 },
    venueServing: {
      type: new Schema({
        code: { type: String, required: true, immutable: true, maxlength: 50, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
        mode: { type: String, required: true, enum: ['sealed', 'pour', 'made_to_order', 'prepared_batch'] },
        saleUnit: { type: String, required: true, enum: ['portion', 'plate', 'bowl', 'tray', 'piece', 'bottle', 'glass'] },
        channels: { type: [String], required: true, validate: value => value.length === 1 && value[0] === 'venue' },
        version: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
      }, { _id: false }),
      default: undefined,
    },

    sizeCategory: {
      type: String,
      enum: [
        'miniature', 'single_serve', 'standard', 'large', 'extra_large',
        'multi_pack', 'bulk', 'gift_set', 'variety_pack', 'keg',
        'accessory', 'glassware', 'barware',
        // Non-beverage industry categories (additive; no default change —
        // legacy beverage rows keep 'standard').
        'apparel', 'shoes', 'electronics',
      ],
      default: 'standard',
      index: true,
    },

    // ════════════════════════════════════════════════════════════
    // INDUSTRY COLOR VARIANTS (non-beverage verticals)
    // ════════════════════════════════════════════════════════════
    // The second variant dimension for apparel/shoes/electronics listings is
    // size + color, carried per Size row. PURE DATA: no defaults, no hooks,
    // absent on legacy rows and every beverage size. colorName stores the
    // user's color name verbatim; colorHexCode only when explicitly supplied.
    optionName: { type: String, trim: true, maxlength: 100 },
    variantColorKey: { type: String, default: null, select: false },
    colorName: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    colorHexCode: {
      type: String,
      trim: true,
      uppercase: true,
      match: /^#[0-9A-F]{6}$/,
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
        'pair', 'kit', 'box', 'bundle', 'puff', 'pouch',
        'bag', 'bar', 'tin',
      ],
      default: function() { return this.servingSchemaVersion === 2 ? 'serving' : 'volume_ml'; },
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
      min: 0,
      default: function() { return this.servingSchemaVersion === 2 ? undefined : 0; },
      // How many servings in this size (0 for non-serving products like bottles)
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
      default: 0,
      // Required is handled in validation - can be derived from basePrice or salePrice
    },
    costPrice: {
      type: Number,
      min: 0,
      default: function() { return this.servingSchemaVersion === 2 ? null : 0; },
      // Can be derived from supplierPrice if not set
    },
    // ── Tenant cost→selling inputs ────────────────────────────────
    // The admin enters these on the size form; `sellingPrice` above is the
    // result of applying them to `costPrice`. They are stored (not just
    // derived back from cost/selling) because `roundUp` makes the round-trip
    // lossy — 25.07% on a rounded price reads back as a different number.
    markupPercentage: {
      type: Number,
      min: 0,
      max: 500,
      default: 25,
    },
    roundUp: {
      type: String,
      enum: ['none', '100', '500', '1000'],
      default: '100',
    },
    saleDiscountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    salePrice: {
      type: Number,
      min: 0,
      default: null,
    },
    // Admin price-override as the effective platform markup % for this size —
    // survives tenant cost/price changes (see SubProduct.platformMarkupOverridePct)
    // Explicit pre-catalogue-discount marketplace price for commission agreements.
    sellingPriceMarkupOverridePct: { type: Number, min: 0, max: 500, default: null },
    commissionPriceOverride: { type: Number, min: 0, default: null },
    packCommissionPriceOverride: { type: Number, min: 0, default: null },
    platformMarkupOverridePct: {
      type: Number,
      default: null,
    },
    // Admin pack-price override — effective platform markup % applied ONLY when
    // computing the quantity-triggered pack unit price. null → pack price uses
    // the tenant's pack rates with no admin override.
    packPlatformMarkupOverridePct: {
      type: Number,
      default: null,
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
    
    // `reorderPoint` is the name the admin size form and the sub-product
    // services use; `reorderLevel` is the historical schema path. Aliased so
    // either name reads and writes the same value instead of being dropped.
    reorderLevel: {
      type: Number,
      default: 0,
      min: 0,
      alias: 'reorderPoint',
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

    // ── IDENTIFICATION & BARCODES
    // ════════════════════════════════════════════════════════════
    // `sku` is unique PER TENANT via the explicit partial index declared at the
    // bottom of this file (constants/... — see config/catalogueIndexes.js).
    // Do NOT put unique:true back on this field: Mongoose autoIndex would
    // rebuild the legacy cross-tenant `sku_1` index on every server start and
    // two tenants selling the same producer SKU string would collide again
    // (docs/audits/general-saas-evolution; uniqueness lives per tenant, like
    // barcode below).
    sku: {
      type: String,
      trim: true,
      uppercase: true,
    },
    
    barcode: {
      type: String,
      trim: true,
    },

    // Previous lookup key retained after it was released for reuse.
    archivedBarcode: {
      type: String,
      select: false,
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
          ...extraSizeCodes.filter(code => /^(pack|case)-/.test(code)),
          'pack-3',
          'bottle', 'can', 'glass_bottle', 'plastic_bottle', 'tetra_pak',
          'keg', 'barrel', 'box', 'bag', 'pouch', 'carton',
          'jar', 'tin', 'tub', 'pod', 'capsule', 'sachet',
          'pack-4', 'pack-6', 'pack-8', 'pack-10', 'pack-12', 'pack-18',
          'pack-24', 'pack-30', 'pack-36',
          'case-6', 'case-12', 'case-24',
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
    imageScope: { type: String, enum: ['variant', 'color', 'option'] },
    
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

    // Operational metadata (transfer trail, cleanup notes). Mixed because
    // writers across services stamp small keyed entries into it.
    metadata: { type: Schema.Types.Mixed, default: undefined },
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

// Fix legacy in_stock values before any validation
sizeSchema.pre('validate', function() {
  if (this.availability === 'in_stock') {
    this.availability = 'available';
  }
  if (this.servingSchemaVersion === 2) {
    if (this.size !== 'venue_serving' || !this.venueServing || !this.displayName?.trim()) this.invalidate('venueServing', 'Explicit venue serving metadata and display name required');
    for (const field of ['weightGrams', 'volumeMl', 'servingsPerUnit']) {
      const value = this[field];
      if (value != null && (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(Math.round(value * 100)) || Math.abs(value * 100 - Math.round(value * 100)) > 1e-8)) this.invalidate(field, 'Declared serving measurements must be positive with at most two decimal places');
    }
    if (this.venueServing?.mode === 'pour' && !(this.volumeMl > 0)) this.invalidate('volumeMl', 'Pour volume is required');
  } else if (this.size === 'venue_serving' || this.venueServing) this.invalidate('venueServing', 'Venue serving requires schema version 2');
});

sizeSchema.pre('save', async function() {
  if (this.isModified('barcode') && this.barcode) {
    await require('../services/size-barcode').prepareSizeBarcode({
      tenant: this.tenant,
      barcode: this.barcode,
      sizeId: this._id,
      session: this.$session(),
    });
  }

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

sizeSchema.pre('validate', function () {
  if (this.isNew || this.isModified('colorName') || this.isModified('optionName')) {
    this.variantColorKey = require('../utils/retailVariantIdentity').variantOptionKey(this.colorName, this.optionName);
  }
});

// Old live guard stays until reviewed migration; import never synchronises indexes.
for (const row of require('../services/venue/serving-indexes').SERVING_MODEL_INDEXES) {
  sizeSchema.index(row.key, { unique: true, ...row.options });
}
// Per-tenant barcode uniqueness — non-empty barcodes must be unique within a tenant
sizeSchema.index(
  { tenant: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $gt: '' } }
  }
);
// Per-tenant SKU uniqueness — non-empty SKUs must be unique within a tenant,
// mirroring the barcode contract. Previously global (unique:true on the field);
// the legacy `sku_1` index is retired per environment by
// scripts/ensure-catalogue-uniqueness.js --retire-global-size-sku. Declared ON
// THE SCHEMA (like barcode) so every environment keeps SKU enforcement from
// server start; the legacy cross-tenant index is the operator-retire step.
sizeSchema.index(
  { tenant: 1, sku: 1 },
  {
    unique: true,
    partialFilterExpression: { sku: { $gt: '' } },
    name: 'tenant_sku_unique',
  }
);
// Remove duplicate index: sizeSchema.index({ availability: 1 });
sizeSchema.index({ stock: 1 });
sizeSchema.index({ subproduct: 1, totalSold: -1 });
// Remove duplicate: sizeSchema.index({ sizeCategory: 1 });

const Size = mongoose.models.Size || mongoose.model('Size', sizeSchema);
module.exports = Size;
