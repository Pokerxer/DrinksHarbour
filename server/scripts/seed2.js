// Load environment variables FIRST
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Custom utilities
const slugify = require('../utils/slugify');

// Database connection
const db = require('../config/db');

// Models
const User = require('../models/user');
const Tenant = require('../models/tenant');
const Product = require('../models/product');
const SubProduct = require('../models/subProduct');
const Size = require('../models/size');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Brand = require('../models/Brand');
const Tag = require('../models/tag');
const Flavor = require('../models/Flavor');

// ============================================================
// CONFIGURATION
// ============================================================

const SEED_CONFIG = {
  createSuperAdmin: true,
  createFlavors: true,
  createTags: true,
  createCategories: true,
  createSubCategories: true,
  createBrands: true,
  createTenants: true,
  createProducts: true,
  createSubProducts: true,
  createSizes: true,
  createCustomers: true,
  
  counts: {
    products: parseInt(process.argv[2]) || 150, // Increased for comprehensive coverage
    customers: 20,
    subProductsPerProduct: 2,
    sizesPerSubProduct: 2,
  },
};

// Track created items
const createdSlugs = new Set();
const createdData = {
  users: [],
  tenants: [],
  categories: [],
  subCategories: [],
  brands: [],
  tags: [],
  flavors: [],
  products: [],
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Safe create - prevents duplicates
 */
async function safeCreate(Model, data, uniqueField = 'slug') {
  const existing = await Model.findOne({ [uniqueField]: data[uniqueField] });
  if (existing) {
    console.log(`  ℹ ${Model.modelName} "${data[uniqueField]}" already exists, skipping...`);
    return existing;
  }
  
  const created = await Model.create(data);
  console.log(`  ✓ Created ${Model.modelName}: ${data.name || data[uniqueField]}`);
  return created;
}

/**
 * Generate unique slug
 */
function generateUniqueSlug(name) {
  let slug = slugify.slugify(name);
  let counter = 1;
  
  while (createdSlugs.has(slug)) {
    slug = `${slugify(name)}-${counter}`;
    counter++;
  }
  
  createdSlugs.add(slug);
  return slug;
}

/**
 * Random selection helper
 */
function randomSelect(array, count = 1) {
  if (!array || !Array.isArray(array) || array.length === 0) {
    return [];
  }
  
  const validCount = Math.max(1, Math.min(count, array.length));
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  
  return shuffled.slice(0, validCount);
}

/**
 * Random selection helper - Returns single item or null
 */
function randomSelectOne(array) {
  if (!array || !Array.isArray(array) || array.length === 0) {
    return null;
  }
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Random number in range (inclusive)
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random from array (single item)
 */
function randomFrom(array) {
  if (!array || !Array.isArray(array) || array.length === 0) {
    return null;
  }
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Random boolean with probability
 */
function randomBool(probability = 0.5) {
  return Math.random() < probability;
}

// ============================================================
// COMPREHENSIVE PRODUCT IMAGES BY CATEGORY
// ============================================================

const PRODUCT_IMAGES = {
  // Beer Categories
  beer: [
    'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800',
    'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=800',
  ],
  lager: [
    'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=800',
    'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800',
  ],
  stout: [
    'https://images.unsplash.com/photo-1612528443702-f6741f70a049?w=800',
    'https://images.unsplash.com/photo-1608909063917-2c63a25f3ea0?w=800',
  ],
  porter: [
    'https://images.unsplash.com/photo-1566631221329-9d4cc34fd55d?w=800',
  ],
  ipa: [
    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
    'https://images.unsplash.com/photo-1513309914637-65c20a5962e1?w=800',
  ],
  
  // Wine Categories
  red_wine: [
    'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=800',
    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
    'https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?w=800',
  ],
  white_wine: [
    'https://images.unsplash.com/photo-1586370434639-0fe43b2d32d6?w=800',
    'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800',
    'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800',
  ],
  rose_wine: [
    'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=800',
    'https://images.unsplash.com/photo-1559388450-6d15b2a3a87c?w=800',
  ],
  champagne: [
    'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=800',
    'https://images.unsplash.com/photo-1598473445208-91323cf87d8c?w=800',
    'https://images.unsplash.com/photo-1519181245277-c0eaa9d7421b?w=800',
  ],
  sparkling_wine: [
    'https://images.unsplash.com/photo-1598473445208-91323cf87d8c?w=800',
  ],
  
  // Spirit Categories
  scotch: [
    'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800',
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
  ],
  bourbon: [
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800',
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
  ],
  rye_whiskey: [
    'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800',
  ],
  vodka: [
    'https://images.unsplash.com/photo-1560508801-cc96d8c6f022?w=800',
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
  ],
  gin: [
    'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=800',
    'https://images.unsplash.com/photo-1593766787879-e8c78e09cec5?w=800',
  ],
  rum: [
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800',
  ],
  tequila: [
    'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800',
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
  ],
  mezcal: [
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
  ],
  brandy: [
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800',
  ],
  cognac: [
    'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800',
  ],
  armagnac: [
    'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800',
  ],
  soju: [
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800',
  ],
  sake: [
    'https://images.unsplash.com/photo-1555043722-45240c63b0f6?w=800',
    'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800',
  ],
  liqueur: [
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800',
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
  ],
  
  // Non-Alcoholic Categories
  coffee: [
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
  ],
  tea: [
    'https://images.unsplash.com/photo-1561047029-3000c68339ca?w=800',
    'https://images.unsplash.com/photo-1561043846-6b3f16d5a6e5?w=800',
  ],
  herbal_tea: [
    'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a9?w=800',
  ],
  soft_drink: [
    'https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=800',
    'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=800',
  ],
  juice: [
    'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=800',
    'https://images.unsplash.com/photo-1603561596112-0a132b757442?w=800',
  ],
  water: [
    'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800',
    'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800',
  ],
  energy_drink: [
    'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=800',
    'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=800',
  ],
  sports_drink: [
    'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=800',
  ],
  milk: [
    'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800',
  ],
  plant_milk: [
    'https://images.unsplash.com/photo-1622244094231-776d4aa0f2b8?w=800',
  ],
  
  // Default fallback
  default: [
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800',
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
  ],
};

/**
 * Get default images for a product type
 */
function getDefaultProductImages(productType, count = 2) {
  // Try exact type match first
  let images = PRODUCT_IMAGES[productType];
  
  // Try to find by partial match
  if (!images || images.length === 0) {
    for (const key in PRODUCT_IMAGES) {
      if (productType.includes(key) || key.includes(productType)) {
        images = PRODUCT_IMAGES[key];
        break;
      }
    }
  }
  
  // Fallback to default
  if (!images || images.length === 0) {
    images = PRODUCT_IMAGES.default;
  }
  
  const selectedImages = [];
  for (let i = 0; i < Math.min(count, images.length); i++) {
    selectedImages.push({
      url: images[i],
      alt: `${productType} product image ${i + 1}`,
      isPrimary: i === 0,
      order: i,
      resourceType: 'image',
      format: 'jpg',
    });
  }
  
  return selectedImages;
}

// ============================================================
// ENHANCED FLAVORS DATA
// ============================================================

// ============================================================
// ENHANCED FLAVORS DATA WITH COLORS
// ============================================================

const FLAVORS_DATA = [
  // Fruits
  { name: 'Fruity', value: 'fruity', category: 'fruit', color: '#FF6B9D', intensity: 'moderate' },
  { name: 'Citrus', value: 'citrus', category: 'citrus', color: '#FFA500', intensity: 'pronounced' },
  { name: 'Tropical', value: 'tropical', category: 'tropical', color: '#FFD700', intensity: 'pronounced' },
  { name: 'Berry', value: 'berry', category: 'berry', color: '#8B008B', intensity: 'moderate' },
  { name: 'Apple', value: 'apple', category: 'fruit', color: '#90EE90', intensity: 'mild' },
  { name: 'Pear', value: 'pear', category: 'fruit', color: '#98FB98', intensity: 'mild' },
  { name: 'Stone Fruit', value: 'stone_fruit', category: 'stone_fruit', color: '#FFDAB9', intensity: 'moderate' },
  { name: 'Cherry', value: 'cherry', category: 'fruit', color: '#DC143C', intensity: 'moderate' },
  { name: 'Plum', value: 'plum', category: 'fruit', color: '#8B008B', intensity: 'moderate' },
  { name: 'Grape', value: 'grape', category: 'fruit', color: '#9370DB', intensity: 'pronounced' },
  { name: 'Peach', value: 'peach', category: 'fruit', color: '#FFDAB9', intensity: 'moderate' },
  { name: 'Apricot', value: 'apricot', category: 'fruit', color: '#F4A460', intensity: 'moderate' },
  { name: 'Fig', value: 'fig', category: 'fruit', color: '#556B2F', intensity: 'moderate' },
  { name: 'Date', value: 'date', category: 'fruit', color: '#8B4513', intensity: 'moderate' },
  
  // Sweet & Dessert
  { name: 'Vanilla', value: 'vanilla', category: 'sweet', color: '#F5DEB3', intensity: 'moderate' },
  { name: 'Caramel', value: 'caramel', category: 'sweet', color: '#D2691E', intensity: 'pronounced' },
  { name: 'Chocolate', value: 'chocolate', category: 'sweet', color: '#8B4513', intensity: 'pronounced' },
  { name: 'Dark Chocolate', value: 'dark_chocolate', category: 'sweet', color: '#3D2817', intensity: 'pronounced' },
  { name: 'Honey', value: 'honey', category: 'sweet', color: '#FFB347', intensity: 'moderate' },
  { name: 'Toffee', value: 'toffee', category: 'sweet', color: '#B8860B', intensity: 'moderate' },
  { name: 'Butterscotch', value: 'butterscotch', category: 'sweet', color: '#E6BE8A', intensity: 'moderate' },
  { name: 'Maple', value: 'maple', category: 'sweet', color: '#D2691E', intensity: 'moderate' },
  { name: 'Molasses', value: 'molasses', category: 'sweet', color: '#8B4513', intensity: 'pronounced' },
  { name: 'Candy', value: 'candy', category: 'sweet', color: '#FFB6C1', intensity: 'moderate' },
  
  // Spices & Herbs
  { name: 'Spicy', value: 'spicy', category: 'spice', color: '#DC143C', intensity: 'pronounced' },
  { name: 'Herbal', value: 'herbal', category: 'herb', color: '#228B22', intensity: 'moderate' },
  { name: 'Peppery', value: 'peppery', category: 'spice', color: '#696969', intensity: 'pronounced' },
  { name: 'Cinnamon', value: 'cinnamon', category: 'spice', color: '#A0522D', intensity: 'moderate' },
  { name: 'Ginger', value: 'ginger', category: 'spice', color: '#CD853F', intensity: 'pronounced' },
  { name: 'Clove', value: 'clove', category: 'spice', color: '#8B4513', intensity: 'pronounced' },
  { name: 'Nutmeg', value: 'nutmeg', category: 'spice', color: '#A0522D', intensity: 'moderate' },
  { name: 'Anise', value: 'anise', category: 'spice', color: '#808080', intensity: 'pronounced' },
  { name: 'Licorice', value: 'licorice', category: 'spice', color: '#1A1110', intensity: 'pronounced' },
  { name: 'Cardamom', value: 'cardamom', category: 'spice', color: '#6B8E23', intensity: 'moderate' },
  { name: 'Sage', value: 'sage', category: 'herb', color: '#778899', intensity: 'subtle' },
  { name: 'Rosemary', value: 'rosemary', category: 'herb', color: '#556B2F', intensity: 'moderate' },
  { name: 'Thyme', value: 'thyme', category: 'herb', color: '#808000', intensity: 'subtle' },
  { name: 'Mint', value: 'mint', category: 'herb', color: '#98FB98', intensity: 'moderate' },
  { name: 'Basil', value: 'basil', category: 'herb', color: '#556B2F', intensity: 'moderate' },
  
  // Floral
  { name: 'Floral', value: 'floral', category: 'floral', color: '#DDA0DD', intensity: 'subtle' },
  { name: 'Rose', value: 'rose', category: 'floral', color: '#FF69B4', intensity: 'subtle' },
  { name: 'Jasmine', value: 'jasmine', category: 'floral', color: '#FFFACD', intensity: 'subtle' },
  { name: 'Lavender', value: 'lavender', category: 'floral', color: '#E6E6FA', intensity: 'subtle' },
  { name: 'Honeysuckle', value: 'honeysuckle', category: 'floral', color: '#F0E68C', intensity: 'subtle' },
  { name: 'Violet', value: 'violet', category: 'floral', color: '#EE82EE', intensity: 'subtle' },
  { name: 'Elderflower', value: 'elderflower', category: 'floral', color: '#DDA0DD', intensity: 'subtle' },
  { name: 'Hibiscus', value: 'hibiscus', category: 'floral', color: '#FF69B4', intensity: 'moderate' },
  
  // Wood & Oak
  { name: 'Oak', value: 'oak', category: 'wood', color: '#8B7355', intensity: 'pronounced' },
  { name: 'Smoky', value: 'smoky', category: 'smoke', color: '#4A4A4A', intensity: 'intense' },
  { name: 'Woody', value: 'woody', category: 'wood', color: '#8B6914', intensity: 'moderate' },
  { name: 'Tobacco', value: 'tobacco', category: 'wood', color: '#8B7355', intensity: 'pronounced' },
  { name: 'Leather', value: 'leather', category: 'wood', color: '#8B4513', intensity: 'pronounced' },
  { name: 'Cedar', value: 'cedar', category: 'wood', color: '#8B7355', intensity: 'moderate' },
  { name: 'Pine', value: 'pine', category: 'wood', color: '#2E8B57', intensity: 'moderate' },
  { name: 'Sandalwood', value: 'sandalwood', category: 'wood', color: '#8B7355', intensity: 'subtle' },
  { name: 'Charred', value: 'charred', category: 'smoke', color: '#2F4F4F', intensity: 'intense' },
  { name: 'Burnt', value: 'burnt', category: 'smoke', color: '#2F4F4F', intensity: 'intense' },
  { name: 'Ash', value: 'ash', category: 'smoke', color: '#696969', intensity: 'pronounced' },
  { name: 'Peaty', value: 'peaty', category: 'smoke', color: '#8B7355', intensity: 'intense' },
  { name: 'Campfire', value: 'campfire', category: 'smoke', color: '#8B4513', intensity: 'pronounced' },
  { name: 'BBQ', value: 'bbq', category: 'smoke', color: '#8B4513', intensity: 'pronounced' },
  
  // Nuts & Grain
  { name: 'Nutty', value: 'nutty', category: 'nut', color: '#A0826D', intensity: 'moderate' },
  { name: 'Almond', value: 'almond', category: 'nut', color: '#F4A460', intensity: 'moderate' },
  { name: 'Hazelnut', value: 'hazelnut', category: 'nut', color: '#D2691E', intensity: 'moderate' },
  { name: 'Walnut', value: 'walnut', category: 'nut', color: '#8B4513', intensity: 'moderate' },
  { name: 'Pecan', value: 'pecan', category: 'nut', color: '#A0522D', intensity: 'moderate' },
  { name: 'Malty', value: 'malty', category: 'grain', color: '#B5651D', intensity: 'moderate' },
  { name: 'Toasted', value: 'toasted', category: 'grain', color: '#8B7355', intensity: 'moderate' },
  { name: 'Bread', value: 'bread', category: 'grain', color: '#D2B48C', intensity: 'moderate' },
  { name: 'Biscuit', value: 'biscuit', category: 'grain', color: '#F5DEB3', intensity: 'moderate' },
  { name: 'Grainy', value: 'grainy', category: 'grain', color: '#D2B48C', intensity: 'moderate' },
  { name: 'Toast', value: 'toast', category: 'grain', color: '#D2B48C', intensity: 'moderate' },
  
  // Coffee & Roasted
  { name: 'Coffee', value: 'coffee', category: 'coffee', color: '#6F4E37', intensity: 'pronounced' },
  { name: 'Espresso', value: 'espresso', category: 'coffee', color: '#3D2817', intensity: 'pronounced' },
  { name: 'Roasted', value: 'roasted', category: 'roasted', color: '#3D2817', intensity: 'pronounced' },
  { name: 'Cocoa', value: 'cocoa', category: 'coffee', color: '#8B4513', intensity: 'moderate' },
  
  // Cream & Dairy
  { name: 'Creamy', value: 'creamy', category: 'dairy', color: '#FFFACD', intensity: 'moderate' },
  { name: 'Buttery', value: 'buttery', category: 'dairy', color: '#FFDB58', intensity: 'moderate' },
  { name: 'Milky', value: 'milky', category: 'dairy', color: '#F5F5F5', intensity: 'mild' },
  { name: 'Yogurt', value: 'yogurt', category: 'dairy', color: '#F0FFF0', intensity: 'moderate' },
  { name: 'Cheese', value: 'cheese', category: 'dairy', color: '#FFD700', intensity: 'moderate' },
  
  // Earth & Mineral
  { name: 'Earthy', value: 'earthy', category: 'earth', color: '#8B4726', intensity: 'moderate' },
  { name: 'Mineral', value: 'mineral', category: 'mineral', color: '#708090', intensity: 'subtle' },
  { name: 'Slate', value: 'slate', category: 'mineral', color: '#708090', intensity: 'subtle' },
  { name: 'Chalk', value: 'chalk', category: 'mineral', color: '#F5F5F5', intensity: 'subtle' },
  { name: 'Petrol', value: 'petrol', category: 'mineral', color: '#2F4F4F', intensity: 'pronounced' },
  { name: 'Mushroom', value: 'mushroom', category: 'earth', color: '#8B7355', intensity: 'moderate' },
  { name: 'Truffle', value: 'truffle', category: 'earth', color: '#8B4513', intensity: 'pronounced' },
  { name: 'Forest Floor', value: 'forest_floor', category: 'earth', color: '#556B2F', intensity: 'moderate' },
  
  // Character
  { name: 'Dry', value: 'dry', category: 'other', color: '#D3D3D3', intensity: 'moderate' },
  { name: 'Bitter', value: 'bitter', category: 'other', color: '#556B2F', intensity: 'pronounced' },
  { name: 'Sweet', value: 'sweet', category: 'sweet', color: '#FFB6C1', intensity: 'moderate' },
  { name: 'Crisp', value: 'crisp', category: 'other', color: '#E0FFFF', intensity: 'pronounced' },
  { name: 'Smooth', value: 'smooth', category: 'other', color: '#F5F5F5', intensity: 'moderate' },
  { name: 'Acidic', value: 'acidic', category: 'other', color: '#FFA500', intensity: 'pronounced' },
  { name: 'Tart', value: 'tart', category: 'other', color: '#FFA500', intensity: 'pronounced' },
  { name: 'Tannic', value: 'tannic', category: 'other', color: '#8B4513', intensity: 'pronounced' },
  { name: 'Fresh', value: 'fresh', category: 'other', color: '#90EE90', intensity: 'moderate' },
  { name: 'Clean', value: 'clean', category: 'other', color: '#F5F5F5', intensity: 'moderate' },
  { name: 'Complex', value: 'complex', category: 'other', color: '#9370DB', intensity: 'pronounced' },
  { name: 'Balanced', value: 'balanced', category: 'other', color: '#98FB98', intensity: 'moderate' },
  { name: 'Rich', value: 'rich', category: 'other', color: '#8B4513', intensity: 'pronounced' },
  { name: 'Full', value: 'full', category: 'other', color: '#8B4513', intensity: 'pronounced' },
  { name: 'Light', value: 'light', category: 'other', color: '#F0E68C', intensity: 'subtle' },
  { name: 'Salty', value: 'salty', category: 'other', color: '#D3D3D3', intensity: 'moderate' },
  { name: 'Savory', value: 'savory', category: 'other', color: '#8B4513', intensity: 'moderate' },
  { name: 'Umami', value: 'umami', category: 'other', color: '#8B4513', intensity: 'pronounced' },
  { name: 'Sour', value: 'sour', category: 'other', color: '#32CD32', intensity: 'pronounced' },
];

// ============================================================
// ENHANCED TAGS DATA WITH COLORS AND CATEGORIES
// ============================================================

const TAGS_DATA = [
  // Occasions
  { name: 'Party', type: 'occasion', color: '#FF1493', category: 'seasonal' },
  { name: 'Celebration', type: 'occasion', color: '#FFD700', category: 'seasonal' },
  { name: 'Gift', type: 'occasion', color: '#FF69B4', category: 'promotional' },
  { name: 'Wedding', type: 'occasion', color: '#FFB6C1', category: 'seasonal' },
  { name: 'Anniversary', type: 'occasion', color: '#DDA0DD', category: 'seasonal' },
  { name: 'Birthday', type: 'occasion', color: '#FF69B4', category: 'seasonal' },
  { name: 'Graduation', type: 'occasion', color: '#9370DB', category: 'seasonal' },
  { name: 'Corporate Event', type: 'occasion', color: '#4682B4', category: 'lifestyle' },
  { name: 'Dinner Party', type: 'occasion', color: '#FF6347', category: 'lifestyle' },
  { name: 'Brunch', type: 'occasion', color: '#FFD700', category: 'lifestyle' },
  
  // Seasonal
  { name: 'Christmas', type: 'seasonal', color: '#DC143C', category: 'seasonal' },
  { name: 'New Year', type: 'seasonal', color: '#1E90FF', category: 'seasonal' },
  { name: 'Valentines', type: 'seasonal', color: '#FF69B4', category: 'seasonal' },
  { name: 'Thanksgiving', type: 'seasonal', color: '#D2691E', category: 'seasonal' },
  { name: 'Easter', type: 'seasonal', color: '#98FB98', category: 'seasonal' },
  { name: 'Halloween', type: 'seasonal', color: '#FF8C00', category: 'seasonal' },
  { name: 'Summer', type: 'season', color: '#FFA500', category: 'seasonal' },
  { name: 'Winter', type: 'season', color: '#4169E1', category: 'seasonal' },
  { name: 'Spring', type: 'season', color: '#98FB98', category: 'seasonal' },
  { name: 'Fall', type: 'season', color: '#D2691E', category: 'seasonal' },
  { name: 'Holiday Season', type: 'seasonal', color: '#DC143C', category: 'seasonal' },
  
  // Quality & Style
  { name: 'Premium', type: 'quality', color: '#DAA520', category: 'lifestyle' },
  { name: 'Luxury', type: 'quality', color: '#FFD700', category: 'lifestyle' },
  { name: 'Craft', type: 'style', color: '#8B4513', category: 'lifestyle' },
  { name: 'Artisanal', type: 'style', color: '#A0522D', category: 'lifestyle' },
  { name: 'Traditional', type: 'style', color: '#8B7355', category: 'lifestyle' },
  { name: 'Modern', type: 'style', color: '#4682B4', category: 'lifestyle' },
  { name: 'Classic', type: 'style', color: '#2F4F4F', category: 'lifestyle' },
  { name: 'Innovative', type: 'style', color: '#9370DB', category: 'lifestyle' },
  { name: 'Experimental', type: 'style', color: '#8A2BE2', category: 'lifestyle' },
  { name: 'Limited Edition', type: 'quality', color: '#9370DB', category: 'promotional' },
  { name: 'Small Batch', type: 'quality', color: '#A0522D', category: 'lifestyle' },
  { name: 'Single Barrel', type: 'quality', color: '#8B4513', category: 'lifestyle' },
  { name: 'Cask Strength', type: 'quality', color: '#8B0000', category: 'lifestyle' },
  
  // Popularity
  { name: 'Bestseller', type: 'popularity', color: '#32CD32', category: 'promotional' },
  { name: 'New Arrival', type: 'popularity', color: '#00CED1', category: 'promotional' },
  { name: 'Trending', type: 'popularity', color: '#FF4500', category: 'promotional' },
  { name: 'Popular', type: 'popularity', color: '#32CD32', category: 'promotional' },
  { name: 'Staff Pick', type: 'popularity', color: '#FFD700', category: 'promotional' },
  { name: 'Customer Favorite', type: 'popularity', color: '#32CD32', category: 'promotional' },
  
  // Awards & Recognition
  { name: 'Award Winning', type: 'award', color: '#FFD700', category: 'promotional' },
  { name: 'Gold Medal', type: 'award', color: '#FFD700', category: 'promotional' },
  { name: 'Silver Medal', type: 'award', color: '#C0C0C0', category: 'promotional' },
  { name: 'Bronze Medal', type: 'award', color: '#CD7F32', category: 'promotional' },
  { name: 'Highly Rated', type: 'award', color: '#FFD700', category: 'promotional' },
  { name: 'Critics Choice', type: 'award', color: '#4682B4', category: 'promotional' },
  
  // Dietary & Health
  { name: 'Organic', type: 'dietary', color: '#228B22', category: 'lifestyle' },
  { name: 'Vegan', type: 'dietary', color: '#32CD32', category: 'lifestyle' },
  { name: 'Vegetarian', type: 'dietary', color: '#90EE90', category: 'lifestyle' },
  { name: 'Gluten Free', type: 'dietary', color: '#90EE90', category: 'lifestyle' },
  { name: 'Dairy Free', type: 'dietary', color: '#98FB98', category: 'lifestyle' },
  { name: 'Low Calorie', type: 'dietary', color: '#98FB98', category: 'lifestyle' },
  { name: 'Sugar Free', type: 'dietary', color: '#00FA9A', category: 'lifestyle' },
  { name: 'Low Carb', type: 'dietary', color: '#90EE90', category: 'lifestyle' },
  { name: 'Kosher', type: 'dietary', color: '#4682B4', category: 'lifestyle' },
  { name: 'Halal', type: 'dietary', color: '#32CD32', category: 'lifestyle' },
  { name: 'Natural', type: 'dietary', color: '#98FB98', category: 'lifestyle' },
  { name: 'Biodynamic', type: 'dietary', color: '#556B2F', category: 'lifestyle' },
  
  // Production & Origin
  { name: 'Single Malt', type: 'production', color: '#8B4513', category: 'lifestyle' },
  { name: 'Blended', type: 'production', color: '#A0522D', category: 'lifestyle' },
  { name: 'Pot Still', type: 'production', color: '#8B7355', category: 'lifestyle' },
  { name: 'Column Still', type: 'production', color: '#708090', category: 'lifestyle' },
  { name: 'Barrel Aged', type: 'production', color: '#8B4513', category: 'lifestyle' },
  { name: 'Cask Aged', type: 'production', color: '#8B4513', category: 'lifestyle' },
  { name: 'Oak Aged', type: 'production', color: '#8B7355', category: 'lifestyle' },
  { name: 'Cold Brew', type: 'production', color: '#6F4E37', category: 'lifestyle' },
  { name: 'Handcrafted', type: 'production', color: '#A0522D', category: 'lifestyle' },
  { name: 'Small Production', type: 'production', color: '#8B7355', category: 'lifestyle' },
  
  // Pairing & Usage
  { name: 'Food Pairing', type: 'pairing', color: '#FF6347', category: 'other' },
  { name: 'Cocktail Ingredient', type: 'pairing', color: '#FF4500', category: 'other' },
  { name: 'Mixer', type: 'pairing', color: '#FF8C00', category: 'other' },
  { name: 'Dessert Pairing', type: 'pairing', color: '#D2691E', category: 'other' },
  { name: 'Cheese Pairing', type: 'pairing', color: '#FFD700', category: 'other' },
  { name: 'Seafood Pairing', type: 'pairing', color: '#1E90FF', category: 'other' },
  { name: 'Steak Pairing', type: 'pairing', color: '#8B0000', category: 'other' },
  { name: 'Chocolate Pairing', type: 'pairing', color: '#8B4513', category: 'other' },
  { name: 'BBQ Pairing', type: 'pairing', color: '#8B4513', category: 'other' },
  { name: 'Spicy Food Pairing', type: 'pairing', color: '#FF4500', category: 'other' },
  { name: 'Perfect for Cocktails', type: 'pairing', color: '#FF8C00', category: 'other' },
  { name: 'Sipping Spirit', type: 'pairing', color: '#8B4513', category: 'other' },
  { name: 'Aperitif', type: 'pairing', color: '#FFD700', category: 'other' },
  { name: 'Digestif', type: 'pairing', color: '#8B4513', category: 'other' },
  
  // Special Features
  { name: 'Local Favorite', type: 'feature', color: '#32CD32', category: 'promotional' },
  { name: 'Imported', type: 'feature', color: '#4682B4', category: 'lifestyle' },
  { name: 'Rare Find', type: 'feature', color: '#9370DB', category: 'promotional' },
  { name: 'Collector\'s Item', type: 'feature', color: '#FFD700', category: 'promotional' },
  { name: 'Age Statement', type: 'feature', color: '#8B4513', category: 'lifestyle' },
  { name: 'Vintage', type: 'feature', color: '#8B4513', category: 'lifestyle' },
  { name: 'Non-Vintage', type: 'feature', color: '#708090', category: 'lifestyle' },
  { name: 'Filtered', type: 'feature', color: '#F5F5F5', category: 'lifestyle' },
  { name: 'Unfiltered', type: 'feature', color: '#8B7355', category: 'lifestyle' },
  { name: 'Chill Filtered', type: 'feature', color: '#1E90FF', category: 'lifestyle' },
  { name: 'Non-Chill Filtered', type: 'feature', color: '#8B7355', category: 'lifestyle' },
  { name: 'Cask Finish', type: 'feature', color: '#8B4513', category: 'lifestyle' },
  { name: 'Sherry Cask', type: 'feature', color: '#8B0000', category: 'lifestyle' },
  { name: 'Bourbon Barrel', type: 'feature', color: '#8B4513', category: 'lifestyle' },
  { name: 'Port Cask', type: 'feature', color: '#8B0000', category: 'lifestyle' },
  { name: 'Virgin Oak', type: 'feature', color: '#8B7355', category: 'lifestyle' },
];
// ============================================================
// COMPREHENSIVE CATEGORIES DATA
// ============================================================

const CATEGORIES_DATA = [
  // Alcoholic Categories
  {
    name: 'Beer',
    type: 'beer',
    alcoholCategory: 'alcoholic',
    description: 'Craft beers, lagers, ales, stouts, porters, IPAs, and specialty beers from around the world.',
    shortDescription: 'Craft and commercial beers',
    tagline: 'Craft Your Perfect Pint',
    icon: '🍺',
    color: '#F59E0B',
    showOnHomepage: true,
    isFeatured: true,
    displayOrder: 1,
  },
  {
    name: 'Wine',
    type: 'wine',
    alcoholCategory: 'alcoholic',
    description: 'Fine wines including red, white, rosé, and specialty wines from renowned vineyards.',
    shortDescription: 'Premium wines for every palate',
    tagline: 'Uncork Excellence',
    icon: '🍷',
    color: '#991B1B',
    showOnHomepage: true,
    isFeatured: true,
    displayOrder: 2,
  },
  {
    name: 'Red Wine',
    type: 'red_wine',
    alcoholCategory: 'alcoholic',
    description: 'Full-bodied red wines including Cabernet Sauvignon, Merlot, Pinot Noir, and Shiraz.',
    shortDescription: 'Rich and robust red wines',
    tagline: 'Bold & Beautiful',
    icon: '🍷',
    color: '#7F1D1D',
    showOnHomepage: true,
    displayOrder: 3,
  },
  {
    name: 'White Wine',
    type: 'white_wine',
    alcoholCategory: 'alcoholic',
    description: 'Crisp and refreshing white wines including Chardonnay, Sauvignon Blanc, and Riesling.',
    shortDescription: 'Light and elegant white wines',
    tagline: 'Crisp & Refreshing',
    icon: '🥂',
    color: '#FBBF24',
    showOnHomepage: true,
    displayOrder: 4,
  },
  {
    name: 'Rosé Wine',
    type: 'rose_wine',
    alcoholCategory: 'alcoholic',
    description: 'Beautiful rosé wines perfect for warm days and celebrations.',
    shortDescription: 'Perfect pink wines',
    tagline: 'Pretty in Pink',
    icon: '🍷',
    color: '#FB7185',
    showOnHomepage: true,
    displayOrder: 5,
  },
  {
    name: 'Sparkling Wine',
    type: 'sparkling_wine',
    alcoholCategory: 'alcoholic',
    description: 'Bubbly delights including Prosecco, Cava, and other sparkling wines.',
    shortDescription: 'Celebratory sparkling wines',
    tagline: 'Pop the Celebration',
    icon: '🥂',
    color: '#FDE68A',
    showOnHomepage: true,
    displayOrder: 6,
  },
  {
    name: 'Champagne',
    type: 'champagne',
    alcoholCategory: 'alcoholic',
    description: 'The finest French Champagne for special occasions.',
    shortDescription: 'Luxury French Champagne',
    tagline: 'Luxury in a Bottle',
    icon: '🍾',
    color: '#FEF3C7',
    showOnHomepage: true,
    isFeatured: true,
    displayOrder: 7,
  },
  {
    name: 'Prosecco',
    type: 'prosecco',
    alcoholCategory: 'alcoholic',
    description: 'Italian sparkling wine perfect for celebrations.',
    shortDescription: 'Italian sparkling wine',
    tagline: 'Italian Bubbles',
    icon: '🥂',
    color: '#FEF3C7',
    showOnHomepage: false,
    displayOrder: 8,
  },
  {
    name: 'Cava',
    type: 'cava',
    alcoholCategory: 'alcoholic',
    description: 'Spanish sparkling wine made using traditional methods.',
    shortDescription: 'Spanish sparkling wine',
    tagline: 'Spanish Sparkle',
    icon: '🥂',
    color: '#FEF3C7',
    showOnHomepage: false,
    displayOrder: 9,
  },
  {
    name: 'Whiskey',
    type: 'whiskey',
    alcoholCategory: 'alcoholic',
    description: 'Premium whiskeys including Scotch, Bourbon, and Rye.',
    shortDescription: 'World-class whiskeys',
    tagline: 'Sip & Savor',
    icon: '🥃',
    color: '#92400E',
    showOnHomepage: true,
    isFeatured: true,
    displayOrder: 10,
  },
  {
    name: 'Scotch',
    type: 'scotch',
    alcoholCategory: 'alcoholic',
    description: 'Single malt and blended Scotch whiskies from Scotland.',
    shortDescription: 'Authentic Scotch whisky',
    tagline: 'Scottish Heritage',
    icon: '🥃',
    color: '#78350F',
    showOnHomepage: true,
    displayOrder: 11,
  },
  {
    name: 'Bourbon',
    type: 'bourbon',
    alcoholCategory: 'alcoholic',
    description: 'American bourbon whiskey, aged in new charred oak barrels.',
    shortDescription: 'American classic bourbon',
    tagline: 'American Spirit',
    icon: '🥃',
    color: '#92400E',
    showOnHomepage: true,
    displayOrder: 12,
  },
  {
    name: 'Rye Whiskey',
    type: 'rye_whiskey',
    alcoholCategory: 'alcoholic',
    description: 'Spicy rye whiskey, perfect for cocktails.',
    shortDescription: 'Spicy rye whiskey',
    tagline: 'Bold & Spicy',
    icon: '🥃',
    color: '#78350F',
    showOnHomepage: false,
    displayOrder: 13,
  },
  {
    name: 'Vodka',
    type: 'vodka',
    alcoholCategory: 'alcoholic',
    description: 'Premium vodkas from around the world.',
    shortDescription: 'Clean and smooth vodka',
    tagline: 'Pure & Clean',
    icon: '🥃',
    color: '#D1D5DB',
    showOnHomepage: true,
    displayOrder: 14,
  },
  {
    name: 'Gin',
    type: 'gin',
    alcoholCategory: 'alcoholic',
    description: 'Botanical gins with juniper and aromatic herbs.',
    shortDescription: 'Botanical gin spirits',
    tagline: 'Botanical Bliss',
    icon: '🍸',
    color: '#A7F3D0',
    showOnHomepage: true,
    displayOrder: 15,
  },
  {
    name: 'Rum',
    type: 'rum',
    alcoholCategory: 'alcoholic',
    description: 'Caribbean and premium rums from around the world.',
    shortDescription: 'Tropical rum spirits',
    tagline: 'Tropical Vibes',
    icon: '🥃',
    color: '#FBBF24',
    showOnHomepage: true,
    displayOrder: 16,
  },
  {
    name: 'Tequila',
    type: 'tequila',
    alcoholCategory: 'alcoholic',
    description: 'Authentic Mexican tequila made from blue agave.',
    shortDescription: 'Mexican tequila',
    tagline: 'Mexican Spirit',
    icon: '🥃',
    color: '#10B981',
    showOnHomepage: true,
    displayOrder: 17,
  },
  {
    name: 'Mezcal',
    type: 'mezcal',
    alcoholCategory: 'alcoholic',
    description: 'Smoky Mexican spirit made from agave.',
    shortDescription: 'Smoky Mexican spirit',
    tagline: 'Smoky & Sophisticated',
    icon: '🥃',
    color: '#065F46',
    showOnHomepage: false,
    displayOrder: 18,
  },
  {
    name: 'Brandy',
    type: 'brandy',
    alcoholCategory: 'alcoholic',
    description: 'Fine brandies and cognac for sipping.',
    shortDescription: 'Premium brandy spirits',
    tagline: 'Elegant & Refined',
    icon: '🥃',
    color: '#92400E',
    showOnHomepage: false,
    displayOrder: 19,
  },
  {
    name: 'Cognac',
    type: 'cognac',
    alcoholCategory: 'alcoholic',
    description: 'French cognac, the king of brandies.',
    shortDescription: 'French luxury cognac',
    tagline: 'French Luxury',
    icon: '🥃',
    color: '#78350F',
    showOnHomepage: true,
    displayOrder: 20,
  },
  {
    name: 'Armagnac',
    type: 'armagnac',
    alcoholCategory: 'alcoholic',
    description: 'French armagnac, oldest brandy of France.',
    shortDescription: 'French armagnac brandy',
    tagline: 'French Heritage',
    icon: '🥃',
    color: '#78350F',
    showOnHomepage: false,
    displayOrder: 21,
  },
  {
    name: 'Sake',
    type: 'sake',
    alcoholCategory: 'alcoholic',
    description: 'Japanese rice wine, traditional and premium.',
    shortDescription: 'Japanese rice wine',
    tagline: 'Japanese Tradition',
    icon: '🍶',
    color: '#EF4444',
    showOnHomepage: false,
    displayOrder: 22,
  },
  {
    name: 'Soju',
    type: 'soju',
    alcoholCategory: 'alcoholic',
    description: 'Korean distilled spirit, smooth and versatile.',
    shortDescription: 'Korean distilled spirit',
    tagline: 'Korean Spirit',
    icon: '🥃',
    color: '#3B82F6',
    showOnHomepage: false,
    displayOrder: 23,
  },
  {
    name: 'Baijiu',
    type: 'baijiu',
    alcoholCategory: 'alcoholic',
    description: 'Chinese distilled spirit, national drink of China.',
    shortDescription: 'Chinese distilled spirit',
    tagline: 'Chinese Tradition',
    icon: '🥃',
    color: '#DC2626',
    showOnHomepage: false,
    displayOrder: 24,
  },
  {
    name: 'Shochu',
    type: 'shochu',
    alcoholCategory: 'alcoholic',
    description: 'Japanese distilled beverage, versatile and smooth.',
    shortDescription: 'Japanese distilled spirit',
    tagline: 'Japanese Craft',
    icon: '🥃',
    color: '#EF4444',
    showOnHomepage: false,
    displayOrder: 25,
  },
  {
    name: 'Liqueurs',
    type: 'liqueur',
    alcoholCategory: 'alcoholic',
    description: 'Sweet and flavorful liqueurs for cocktails and sipping.',
    shortDescription: 'Premium liqueurs and cordials',
    tagline: 'Sweet Sophistication',
    icon: '🍸',
    color: '#EC4899',
    showOnHomepage: true,
    displayOrder: 26,
  },
  {
    name: 'Cider & Perry',
    type: 'cider',
    alcoholCategory: 'alcoholic',
    description: 'Hard cider and perry made from apples and pears.',
    shortDescription: 'Hard cider and perry',
    tagline: 'Fruity & Refreshing',
    icon: '🍎',
    color: '#10B981',
    showOnHomepage: false,
    displayOrder: 27,
  },
  {
    name: 'Mead',
    type: 'mead',
    alcoholCategory: 'alcoholic',
    description: 'Ancient honey wine, traditional and modern varieties.',
    shortDescription: 'Honey wine mead',
    tagline: 'Ancient Nectar',
    icon: '🍯',
    color: '#F59E0B',
    showOnHomepage: false,
    displayOrder: 28,
  },
  {
    name: 'Sherry',
    type: 'sherry',
    alcoholCategory: 'alcoholic',
    description: 'Spanish fortified wine, diverse styles.',
    shortDescription: 'Spanish fortified wine',
    tagline: 'Spanish Fortified',
    icon: '🍷',
    color: '#92400E',
    showOnHomepage: false,
    displayOrder: 29,
  },
  {
    name: 'Port',
    type: 'port',
    alcoholCategory: 'alcoholic',
    description: 'Portuguese fortified wine, rich and sweet.',
    shortDescription: 'Portuguese fortified wine',
    tagline: 'Portuguese Richness',
    icon: '🍷',
    color: '#7F1D1D',
    showOnHomepage: false,
    displayOrder: 30,
  },
  {
    name: 'Vermouth',
    type: 'vermouth',
    alcoholCategory: 'alcoholic',
    description: 'Aromatized fortified wine, perfect for cocktails.',
    shortDescription: 'Fortified aromatized wine',
    tagline: 'Cocktail Essential',
    icon: '🍸',
    color: '#A855F7',
    showOnHomepage: false,
    displayOrder: 31,
  },
  
  // Non-Alcoholic Categories
  {
    name: 'Coffee',
    type: 'coffee',
    alcoholCategory: 'non_alcoholic',
    description: 'Premium coffee beans, ground coffee, and specialty brews.',
    shortDescription: 'Artisan coffee',
    tagline: 'Awaken Your Senses',
    icon: '☕',
    color: '#78350F',
    showOnHomepage: true,
    displayOrder: 32,
  },
  {
    name: 'Tea',
    type: 'tea',
    alcoholCategory: 'non_alcoholic',
    description: 'Fine teas from around the world, traditional and herbal.',
    shortDescription: 'Premium teas',
    tagline: 'Steeped in Tradition',
    icon: '🍵',
    color: '#10B981',
    showOnHomepage: true,
    displayOrder: 33,
  },
  {
    name: 'Herbal Tea',
    type: 'herbal_tea',
    alcoholCategory: 'non_alcoholic',
    description: 'Caffeine-free herbal infusions and tisanes.',
    shortDescription: 'Herbal infusions',
    tagline: 'Natural Wellness',
    icon: '🌿',
    color: '#10B981',
    showOnHomepage: false,
    displayOrder: 34,
  },
  {
    name: 'Iced Tea',
    type: 'iced_tea',
    alcoholCategory: 'non_alcoholic',
    description: 'Refreshing iced tea, sweetened and unsweetened.',
    shortDescription: 'Chilled tea beverages',
    tagline: 'Cool Refreshment',
    icon: '🥤',
    color: '#10B981',
    showOnHomepage: false,
    displayOrder: 35,
  },
  {
    name: 'Iced Coffee',
    type: 'iced_coffee',
    alcoholCategory: 'non_alcoholic',
    description: 'Cold brew and iced coffee beverages.',
    shortDescription: 'Chilled coffee drinks',
    tagline: 'Cold Caffeine',
    icon: '🥤',
    color: '#78350F',
    showOnHomepage: false,
    displayOrder: 36,
  },
  {
    name: 'Soft Drinks',
    type: 'soft_drink',
    alcoholCategory: 'non_alcoholic',
    description: 'Sodas, colas, and carbonated soft drinks.',
    shortDescription: 'Carbonated beverages',
    tagline: 'Refresh Yourself',
    icon: '🥤',
    color: '#EF4444',
    showOnHomepage: true,
    displayOrder: 37,
  },
  {
    name: 'Soda',
    type: 'soda',
    alcoholCategory: 'non_alcoholic',
    description: 'Carbonated soft drinks and mixers.',
    shortDescription: 'Carbonated drinks',
    tagline: 'Fizzy Refreshment',
    icon: '🥤',
    color: '#EF4444',
    showOnHomepage: false,
    displayOrder: 38,
  },
  {
    name: 'Juice',
    type: 'juice',
    alcoholCategory: 'non_alcoholic',
    description: 'Fresh fruit and vegetable juices.',
    shortDescription: 'Fresh pressed juices',
    tagline: 'Nature\'s Nectar',
    icon: '🧃',
    color: '#10B981',
    showOnHomepage: true,
    displayOrder: 39,
  },
  {
    name: 'Water',
    type: 'water',
    alcoholCategory: 'non_alcoholic',
    description: 'Still, sparkling, and mineral waters.',
    shortDescription: 'Pure hydration',
    tagline: 'Pure & Simple',
    icon: '💧',
    color: '#0EA5E9',
    showOnHomepage: true,
    displayOrder: 40,
  },
  {
    name: 'Sparkling Water',
    type: 'sparkling_water',
    alcoholCategory: 'non_alcoholic',
    description: 'Carbonated water, plain and flavored.',
    shortDescription: 'Bubbly water',
    tagline: 'Effervescent Hydration',
    icon: '💧',
    color: '#0EA5E9',
    showOnHomepage: false,
    displayOrder: 41,
  },
  {
    name: 'Seltzer',
    type: 'seltzer',
    alcoholCategory: 'non_alcoholic',
    description: 'Carbonated water with natural flavors.',
    shortDescription: 'Flavored sparkling water',
    tagline: 'Light & Bubbly',
    icon: '💧',
    color: '#0EA5E9',
    showOnHomepage: false,
    displayOrder: 42,
  },
  {
    name: 'Lemonade',
    type: 'lemonade',
    alcoholCategory: 'non_alcoholic',
    description: 'Classic lemonade and limeade.',
    shortDescription: 'Citrus refreshment',
    tagline: 'Zesty & Sweet',
    icon: '🍋',
    color: '#FBBF24',
    showOnHomepage: false,
    displayOrder: 43,
  },
  {
    name: 'Limeade',
    type: 'limeade',
    alcoholCategory: 'non_alcoholic',
    description: 'Refreshing lime-based beverages.',
    shortDescription: 'Lime citrus drink',
    tagline: 'Tangy Refreshment',
    icon: '🍋',
    color: '#84CC16',
    showOnHomepage: false,
    displayOrder: 44,
  },
  {
    name: 'Milk',
    type: 'milk',
    alcoholCategory: 'non_alcoholic',
    description: 'Dairy milk and milk-based drinks.',
    shortDescription: 'Dairy beverages',
    tagline: 'Creamy Goodness',
    icon: '🥛',
    color: '#F3F4F6',
    showOnHomepage: false,
    displayOrder: 45,
  },
  {
    name: 'Plant Milk',
    type: 'plant_milk',
    alcoholCategory: 'non_alcoholic',
    description: 'Non-dairy milk alternatives.',
    shortDescription: 'Plant-based milk',
    tagline: 'Plant Powered',
    icon: '🌱',
    color: '#10B981',
    showOnHomepage: false,
    displayOrder: 46,
  },
  {
    name: 'Buttermilk',
    type: 'buttermilk',
    alcoholCategory: 'non_alcoholic',
    description: 'Cultured buttermilk and drinking yogurt.',
    shortDescription: 'Cultured dairy drinks',
    tagline: 'Traditional & Tangy',
    icon: '🥛',
    color: '#F3F4F6',
    showOnHomepage: false,
    displayOrder: 47,
  },
  {
    name: 'Yogurt Drink',
    type: 'yogurt_drink',
    alcoholCategory: 'non_alcoholic',
    description: 'Drinking yogurt and smoothies.',
    shortDescription: 'Probiotic drinks',
    tagline: 'Gut-Friendly',
    icon: '🥛',
    color: '#F3F4F6',
    showOnHomepage: false,
    displayOrder: 48,
  },
  {
    name: 'Kefir',
    type: 'kefir',
    alcoholCategory: 'non_alcoholic',
    description: 'Fermented milk drink, rich in probiotics.',
    shortDescription: 'Fermented probiotic drink',
    tagline: 'Ancient Probiotic',
    icon: '🥛',
    color: '#F3F4F6',
    showOnHomepage: false,
    displayOrder: 49,
  },
  {
    name: 'Energy Drinks',
    type: 'energy_drink',
    alcoholCategory: 'non_alcoholic',
    description: 'Energy and performance drinks.',
    shortDescription: 'Energy boost drinks',
    tagline: 'Fuel Your Day',
    icon: '⚡',
    color: '#3B82F6',
    showOnHomepage: true,
    displayOrder: 50,
  },
  {
    name: 'Sports Drinks',
    type: 'sports_drink',
    alcoholCategory: 'non_alcoholic',
    description: 'Electrolyte and hydration drinks for athletes.',
    shortDescription: 'Athletic hydration',
    tagline: 'Performance Hydration',
    icon: '🏃',
    color: '#3B82F6',
    showOnHomepage: false,
    displayOrder: 51,
  },
  {
    name: 'Vitamin Water',
    type: 'vitamin_water',
    alcoholCategory: 'non_alcoholic',
    description: 'Enhanced water with vitamins and minerals.',
    shortDescription: 'Vitamin-infused water',
    tagline: 'Enhanced Hydration',
    icon: '💧',
    color: '#0EA5E9',
    showOnHomepage: false,
    displayOrder: 52,
  },
  {
    name: 'Probiotic Drink',
    type: 'probiotic_drink',
    alcoholCategory: 'non_alcoholic',
    description: 'Kombucha and other fermented probiotic beverages.',
    shortDescription: 'Fermented health drinks',
    tagline: 'Gut Health',
    icon: '🥤',
    color: '#10B981',
    showOnHomepage: false,
    displayOrder: 53,
  },
  {
    name: 'Meal Replacement Shake',
    type: 'meal_replacement_shake',
    alcoholCategory: 'non_alcoholic',
    description: 'Nutritionally complete meal replacement shakes.',
    shortDescription: 'Nutrition shakes',
    tagline: 'Complete Nutrition',
    icon: '🥤',
    color: '#8B5CF6',
    showOnHomepage: false,
    displayOrder: 54,
  },
  {
    name: 'Non-Alcoholic Beer & Wine',
    type: 'non_alcoholic_beer_wine',
    alcoholCategory: 'alcohol_free',
    description: 'Alcohol-free alternatives to beer and wine.',
    shortDescription: 'Alcohol-free alternatives',
    tagline: 'All Flavor, No Alcohol',
    icon: '🍺',
    color: '#10B981',
    showOnHomepage: true,
    displayOrder: 55,
  },
  {
    name: 'Mocktails',
    type: 'mocktail',
    alcoholCategory: 'alcohol_free',
    description: 'Sophisticated non-alcoholic mixed drinks.',
    shortDescription: 'Alcohol-free cocktails',
    tagline: 'Craft Without Alcohol',
    icon: '🍹',
    color: '#EC4899',
    showOnHomepage: true,
    displayOrder: 56,
  },
  {
    name: 'Mixers',
    type: 'mixer',
    alcoholCategory: 'mixed',
    description: 'Cocktail mixers and ingredients.',
    shortDescription: 'Cocktail ingredients',
    tagline: 'Perfect Your Mix',
    icon: '🍸',
    color: '#8B5CF6',
    showOnHomepage: false,
    displayOrder: 57,
  },
  {
    name: 'Syrup',
    type: 'syrup',
    alcoholCategory: 'non_alcoholic',
    description: 'Simple syrups and flavored syrups for drinks.',
    shortDescription: 'Drink syrups',
    tagline: 'Sweeten Your Sip',
    icon: '🍯',
    color: '#F59E0B',
    showOnHomepage: false,
    displayOrder: 58,
  },
  {
    name: 'Bitters',
    type: 'bitters',
    alcoholCategory: 'alcoholic',
    description: 'Cocktail bitters for flavor enhancement.',
    shortDescription: 'Cocktail flavoring',
    tagline: 'Essence of Flavor',
    icon: '💧',
    color: '#78350F',
    showOnHomepage: false,
    displayOrder: 59,
  },
  {
    name: 'Tonic Water',
    type: 'tonic_water',
    alcoholCategory: 'non_alcoholic',
    description: 'Tonic water and other cocktail mixers.',
    shortDescription: 'Gin mixer essential',
    tagline: 'Classic Mixer',
    icon: '🥤',
    color: '#0EA5E9',
    showOnHomepage: false,
    displayOrder: 60,
  },
];

// ============================================================
// COMPREHENSIVE SUBCATEGORIES DATA
// ============================================================

const SUBCATEGORIES_DATA = {
  // Beer Subcategories
  'Beer': [
    {
      name: 'Pale Ale',
      type: 'pale_ale',
      description: 'Classic pale ales with balanced hop and malt character.',
      characteristics: {
        abvRange: { min: 4.5, max: 6.2 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
        bitterness: 'medium',
      },
      typicalFlavors: ['citrus', 'pine', 'malty', 'balanced'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'India Pale Ale',
      type: 'india_pale_ale',
      description: 'Hop-forward IPAs with bold aromas and flavors.',
      characteristics: {
        abvRange: { min: 6, max: 7.5 },
        colorProfile: 'Golden to deep amber',
        bodyStyle: 'medium_full',
        bitterness: 'high',
      },
      typicalFlavors: ['hoppy', 'citrus', 'tropical', 'pine'],
      seasonal: { summer: true },
    },
    {
      name: 'Stout',
      type: 'stout',
      description: 'Dark, roasted beers with rich, complex flavors.',
      characteristics: {
        abvRange: { min: 4, max: 8 },
        colorProfile: 'Deep brown to black',
        bodyStyle: 'full',
        bitterness: 'medium',
      },
      typicalFlavors: ['roasted', 'coffee', 'chocolate', 'creamy'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Porter',
      type: 'porter',
      description: 'Dark beer with chocolate and caramel notes.',
      characteristics: {
        abvRange: { min: 4.5, max: 6.5 },
        colorProfile: 'Dark brown',
        bodyStyle: 'medium_full',
        bitterness: 'medium',
      },
      typicalFlavors: ['chocolate', 'caramel', 'roasted', 'nutty'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Lager',
      type: 'lager',
      description: 'Crisp, clean, and refreshing beers.',
      characteristics: {
        abvRange: { min: 4, max: 6 },
        colorProfile: 'Pale golden to amber',
        bodyStyle: 'light_medium',
        bitterness: 'low',
      },
      typicalFlavors: ['crisp', 'clean', 'malty', 'subtle'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Pilsner',
      type: 'pilsner',
      description: 'Classic Czech/German style pale lager.',
      characteristics: {
        abvRange: { min: 4.5, max: 5.5 },
        colorProfile: 'Pale golden',
        bodyStyle: 'light_medium',
        bitterness: 'medium',
      },
      typicalFlavors: ['crisp', 'grassy', 'floral', 'clean'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Wheat Beer',
      type: 'wheat_beer',
      description: 'Beers brewed with significant wheat content.',
      characteristics: {
        abvRange: { min: 4.5, max: 5.5 },
        colorProfile: 'Pale to golden',
        bodyStyle: 'medium',
        bitterness: 'low',
      },
      typicalFlavors: ['citrus', 'banana', 'clove', 'refreshing'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Sour Beer',
      type: 'sour_beer',
      description: 'Tart and acidic beers with complex fermentation.',
      characteristics: {
        abvRange: { min: 3, max: 6 },
        colorProfile: 'Various',
        bodyStyle: 'light_medium',
        acidity: 'high',
      },
      typicalFlavors: ['tart', 'fruity', 'funky', 'complex'],
      seasonal: { spring: true, summer: true },
    },
  ],
  
  // Red Wine Subcategories
  'Red Wine': [
    {
      name: 'Cabernet Sauvignon',
      type: 'cabernet_sauvignon',
      description: 'Full-bodied red wine with bold tannins and dark fruit flavors.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Deep ruby to garnet',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'high',
      },
      typicalFlavors: ['blackcurrant', 'cherry', 'cedar', 'tobacco'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Merlot',
      type: 'merlot',
      description: 'Medium to full-bodied red with soft tannins and plum flavors.',
      characteristics: {
        abvRange: { min: 13, max: 14.5 },
        colorProfile: 'Ruby red',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['plum', 'black cherry', 'chocolate', 'herbal'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Pinot Noir',
      type: 'pinot_noir',
      description: 'Light to medium-bodied red with delicate aromas.',
      characteristics: {
        abvRange: { min: 12, max: 14 },
        colorProfile: 'Light ruby to garnet',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        tannins: 'low',
      },
      typicalFlavors: ['cherry', 'raspberry', 'mushroom', 'earth'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Syrah/Shiraz',
      type: 'syrah',
      description: 'Full-bodied red with spicy, dark fruit character.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Deep purple to ruby',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'high',
      },
      typicalFlavors: ['blackberry', 'pepper', 'smoke', 'licorice'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Malbec',
      type: 'malbec',
      description: 'Full-bodied red with dark fruit and velvety texture.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Deep purple',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'medium_high',
      },
      typicalFlavors: ['plum', 'blackberry', 'cocoa', 'violets'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Zinfandel',
      type: 'zinfandel',
      description: 'Medium to full-bodied red with jammy fruit flavors.',
      characteristics: {
        abvRange: { min: 14, max: 16 },
        colorProfile: 'Ruby to garnet',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['jammy', 'blackberry', 'pepper', 'spice'],
      seasonal: { fall: true, winter: true },
    },
  ],
  
  // White Wine Subcategories
  'White Wine': [
    {
      name: 'Chardonnay',
      type: 'chardonnay',
      description: 'Versatile white wine ranging from crisp to buttery.',
      characteristics: {
        abvRange: { min: 12.5, max: 14.5 },
        colorProfile: 'Pale straw to golden',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['apple', 'citrus', 'vanilla', 'butter'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Sauvignon Blanc',
      type: 'sauvignon_blanc',
      description: 'Crisp, aromatic white with herbaceous notes.',
      characteristics: {
        abvRange: { min: 12, max: 14 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        acidity: 'high',
      },
      typicalFlavors: ['citrus', 'grass', 'gooseberry', 'mineral'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Pinot Grigio',
      type: 'pinot_grigio',
      description: 'Light, crisp Italian white wine.',
      characteristics: {
        abvRange: { min: 11.5, max: 13.5 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['citrus', 'green apple', 'pear', 'mineral'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Riesling',
      type: 'riesling',
      description: 'Aromatic white ranging from dry to sweet.',
      characteristics: {
        abvRange: { min: 8, max: 13 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'varies',
        acidity: 'high',
      },
      typicalFlavors: ['apricot', 'peach', 'honey', 'petrol'],
      seasonal: { spring: true, summer: true },
    },
  ],
  
  // Rosé Wine Subcategories
  'Rosé Wine': [
    {
      name: 'Provence Rosé',
      type: 'provencal_rose',
      description: 'Dry, pale rosé from Provence, France.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Pale pink',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        acidity: 'medium_high',
      },
      typicalFlavors: ['strawberry', 'citrus', 'melon', 'mineral'],
      seasonal: { spring: true, summer: true },
    },
  ],
  
  // Scotch Subcategories
  'Scotch': [
    {
      name: 'Single Malt Scotch',
      type: 'single_malt',
      description: 'Scotch whisky from a single distillery.',
      characteristics: {
        abvRange: { min: 40, max: 60 },
        colorProfile: 'Golden to deep amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['smoky', 'peaty', 'oak', 'fruit'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Blended Scotch',
      type: 'blended_grain',
      description: 'Blended Scotch whisky from multiple distilleries.',
      characteristics: {
        abvRange: { min: 40, max: 43 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['smooth', 'balanced', 'vanilla', 'spice'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Islay Scotch',
      type: 'islay_whisky',
      description: 'Peaty, smoky Scotch from Islay region.',
      characteristics: {
        abvRange: { min: 43, max: 60 },
        colorProfile: 'Golden to deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['peaty', 'smoky', 'medicinal', 'sea salt'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Speyside Scotch',
      type: 'speyside_whisky',
      description: 'Smooth, fruity Scotch from Speyside region.',
      characteristics: {
        abvRange: { min: 40, max: 46 },
        colorProfile: 'Golden',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['fruity', 'honey', 'vanilla', 'spice'],
      seasonal: { fall: true, winter: true },
    },
  ],
  
  // Bourbon Subcategories
  'Bourbon': [
    {
      name: 'Straight Bourbon',
      type: 'bourbon',
      description: 'Classic American bourbon whiskey.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Amber to deep amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['vanilla', 'caramel', 'oak', 'sweet'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Small Batch Bourbon',
      type: 'bourbon',
      description: 'Premium bourbon from select barrels.',
      characteristics: {
        abvRange: { min: 45, max: 55 },
        colorProfile: 'Deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['complex', 'rich', 'oak', 'spice'],
      seasonal: { fall: true, winter: true },
    },
  ],
  
  // Rye Whiskey Subcategories
  'Rye Whiskey': [
    {
      name: 'Straight Rye Whiskey',
      type: 'rye_whiskey',
      description: 'Spicy rye whiskey with bold character.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['spicy', 'peppery', 'herbal', 'dry'],
      seasonal: { fall: true, winter: true },
    },
  ],
  
  // Vodka Subcategories
  'Vodka': [
    {
      name: 'Premium Vodka',
      type: 'premium_vodka',
      description: 'High-quality, smooth vodka.',
      characteristics: {
        abvRange: { min: 37.5, max: 40 },
        colorProfile: 'Clear',
        bodyStyle: 'light',
      },
      typicalFlavors: ['clean', 'smooth', 'neutral', 'crisp'],
    },
    {
      name: 'Flavored Vodka',
      type: 'flavored_vodka',
      description: 'Vodka infused with natural flavors.',
      characteristics: {
        abvRange: { min: 35, max: 40 },
        colorProfile: 'Clear to tinted',
        bodyStyle: 'light',
      },
      typicalFlavors: ['citrus', 'berry', 'vanilla', 'pepper'],
      seasonal: { spring: true, summer: true },
    },
  ],
  
  // Gin Subcategories
  'Gin': [
    {
      name: 'London Dry Gin',
      type: 'london_dry_gin',
      description: 'Classic juniper-forward gin.',
      characteristics: {
        abvRange: { min: 37.5, max: 47 },
        colorProfile: 'Clear',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['juniper', 'citrus', 'spice', 'dry'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Contemporary Gin',
      type: 'contemporary_gin',
      description: 'Modern gin with innovative botanicals.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Clear',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['floral', 'fruity', 'herbal', 'complex'],
      seasonal: { spring: true, summer: true },
    },
  ],
  
  // Rum Subcategories
  'Rum': [
    {
      name: 'White Rum',
      type: 'white_rum',
      description: 'Clear, light rum for cocktails.',
      characteristics: {
        abvRange: { min: 37.5, max: 40 },
        colorProfile: 'Clear',
        bodyStyle: 'light',
      },
      typicalFlavors: ['sugarcane', 'vanilla', 'smooth', 'clean'],
      seasonal: { summer: true },
    },
    {
      name: 'Dark Rum',
      type: 'dark_rum',
      description: 'Aged rum with rich, complex flavors.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Amber to dark brown',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['caramel', 'spice', 'oak', 'tropical'],
      seasonal: { fall: true, winter: true },
    },
  ],
  
  // Tequila Subcategories
  'Tequila': [
    {
      name: 'Blanco Tequila',
      type: 'blanco_tequila',
      description: 'Unaged tequila with pure agave flavor.',
      characteristics: {
        abvRange: { min: 38, max: 40 },
        colorProfile: 'Clear',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['agave', 'citrus', 'pepper', 'herbal'],
      seasonal: { summer: true },
    },
    {
      name: 'Reposado Tequila',
      type: 'reposado_tequila',
      description: 'Tequila aged 2-12 months in oak.',
      characteristics: {
        abvRange: { min: 38, max: 40 },
        colorProfile: 'Pale gold',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['agave', 'vanilla', 'caramel', 'oak'],
      seasonal: { summer: true },
    },
  ],
  
  // Cognac Subcategories
  'Cognac': [
    {
      name: 'VS Cognac',
      type: 'vs_cognac',
      description: 'Very Special cognac aged at least 2 years.',
      characteristics: {
        abvRange: { min: 40, max: 43 },
        colorProfile: 'Golden amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['fruity', 'floral', 'fresh', 'light'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'VSOP Cognac',
      type: 'vsop_cognac',
      description: 'Very Superior Old Pale cognac aged at least 4 years.',
      characteristics: {
        abvRange: { min: 40, max: 43 },
        colorProfile: 'Amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['dried fruit', 'vanilla', 'spice', 'oak'],
      seasonal: { fall: true, winter: true },
    },
  ],
  
  // Coffee Subcategories
  'Coffee': [
    {
      name: 'Arabica Coffee Beans',
      type: 'drip_coffee',
      description: 'Premium Arabica coffee beans for brewing.',
      characteristics: {
        colorProfile: 'Dark brown',
      },
      typicalFlavors: ['chocolate', 'nutty', 'fruity', 'balanced'],
    },
    {
      name: 'Espresso',
      type: 'espresso',
      description: 'Dark roast coffee for espresso preparation.',
      characteristics: {
        colorProfile: 'Very dark brown',
      },
      typicalFlavors: ['roasted', 'bitter', 'caramel', 'creamy'],
    },
  ],
  
  // Tea Subcategories
  'Tea': [
    {
      name: 'Green Tea',
      type: 'green_tea',
      description: 'Unoxidized tea with fresh, grassy flavors.',
      characteristics: {
        colorProfile: 'Pale green to yellow',
      },
      typicalFlavors: ['grassy', 'vegetal', 'fresh', 'delicate'],
    },
    {
      name: 'Black Tea',
      type: 'black_tea',
      description: 'Fully oxidized tea with robust flavor.',
      characteristics: {
        colorProfile: 'Amber to dark brown',
      },
      typicalFlavors: ['malty', 'bold', 'fruity', 'spicy'],
    },
  ],
  
  // Soft Drinks Subcategories
  'Soft Drinks': [
    {
      name: 'Cola',
      type: 'cola',
      description: 'Classic cola soft drinks.',
      characteristics: {
        colorProfile: 'Dark brown',
        sweetnessLevel: 'sweet',
      },
      typicalFlavors: ['caramel', 'vanilla', 'citrus', 'spice'],
    },
    {
      name: 'Lemon-Lime Soda',
      type: 'lemon_lime_soda',
      description: 'Refreshing citrus soft drinks.',
      characteristics: {
        colorProfile: 'Clear to pale yellow',
        sweetnessLevel: 'sweet',
      },
      typicalFlavors: ['lemon', 'lime', 'citrus', 'refreshing'],
    },
  ],
};

// ============================================================
// COMPREHENSIVE REALISTIC PRODUCTS DATA
// ============================================================

const REALISTIC_PRODUCTS = [
  // BEERS
  {
    name: 'Guinness Draught Stout',
    brand: 'Guinness',
    type: 'stout',
    subType: 'Irish Dry Stout',
    category: 'Beer',
    subCategory: 'Stout',
    isAlcoholic: true,
    abv: 4.2,
    proof: 8.4,
    volumeMl: 440,
    originCountry: 'Ireland',
    region: 'Dublin',
    breweryName: 'St. James\'s Gate Brewery',
    productionMethod: 'traditional',
    description: 'The world\'s most famous stout, known for its rich, creamy head and distinctive flavor profile.',
    shortDescription: 'Iconic Irish dry stout with creamy texture',
    tagline: 'Good Things Come to Those Who Wait',
    tastingNotes: {
      aroma: ['roasted barley', 'coffee', 'chocolate'],
      palate: ['smooth', 'creamy', 'balanced'],
      finish: ['dry', 'clean', 'lingering'],
      appearance: 'Dark ruby black with creamy tan head',
      color: 'Ruby black',
    },
    flavorProfile: ['roasted', 'coffee', 'chocolate', 'creamy'],
    servingSuggestions: {
      temperature: 'Cool (6-8°C)',
      glassware: 'Tulip pint glass',
      serving: 'Pour hard at 45° angle',
    },
    isDietary: {
      vegan: true,
      vegetarian: true,
      glutenFree: false,
    },
    allergens: ['gluten', 'barley'],
    nutritionalInfo: {
      calories: 125,
      carbohydrates: 10,
      sugar: 0,
      protein: 1.5,
    },
    standardSizes: ['44cl', 'can-440ml', 'pack-4', 'pack-8'],
    servingSize: '1 can (440ml)',
    servingsPerContainer: 1,
  },
  {
    name: 'Heineken Lager',
    brand: 'Heineken',
    type: 'lager',
    subType: 'Premium Lager',
    category: 'Beer',
    subCategory: 'Lager',
    isAlcoholic: true,
    abv: 5.0,
    volumeMl: 330,
    originCountry: 'Netherlands',
    region: 'Amsterdam',
    breweryName: 'Heineken Brewery',
    description: 'Internationally recognized premium lager with a balanced, refreshing taste.',
    shortDescription: 'World-famous Dutch premium lager',
    tagline: 'Open Your World',
    tastingNotes: {
      aroma: ['mild hops', 'grain', 'subtle fruit'],
      palate: ['crisp', 'clean', 'balanced'],
    },
    flavorProfile: ['crisp', 'malty', 'clean'],
    isDietary: {
      vegan: true,
      vegetarian: true,
    },
    allergens: ['gluten'],
    standardSizes: ['33cl', 'can-330ml', 'bottle-330ml', 'pack-6', 'pack-12'],
  },
  {
    name: 'Sierra Nevada Pale Ale',
    brand: 'Sierra Nevada',
    type: 'pale_ale',
    subType: 'American Pale Ale',
    category: 'Beer',
    subCategory: 'Pale Ale',
    isAlcoholic: true,
    abv: 5.6,
    volumeMl: 355,
    originCountry: 'United States',
    region: 'California',
    breweryName: 'Sierra Nevada Brewing Co.',
    description: 'The beer that launched the American craft beer revolution.',
    shortDescription: 'Classic American pale ale',
    flavorProfile: ['citrus', 'pine', 'balanced'],
    standardSizes: ['35.5cl', 'can-355ml', 'bottle-355ml', 'pack-6'],
  },

  // RED WINES
  {
    name: 'Yellow Tail Cabernet Sauvignon',
    brand: 'Yellow Tail',
    type: 'cabernet_sauvignon',
    category: 'Red Wine',
    subCategory: 'Cabernet Sauvignon',
    isAlcoholic: true,
    abv: 13.5,
    volumeMl: 750,
    originCountry: 'Australia',
    region: 'South Eastern Australia',
    wineryName: 'Casella Family Brands',
    vintage: 2022,
    description: 'A rich and full-bodied Cabernet Sauvignon with dark fruit flavors and smooth tannins.',
    shortDescription: 'Australian Cabernet Sauvignon',
    tastingNotes: {
      aroma: ['blackcurrant', 'cherry', 'oak'],
      palate: ['full-bodied', 'fruity', 'balanced'],
      finish: ['smooth', 'lingering'],
      color: 'Deep ruby',
    },
    flavorProfile: ['dark fruit', 'oak', 'balanced'],
    servingSuggestions: {
      temperature: '16-18°C',
      glassware: 'Red wine glass',
    },
    foodPairings: ['Grilled steak', 'Roasted lamb', 'Hard cheeses'],
    standardSizes: ['75cl', 'bottle-750ml', '1.5L'],
  },
  {
    name: '19 Crimes Snoop Dogg Cali Red',
    brand: '19 Crimes',
    type: 'red_wine',
    subType: 'Red Blend',
    category: 'Red Wine',
    subCategory: 'Merlot',
    isAlcoholic: true,
    abv: 13.5,
    volumeMl: 750,
    originCountry: 'United States',
    region: 'California',
    vintage: 2022,
    description: 'A bold, smooth red blend crafted by Snoop Dogg and 19 Crimes.',
    shortDescription: 'Snoop Dogg California red blend',
    flavorProfile: ['berry', 'vanilla', 'smooth'],
    standardSizes: ['75cl', 'bottle-750ml'],
  },

  // WHITE WINES
  {
    name: 'Kendall-Jackson Vintner\'s Reserve Chardonnay',
    brand: 'Kendall-Jackson',
    type: 'chardonnay',
    category: 'White Wine',
    subCategory: 'Chardonnay',
    isAlcoholic: true,
    abv: 13.5,
    volumeMl: 750,
    originCountry: 'United States',
    region: 'California',
    vintage: 2022,
    description: 'A rich, buttery Chardonnay with tropical fruit flavors.',
    shortDescription: 'California Chardonnay',
    flavorProfile: ['buttery', 'vanilla', 'tropical'],
    standardSizes: ['75cl', 'bottle-750ml'],
  },

  // SCOTCH WHISKIES
  {
    name: 'Johnnie Walker Black Label',
    brand: 'Johnnie Walker',
    type: 'scotch',
    subType: 'Blended Scotch Whisky',
    category: 'Scotch',
    subCategory: 'Blended Scotch',
    isAlcoholic: true,
    abv: 40,
    proof: 80,
    volumeMl: 700,
    age: 12,
    ageStatement: '12 Year Old',
    originCountry: 'Scotland',
    region: 'Multiple Regions',
    distilleryName: 'Multiple Distilleries',
    description: 'A rich, complex blend of whiskies from across Scotland, each aged for at least 12 years.',
    shortDescription: 'Premium 12-year blended Scotch',
    tagline: 'Keep Walking',
    tastingNotes: {
      nose: ['fruit', 'vanilla', 'smoke'],
      palate: ['smooth', 'complex', 'smoky'],
      finish: ['long', 'warming'],
    },
    flavorProfile: ['smoky', 'vanilla', 'fruity', 'oak'],
    standardSizes: ['70cl', '1L', 'miniature-50ml'],
  },
  {
    name: 'Glenfiddich 12 Year Old',
    brand: 'Glenfiddich',
    type: 'single_malt',
    category: 'Scotch',
    subCategory: 'Single Malt Scotch',
    isAlcoholic: true,
    abv: 40,
    volumeMl: 700,
    age: 12,
    ageStatement: '12 Year Old',
    originCountry: 'Scotland',
    region: 'Speyside',
    distilleryName: 'Glenfiddich Distillery',
    description: 'The world\'s most awarded single malt Scotch whisky.',
    shortDescription: 'Speyside single malt Scotch',
    flavorProfile: ['pear', 'oak', 'honey'],
    standardSizes: ['70cl', '1L'],
  },

  // BOURBON
  {
    name: 'Jack Daniel\'s Old No. 7',
    brand: 'Jack Daniel\'s',
    type: 'bourbon',
    subType: 'Tennessee Whiskey',
    category: 'Bourbon',
    subCategory: 'Straight Bourbon',
    isAlcoholic: true,
    abv: 40,
    volumeMl: 700,
    originCountry: 'United States',
    region: 'Tennessee',
    distilleryName: 'Jack Daniel\'s Distillery',
    productionMethod: 'charcoal mellowed',
    description: 'Smooth-sipping Tennessee whiskey charcoal mellowed for exceptional character.',
    shortDescription: 'Iconic Tennessee whiskey',
    flavorProfile: ['caramel', 'vanilla', 'oak'],
    standardSizes: ['70cl', '1L', '35cl'],
  },

  // VODKA
  {
    name: 'Absolut Vodka',
    brand: 'Absolut',
    type: 'vodka',
    category: 'Vodka',
    subCategory: 'Premium Vodka',
    isAlcoholic: true,
    abv: 40,
    volumeMl: 700,
    originCountry: 'Sweden',
    description: 'Swedish vodka made from winter wheat and pure water.',
    shortDescription: 'Premium Swedish vodka',
    flavorProfile: ['clean', 'smooth'],
    standardSizes: ['70cl', '1L', '35cl'],
  },

  // GIN
  {
    name: 'Tanqueray London Dry Gin',
    brand: 'Tanqueray',
    type: 'london_dry_gin',
    category: 'Gin',
    subCategory: 'London Dry Gin',
    isAlcoholic: true,
    abv: 43.1,
    volumeMl: 700,
    originCountry: 'United Kingdom',
    region: 'Scotland',
    description: 'Classic London dry gin with a distinctive juniper-led character.',
    shortDescription: 'Classic London dry gin',
    flavorProfile: ['juniper', 'citrus', 'spice'],
    standardSizes: ['70cl', '1L'],
  },

  // RUM
  {
    name: 'Bacardi Superior White Rum',
    brand: 'Bacardi',
    type: 'white_rum',
    category: 'Rum',
    subCategory: 'White Rum',
    isAlcoholic: true,
    abv: 37.5,
    volumeMl: 700,
    originCountry: 'Puerto Rico',
    description: 'The world\'s most awarded rum, smooth and versatile.',
    shortDescription: 'Premium white rum',
    flavorProfile: ['smooth', 'clean', 'vanilla'],
    standardSizes: ['70cl', '1L', '35cl'],
  },

  // TEQUILA
  {
    name: 'Jose Cuervo Especial Silver',
    brand: 'Jose Cuervo',
    type: 'blanco_tequila',
    category: 'Tequila',
    subCategory: 'Blanco Tequila',
    isAlcoholic: true,
    abv: 38,
    volumeMl: 700,
    originCountry: 'Mexico',
    region: 'Jalisco',
    description: 'The world\'s best-selling tequila, perfect for margaritas.',
    shortDescription: 'Mexican silver tequila',
    flavorProfile: ['agave', 'citrus', 'pepper'],
    standardSizes: ['70cl', '1L'],
  },

  // COGNAC
  {
    name: 'Remy Martin VSOP',
    brand: 'Remy Martin',
    type: 'vsop_cognac',
    category: 'Cognac',
    subCategory: 'VSOP Cognac',
    isAlcoholic: true,
    abv: 40,
    volumeMl: 700,
    ageStatement: 'VSOP',
    originCountry: 'France',
    region: 'Cognac',
    description: 'Fine Champagne cognac aged up to 14 years.',
    shortDescription: 'Premium VSOP cognac',
    flavorProfile: ['fruity', 'vanilla', 'oak'],
    standardSizes: ['70cl', '1L'],
  },

  // CHAMPAGNE
  {
    name: 'Moët & Chandon Impérial Brut',
    brand: 'Moët & Chandon',
    type: 'champagne',
    category: 'Champagne',
    subCategory: 'Champagne',
    isAlcoholic: true,
    abv: 12,
    volumeMl: 750,
    originCountry: 'France',
    region: 'Champagne',
    description: 'The most loved Champagne in the world.',
    shortDescription: 'French Brut Champagne',
    flavorProfile: ['toasty', 'citrus', 'apple'],
    standardSizes: ['75cl', '1.5L'],
  },

  // LIQUEURS
  {
    name: 'Baileys Original Irish Cream',
    brand: 'Baileys',
    type: 'cream_liqueur',
    category: 'Liqueurs',
    isAlcoholic: true,
    abv: 17,
    volumeMl: 700,
    originCountry: 'Ireland',
    description: 'The original Irish cream liqueur.',
    shortDescription: 'Irish cream liqueur',
    flavorProfile: ['creamy', 'chocolate', 'vanilla'],
    allergens: ['milk'],
    standardSizes: ['70cl', '1L', '35cl'],
  },

  // COFFEE
  {
    name: 'Starbucks House Blend Ground Coffee',
    brand: 'Starbucks',
    type: 'coffee',
    category: 'Coffee',
    subCategory: 'Arabica Coffee Beans',
    isAlcoholic: false,
    volumeMl: 0,
    weightGrams: 340,
    originCountry: 'Multiple',
    description: 'Well-balanced with notes of nuts and cocoa.',
    shortDescription: 'Medium roast ground coffee',
    flavorProfile: ['nutty', 'cocoa', 'balanced'],
    standardSizes: ['340g'],
    servingsPerContainer: 40,
  },

  // TEA
  {
    name: 'Twinings English Breakfast Tea',
    brand: 'Twinings',
    type: 'black_tea',
    category: 'Tea',
    subCategory: 'Black Tea',
    isAlcoholic: false,
    volumeMl: 0,
    weightGrams: 100,
    originCountry: 'United Kingdom',
    description: 'Classic English breakfast tea blend.',
    shortDescription: 'Traditional English breakfast tea',
    flavorProfile: ['malty', 'robust', 'balanced'],
    standardSizes: ['teabag-50'],
  },

  // SOFT DRINKS
  {
    name: 'Coca-Cola Original',
    brand: 'Coca-Cola',
    type: 'cola',
    category: 'Soft Drinks',
    subCategory: 'Cola',
    isAlcoholic: false,
    volumeMl: 330,
    originCountry: 'United States',
    description: 'The original Coca-Cola formula.',
    shortDescription: 'Classic cola',
    flavorProfile: ['caramel', 'vanilla', 'citrus'],
    nutritionalInfo: {
      calories: 139,
      carbohydrates: 35,
      sugar: 35,
    },
    standardSizes: ['33cl', 'can-330ml', '50cl', '1L', '1.5L', '2L', 'pack-6', 'pack-12'],
  },

  // WATER
  {
    name: 'Evian Natural Spring Water',
    brand: 'Evian',
    type: 'spring_water',
    category: 'Water',
    isAlcoholic: false,
    volumeMl: 500,
    originCountry: 'France',
    region: 'French Alps',
    description: 'Natural spring water from the French Alps.',
    shortDescription: 'Premium spring water',
    standardSizes: ['50cl', '1L', '1.5L'],
  },

  // ENERGY DRINKS
  {
    name: 'Red Bull Energy Drink',
    brand: 'Red Bull',
    type: 'energy_drink',
    category: 'Energy Drinks',
    isAlcoholic: false,
    volumeMl: 250,
    originCountry: 'Austria',
    description: 'Energy drink with taurine, caffeine, and B-vitamins.',
    shortDescription: 'Original energy drink',
    nutritionalInfo: {
      caffeine: 80,
      calories: 110,
    },
    standardSizes: ['can-250ml', 'can-473ml'],
  },

  // JUICE
  {
    name: 'Tropicana Pure Premium Orange Juice',
    brand: 'Tropicana',
    type: 'orange_juice',
    category: 'Juice',
    isAlcoholic: false,
    volumeMl: 1000,
    originCountry: 'United States',
    description: '100% pure squeezed orange juice.',
    shortDescription: 'Pure orange juice',
    flavorProfile: ['citrus', 'sweet', 'fresh'],
    nutritionalInfo: {
      calories: 110,
      carbohydrates: 26,
      sugar: 22,
      vitaminC: 120,
    },
    standardSizes: ['1L', '1.75L'],
  },
];

// ============================================================
// COMPREHENSIVE BRANDS DATA
// ============================================================

const BRANDS_DATA = [
  // Beer Brands
  {
    name: 'Guinness',
    brandType: 'brewery',
    primaryCategory: 'beer',
    countryOfOrigin: 'Ireland',
    region: 'Dublin',
    founded: 1759,
    description: 'Iconic Irish brewery famous for its rich, dark stouts.',
    story: 'Founded by Arthur Guinness, this brewery has been crafting exceptional stouts for over 260 years.',
    tagline: 'Made of More',
    website: 'https://www.guinness.com',
    specializations: ['Stout', 'Dark Beer'],
    productionMethod: 'traditional',
    qualityStandards: ['iso_certified'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Heineken',
    brandType: 'brewery',
    primaryCategory: 'beer',
    countryOfOrigin: 'Netherlands',
    region: 'Amsterdam',
    founded: 1864,
    description: 'World-renowned Dutch brewery producing premium lager beer.',
    tagline: 'Open Your World',
    specializations: ['Lager', 'Premium Beer'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Sierra Nevada',
    brandType: 'brewery',
    primaryCategory: 'beer',
    countryOfOrigin: 'United States',
    region: 'California',
    founded: 1980,
    description: 'Pioneer of American craft brewing.',
    specializations: ['Pale Ale', 'Craft Beer'],
    isPremium: true,
    isCraft: true,
  },

  // Wine Brands
  {
    name: 'Yellow Tail',
    brandType: 'winery',
    primaryCategory: 'wine',
    countryOfOrigin: 'Australia',
    region: 'South Eastern Australia',
    founded: 2001,
    description: 'Australian wine brand known for approachable, fruit-forward wines.',
    specializations: ['Cabernet Sauvignon', 'Shiraz', 'Chardonnay'],
    isPremium: false,
    isCraft: false,
  },
  {
    name: 'Kendall-Jackson',
    brandType: 'winery',
    primaryCategory: 'wine',
    countryOfOrigin: 'United States',
    region: 'California',
    founded: 1982,
    description: 'Premium California winery specializing in Chardonnay.',
    specializations: ['Chardonnay', 'Premium Wine'],
    isPremium: true,
    isCraft: false,
  },

  // Spirit Brands
  {
    name: 'Johnnie Walker',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'Scotland',
    region: 'Multiple',
    founded: 1820,
    description: 'The world\'s most distributed Scotch whisky.',
    tagline: 'Keep Walking',
    specializations: ['Blended Scotch Whisky'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Jack Daniel\'s',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'United States',
    region: 'Tennessee',
    founded: 1866,
    description: 'Iconic American whiskey producer.',
    specializations: ['Tennessee Whiskey'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Absolut',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'Sweden',
    founded: 1879,
    description: 'Swedish vodka brand known for purity.',
    specializations: ['Vodka'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Tanqueray',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'United Kingdom',
    region: 'Scotland',
    founded: 1830,
    description: 'Classic London dry gin producer.',
    specializations: ['Gin'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Bacardi',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'Puerto Rico',
    founded: 1862,
    description: 'World\'s most awarded rum.',
    specializations: ['White Rum'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Jose Cuervo',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'Mexico',
    region: 'Jalisco',
    founded: 1795,
    description: 'World\'s best-selling tequila.',
    specializations: ['Tequila'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Remy Martin',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'France',
    region: 'Cognac',
    founded: 1724,
    description: 'Premium cognac producer.',
    specializations: ['Cognac'],
    isPremium: true,
    isCraft: false,
  },

  // Champagne Brands
  {
    name: 'Moët & Chandon',
    brandType: 'champagne_house',
    primaryCategory: 'champagne',
    countryOfOrigin: 'France',
    region: 'Champagne',
    founded: 1743,
    description: 'Luxury Champagne house.',
    specializations: ['Champagne'],
    isPremium: true,
    isCraft: false,
  },

  // Liqueur Brands
  {
    name: 'Baileys',
    brandType: 'spirits_producer',
    primaryCategory: 'liqueurs',
    countryOfOrigin: 'Ireland',
    founded: 1974,
    description: 'Original Irish cream liqueur.',
    specializations: ['Cream Liqueur'],
    isPremium: true,
    isCraft: false,
  },

  // Non-Alcoholic Brands
  {
    name: 'Starbucks',
    brandType: 'coffee_company',
    primaryCategory: 'coffee',
    countryOfOrigin: 'United States',
    founded: 1971,
    description: 'World\'s largest coffeehouse chain.',
    specializations: ['Coffee'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Twinings',
    brandType: 'tea_company',
    primaryCategory: 'tea',
    countryOfOrigin: 'United Kingdom',
    founded: 1706,
    description: 'Premium tea company.',
    specializations: ['Tea'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Coca-Cola',
    brandType: 'beverage_company',
    primaryCategory: 'soft_drinks',
    countryOfOrigin: 'United States',
    founded: 1886,
    description: 'World\'s most recognized soft drink brand.',
    specializations: ['Cola'],
    isPremium: false,
    isCraft: false,
  },
  {
    name: 'Evian',
    brandType: 'water_brand',
    primaryCategory: 'water',
    countryOfOrigin: 'France',
    founded: 1826,
    description: 'Premium natural spring water.',
    specializations: ['Spring Water'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Red Bull',
    brandType: 'beverage_company',
    primaryCategory: 'energy_drinks',
    countryOfOrigin: 'Austria',
    founded: 1987,
    description: 'Pioneer in energy drinks.',
    specializations: ['Energy Drinks'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Tropicana',
    brandType: 'juice_company',
    primaryCategory: 'juice',
    countryOfOrigin: 'United States',
    founded: 1947,
    description: 'Leading juice brand.',
    specializations: ['Orange Juice'],
    isPremium: true,
    isCraft: false,
  },
];

// ============================================================
// TENANTS DATA
// ============================================================

const TENANTS_DATA = [
  {
    name: 'Premium Spirits & Wine',
    revenueModel: 'markup',
    markupPercentage: 45,
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    plan: 'pro',
    subscriptionStatus: 'active',
    defaultCurrency: 'NGN',
    supportedCurrencies: ['NGN', 'USD'],
    enforceAgeVerification: true,
  },
  {
    name: 'Craft Beer Haven',
    revenueModel: 'commission',
    commissionPercentage: 15,
    city: 'Abuja',
    state: 'FCT',
    country: 'Nigeria',
    plan: 'starter',
    subscriptionStatus: 'active',
    defaultCurrency: 'NGN',
    enforceAgeVerification: true,
  },
  {
    name: 'The Wine Cellar',
    revenueModel: 'markup',
    markupPercentage: 50,
    city: 'Port Harcourt',
    state: 'Rivers',
    country: 'Nigeria',
    plan: 'pro',
    subscriptionStatus: 'active',
    defaultCurrency: 'NGN',
    enforceAgeVerification: true,
  },
  {
    name: 'Beverages Plus',
    revenueModel: 'commission',
    commissionPercentage: 12,
    city: 'Ibadan',
    state: 'Oyo',
    country: 'Nigeria',
    plan: 'enterprise',
    subscriptionStatus: 'active',
    defaultCurrency: 'NGN',
    supportedCurrencies: ['NGN', 'USD', 'GBP'],
    enforceAgeVerification: true,
  },
  {
    name: 'Quick Drinks Express',
    revenueModel: 'markup',
    markupPercentage: 35,
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    plan: 'starter',
    subscriptionStatus: 'active',
    defaultCurrency: 'NGN',
    enforceAgeVerification: false,
  },
];

// ============================================================
// SEEDING FUNCTIONS
// ============================================================

/**
 * Create Super Admin
 */
async function createSuperAdmin() {
  console.log('\n📝 Creating Super Admin...');
  
  const hashedPassword = await bcrypt.hash('Admin@123!SecurePassword', 10);
  
  const admin = await safeCreate(User, {
    email: 'admin@drinksharbour.com',
    passwordHash: hashedPassword,
    firstName: 'Super',
    lastName: 'Admin',
    displayName: 'Platform Administrator',
    role: 'super_admin',
    status: 'active',
    isEmailVerified: true,
    isAgeVerified: true,
    ageVerificationMethod: 'self_declaration',
  }, 'email');
  
  createdData.users.push(admin);
  return admin;
}

/**
 * Create Flavors
 */
async function createFlavors() {
  console.log('\n🌿 Creating Flavors...');
  
  for (const flavorData of FLAVORS_DATA) {
    const flavor = await safeCreate(Flavor, {
      ...flavorData,
      slug: generateUniqueSlug(flavorData.value),
      status: 'active',
      isVerified: true,
      source: 'admin',
    }, 'slug');
    
    createdData.flavors.push(flavor);
  }
  
  console.log(`✓ Created ${createdData.flavors.length} flavors`);
}

/**
 * Create Tags
 */
async function createTags() {
  console.log('\n🏷️  Creating Tags...');
  
  for (const tagData of TAGS_DATA) {
    const tag = await safeCreate(Tag, {
      ...tagData,
      slug: generateUniqueSlug(tagData.name),
      status: 'active',
      isVerified: true,
      isFilterable: true,
      isSearchable: true,
      showInAutocomplete: true,
      source: 'admin',
    }, 'slug');
    
    createdData.tags.push(tag);
  }
  
  console.log(`✓ Created ${createdData.tags.length} tags`);
}

/**
 * Create Categories
 */
async function createCategories() {
  console.log('\n📁 Creating Categories...');
  
  for (const categoryData of CATEGORIES_DATA) {
    const category = await safeCreate(Category, {
      ...categoryData,
      slug: generateUniqueSlug(categoryData.name),
      status: 'published',
      level: 0,
      displayOrder: CATEGORIES_DATA.indexOf(categoryData),
      createdBy: createdData.users[0]?._id,
      publishedAt: new Date(),
      publishedBy: createdData.users[0]?._id,
    }, 'slug');
    
    createdData.categories.push(category);
  }
  
  console.log(`✓ Created ${createdData.categories.length} categories`);
}

/**
 * Create SubCategories
 */
async function createSubCategories() {
  console.log('\n📂 Creating SubCategories...');
  
  for (const [categoryName, subCats] of Object.entries(SUBCATEGORIES_DATA)) {
    const parentCategory = createdData.categories.find(c => c.name === categoryName);
    if (!parentCategory) {
      console.log(`  ⚠️  Parent category "${categoryName}" not found`);
      continue;
    }
    
    for (const subCatData of subCats) {
      const subCategory = await safeCreate(SubCategory, {
        ...subCatData,
        slug: generateUniqueSlug(subCatData.name),
        parent: parentCategory._id,
        parentPath: parentCategory.slug,
        status: 'published',
        displayOrder: subCats.indexOf(subCatData),
        createdBy: createdData.users[0]?._id,
        publishedAt: new Date(),
      }, 'slug');
      
      createdData.subCategories.push(subCategory);
      
      // Update parent category
      parentCategory.subCategories.push(subCategory._id);
    }
    
    await parentCategory.save();
  }
  
  console.log(`✓ Created ${createdData.subCategories.length} subcategories`);
}

/**
 * Create Brands
 */
async function createBrands() {
  console.log('\n🏭 Creating Brands...');
  
  for (const brandData of BRANDS_DATA) {
    const brand = await safeCreate(Brand, {
      ...brandData,
      slug: generateUniqueSlug(brandData.name),
      status: 'active',
      verified: true,
      verifiedBy: createdData.users[0]?._id,
      verifiedAt: new Date(),
      verificationStatus: 'verified',
      createdBy: createdData.users[0]?._id,
    }, 'slug');
    
    createdData.brands.push(brand);
  }
  
  console.log(`✓ Created ${createdData.brands.length} brands`);
}

/**
 * Create Tenants
 */
async function createTenants() {
  console.log('\n🏢 Creating Tenants...');
  
  const hashedPassword = await bcrypt.hash('Tenant@123!SecurePassword', 10);
  
  for (const tenantData of TENANTS_DATA) {
    const slug = generateUniqueSlug(tenantData.name);
    const ownerEmail = `admin@${slug}.drinksharbour.com`;
    
    try {
      // Check if tenant already exists
      let tenant = await Tenant.findOne({ slug });
      
      if (!tenant) {
        tenant = await Tenant.create({
          ...tenantData,
          slug,
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: createdData.users[0]?._id,
          onboardedAt: new Date(),
          primaryColor: '#1a202c',
        });
        console.log(`  ✓ Created tenant: ${tenant.name}`);
      } else {
        console.log(`  ℹ Tenant "${slug}" already exists`);
      }
      
      // Check if owner already exists
      let owner = await User.findOne({ email: ownerEmail });
      
      if (!owner) {
        owner = await User.create({
          email: ownerEmail,
          passwordHash: hashedPassword,
          firstName: tenantData.name.split(' ')[0],
          lastName: 'Admin',
          displayName: `${tenantData.name} Admin`,
          role: 'customer',
          status: 'active',
          isEmailVerified: true,
          isAgeVerified: true,
          ageVerificationMethod: 'self_declaration',
        });
        
        owner.role = 'tenant_owner';
        owner.tenant = tenant._id;
        await owner.save();
        
        console.log(`  ✓ Created tenant owner: ${ownerEmail}`);
      }
      
      createdData.tenants.push(tenant);
      createdData.users.push(owner);
      
    } catch (error) {
      console.error(`  ✗ Error creating tenant "${tenantData.name}":`, error.message);
      continue;
    }
  }
  
  console.log(`✓ Created ${createdData.tenants.length} tenants`);
}

/**
 * Create Products with Enhanced Data
 */
async function createProducts() {
  console.log('\n🍺 Creating Products...');
  
  const productCount = Math.min(SEED_CONFIG.counts.products, REALISTIC_PRODUCTS.length);
  
  for (let i = 0; i < productCount; i++) {
    const productData = REALISTIC_PRODUCTS[i % REALISTIC_PRODUCTS.length];
    
    // Find brand
    const brand = createdData.brands.find(b => b.name === productData.brand);
    if (!brand) {
      console.log(`  ⚠️  Brand "${productData.brand}" not found, skipping...`);
      continue;
    }
    
    // Find category
    const category = createdData.categories.find(c => c.name === productData.category);
    let subCategory = null;
    if (productData.subCategory) {
      subCategory = createdData.subCategories.find(sc => sc.name === productData.subCategory);
    }
    
    // Select relevant flavors
    const relevantFlavors = createdData.flavors.filter(f => 
      productData.flavorProfile?.includes(f.value)
    );
    const selectedFlavors = randomSelect(relevantFlavors, Math.min(3, relevantFlavors.length));
    
    // Select tags based on product
    const relevantTags = createdData.tags.filter(t => {
      if (productData.isAlcoholic && t.name === 'Premium') return randomBool(0.4);
      if (productData.type?.includes('craft')) return randomBool(0.3);
      if (t.name === 'Bestseller') return randomBool(0.2);
      return false;
    });
    const selectedTags = randomSelect(relevantTags, Math.min(2, relevantTags.length));
    
    // Get default images
    const productImages = getDefaultProductImages(productData.type, 2);
    
    try {
      const product = await Product.create({
        ...productData,
        slug: generateUniqueSlug(`${productData.name}-${i}`),
        brand: brand._id,
        category: category?._id,
        subCategory: subCategory?._id,
        flavors: selectedFlavors.map(f => f._id),
        tags: selectedTags.map(t => t._id),
        images: productImages,
        status: 'approved',
        publishedAt: new Date(),
        approvedBy: createdData.users[0]?._id,
        submissionSource: 'admin',
        metaTitle: `${productData.name} - Buy Online | DrinksHarbour`,
        metaDescription: productData.shortDescription,
        keywords: [
          productData.name.toLowerCase(),
          productData.brand.toLowerCase(),
          productData.type,
          ...(productData.flavorProfile || []),
          productData.originCountry?.toLowerCase(),
        ].filter(Boolean),
      });
      
      createdData.products.push(product);
      console.log(`  ✓ Created product: ${product.name}`);
    } catch (error) {
      console.error(`  ✗ Error creating product "${productData.name}":`, error.message);
      continue;
    }
  }
  
  console.log(`✓ Created ${createdData.products.length} products`);
}

/**
 * Create SubProducts
 */
async function createSubProducts() {
  console.log('\n📦 Creating SubProducts...');
  
  let totalSubProducts = 0;
  
  if (!createdData.products || createdData.products.length === 0) {
    console.log('  ⚠️  No products available');
    return;
  }
  
  if (!createdData.tenants || createdData.tenants.length === 0) {
    console.log('  ⚠️  No tenants available');
    return;
  }
  
  for (const product of createdData.products) {
    try {
      // Select random tenants for this product
      const numTenants = randomInt(1, Math.min(2, createdData.tenants.length));
      const selectedTenants = randomSelect(createdData.tenants, numTenants);
      
      if (!selectedTenants || selectedTenants.length === 0) {
        continue;
      }
      
      for (const tenant of selectedTenants) {
        if (!tenant || !tenant._id) {
          continue;
        }
        
        // Calculate pricing
        const baseCost = randomInt(500, 50000);
        let sellingPrice;
        
        if (tenant.revenueModel === 'markup') {
          sellingPrice = Math.round(baseCost * (1 + (tenant.markupPercentage || 40) / 100));
        } else {
          sellingPrice = Math.round(baseCost * 1.3);
        }
        
        // Generate SKU
        const tenantPrefix = tenant.slug.substring(0, 3).toUpperCase();
        const productPrefix = product.slug.substring(0, 5).toUpperCase();
        const randomSuffix = randomInt(100, 999);
        const sku = `${tenantPrefix}-${productPrefix}-${randomSuffix}`;
        
        // Create SubProduct
        const totalStock = randomInt(20, 200);
        const lowStockThreshold = randomInt(5, 15);
        
        const subProduct = await SubProduct.create({
          product: product._id,
          tenant: tenant._id,
          sku,
          baseSellingPrice: sellingPrice,
          costPrice: baseCost,
          currency: tenant.defaultCurrency || 'NGN',
          status: 'active',
          isFeaturedByTenant: randomBool(0.1),
          addedAt: new Date(),
          activatedAt: new Date(),
          
          totalStock,
          availableStock: totalStock,
          reservedStock: 0,
          lowStockThreshold,
          reorderPoint: randomInt(5, 10),
          reorderQuantity: randomInt(20, 50),
          stockStatus: totalStock === 0 ? 'out_of_stock' :
                       totalStock <= lowStockThreshold ? 'low_stock' : 'in_stock',
          
          totalSold: randomInt(0, 50),
          totalRevenue: randomInt(0, 250000),
          viewCount: randomInt(10, 200),
          addToCartCount: randomInt(5, 100),
          conversionRate: randomInt(5, 20),
        });
        
        totalSubProducts++;
        product.subProducts.push(subProduct._id);
      }
      
      await product.save();
      
    } catch (error) {
      console.error(`  ✗ Error creating SubProducts for ${product.name}:`, error.message);
      continue;
    }
  }
  
  console.log(`✓ Created ${totalSubProducts} subproducts`);
}

/**
 * Create Sizes
 */
async function createSizes() {
  console.log('\n📏 Creating Sizes...');
  
  let totalSizes = 0;
  
  const allSubProducts = await SubProduct.find({}).populate('product');
  
  if (!allSubProducts || allSubProducts.length === 0) {
    console.log('  ⚠️  No SubProducts found');
    return;
  }
  
  for (const subProduct of allSubProducts) {
    try {
      const product = subProduct.product;
      
      if (!product) {
        continue;
      }
      
      // Determine available sizes based on product type
      let availableSizes = [];
      
      if (product.type?.includes('beer')) {
        availableSizes = ['33cl', 'can-330ml', '44cl', 'bottle-330ml'];
      } else if (product.type?.includes('wine') || product.type?.includes('champagne')) {
        availableSizes = ['75cl', 'bottle-750ml', '37.5cl'];
      } else if (product.type?.includes('spirit') || product.type?.includes('whiskey') || 
                 product.type?.includes('vodka') || product.type?.includes('gin') || 
                 product.type?.includes('rum') || product.type?.includes('tequila')) {
        availableSizes = ['70cl', '1L', '35cl', 'miniature-50ml'];
      } else if (product.type?.includes('liqueur')) {
        availableSizes = ['70cl', '1L', '35cl'];
      } else if (product.type?.includes('soft_drink') || product.type?.includes('cola')) {
        availableSizes = ['33cl', 'can-330ml', '50cl', '1L', '1.5L'];
      } else if (product.type?.includes('energy_drink')) {
        availableSizes = ['can-250ml', 'can-473ml'];
      } else if (product.type?.includes('water')) {
        availableSizes = ['50cl', '1L', '1.5L'];
      } else if (product.type?.includes('coffee')) {
        availableSizes = ['250g', '500g', '1kg'];
      } else {
        availableSizes = ['50cl', '70cl', '1L'];
      }
      
      if (availableSizes.length === 0) {
        continue;
      }
      
      // Select 1-2 sizes
      const numSizes = randomInt(1, Math.min(2, availableSizes.length));
      const selectedSizes = randomSelect(availableSizes, numSizes);
      
      for (let i = 0; i < selectedSizes.length; i++) {
        const sizeValue = selectedSizes[i];
        
        if (!sizeValue) continue;
        
        // Calculate volume
        let volumeMl = product.volumeMl || 0;
        if (sizeValue.includes('cl')) {
          volumeMl = parseInt(sizeValue) * 10;
        } else if (sizeValue.includes('ml')) {
          const match = sizeValue.match(/\d+/);
          volumeMl = match ? parseInt(match[0]) : 0;
        } else if (sizeValue.includes('L') && !sizeValue.includes('cl')) {
          volumeMl = parseFloat(sizeValue) * 1000;
        }
        
        const stock = randomInt(10, 100);
        const lowStockThreshold = randomInt(3, 10);
        
        const size = await Size.create({
          subproduct: subProduct._id,
          size: sizeValue,
          displayName: `${sizeValue} ${product.type?.includes('coffee') ? 'Pack' : 'Bottle'}`,
          sizeCategory: volumeMl < 100 ? 'miniature' :
                       volumeMl < 500 ? 'single_serve' :
                       volumeMl < 1000 ? 'standard' : 'large',
          unitType: product.type?.includes('coffee') ? 'weight_g' : 'volume_ml',
          volumeMl: product.type?.includes('coffee') ? 0 : volumeMl,
          weightGrams: product.type?.includes('coffee') ? 
            (sizeValue.includes('g') ? parseInt(sizeValue) : 
             sizeValue.includes('kg') ? parseFloat(sizeValue) * 1000 : 0) : 0,
          sellingPrice: Math.round(subProduct.baseSellingPrice * (i === 0 ? 1 : 1 + (i * 0.2))),
          costPrice: Math.round(subProduct.costPrice * (i === 0 ? 1 : 1 + (i * 0.2))),
          compareAtPrice: Math.round(subProduct.baseSellingPrice * 1.2),
          currency: subProduct.currency,
          stock,
          availableStock: stock,
          lowStockThreshold,
          availability: stock === 0 ? 'out_of_stock' :
                       stock <= lowStockThreshold ? 'low_stock' : 'available',
          sku: `${subProduct.sku}-${sizeValue.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`,
          packaging: {
            type: sizeValue.includes('can') ? 'can' :
                  sizeValue.includes('bottle') ? 'glass_bottle' : 'bottle',
            recyclable: true,
          },
          isDefault: i === 0,
          status: 'active',
          requiresAgeVerification: product.isAlcoholic || false,
        });
        
        totalSizes++;
        subProduct.sizes.push(size._id);
      }
      
      await subProduct.save();
      
    } catch (error) {
      console.error(`  ✗ Error creating sizes for SubProduct ${subProduct._id}:`, error.message);
      continue;
    }
  }
  
  console.log(`✓ Created ${totalSizes} sizes`);
}

/**
 * Create Customers
 */
async function createCustomers() {
  console.log('\n👥 Creating Customers...');
  
  const hashedPassword = await bcrypt.hash('Customer@123', 10);
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'James', 'Olivia', 'Robert', 'Sophia'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  
  for (let i = 0; i < SEED_CONFIG.counts.customers; i++) {
    const firstName = randomFrom(firstNames);
    const lastName = randomFrom(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
    
    try {
      const customer = await safeCreate(User, {
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        role: 'customer',
        status: 'active',
        isEmailVerified: randomBool(0.8),
        isAgeVerified: randomBool(0.9),
        ageVerificationMethod: 'self_declaration',
        preferredCurrency: 'NGN',
        language: 'en',
      }, 'email');
      
      createdData.users.push(customer);
    } catch (error) {
      // Continue with next customer
    }
  }
  
  console.log(`✓ Created ${createdData.users.length - 1} customers`);
}

/**
 * Update Statistics
 */
async function updateStatistics() {
  console.log('\n📊 Updating Statistics...');
  
  // Update product counts for categories
  for (const category of createdData.categories) {
    const productCount = await Product.countDocuments({ 
      category: category._id,
      status: 'approved'
    });
    category.productCount = productCount;
    category.activeProductCount = productCount;
    await category.save();
  }
  
  // Update product counts for subcategories
  for (const subCategory of createdData.subCategories) {
    const productCount = await Product.countDocuments({ 
      subCategory: subCategory._id,
      status: 'approved'
    });
    subCategory.productCount = productCount;
    subCategory.activeProductCount = productCount;
    await subCategory.save();
  }
  
  // Update product counts for brands
  for (const brand of createdData.brands) {
    const productCount = await Product.countDocuments({ 
      brand: brand._id,
      status: 'approved'
    });
    brand.productCount = productCount;
    brand.activeProductCount = productCount;
    await brand.save();
  }
  
  // Update product counts for flavors
  for (const flavor of createdData.flavors) {
    const productCount = await Product.countDocuments({ 
      flavors: flavor._id,
      status: 'approved'
    });
    flavor.productCount = productCount;
    flavor.isPopular = productCount > 5;
    await flavor.save();
  }
  
  // Update product counts for tags
  for (const tag of createdData.tags) {
    const productCount = await Product.countDocuments({ 
      tags: tag._id,
      status: 'approved'
    });
    tag.productCount = productCount;
    tag.activeProductCount = productCount;
    tag.isPopular = productCount > 5;
    await tag.save();
  }
  
  // Update tenant counts
  for (const product of createdData.products) {
    const subProductCount = await SubProduct.countDocuments({ product: product._id });
    product.tenantCount = subProductCount;
    await product.save();
  }
  
  console.log('✓ Statistics updated');
}

/**
 * Main Seed Function
 */
async function seed() {
  try {
    console.log('🌱 Starting database seeding...\n');
    console.log('═══════════════════════════════════════════════════════');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }
    
    console.log(`📡 Connecting to MongoDB...`);
    
    // Connect to database
    await db.connectDB();
    
    console.log('✓ Connected to database\n');
    
    // Clear existing data if reset flag is present
    if (process.argv.includes('--reset')) {
      console.log('🗑️  Resetting database...');
      await Promise.all([
        User.deleteMany({}),
        Tenant.deleteMany({}),
        Product.deleteMany({}),
        SubProduct.deleteMany({}),
        Size.deleteMany({}),
        Category.deleteMany({}),
        SubCategory.deleteMany({}),
        Brand.deleteMany({}),
        Tag.deleteMany({}),
        Flavor.deleteMany({}),
      ]);
      console.log('✓ Database reset complete\n');
    }
    
    // Execute seeding in order
    if (SEED_CONFIG.createSuperAdmin) await createSuperAdmin();
    if (SEED_CONFIG.createFlavors) await createFlavors();
    if (SEED_CONFIG.createTags) await createTags();
    if (SEED_CONFIG.createCategories) await createCategories();
    if (SEED_CONFIG.createSubCategories) await createSubCategories();
    if (SEED_CONFIG.createBrands) await createBrands();
    if (SEED_CONFIG.createTenants) await createTenants();
    if (SEED_CONFIG.createProducts) await createProducts();
    if (SEED_CONFIG.createSubProducts) await createSubProducts();
    if (SEED_CONFIG.createSizes) await createSizes();
    if (SEED_CONFIG.createCustomers) await createCustomers();
    
    // Update statistics
    await updateStatistics();
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ SEEDING COMPLETED SUCCESSFULLY!\n');
    console.log('📊 Summary:');
    console.log(`   • Super Admin: 1`);
    console.log(`   • Flavors: ${createdData.flavors.length}`);
    console.log(`   • Tags: ${createdData.tags.length}`);
    console.log(`   • Categories: ${createdData.categories.length}`);
    console.log(`   • SubCategories: ${createdData.subCategories.length}`);
    console.log(`   • Brands: ${createdData.brands.length}`);
    console.log(`   • Tenants: ${createdData.tenants.length}`);
    console.log(`   • Products: ${createdData.products.length}`);
    console.log(`   • SubProducts: ${await SubProduct.countDocuments({})}`);
    console.log(`   • Size Variants: ${await Size.countDocuments({})}`);
    console.log(`   • Customers: ${SEED_CONFIG.counts.customers}`);
    console.log(`   • Total Users: ${createdData.users.length}`);
    
    console.log('\n🔐 Login Credentials:');
    console.log('   Super Admin:');
    console.log('   Email: admin@drinksharbour.com');
    console.log('   Password: Admin@123!SecurePassword\n');
    console.log('   Tenant Admins:');
    console.log('   Email: admin@{tenant-slug}.drinksharbour.com');
    console.log('   Password: Tenant@123!SecurePassword\n');
    console.log('   Customers:');
    console.log('   Email: {firstname}.{lastname}{n}@example.com');
    console.log('   Password: Customer@123');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Disconnect and exit
    await db.disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error('\nStack trace:', error.stack);
    
    try {
      if (mongoose.connection.readyState === 1) {
        await db.disconnectDB();
      }
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
    
    process.exit(1);
  }
}

// Run seeder
if (require.main === module) {
  seed();
}

module.exports = seed;