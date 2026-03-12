// Migration script to populate all size fields in the database
const mongoose = require('mongoose');

const Size = require('../models/Size');
const SubProduct = require('../models/subProduct');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';

const sizeFieldMappings = {
  // Unit type mapping from size string
  unitType: (size) => {
    if (size.unitType) return size.unitType;
    const s = size.size || '';
    if (s.match(/ml$/i)) return 'volume_ml';
    if (s.match(/^(\d+)cl?$/i)) return s.includes('cl') ? 'volume_cl' : 'volume_ml';
    if (s.match(/^(\d+\.?\d*)L$/i)) return 'volume_l';
    if (s.match(/^can-/i)) return 'count_unit';
    if (s.match(/^bottle-/i)) return 'count_unit';
    if (s.match(/^pack-/i)) return 'count_pack';
    if (s.match(/^case-/i)) return 'count_case';
    if (s.match(/^keg-/i)) return 'volume_l';
    return 'count_unit';
  },
  
  // Volume in ml
  volumeMl: (size) => {
    if (size.volumeMl) return size.volumeMl;
    const s = size.size || '';
    let match = s.match(/^(\d+\.?\d*)ml$/i);
    if (match) return parseFloat(match[1]);
    match = s.match(/^(\d+\.?\d*)cl$/i);
    if (match) return parseFloat(match[1]) * 10;
    match = s.match(/^(\d+\.?\d*)L$/i);
    if (match) return parseFloat(match[1]) * 1000;
    // Common bottle sizes
    const volumeMap = {
      '70cl': 700, '75cl': 750, '1l': 1000, '1L': 1000,
      '1.5l': 1500, '1.5L': 1500, '20cl': 200, '25cl': 250,
      '33cl': 330, '50cl': 500, '100cl': 1000,
    };
    return volumeMap[s.toLowerCase()] || null;
  },
  
  // Weight in grams
  weightGrams: (size) => {
    if (size.weightGrams) return size.weightGrams;
    const s = size.size || '';
    let match = s.match(/^(\d+\.?\d*)g$/i);
    if (match) return parseFloat(match[1]);
    match = s.match(/^(\d+\.?\d*)kg$/i);
    if (match) return parseFloat(match[1]) * 1000;
    return null;
  },
  
  // Units per pack
  unitsPerPack: (size) => {
    if (size.unitsPerPack) return size.unitsPerPack;
    const s = size.size || '';
    let match = s.match(/^pack-(\d+)/i);
    if (match) return parseInt(match[1]);
    match = s.match(/^case-(\d+)/i);
    if (match) return parseInt(match[1]);
    return 1;
  },
  
  // Servings per unit
  servingsPerUnit: (size) => {
    if (size.servingsPerUnit !== undefined) return size.servingsPerUnit;
    return 0;
  },
  
  // Cost price
  costPrice: (size) => {
    if (size.costPrice !== undefined && size.costPrice !== null) return size.costPrice;
    // Default to 70% of selling price
    if (size.sellingPrice) return Math.round(size.sellingPrice * 0.7 * 100) / 100;
    return 0;
  },
  
  // Compare at price (MSRP)
  compareAtPrice: (size) => {
    if (size.compareAtPrice !== undefined) return size.compareAtPrice;
    return null;
  },
  
  // Wholesale price
  wholesalePrice: (size) => {
    if (size.wholesalePrice !== undefined) return size.wholesalePrice;
    if (size.sellingPrice) return Math.round(size.sellingPrice * 0.8 * 100) / 100;
    return null;
  },
  
  // Currency
  currency: (size) => {
    return size.currency || 'NGN';
  },
  
  // Price per unit (for multi-packs)
  pricePerUnit: (size) => {
    if (size.pricePerUnit !== undefined) return size.pricePerUnit;
    if (size.sellingPrice && size.unitsPerPack > 1) {
      return Math.round((size.sellingPrice / size.unitsPerPack) * 100) / 100;
    }
    return null;
  },
  
  // Price per ml
  pricePerMl: (size) => {
    if (size.pricePerMl !== undefined) return size.pricePerMl;
    if (size.sellingPrice && size.volumeMl) {
      return Math.round((size.sellingPrice / size.volumeMl) * 10000) / 10000;
    }
    return null;
  },
  
  // Reserved stock
  reservedStock: (size) => {
    return size.reservedStock || 0;
  },
  
  // Available stock
  availableStock: (size) => {
    if (size.availableStock !== undefined) return size.availableStock;
    return (size.stock || 0) - (size.reservedStock || 0);
  },
  
  // Reorder level
  reorderLevel: (size) => {
    return size.reorderLevel || 0;
  },
  
  // Reorder quantity
  reorderQuantity: (size) => {
    return size.reorderQuantity || 0;
  },
  
  // Availability
  availability: (size) => {
    if (size.availability) return size.availability;
    if (size.stock === 0) return 'out_of_stock';
    if (size.stock && size.lowStockThreshold && size.stock <= size.lowStockThreshold) return 'low_stock';
    return 'available';
  },
  
  // SKU
  sku: (size) => {
    return size.sku || '';
  },
  
  // Barcode
  barcode: (size) => {
    return size.barcode || '';
  },
  
  // Packaging
  packaging: (size) => {
    return size.packaging || '';
  },
  
  // Min order quantity
  minOrderQuantity: (size) => {
    return size.minOrderQuantity || 1;
  },
  
  // Max order quantity
  maxOrderQuantity: (size) => {
    return size.maxOrderQuantity || null;
  },
  
  // Order increment
  orderIncrement: (size) => {
    return size.orderIncrement || 1;
  },
  
  // Size category
  sizeCategory: (size) => {
    if (size.sizeCategory) return size.sizeCategory;
    const s = (size.size || '').toLowerCase();
    if (s.includes('mini') || s.includes('nip') || s === '50ml') return 'miniature';
    if (s.match(/^(20|25|33|35|37\.5|44|50)cl?$/)) return 'single_serve';
    if (s.match(/^(70|75)cl?$/)) return 'standard';
    if (s.match(/^(1|1\.5|2)L?$/)) return 'large';
    if (s.match(/^pack-|^case-/)) return 'multi_pack';
    if (s.match(/^keg-/)) return 'keg';
    return 'standard';
  },
};

async function migrateSizes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get all sizes
    const sizes = await Size.find({}).lean();
    console.log(`Found ${sizes.length} sizes to migrate`);
    
    let updated = 0;
    for (const size of sizes) {
      const updates = {};
      let hasChanges = false;
      
      for (const [field, mapper] of Object.entries(sizeFieldMappings)) {
        if (size[field] === undefined || size[field] === null) {
          const newValue = mapper(size);
          if (newValue !== undefined && newValue !== null) {
            updates[field] = newValue;
            hasChanges = true;
          }
        }
      }
      
      if (hasChanges) {
        await Size.updateOne({ _id: size._id }, { $set: updates });
        updated++;
        if (updated % 10 === 0) {
          console.log(`Updated ${updated} sizes...`);
        }
      }
    }
    
    console.log(`Migration complete! Updated ${updated} sizes.`);
    
    // Show a sample of updated sizes
    const sample = await Size.findOne({}).lean();
    console.log('\nSample size after migration:');
    console.log(JSON.stringify(sample, null, 2));
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrateSizes();
