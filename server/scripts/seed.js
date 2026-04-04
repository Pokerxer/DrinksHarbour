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
    products: parseInt(process.argv[2]) || 50,
    customers: 15,
    subProductsPerProduct: 3,
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
    slug = `${slugify.slugify(name)}-${counter}`;
    counter++;
  }
  
  createdSlugs.add(slug);
  return slug;
}


/**
 * Random selection helper - ALWAYS returns an array
 * @param {Array} array - Source array
 * @param {number} count - Number of items to select
 * @returns {Array} - Selected items (always an array)
 */
function randomSelect(array, count = 1) {
  // Validation
  if (!array || !Array.isArray(array) || array.length === 0) {
    console.warn('randomSelect: Invalid or empty array provided');
    return [];
  }
  
  // Ensure count is valid
  const validCount = Math.max(1, Math.min(count, array.length));
  
  // Shuffle array
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  
  // Always return array
  return shuffled.slice(0, validCount);
}

/**
 * Random selection helper - Returns single item or null
 * @param {Array} array - Source array
 * @returns {*} - Single random item
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
// DEFAULT PRODUCT IMAGES
// ============================================================


// Default images for subcategories (Cloudinary URLs)
const DEFAULT_SUBCATEGORY_IMAGES = {
  // Vodka
  premium_vodka: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/vodka_premium',
  flavored_vodka: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/vodka_flavored',
  citrus_vodka: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/vodka_citrus',

  // Gin
  london_dry_gin: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/gin_london_dry',
  contemporary_gin: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/gin_contemporary',
  floral_gin: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/gin_floral',

  // Rum
  white_rum: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/rum_white',
  dark_rum: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/rum_dark',
  spiced_rum: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/rum_spiced',

  // Red Wine
  cabernet_sauvignon: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/wine_red_cabernet',
  pinot_noir: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/wine_red_pinot',
  merlot: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/wine_red_merlot',

  // White Wine
  chardonnay: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/wine_white_chardonnay',
  sauvignon_blanc: 'https://res.cloudazine.com/dpydlvp2h/image/upload/v1/subcategories/wine_white_sauvignon',

  // Rosé
  provence_rose: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/rose_provence',
  white_rose: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/rose_white',

  // Sparkling
  prosecco: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/sparkling_prosecco',
  cava: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/sparkling_cava',

  // Champagne
  non_vintage_champagne: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/champagne_nv',
  rose_champagne: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/champagne_rose',

  // Scotch
  single_malt: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/scotch_malt',
  blended_scotch: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/scotch_blended',

  // Bourbon
  bourbon: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/bourbon_straight',
  kentucky_bourbon: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/bourbon_kentucky',

  // Water
  still_water: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/water_still',
  sparkling_water: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/water_sparkling',
  coconut_water: 'https://res.cloudinary.com/dpydlvp2h/image/upload/v1/subcategories/water_coconut',
};

const DEFAULT_PRODUCT_IMAGES = {
  // Beer Images
  beer: [
    'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800',
    'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=800',
    'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=800',
  ],
  lager: [
    'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=800',
    'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800',
  ],
  stout: [
    'https://images.unsplash.com/photo-1612528443702-f6741f70a049?w=800',
    'https://images.unsplash.com/photo-1608909063917-2c63a25f3ea0?w=800',
  ],
  
  // Wine Images
  wine: [
    'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800',
    'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=800',
    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
  ],
  red_wine: [
    'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=800',
    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800',
  ],
  white_wine: [
    'https://images.unsplash.com/photo-1586370434639-0fe43b2d32d6?w=800',
    'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800',
    
  ],
  rose_wine: [
    'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=800',
    'https://images.unsplash.com/photo-1559388450-6d15b2a3a87c?w=800',
  ],
  sparkling_wine: [
    'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=800',
    'https://images.unsplash.com/photo-1598473445208-91323cf87d8c?w=800',
  ],
  champagne: [
    'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=800',
    'https://images.unsplash.com/photo-1598473445208-91323cf87d8c?w=800',
    'https://images.unsplash.com/photo-1519181245277-c0eaa9d7421b?w=800',
  ],
  whiskey: [
    'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800',
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800',
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
  white_rum: [
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
  ],
  tequila: [
    'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800',
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
  ],
  brandy: [
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800',
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
  
  // Liqueur Images
  liqueur: [
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800',
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
  ],
  coffee: [
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
  ],
  tea: [
    'https://images.unsplash.com/photo-1561047029-3000c68339ca?w=800',
    'https://images.unsplash.com/photo-1561043846-6b3f16d5a6e5?w=800',
  ],
  // Soft Drinks Images
  soft_drink: [
    'https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=800',
    'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=800',
  ],

  juice: [
    'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=800',
    'https://images.unsplash.com/photo-1603561596112-0a132b757442?w=800',
  ],
  // Energy Drinks
  energy_drink: [
    'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=800',
    'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=800',
  ],
  milk: [
    'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800',
  ],
  
  // Water
  water: [
    'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800',
    'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800',
  ],
  spring_water: [
    'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800',
  ],
  
  // Default fallback
  default: [
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800',
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
  ],
};


// ============================================================
// ENHANCED FLAVORS DATA
// ============================================================

const FLAVORS_DATA = [
  // Fruits
  { name: 'Fruity', value: 'fruity', category: 'fruit', color: '#FF6B9D', intensity: 'moderate' },
  { name: 'Citrus', value: 'citrus', category: 'citrus', color: '#FFA500', intensity: 'pronounced' },
  { name: 'Tropical', value: 'tropical', category: 'tropical', color: '#FFD700', intensity: 'pronounced' },
  { name: 'Berry', value: 'berry', category: 'berry', color: '#8B008B', intensity: 'moderate' },
  { name: 'Apple', value: 'apple', category: 'fruit', color: '#90EE90', intensity: 'mild' },
  { name: 'Stone Fruit', value: 'stone_fruit', category: 'stone_fruit', color: '#FFDAB9', intensity: 'moderate' },
  
  // Sweet & Dessert
  { name: 'Vanilla', value: 'vanilla', category: 'sweet', color: '#F5DEB3', intensity: 'moderate' },
  { name: 'Caramel', value: 'caramel', category: 'sweet', color: '#D2691E', intensity: 'pronounced' },
  { name: 'Chocolate', value: 'chocolate', category: 'sweet', color: '#8B4513', intensity: 'pronounced' },
  { name: 'Honey', value: 'honey', category: 'sweet', color: '#FFB347', intensity: 'moderate' },
  { name: 'Toffee', value: 'toffee', category: 'sweet', color: '#B8860B', intensity: 'moderate' },
  
  // Spices & Herbs
  { name: 'Spicy', value: 'spicy', category: 'spice', color: '#DC143C', intensity: 'pronounced' },
  { name: 'Herbal', value: 'herbal', category: 'herb', color: '#228B22', intensity: 'moderate' },
  { name: 'Peppery', value: 'peppery', category: 'spice', color: '#696969', intensity: 'pronounced' },
  { name: 'Cinnamon', value: 'cinnamon', category: 'spice', color: '#A0522D', intensity: 'moderate' },
  { name: 'Ginger', value: 'ginger', category: 'spice', color: '#CD853F', intensity: 'pronounced' },
  
  // Floral
  { name: 'Floral', value: 'floral', category: 'floral', color: '#DDA0DD', intensity: 'subtle' },
  
  // Wood & Oak
  { name: 'Oak', value: 'oak', category: 'wood', color: '#8B7355', intensity: 'pronounced' },
  { name: 'Smoky', value: 'smoky', category: 'smoke', color: '#4A4A4A', intensity: 'intense' },
  { name: 'Woody', value: 'woody', category: 'wood', color: '#8B6914', intensity: 'moderate' },
  
  // Nuts & Grain
  { name: 'Nutty', value: 'nutty', category: 'nut', color: '#A0826D', intensity: 'moderate' },
  { name: 'Malty', value: 'malty', category: 'grain', color: '#B5651D', intensity: 'moderate' },
  { name: 'Toasted', value: 'toasted', category: 'grain', color: '#8B7355', intensity: 'moderate' },
  
  // Coffee & Roasted
  { name: 'Coffee', value: 'coffee', category: 'coffee', color: '#6F4E37', intensity: 'pronounced' },
  { name: 'Roasted', value: 'roasted', category: 'roasted', color: '#3D2817', intensity: 'pronounced' },
  
  // Cream & Dairy
  { name: 'Creamy', value: 'creamy', category: 'dairy', color: '#FFFACD', intensity: 'moderate' },
  { name: 'Buttery', value: 'buttery', category: 'dairy', color: '#FFDB58', intensity: 'moderate' },
  
  // Earth & Mineral
  { name: 'Earthy', value: 'earthy', category: 'earth', color: '#8B4726', intensity: 'moderate' },
  { name: 'Mineral', value: 'mineral', category: 'mineral', color: '#708090', intensity: 'subtle' },
  
  // Character
  { name: 'Dry', value: 'dry', category: 'other', color: '#D3D3D3', intensity: 'moderate' },
  { name: 'Bitter', value: 'bitter', category: 'other', color: '#556B2F', intensity: 'pronounced' },
  { name: 'Sweet', value: 'sweet', category: 'sweet', color: '#FFB6C1', intensity: 'moderate' },
  { name: 'Crisp', value: 'crisp', category: 'other', color: '#E0FFFF', intensity: 'pronounced' },
  { name: 'Smooth', value: 'smooth', category: 'other', color: '#F5F5F5', intensity: 'moderate' },
];

// ============================================================
// ENHANCED TAGS DATA
// ============================================================

const TAGS_DATA = [
  // Occasions
  { name: 'party', type: 'occasion', color: '#FF1493', category: 'seasonal' },
  { name: 'celebration', type: 'occasion', color: '#FFD700', category: 'seasonal' },
  { name: 'gift', type: 'occasion', color: '#FF69B4', category: 'promotional' },
  { name: 'summer', type: 'season', color: '#FFA500', category: 'seasonal', seasonal: { summer: true } },
  { name: 'winter', type: 'season', color: '#4169E1', category: 'seasonal', seasonal: { winter: true } },
  { name: 'christmas', type: 'occasion', color: '#DC143C', category: 'seasonal', seasonal: { winter: true } },
  
  // Quality & Style
  { name: 'premium', type: 'attribute', color: '#DAA520', category: 'lifestyle' },
  { name: 'craft', type: 'style', color: '#8B4513', category: 'lifestyle' },
  { name: 'limited edition', type: 'attribute', color: '#9370DB', category: 'promotional' },
  { name: 'bestseller', type: 'trend', color: '#32CD32', category: 'promotional' },
  { name: 'new arrival', type: 'trend', color: '#00CED1', category: 'promotional' },
  { name: 'award winning', type: 'award', color: '#FFD700', category: 'promotional' },
  
  // Dietary
  { name: 'organic', type: 'dietary', color: '#228B22', category: 'lifestyle' },
  { name: 'vegan', type: 'dietary', color: '#32CD32', category: 'lifestyle' },
  { name: 'gluten free', type: 'dietary', color: '#90EE90', category: 'lifestyle' },
  { name: 'low calorie', type: 'dietary', color: '#98FB98', category: 'lifestyle' },
  { name: 'sugar free', type: 'dietary', color: '#00FA9A', category: 'lifestyle' },
  
  // Style
  { name: 'artisanal', type: 'style', color: '#8B7355', category: 'lifestyle' },
  { name: 'traditional', type: 'style', color: '#A0826D', category: 'lifestyle' },
  { name: 'modern', type: 'style', color: '#4682B4', category: 'lifestyle' },
  
  // Pairing
  { name: 'food pairing', type: 'pairing', color: '#FF6347', category: 'other' },
  { name: 'cocktail ingredient', type: 'pairing', color: '#FF4500', category: 'other' },
];

// ============================================================
// ENHANCED CATEGORIES DATA
// ============================================================

const CATEGORIES_DATA = [
  {
    name: 'Beer',
    type: 'beer',
    alcoholCategory: 'alcoholic',
    description: 'Explore our extensive collection of beers from around the world, including craft brews, lagers, ales, stouts, and specialty beers.',
    shortDescription: 'Premium beers, craft brews, and international favorites',
    tagline: 'Discover Your Perfect Brew',
    icon: '🍺',
    color: '#F59E0B',
    showOnHomepage: true,
    isFeatured: true,
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
    name: 'Functional Drinks',
    type: 'functional_drink',
    alcoholCategory: 'non_alcoholic',
    description: 'Functional drinks for health and wellness.',
    shortDescription: 'Functional drinks',
    tagline: 'Health & Wellness',
    icon: '💪',
    color: '#10B981',
    showOnHomepage: true,
    displayOrder: 49,
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

];

// ============================================================
// ENHANCED SUBCATEGORIES DATA
// ============================================================

const SUBCATEGORIES_DATA = {
  'Beer': [
    {
      name: 'Lager',
      type: 'lager',
      description: 'Crisp, clean, and refreshing beers fermented at cool temperatures with bottom-fermenting yeast.',
      characteristics: {
        abvRange: { min: 4, max: 6 },
        colorProfile: 'Pale golden to amber',
        bodyStyle: 'light_medium',
        bitterness: 'low',
        carbonation: 'medium_high',
      },
      typicalFlavors: ['clean', 'crisp', 'malty', 'bready', 'subtle hop'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Pilsner',
      type: 'pilsner',
      description: 'A type of pale lager originating from the Czech Republic, known for its crispness and noble hop character.',
      characteristics: {
        abvRange: { min: 4.5, max: 5.5 },
        colorProfile: 'Straw to pale gold',
        bodyStyle: 'light_medium',
        bitterness: 'medium',
        carbonation: 'high',
      },
      typicalFlavors: ['crisp', 'grassy', 'floral', 'biscuit', 'clean'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'India Pale Ale (IPA)',
      type: 'ipa',
      description: 'Hop-forward beers with pronounced bitterness, originally brewed with extra hops for preservation during long sea voyages.',
      characteristics: {
        abvRange: { min: 5.5, max: 7.5 },
        colorProfile: 'Golden to deep amber',
        bodyStyle: 'medium',
        bitterness: 'high',
        carbonation: 'medium',
      },
      typicalFlavors: ['citrus', 'pine', 'tropical fruit', 'resinous', 'floral'],
      seasonal: { year_round: true },
    },
    {
      name: 'West Coast IPA',
      type: 'west_coast_ipa',
      description: 'A classic American IPA style with clear appearance, pronounced bitterness, and citrus/pine hop character.',
      characteristics: {
        abvRange: { min: 6, max: 7.5 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
        bitterness: 'high',
        carbonation: 'medium',
      },
      typicalFlavors: ['grapefruit', 'pine', 'resin', 'dank', 'crackery malt'],
      seasonal: { year_round: true },
    },
    {
      name: 'New England IPA (Hazy IPA)',
      type: 'hazy_ipa',
      description: 'Modern IPA with juicy, tropical hop flavors, low bitterness, and a hazy, opaque appearance.',
      characteristics: {
        abvRange: { min: 6, max: 8 },
        colorProfile: 'Hazy yellow to orange',
        bodyStyle: 'medium_full',
        bitterness: 'low',
        carbonation: 'medium',
      },
      typicalFlavors: ['juicy', 'mango', 'passion fruit', 'orange', 'peach'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Pale Ale',
      type: 'pale_ale',
      description: 'Classic beer style with balanced hop and malt character, more hop-forward than a blonde ale but less than an IPA.',
      characteristics: {
        abvRange: { min: 4.5, max: 6.2 },
        colorProfile: 'Golden to copper',
        bodyStyle: 'medium',
        bitterness: 'medium',
        carbonation: 'medium',
      },
      typicalFlavors: ['citrus', 'pine', 'caramel', 'biscuit', 'balanced'],
      seasonal: { year_round: true },
    },
    {
      name: 'Stout',
      type: 'stout',
      description: 'Dark, rich beers made with roasted barley or roasted malt, giving coffee and chocolate flavors.',
      characteristics: {
        abvRange: { min: 4, max: 12 },
        colorProfile: 'Deep brown to black',
        bodyStyle: 'medium_full',
        bitterness: 'medium',
        carbonation: 'low_medium',
      },
      typicalFlavors: ['roasted coffee', 'dark chocolate', 'caramel', 'toast', 'cream'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Imperial Stout',
      type: 'imperial_stout',
      description: 'A stronger, fuller-bodied version of stout with higher alcohol and intense flavors.',
      characteristics: {
        abvRange: { min: 8, max: 12 },
        colorProfile: 'Black',
        bodyStyle: 'full',
        bitterness: 'medium',
        carbonation: 'low_medium',
      },
      typicalFlavors: ['dark fruit', 'coffee', 'chocolate', 'molasses', 'alcohol warmth'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Porter',
      type: 'porter',
      description: 'Dark ale similar to stout but generally less roasty, with chocolate and caramel malt character.',
      characteristics: {
        abvRange: { min: 4.5, max: 6.5 },
        colorProfile: 'Dark brown to black',
        bodyStyle: 'medium',
        bitterness: 'medium',
        carbonation: 'medium',
      },
      typicalFlavors: ['chocolate', 'caramel', 'toffee', 'nutty', 'roasted malt'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Wheat Beer (Hefeweizen)',
      type: 'hefeweizen',
      description: 'German-style wheat beer with significant wheat content, known for banana and clove yeast character.',
      characteristics: {
        abvRange: { min: 4.5, max: 5.5 },
        colorProfile: 'Pale to golden, hazy',
        bodyStyle: 'medium',
        bitterness: 'low',
        carbonation: 'high',
      },
      typicalFlavors: ['banana', 'clove', 'bubblegum', 'vanilla', 'wheat'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Witbier (Belgian White)',
      type: 'witbier',
      description: 'Belgian-style wheat beer brewed with orange peel and coriander, typically hazy and refreshing.',
      characteristics: {
        abvRange: { min: 4.5, max: 5.5 },
        colorProfile: 'Pale straw, hazy',
        bodyStyle: 'light_medium',
        bitterness: 'low',
        carbonation: 'high',
      },
      typicalFlavors: ['orange peel', 'coriander', 'wheat', 'spice', 'citrus'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Sour Beer',
      type: 'sour_beer',
      description: 'Beers intentionally soured through wild yeast or bacteria fermentation, with tart, funky, or fruity flavors.',
      characteristics: {
        abvRange: { min: 3, max: 7 },
        colorProfile: 'Various (often pale to amber)',
        bodyStyle: 'light_medium',
        acidity: 'medium_high',
        carbonation: 'medium_high',
      },
      typicalFlavors: ['tart', 'fruity', 'funky', 'complex', 'vinegar'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Berliner Weisse',
      type: 'berliner_weisse',
      description: 'A light, tart German wheat beer with low alcohol and refreshing acidity.',
      characteristics: {
        abvRange: { min: 2.8, max: 3.8 },
        colorProfile: 'Pale straw, hazy',
        bodyStyle: 'light',
        acidity: 'high',
        carbonation: 'high',
      },
      typicalFlavors: ['tart lemon', 'green apple', 'wheat', 'yogurt', 'crisp'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Gose',
      type: 'gose',
      description: 'A sour German wheat beer brewed with coriander and salt, creating a tart, slightly salty profile.',
      characteristics: {
        abvRange: { min: 4, max: 5 },
        colorProfile: 'Pale straw, hazy',
        bodyStyle: 'light_medium',
        acidity: 'medium',
        carbonation: 'high',
      },
      typicalFlavors: ['tart', 'salt', 'coriander', 'lemon', 'wheat'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Brown Ale',
      type: 'brown_ale',
      description: 'Malty, nutty beers with caramel and chocolate notes, ranging from English to American styles.',
      characteristics: {
        abvRange: { min: 4.5, max: 6.5 },
        colorProfile: 'Amber to brown',
        bodyStyle: 'medium',
        bitterness: 'low',
        carbonation: 'medium',
      },
      typicalFlavors: ['caramel', 'nutty', 'toffee', 'chocolate', 'raisin'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Belgian Dubbel',
      type: 'belgian_dubbel',
      description: 'A Belgian abbey-style ale with malty sweetness, dark fruit flavors, and modest strength.',
      characteristics: {
        abvRange: { min: 6, max: 7.5 },
        colorProfile: 'Amber to brown',
        bodyStyle: 'medium_full',
        bitterness: 'low',
        carbonation: 'high',
      },
      typicalFlavors: ['raisin', 'plum', 'caramel', 'spice', 'bread'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Belgian Tripel',
      type: 'belgian_tripel',
      description: 'A strong, pale Belgian ale with complex yeast character, fruity notes, and deceptively smooth alcohol.',
      characteristics: {
        abvRange: { min: 7.5, max: 9.5 },
        colorProfile: 'Pale gold to amber',
        bodyStyle: 'medium',
        bitterness: 'medium',
        carbonation: 'high',
      },
      typicalFlavors: ['pear', 'apple', 'pepper', 'honey', 'spice'],
      seasonal: { year_round: true },
    },
    {
      name: 'Saison/Farmhouse Ale',
      type: 'saison',
      description: 'Rustic, dry Belgian-style ale with fruity, spicy yeast character and high carbonation.',
      characteristics: {
        abvRange: { min: 5, max: 8 },
        colorProfile: 'Pale to amber',
        bodyStyle: 'light_medium',
        bitterness: 'medium',
        carbonation: 'high',
      },
      typicalFlavors: ['pepper', 'citrus', 'hay', 'herbal', 'earth'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Amber Ale',
      type: 'amber_ale',
      description: 'American-style ale with balanced malt and hop character, featuring caramel and toast notes.',
      characteristics: {
        abvRange: { min: 4.5, max: 6.2 },
        colorProfile: 'Amber to copper',
        bodyStyle: 'medium',
        bitterness: 'medium',
        carbonation: 'medium',
      },
      typicalFlavors: ['caramel', 'toast', 'nutty', 'citrus', 'balanced'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Blonde Ale',
      type: 'blonde_ale',
      description: 'Light, approachable ale with mild malt and hop character, easy-drinking and refreshing.',
      characteristics: {
        abvRange: { min: 4, max: 5.5 },
        colorProfile: 'Straw to gold',
        bodyStyle: 'light',
        bitterness: 'low',
        carbonation: 'medium',
      },
      typicalFlavors: ['biscuit', 'bread', 'light fruit', 'subtle hop', 'clean'],
      seasonal: { spring: true, summer: true },
    }
  ],
  'Cider': [
    {
      name: 'Traditional Dry Cider',
      type: 'dry_cider',
      description: 'Classic, dry cider with minimal residual sugar, highlighting natural apple character and tannins.',
      characteristics: {
        abvRange: { min: 5, max: 7 },
        colorProfile: 'Pale straw to amber',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        carbonation: 'medium',
      },
      typicalFlavors: ['tart apple', 'woody', 'earthy', 'mineral', 'dry finish'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'New England Style Cider',
      type: 'new_england_cider',
      description: 'American cider made with traditional cider apples, often dry to off-dry with robust tannic structure.',
      characteristics: {
        abvRange: { min: 6, max: 8 },
        colorProfile: 'Golden to deep amber',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry_off_dry',
        carbonation: 'low_medium',
      },
      typicalFlavors: ['astringent apple', 'tannic', 'leather', 'barnyard', 'complex'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'French Cidre',
      type: 'french_cidre',
      description: 'French-style cider, typically from Normandy or Brittany, often bottled with low carbonation (pétillant) and funky, earthy notes.',
      characteristics: {
        abvRange: { min: 3, max: 6 },
        colorProfile: 'Hazy gold to amber',
        bodyStyle: 'medium',
        sweetnessLevel: 'off_dry',
        carbonation: 'low',
      },
      typicalFlavors: ['funky', 'earthy', 'baked apple', 'yeasty', 'farmhouse'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Spanish Sidra Natural',
      type: 'spanish_sidra',
      description: 'Natural, still or lightly sparkling cider from Asturias or Basque Country, often poured from height (escanciado) to aerate.',
      characteristics: {
        abvRange: { min: 5, max: 7 },
        colorProfile: 'Hazy pale gold',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        carbonation: 'very_low',
      },
      typicalFlavors: ['sharp acidity', 'grassy', 'funk', 'green apple', 'vinegar'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Modern Semi-Dry/Sweet Cider',
      type: 'sweet_cider',
      description: 'Popular commercial style with noticeable residual sugar, approachable and fruit-forward.',
      characteristics: {
        abvRange: { min: 4.5, max: 6 },
        colorProfile: 'Clear pale gold',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'sweet',
        carbonation: 'medium_high',
      },
      typicalFlavors: ['sweet apple', 'juicy', 'honey', 'pear', 'clean'],
      seasonal: { year_round: true },
    },
    {
      name: 'Ice Cider (Cidre de Glace)',
      type: 'ice_cider',
      description: 'Canadian dessert cider made from apples frozen on the tree or after harvest, concentrated and fermented slowly, resulting in a sweet, intense nectar.',
      characteristics: {
        abvRange: { min: 7, max: 13 },
        colorProfile: 'Deep amber to gold',
        bodyStyle: 'full',
        sweetnessLevel: 'sweet',
        carbonation: 'still',
      },
      typicalFlavors: ['apricot', 'honey', 'caramelized apple', 'raisin', 'syrupy'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Perry (Pear Cider)',
      type: 'perry',
      description: 'Fermented beverage made primarily from pear juice, often drier and more delicate than apple cider.',
      characteristics: {
        abvRange: { min: 5, max: 8 },
        colorProfile: 'Pale straw to water-white',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'off_dry',
        carbonation: 'medium',
      },
      typicalFlavors: ['delicate pear', 'floral', 'honey', 'quince', 'light spice'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Hopped Cider',
      type: 'hopped_cider',
      description: 'Cider infused with hops during fermentation or aging, adding aromatic and bitter notes common in craft beer.',
      characteristics: {
        abvRange: { min: 5.5, max: 7 },
        colorProfile: 'Pale gold',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        carbonation: 'medium_high',
      },
      typicalFlavors: ['citrus', 'pine', 'herbal', 'apple', 'bitter finish'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Fruit-Infused Cider',
      type: 'fruit_infused_cider',
      description: 'Cider blended or fermented with additional fruits like berries, cherries, or tropical fruits.',
      characteristics: {
        abvRange: { min: 4.5, max: 6.5 },
        colorProfile: 'Pink, red, or purple (depending on fruit)',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'semi_sweet',
        carbonation: 'medium_high',
      },
      typicalFlavors: ['berry', 'cherry', 'tropical fruit', 'jammy', 'balanced apple'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Barrel-Aged Cider',
      type: 'barrel_aged_cider',
      description: 'Cider aged in oak barrels (often previously used for whiskey, wine, or rum), acquiring complex woody and spirit notes.',
      characteristics: {
        abvRange: { min: 6.5, max: 10 },
        colorProfile: 'Amber to deep gold',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'off_dry',
        carbonation: 'low_medium',
      },
      typicalFlavors: ['vanilla', 'oak', 'caramel', 'spice', 'bourbon'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Herbal/Spiced Cider',
      type: 'spiced_cider',
      description: 'Cider infused with botanicals, spices, or herbs such as ginger, cinnamon, or rosemary.',
      characteristics: {
        abvRange: { min: 5, max: 7 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
        carbonation: 'medium',
      },
      typicalFlavors: ['ginger', 'cinnamon', 'clove', 'herbal', 'warming spice'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Mead-Cider Hybrid (Cyser)',
      type: 'cyser',
      description: 'A traditional melomel (mead) made by fermenting apple juice with honey, blending cider and mead characteristics.',
      characteristics: {
        abvRange: { min: 8, max: 14 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium_full',
        carbonation: 'varies',
      },
      typicalFlavors: ['honey', 'apple', 'meady', 'floral', 'complex'],
      seasonal: { fall: true, winter: true },
    }
  ],
  'Red Wine': [
    {
      name: 'Cabernet Sauvignon',
      type: 'cabernet_sauvignon',
      description: 'Full-bodied red with firm tannins and dark fruit flavors, often aged in oak.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Deep ruby to garnet',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'high',
      },
      typicalFlavors: ['blackcurrant', 'cedar', 'tobacco', 'green pepper', 'dark cherry'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Merlot',
      type: 'merlot',
      description: 'Medium to full-bodied red with softer tannins and plummy fruit character.',
      characteristics: {
        abvRange: { min: 13, max: 14.5 },
        colorProfile: 'Ruby to garnet',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['plum', 'black cherry', 'chocolate', 'mocha', 'herbal'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Pinot Noir',
      type: 'pinot_noir',
      description: 'Light to medium-bodied red known for elegance, complexity, and red fruit aromas.',
      characteristics: {
        abvRange: { min: 12, max: 14.5 },
        colorProfile: 'Light ruby to garnet',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['cherry', 'raspberry', 'mushroom', 'forest floor', 'violet'],
      seasonal: { spring: true, summer: true, fall: true },
    },
    {
      name: 'Syrah',
      type: 'syrah',
      description: 'Full-bodied red with spicy, dark fruit character and often peppery notes.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Deep purple to inky purple',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'high',
      },
      typicalFlavors: ['blackberry', 'blueberry', 'black pepper', 'smoke', 'licorice'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Malbec',
      type: 'malbec',
      description: 'Full-bodied red with dark fruit flavors and velvety texture, especially from Argentina.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Deep purple',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'medium_high',
      },
      typicalFlavors: ['plum', 'blackberry', 'cocoa', 'violets', 'leather'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Zinfandel',
      type: 'zinfandel',
      description: 'Medium to full-bodied red with jammy fruit, spice, and often higher alcohol.',
      characteristics: {
        abvRange: { min: 14, max: 16 },
        colorProfile: 'Ruby to deep garnet',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['jammy raspberry', 'blackberry', 'black pepper', 'spice', 'cinnamon'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Sangiovese',
      type: 'sangiovese',
      description: 'Medium-bodied Italian red with high acidity and tart cherry flavors, the main grape of Chianti.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Ruby red',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        tannins: 'medium_high',
      },
      typicalFlavors: ['tart cherry', 'tomato leaf', 'dried herbs', 'leather', 'earth'],
      seasonal: { spring: true, fall: true },
    },
    {
      name: 'Tempranillo',
      type: 'tempranillo',
      description: 'Medium to full-bodied Spanish red with leather and red fruit notes, the main grape of Rioja.',
      characteristics: {
        abvRange: { min: 13.5, max: 14.5 },
        colorProfile: 'Ruby to garnet',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['strawberry', 'leather', 'tobacco', 'vanilla', 'dill'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Grenache/Garnacha',
      type: 'grenache',
      description: 'Medium-bodied red with red fruit, spice, and lower tannins, often used in blends.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Ruby red',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        tannins: 'low_medium',
      },
      typicalFlavors: ['raspberry', 'strawberry', 'white pepper', 'herbs', 'licorice'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Barbera',
      type: 'barbera',
      description: 'Italian red with high acidity, low tannins, and vibrant red fruit flavors.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Bright ruby',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        tannins: 'low',
      },
      typicalFlavors: ['sour cherry', 'raspberry', 'violets', 'spice', 'earth'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Grenache',
      type: 'grenache',
      description: 'Medium to full-bodied red with jammy fruit flavors, often featuring high alcohol and smooth texture.',
      characteristics: {
        abvRange: { min: 14, max: 16 },
        colorProfile: 'Medium ruby to purple',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['berry', 'jammy fruit', 'spice', 'herbs', 'earth'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Carignan',
      type: 'carignan',
      description: 'Traditional Mediterranean grape producing wines with deep color and firm tannins.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Deep ruby to purple',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'high',
      },
      typicalFlavors: ['black fruit', 'earthy', 'spice', 'herbs', 'firm'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Mourvèdre',
      type: 'mouvedre',
      description: 'Bold, meaty red with dark fruit and gamey flavors, often blended in GSM (Grenache-Syrah-Mourvèdre).',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Deep ruby to garnet',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'high',
      },
      typicalFlavors: ['dark fruit', 'gamey', 'meat', 'spice', 'earth'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Cabernet Franc',
      type: 'cabernet_franc',
      description: 'Elegant red with herbal, vegetative notes alongside dark fruit, often used in Bordeaux blends.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Ruby to garnet',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['herbaceous', 'bell pepper', 'raspberry', 'violet', 'tobacco'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Petite Sirah',
      type: 'petite_sirah',
      description: 'Inky, bold red with intense color and spicy, fruity flavors.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Inky purple',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'high',
      },
      typicalFlavors: ['blueberry', 'black pepper', 'spice', 'jammy', 'bold'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Touriga Nacional',
      type: 'touriga_nacional',
      description: 'Portugals flagship grape, producing deeply colored, aromatic reds with intense fruit and tannins.',
      characteristics: {
        abvRange: { min: 13, max: 15 },
        colorProfile: 'Deep ruby to purple',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'high',
      },
      typicalFlavors: ['blackberry', 'rose', 'spice', 'herbs', 'intense'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Tempranillo',
      type: 'tempranillo',
      description: 'Spains signature grape, producing medium to full-bodied reds with tobacco and leather notes.',
      characteristics: {
        abvRange: { min: 12.5, max: 14.5 },
        colorProfile: 'Ruby to brick',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['tobacco', 'leather', 'cherry', 'herb', 'earth'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Sangiovese',
      type: 'sangiovese',
      description: 'Italys primary grape, producing wines with bright cherry and earthy notes.',
      characteristics: {
        abvRange: { min: 12, max: 14 },
        colorProfile: 'Ruby to garnet',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['cherry', 'plum', 'earthy', 'herbs', 'tobacco'],
      seasonal: { year_round: true },
    },
    {
      name: 'Nebbiolo',
      type: 'nebbiolo',
      description: 'Piedmonts noble grape, producing powerful, tannic wines with distinctive tar and roses.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Garnet to brick',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'high',
      },
      typicalFlavors: ['tar', 'roses', 'truffle', 'cherry', 'earth'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Barbera',
      type: 'barbera',
      description: 'Piedmonts workhorse grape, producing approachable wines with bright acidity and cherry fruit.',
      characteristics: {
        abvRange: { min: 12, max: 14 },
        colorProfile: 'Ruby to purple',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        tannins: 'low',
      },
      typicalFlavors: ['cherry', 'raspberry', 'jam', 'acidic', 'approachable'],
      seasonal: { year_round: true },
    },
    {
      name: 'Dolcetto',
      type: 'dolcetto',
      description: 'Piedmont grape producing soft, fruity wines with low tannins, meant for early drinking.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Deep ruby to purple',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        tannins: 'low',
      },
      typicalFlavors: ['blackberry', 'plum', 'chocolate', 'almond', 'soft'],
      seasonal: { year_round: true },
    },
    {
      name: 'Aglianico',
      type: 'aglianico',
      description: 'Southern Italys powerful grape, producing bold, tannic wines with volcanic earth notes.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Deep ruby to garnet',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'high',
      },
      typicalFlavors: ['blackberry', 'plum', 'volcanic earth', 'spice', 'gamey'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Primitivo',
      type: 'primitivo',
      description: 'Southern Italian grape (genetically related to Zinfandel), producing bold, fruity wines.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Deep ruby to purple',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['blackberry', 'jam', 'prune', 'spice', 'jammy'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Nero dAvola',
      type: 'nero_davola',
      description: 'Sicilys flagship grape, producing deeply colored wines with dark fruit and spicy notes.',
      characteristics: {
        abvRange: { min: 13, max: 14.5 },
        colorProfile: 'Deep ruby to purple',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['black cherry', 'plum', 'spice', 'earthy', 'bold'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Pinotage',
      type: 'pinotage',
      description: 'South African cross between Pinot Noir and Cinsault, with smoky, fruity character.',
      characteristics: {
        abvRange: { min: 13, max: 14.5 },
        colorProfile: 'Ruby to purple',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['smoky', 'berry', 'tropical', 'earthy', 'unique'],
      seasonal: { year_round: true },
    },
    {
      name: 'Baga',
      type: 'baga',
      description: 'Portugueses hidden treasure, producing tannic, age-worthy wines with dark fruit.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Deep ruby',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        tannins: 'high',
      },
      typicalFlavors: ['black fruit', 'earthy', 'tannic', 'spice', 'structured'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Tinta Roriz',
      type: 'tinta_roriz',
      description: 'Portugese grape (related to Tempranillo), used in Dao and Douro wines.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Deep ruby',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'medium',
      },
      typicalFlavors: ['berry', 'spice', 'herbs', 'earthy', 'structured'],
      seasonal: { year_round: true },
    }
  ],
  'White Wine': [
    {
      name: 'Chardonnay',
      type: 'chardonnay',
      description: 'Versatile white that can be crisp and mineral-driven or rich and buttery from oak aging.',
      characteristics: {
        abvRange: { min: 12.5, max: 14.5 },
        colorProfile: 'Pale straw to deep gold',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['apple', 'citrus', 'vanilla', 'butter', 'toast'],
      seasonal: { spring: true, summer: true, fall: true },
    },
    {
      name: 'Sauvignon Blanc',
      type: 'sauvignon_blanc',
      description: 'Crisp, aromatic white with herbaceous and tropical fruit notes, known for high acidity.',
      characteristics: {
        abvRange: { min: 12, max: 14 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        acidity: 'high',
      },
      typicalFlavors: ['grapefruit', 'grass', 'gooseberry', 'passion fruit', 'mineral'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Pinot Grigio/Pinot Gris',
      type: 'pinot_grigio',
      description: 'Light-bodied, crisp Italian style (Pinot Grigio) or richer, spicier Alsatian style (Pinot Gris).',
      characteristics: {
        abvRange: { min: 11.5, max: 14 },
        colorProfile: 'Pale straw to copper-tinged',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['citrus', 'green apple', 'pear', 'white peach', 'mineral'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Riesling',
      type: 'riesling',
      description: 'Aromatic white with high acidity, ranging from bone dry to lusciously sweet.',
      characteristics: {
        abvRange: { min: 8, max: 13 },
        colorProfile: 'Pale straw to deep gold',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'varies',
        acidity: 'high',
      },
      typicalFlavors: ['apricot', 'peach', 'honey', 'petrol', 'lime'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Chenin Blanc',
      type: 'chenin_blanc',
      description: 'Versatile white from the Loire Valley or South Africa, ranging from dry to sweet with high acidity.',
      characteristics: {
        abvRange: { min: 12, max: 14 },
        colorProfile: 'Pale straw to golden',
        bodyStyle: 'medium',
        sweetnessLevel: 'varies',
        acidity: 'high',
      },
      typicalFlavors: ['apple', 'pear', 'honey', 'quince', 'wax'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Viognier',
      type: 'viognier',
      description: 'Aromatic, full-bodied white with low acidity and floral, stone fruit aromas.',
      characteristics: {
        abvRange: { min: 13.5, max: 15 },
        colorProfile: 'Pale to deep gold',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        acidity: 'low',
      },
      typicalFlavors: ['apricot', 'peach', 'orange blossom', 'honeysuckle', 'spice'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Albariño',
      type: 'albarino',
      description: 'Crisp, light-bodied Spanish white with saline minerality and citrus notes.',
      characteristics: {
        abvRange: { min: 11.5, max: 13 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        acidity: 'high',
      },
      typicalFlavors: ['lemon', 'lime', 'grapefruit', 'peach', 'sea spray'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Gewürztraminer',
      type: 'gewurztraminer',
      description: 'Aromatic white with lychee, rose, and spice notes, often slightly off-dry.',
      characteristics: {
        abvRange: { min: 12, max: 14 },
        colorProfile: 'Pale to deep gold',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'off_dry',
        acidity: 'low',
      },
      typicalFlavors: ['lychee', 'rose', 'ginger', 'grapefruit', 'honey'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Grüner Veltliner',
      type: 'gruner_veltliner',
      description: 'Crisp Austrian white with white pepper, citrus, and herbal notes.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        acidity: 'high',
      },
      typicalFlavors: ['white pepper', 'lime', 'grapefruit', 'green bean', 'mineral'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Moscato',
      type: 'moscato',
      description: 'Light, sweet, slightly sparkling white with low alcohol and intense fruitiness.',
      characteristics: {
        abvRange: { min: 5, max: 7 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'sweet',
        acidity: 'medium',
      },
      typicalFlavors: ['peach', 'orange blossom', 'honey', 'nectarine', 'citrus'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Grüner Veltliner',
      type: 'gruner_veltliner',
      description: 'Austrias signature white with peppery notes, crisp acidity, and white pepper characteristic.',
      characteristics: {
        abvRange: { min: 12, max: 14 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        acidity: 'high',
      },
      typicalFlavors: ['white pepper', 'green apple', 'citrus', 'herb', 'crisp'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Riesling',
      type: 'riesling',
      description: '芳香型白葡萄酒，从干型到甜型都有，酸度高，带有柑橘和核果风味。',
      characteristics: {
        abvRange: { min: 7.5, max: 13 },
        colorProfile: 'Pale straw to golden',
        bodyStyle: 'light_full',
        sweetnessLevel: 'varies',
        acidity: 'high',
      },
      typicalFlavors: ['lime', 'peach', 'petroleum', 'honey', 'floral'],
      seasonal: { year_round: true },
    },
    {
      name: 'Pinot Grigio',
      type: 'pinot_grigio',
      description: 'Italian-style light white with crisp acidity and delicate fruit flavors.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Straw to pale gold',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['pear', 'apple', 'citrus', 'mineral', 'crisp'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Viognier',
      type: 'viognier',
      description: 'Rich, aromatic white with lush stone fruit and floral aromas.',
      characteristics: {
        abvRange: { min: 13, max: 15 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        acidity: 'medium_low',
      },
      typicalFlavors: ['apricot', 'peach', 'floral', 'honeysuckle', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Marsanne',
      type: 'marsanne',
      description: 'Full-bodied white with rich texture and nutty, honeyed flavors.',
      characteristics: {
        abvRange: { min: 13, max: 14.5 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['honey', 'nutty', 'pear', 'herbs', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Roussanne',
      type: 'roussanne',
      description: 'Complex, aromatic white with herbal notes and good aging potential.',
      characteristics: {
        abvRange: { min: 13, max: 14.5 },
        colorProfile: 'Pale gold to golden',
        bodyStyle: 'full',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['herbal', 'honey', 'pear', 'tea', 'complex'],
      seasonal: { year_round: true },
    },
    {
      name: 'Vermentino',
      type: 'vermentino',
      description: 'Italian Mediterranean white with citrus, herb, and subtle bitter almond notes.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        acidity: 'medium_high',
      },
      typicalFlavors: ['citrus', 'herbs', 'almond', 'mineral', 'fresh'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Fiano',
      type: 'fiano',
      description: 'Southern Italian white with rich, nutty, honeyed character.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['honey', 'nutty', 'stone fruit', 'herbs', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Greco',
      type: 'greco',
      description: 'Campanian white with rich texture, citrus, and mineral notes.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        acidity: 'medium_high',
      },
      typicalFlavors: ['citrus', 'mineral', 'herbs', 'stone fruit', 'crisp'],
      seasonal: { year_round: true },
    },
    {
      name: 'Arneis',
      type: 'arneis',
      description: 'Piedmont white with delicate floral and pear notes.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['pear', 'floral', 'almond', 'citrus', 'delicate'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Cortese',
      type: 'cortese',
      description: 'Piedmonts crisp, mineral white, notably used for Gavi.',
      characteristics: {
        abvRange: { min: 11.5, max: 13 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        acidity: 'high',
      },
      typicalFlavors: ['citrus', 'green apple', 'mineral', 'crisp', 'clean'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Albarino',
      type: 'albarino',
      description: 'Spanish coastal white with stone fruit, citrus, and saline minerality.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        acidity: 'medium_high',
      },
      typicalFlavors: ['peach', 'citrus', 'salty', 'mineral', 'fresh'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Txakoli',
      type: 'txakoli',
      description: 'Basque country sparkling white with slight effervescence and crisp acidity.',
      characteristics: {
        abvRange: { min: 10.5, max: 12 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        acidity: 'high',
      },
      typicalFlavors: ['citrus', 'green apple', 'mineral', 'tart', 'sparkling'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Assyrtiko',
      type: 'assyrtiko',
      description: 'Greek volcanic white with citrus, mineral, and excellent aging potential.',
      characteristics: {
        abvRange: { min: 13, max: 15 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        acidity: 'high',
      },
      typicalFlavors: ['citrus', 'mineral', 'stone fruit', 'volcanic', 'crisp'],
      seasonal: { year_round: true },
    },
    {
      name: 'Roditis',
      type: 'roditis',
      description: 'Greek pink-skinned grape producing light, refreshing whites.',
      characteristics: {
        abvRange: { min: 11, max: 13 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['citrus', 'green apple', 'flower', 'light', 'fresh'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Savatiano',
      type: 'savatiano',
      description: 'Greek table wine with crisp acidity and citrus notes.',
      characteristics: {
        abvRange: { min: 11.5, max: 13 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        acidity: 'medium_high',
      },
      typicalFlavors: ['citrus', 'green fruit', 'herbs', 'crisp', 'fresh'],
      seasonal: { year_round: true },
    },
    {
      name: 'Moschofilero',
      type: 'moschofilero',
      description: 'Greek aromatic white with rose and citrus aromatics.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Pale gold',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['rose', 'citrus', 'floral', 'peach', 'aromatic'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Xarel-lo',
      type: 'xarel_lo',
      description: 'Spanish Catalan white used for Cava, with citrus and nutty notes.',
      characteristics: {
        abvRange: { min: 11.5, max: 13 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        acidity: 'medium_high',
      },
      typicalFlavors: ['citrus', 'nutty', 'herbs', 'mineral', 'fresh'],
      seasonal: { year_round: true },
    },
    {
      name: 'Parellada',
      type: 'parellada',
      description: 'Mild Catalan white with delicate fruit and floral notes.',
      characteristics: {
        abvRange: { min: 11, max: 12.5 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['pear', 'floral', 'citrus', 'delicate', 'soft'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Macabeo',
      type: 'macabeo',
      description: 'Spanish white with nutty, fruity character, used in Cava.',
      characteristics: {
        abvRange: { min: 11.5, max: 13 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['nutty', 'fruity', 'citrus', 'flower', 'balanced'],
      seasonal: { year_round: true },
    }
  ],
  'Rosé Wine': [
    {
      name: 'Provence Rosé',
      type: 'provencal_rose',
      description: 'Dry, pale pink rosé from Provence, France, known for its elegance and minerality.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Pale pink to salmon',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        acidity: 'medium_high',
      },
      typicalFlavors: ['strawberry', 'citrus', 'melon', 'mineral', 'herbal'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Tavel Rosé',
      type: 'tavel_rose',
      description: 'Fuller-bodied, darker rosé from the Rhône Valley, France, with more structure.',
      characteristics: {
        abvRange: { min: 13.5, max: 14.5 },
        colorProfile: 'Deep pink to salmon',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['red berry', 'melon', 'spice', 'herbal', 'mineral'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'White Zinfandel',
      type: 'white_zinfandel',
      description: 'Sweet, pale pink rosé from California, made from Zinfandel grapes.',
      characteristics: {
        abvRange: { min: 9, max: 11 },
        colorProfile: 'Pale pink',
        bodyStyle: 'light',
        sweetnessLevel: 'sweet',
        acidity: 'medium',
      },
      typicalFlavors: ['strawberry', 'candy', 'melon', 'citrus', 'watermelon'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Spanish Rosado',
      type: 'spanish_rosado',
      description: 'Spanish rosé, often made from Garnacha or Tempranillo, with bright fruit and good acidity.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Bright pink to ruby',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        acidity: 'medium_high',
      },
      typicalFlavors: ['red cherry', 'strawberry', 'herbal', 'citrus', 'mineral'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Italian Rosato',
      type: 'italian_rosato',
      description: 'Italian rosé, often from southern regions, with good structure and food-friendly acidity.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Pale to deep pink',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        acidity: 'medium_high',
      },
      typicalFlavors: ['red berries', 'citrus', 'herbs', 'mineral', 'floral'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'White Rosé',
      type: 'white_rose',
      description: 'Very pale rosé, nearly white in color, often from Grenache or Grenache Gris grapes.',
      characteristics: {
        abvRange: { min: 11.5, max: 13 },
        colorProfile: 'Very pale pink to white',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['citrus', 'white peach', 'mineral', 'delicate', 'crisp'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Dark Rosé',
      type: 'dark_rose',
      description: 'Deeper colored rosé with more body and intensity, often from extended skin contact.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Deep pink to salmon',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['strawberry', 'watermelon', 'red berries', 'fruit', 'rich'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Sparkling Rosé',
      type: 'sparkling_rose',
      description: 'Pink sparkling wine with bubbles, ranging from sweet to dry styles.',
      characteristics: {
        abvRange: { min: 11, max: 13 },
        colorProfile: 'Pink to salmon',
        bodyStyle: 'light',
        sweetnessLevel: 'varies',
        acidity: 'medium_high',
      },
      typicalFlavors: ['red berries', 'citrus', 'bubbles', 'fresh', 'festive'],
      seasonal: { year_round: true },
    },
    {
      name: 'Organic Rosé',
      type: 'organic_rose',
      description: 'Rosé made from organically grown grapes without synthetic pesticides or fertilizers.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Pale to medium pink',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['pure fruit', 'mineral', 'clean', 'natural', 'fresh'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Natural Rosé',
      type: 'natural_rose',
      description: 'Minimal intervention rosé with little to no sulfites added.',
      characteristics: {
        abvRange: { min: 11.5, max: 13 },
        colorProfile: 'Pale to medium pink',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        acidity: 'varies',
      },
      typicalFlavors: ['pure fruit', 'wild', 'mineral', 'unfiltered', 'unique'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Frozen Rosé',
      type: 'frozen_rose',
      description: 'Chilled ros wine with slushy texture, popular in warm climates and poolside.',
      characteristics: {
        abvRange: { min: 10, max: 12 },
        colorProfile: 'Pale pink',
        bodyStyle: 'light',
        sweetnessLevel: 'sweet',
        acidity: 'low',
      },
      typicalFlavors: ['fruit forward', 'sweet', 'frozen', 'fun', 'refreshing'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Cinsault Rosé',
      type: 'cinsault_rose',
      description: 'Light, fragrant rosé from Cinsault grapes with delicate floral aromatics.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Pale pink',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['floral', 'strawberry', 'citrus', 'delicate', 'fragrant'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Mourvèdre Rosé',
      type: 'mouvedre_rose',
      description: 'Rosé from Mourvèdre grapes, offering deeper color and more structured flavor.',
      characteristics: {
        abvRange: { min: 12.5, max: 14 },
        colorProfile: 'Deep pink to coral',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['dark fruit', 'spice', 'herb', 'structured', 'complex'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Cabernet Rosé',
      type: 'cabernet_rose',
      description: 'Rosé made from Cabernet grapes, often with more body and structure.',
      characteristics: {
        abvRange: { min: 12, max: 14 },
        colorProfile: 'Deep pink to ruby',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'low',
      },
      typicalFlavors: ['currant', 'berry', 'herb', 'structured', 'crisp'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Saignée Method Rosé',
      type: 'saignee_rose',
      description: 'Premium rosé made by bleeding off juice from red wine fermentation (Saignée method).',
      characteristics: {
        abvRange: { min: 12.5, max: 14.5 },
        colorProfile: 'Pale to medium pink',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        tannins: 'low',
      },
      typicalFlavors: ['concentrated fruit', 'berry', 'elegant', 'complex', 'refined'],
      seasonal: { year_round: true },
    },
    {
      name: 'Blend Rosé',
      type: 'blend_rose',
      description: 'Rosé made from a blend of multiple grape varieties for complexity.',
      characteristics: {
        abvRange: { min: 12, max: 14 },
        colorProfile: 'Varies',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        acidity: 'medium',
      },
      typicalFlavors: ['complex', 'varied fruit', 'balanced', 'layered', 'interesting'],
      seasonal: { year_round: true },
    },
    {
      name: 'Late Harvest Rosé',
      type: 'late_harvest_rose',
      description: 'Sweet rosé made from grapes left on the vine longer for added ripeness.',
      characteristics: {
        abvRange: { min: 10, max: 13 },
        colorProfile: 'Golden pink to amber',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'sweet',
        acidity: 'low',
      },
      typicalFlavors: ['honey', 'ripe fruit', 'sweet', 'concentrated', 'dessert'],
      seasonal: { fall: true, winter: true },
    }
  ],
  'Scotch': [
    {
      name: 'Single Malt Scotch',
      type: 'single_malt',
      description: 'Scotch whisky made from 100% malted barley at a single distillery, aged in oak barrels for at least 3 years.',
      characteristics: {
        abvRange: { min: 40, max: 60 },
        colorProfile: 'Golden to deep amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['smoky', 'honey', 'fruit', 'oak', 'spice'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Single Grain Scotch',
      type: 'single_grain',
      description: 'Scotch whisky made from grains other than barley at a single distillery, often lighter and used primarily in blends.',
      characteristics: {
        abvRange: { min: 40, max: 46 },
        colorProfile: 'Pale gold to amber',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['vanilla', 'toffee', 'light fruit', 'creamy'],
      seasonal: { year_round: true },
    },
    {
      name: 'Blended Malt Scotch',
      type: 'blended_malt',
      description: 'A blend of single malt scotches from multiple distilleries, formerly known as "vatted malt."',
      characteristics: {
        abvRange: { min: 40, max: 46 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['balanced', 'complex', 'fruit', 'spice', 'honey'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Blended Grain',
      type: 'blended_grain',
      description: 'The most common style, blending single malt and single grain whiskies from multiple distilleries.',
      characteristics: {
        abvRange: { min: 40, max: 43 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['smooth', 'balanced', 'vanilla', 'light smoke', 'caramel'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Islay Scotch',
      type: 'islay_whisky',
      description: 'A regional style from the island of Islay, known for intensely peaty, smoky, and medicinal characteristics.',
      characteristics: {
        abvRange: { min: 43, max: 60 },
        colorProfile: 'Golden to deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['peat', 'smoke', 'sea salt', 'iodine', 'seaweed'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Speyside Scotch',
      type: 'speyside_whisky',
      description: 'The most densely populated whisky region, known for elegant, sweet, and fruity single malts.',
      characteristics: {
        abvRange: { min: 40, max: 46 },
        colorProfile: 'Pale gold to amber',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['apple', 'pear', 'honey', 'vanilla', 'spice'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Highland Scotch',
      type: 'highland_whisky',
      description: 'A diverse regional style ranging from light and floral to rich and peaty, from Scotland\'s largest whisky region.',
      characteristics: {
        abvRange: { min: 40, max: 46 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['heather', 'fruit', 'spice', 'honey', 'light peat'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Lowland Scotch',
      type: 'lowland_whisky',
      description: 'A regional style known for light, floral, and gentle single malts, often called "the Lowland ladies."',
      characteristics: {
        abvRange: { min: 40, max: 46 },
        colorProfile: 'Pale gold',
        bodyStyle: 'light',
      },
      typicalFlavors: ['grass', 'floral', 'citrus', 'ginger', 'toasted cereal'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Campbeltown Scotch',
      type: 'campbeltown_whisky',
      description: 'A distinctive regional style from the small peninsula, known for briny, oily, and complex single malts.',
      characteristics: {
        abvRange: { min: 46, max: 60 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['brine', 'salt', 'oil', 'fruit', 'smoke'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Single Barrel Scotch',
      type: 'single_barrel_scotch',
      description: 'Scotch from a single barrel, each bottle unique with distinct characteristics.',
      characteristics: {
        abvRange: { min: 43, max: 60 },
        colorProfile: 'Varies by barrel',
        bodyStyle: 'varies',
      },
      typicalFlavors: ['unique', 'barrel specific', 'complex', 'individual', 'special'],
      seasonal: { year_round: true },
    },
    {
      name: 'Cask Strength Scotch',
      type: 'cask_strength_scotch',
      description: 'Uncut, undiluted Scotch at full barrel proof, typically 55-65% ABV.',
      characteristics: {
        abvRange: { min: 55, max: 70 },
        colorProfile: 'Deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['intense', 'concentrated', 'bold', 'powerful', 'neat'],
      seasonal: { year_round: true },
    },
    {
      name: 'Double Cask/Finish Scotch',
      type: 'double_cask_scotch',
      description: 'Scotch finished in a second barrel type for additional flavor complexity.',
      characteristics: {
        abvRange: { min: 40, max: 46 },
        colorProfile: 'Amber to mahogany',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['vanilla', 'oak', 'wine', 'complex', 'layers'],
      seasonal: { year_round: true },
    },
    {
      name: 'Sherry Cask Scotch',
      type: 'sherry_cask_scotch',
      description: 'Scotch aged or finished in Sherry-seasoned oak barrels.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Deep amber to mahogany',
        bodyStyle: 'full',
      },
      typicalFlavors: ['sherry', 'dried fruit', 'nuts', 'sweet', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Wine Cask Scotch',
      type: 'wine_cask_scotch',
      description: 'Scotch finished in wine barrels (Burgundy, Bordeaux, etc.).',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['wine', 'fruity', 'tannins', 'complex', 'unique'],
      seasonal: { year_round: true },
    },
    {
      name: 'Bourbon Cask Scotch',
      type: 'bourbon_cask_scotch',
      description: 'Scotch aged in used Bourbon barrels, imparting vanilla and caramel notes.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['vanilla', 'caramel', 'oak', 'smooth', 'classic'],
      seasonal: { year_round: true },
    },
    {
      name: 'peated Scotch',
      type: 'peated_scotch',
      description: 'Scotch with smoky, earthy flavors from drying malt over peat smoke.',
      characteristics: {
        abvRange: { min: 40, max: 60 },
        colorProfile: 'Amber to dark',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['peat', 'smoke', 'earth', 'medicinal', ' BBQ'],
      seasonal: { year_round: true },
    },
    {
      name: 'Lightly Peated Scotch',
      type: 'lightly_peated_scotch',
      description: 'Scotch with subtle peaty notes, balancing smoke with other flavors.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['gentle smoke', 'fruit', 'malty', 'balanced', 'smooth'],
      seasonal: { year_round: true },
    },
    {
      name: 'Heavy Peated Scotch',
      type: 'heavy_peated_scotch',
      description: 'Scotch with intense peat smoke character, often from Islay.',
      characteristics: {
        abvRange: { min: 45, max: 65 },
        colorProfile: 'Deep amber to dark',
        bodyStyle: 'full',
      },
      typicalFlavors: ['intense peat', 'smoke', 'medicinal', 'seaweed', 'bold'],
      seasonal: { year_round: true },
    },
    {
      name: 'Aged 18 Year Scotch',
      type: '18_year_scotch',
      description: 'Scotch aged for at least 18 years, developed complexity and smoothness.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['complex', 'oak', 'dried fruit', 'smooth', 'aged'],
      seasonal: { year_round: true },
    },
    {
      name: 'Aged 21 Year Scotch',
      type: '21_year_scotch',
      description: 'Premium Scotch aged 21+ years with exceptional depth and refinement.',
      characteristics: {
        abvRange: { min: 43, max: 55 },
        colorProfile: 'Deep amber to mahogany',
        bodyStyle: 'full',
      },
      typicalFlavors: ['very complex', 'rich oak', 'dried fruit', 'elegant', 'luxurious'],
      seasonal: { year_round: true },
    },
    {
      name: 'Aged 25+ Year Scotch',
      type: '25_year_scotch',
      description: 'Ultra-premium Scotch aged 25+ years with remarkable depth and rarity.',
      characteristics: {
        abvRange: { min: 43, max: 60 },
        colorProfile: 'Deep mahogany',
        bodyStyle: 'full',
      },
      typicalFlavors: ['extremely complex', 'rare', 'premium', 'exceptional', 'collectible'],
      seasonal: { year_round: true },
    },
    {
      name: 'Blended Malt Scotch',
      type: 'blended_malt_scotch',
      description: 'Blend of single malt whiskies from different distilleries.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['complex', 'balanced', 'varied', 'smooth', 'accessible'],
      seasonal: { year_round: true },
    },
    {
      name: 'Blended Grain Scotch',
      type: 'blended_grain_scotch',
      description: 'Blend of grain whiskies, lighter and more approachable.',
      characteristics: {
        abvRange: { min: 40, max: 45 },
        colorProfile: 'Light gold to amber',
        bodyStyle: 'light',
      },
      typicalFlavors: ['light', 'smooth', 'grain', 'clean', 'easy'],
      seasonal: { year_round: true },
    },
    {
      name: 'Small Batch Scotch',
      type: 'small_batch_scotch',
      description: 'Scotch from limited batches, often with more flavor depth.',
      characteristics: {
        abvRange: { min: 43, max: 50 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['carefully selected', 'complex', 'quality', 'special', 'artisan'],
      seasonal: { year_round: true },
    },
    {
      name: 'Batch Strength Scotch',
      type: 'batch_strength_scotch',
      description: 'Scotch bottled at barrel strength from small batches.',
      characteristics: {
        abvRange: { min: 50, max: 65 },
        colorProfile: 'Deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['concentrated', 'batch specific', 'bold', 'intense', 'unique'],
      seasonal: { year_round: true },
    },
    {
      name: 'Limited Edition Scotch',
      type: 'limited_edition_scotch',
      description: 'Special releaseScotch in limited quantities, often vintage-dated.',
      characteristics: {
        abvRange: { min: 43, max: 60 },
        colorProfile: 'Varies',
        bodyStyle: 'varies',
      },
      typicalFlavors: ['rare', 'collectible', 'special', 'unique', 'exclusive'],
      seasonal: { year_round: true },
    },
    {
      name: 'Single Farm Scotch',
      type: 'single_farm_scotch',
      description: 'Scotch made from barley from a single farm, emphasizing terroir.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['farm', 'terroir', 'local', 'unique', 'authentic'],
      seasonal: { year_round: true },
    },
    {
      name: 'Organic Scotch',
      type: 'organic_scotch',
      description: 'Scotch made from organically grown ingredients.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['natural', 'organic', 'clean', 'pure', 'sustainable'],
      seasonal: { year_round: true },
    }
  ],

  'Bourbon': [
    {
      name: 'Straight Bourbon',
      type: 'bourbon',
      description: 'Classic American whiskey made from at least 51% corn, aged in new charred oak barrels for a minimum of 2 years.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Amber to deep amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['vanilla', 'caramel', 'oak', 'honey', 'brown sugar'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Small Batch Bourbon',
      type: 'small_batch',
      description: 'Bourbon made from a selected blend of a relatively small number of barrels, emphasizing consistency and quality.',
      characteristics: {
        abvRange: { min: 45, max: 55 },
        colorProfile: 'Deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['complex', 'rich', 'dark fruit', 'oak', 'spice'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Single Barrel Bourbon',
      type: 'single_barrel',
      description: 'Bourbon bottled from an individual aging barrel, offering unique characteristics that vary from barrel to barrel.',
      characteristics: {
        abvRange: { min: 45, max: 65 },
        colorProfile: 'Deep amber to mahogany',
        bodyStyle: 'full',
      },
      typicalFlavors: ['oak', 'vanilla', 'toffee', 'spice', 'complex'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'High Rye Bourbon',
      type: 'high_rye_bourbon',
      description: 'Bourbon with a higher percentage of rye in the mash bill (typically 20-35%), adding spicy complexity.',
      characteristics: {
        abvRange: { min: 45, max: 50 },
        colorProfile: 'Amber to deep amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['spice', 'pepper', 'caramel', 'fruit', 'herbal'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Wheated Bourbon',
      type: 'wheated_bourbon',
      description: 'Bourbon that uses wheat instead of rye as the secondary grain, resulting in a softer, sweeter profile.',
      characteristics: {
        abvRange: { min: 45, max: 50 },
        colorProfile: 'Amber to deep amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['smooth', 'caramel', 'vanilla', 'soft fruit', 'honey'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Bottled-in-Bond Bourbon',
      type: 'bottled_in_bond',
      description: 'A regulated class of bourbon that must be the product of one distillation season, one distillery, and aged at least 4 years at 50% ABV.',
      characteristics: {
        abvRange: { min: 50, max: 50 },
        colorProfile: 'Amber to deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['bold', 'oak', 'spice', 'caramel', 'balanced'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Small Batch Bourbon',
      type: 'small_batch_bourbon',
      description: 'Bourbon from a small batch of barrels, often with more flavor complexity.',
      characteristics: {
        abvRange: { min: 43, max: 50 },
        colorProfile: 'Amber to deep amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['complex', 'caramel', 'oak', 'vanilla', 'balanced'],
      seasonal: { year_round: true },
    },
    {
      name: 'Single Barrel Bourbon',
      type: 'single_barrel_bourbon',
      description: 'Bourbon from a single barrel, each bottle unique with distinct characteristics.',
      characteristics: {
        abvRange: { min: 43, max: 55 },
        colorProfile: 'Varies by barrel',
        bodyStyle: 'varies',
      },
      typicalFlavors: ['unique', 'barrel specific', 'complex', 'individual', 'special'],
      seasonal: { year_round: true },
    },
    {
      name: 'Cask Strength Bourbon',
      type: 'cask_strength_bourbon',
      description: 'Uncut, undiluted Bourbon at full barrel proof, typically 55-65% ABV.',
      characteristics: {
        abvRange: { min: 55, max: 70 },
        colorProfile: 'Deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['intense', 'concentrated', 'bold', 'powerful', 'neat'],
      seasonal: { year_round: true },
    },
    {
      name: 'Barrel Proof Bourbon',
      type: 'barrel_proof_bourbon',
      description: 'Bourbon bottled directly from the barrel without dilution.',
      characteristics: {
        abvRange: { min: 60, max: 70 },
        colorProfile: 'Deep amber to dark',
        bodyStyle: 'full',
      },
      typicalFlavors: ['raw', 'untouched', 'intense', 'pure', 'bold'],
      seasonal: { year_round: true },
    },
    {
      name: 'Wheated Bourbon',
      type: 'wheated_bourbon',
      description: 'Bourbon using wheat instead of rye as the secondary grain, resulting in softer, sweeter notes.',
      characteristics: {
        abvRange: { min: 45, max: 55 },
        colorProfile: 'Amber to golden',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['soft', 'sweet', 'wheat', 'vanilla', 'smooth'],
      seasonal: { year_round: true },
    },
    {
      name: 'High Rye Bourbon',
      type: 'high_rye_bourbon',
      description: 'Bourbon with higher rye content (above 20%) for more spice and complexity.',
      characteristics: {
        abvRange: { min: 45, max: 55 },
        colorProfile: 'Amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['spicy', 'rye', 'pepper', 'cinnamon', 'bold'],
      seasonal: { year_round: true },
    },
    {
      name: 'Low Rye Bourbon',
      type: 'low_rye_bourbon',
      description: 'Bourbon with lower rye content for smoother, sweeter profile.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['sweet', 'corn', 'vanilla', 'smooth', 'approachable'],
      seasonal: { year_round: true },
    },
    {
      name: 'Bottled-in-Bond Bourbon',
      type: 'bonded_bourbon',
      description: 'Bourbon meeting strict federal standards: single season, one distillery, 4-8 years old, 50% ABV.',
      characteristics: {
        abvRange: { min: 50, max: 50 },
        colorProfile: 'Amber to deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['oak', 'caramel', 'vanilla', 'standard', 'classic'],
      seasonal: { year_round: true },
    },
    {
      name: 'Honey Bourbon',
      type: 'honey_bourbon',
      description: 'Bourbon infused or flavored with honey for added sweetness.',
      characteristics: {
        abvRange: { min: 35, max: 40 },
        colorProfile: 'Amber to golden',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['honey', 'sweet', 'vanilla', 'smooth', 'flavored'],
      seasonal: { year_round: true },
    },
    {
      name: 'Bourbon Cream',
      type: 'bourbon_cream',
      description: 'Cream liqueur flavored with bourbon, typically 15-20% ABV.',
      characteristics: {
        abvRange: { min: 15, max: 20 },
        colorProfile: 'Creamy amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['cream', 'bourbon', 'vanilla', 'sweet', 'dessert'],
      seasonal: { year_round: true },
    },
    {
      name: 'Maple Bourbon',
      type: 'maple_bourbon',
      description: 'Bourbon with natural maple flavoring or barrel finishing.',
      characteristics: {
        abvRange: { min: 35, max: 45 },
        colorProfile: 'Amber to golden',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['maple', 'sweet', 'oak', 'caramel', 'autumn'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Cherry Bourbon',
      type: 'cherry_bourbon',
      description: 'Bourbon infused with cherries for a sweet, fruity profile.',
      characteristics: {
        abvRange: { min: 35, max: 45 },
        colorProfile: 'Amber to reddish',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['cherry', 'stone fruit', 'sweet', 'fruity', 'summer'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Toasted Bourbon',
      type: 'toasted_bourbon',
      description: 'Bourbon finished in heavily toasted (not charred) oak barrels.',
      characteristics: {
        abvRange: { min: 45, max: 55 },
        colorProfile: 'Deep amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['toasted oak', 'vanilla', 'caramel', 'warm', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Double Oak Bourbon',
      type: 'double_oak_bourbon',
      description: 'Bourbon aged in two different oak barrels for added complexity.',
      characteristics: {
        abvRange: { min: 45, max: 55 },
        colorProfile: 'Deep amber to mahogany',
        bodyStyle: 'full',
      },
      typicalFlavors: ['double oak', 'vanilla', 'complex', 'layers', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Aged 10 Year Bourbon',
      type: '10_year_bourbon',
      description: 'Bourbon aged at least 10 years, developed oak and complexity.',
      characteristics: {
        abvRange: { min: 45, max: 55 },
        colorProfile: 'Deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['oak', 'aged', 'complex', 'smooth', 'mature'],
      seasonal: { year_round: true },
    },
    {
      name: 'Aged 12 Year Bourbon',
      type: '12_year_bourbon',
      description: 'Premium Bourbon aged 12+ years with significant oak influence.',
      characteristics: {
        abvRange: { min: 45, max: 55 },
        colorProfile: 'Deep amber to mahogany',
        bodyStyle: 'full',
      },
      typicalFlavors: ['deep oak', 'complex', 'aged', 'refined', 'premium'],
      seasonal: { year_round: true },
    },
    {
      name: 'Rye Mash Bill Bourbon',
      type: 'high_rye_bourbon',
      description: 'Bourbon with high rye content (15-20%) for spicier profile.',
      characteristics: {
        abvRange: { min: 45, max: 55 },
        colorProfile: 'Amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['rye', 'spice', 'pepper', 'bold', 'complex'],
      seasonal: { year_round: true },
    },
    {
      name: 'Corn Mash Bourbon',
      type: 'high_corn_bourbon',
      description: 'Bourbon with higher corn content (above 80%) for sweeter profile.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['corn', 'sweet', 'grain', 'smooth', 'approachable'],
      seasonal: { year_round: true },
    },
    {
      name: 'Limited Release Bourbon',
      type: 'limited_bourbon',
      description: 'Special limited edition Bourbon releases, often single barrel or small batch.',
      characteristics: {
        abvRange: { min: 45, max: 60 },
        colorProfile: 'Varies',
        bodyStyle: 'varies',
      },
      typicalFlavors: ['rare', 'special', 'collectible', 'unique', 'exclusive'],
      seasonal: { year_round: true },
    },
    {
      name: 'Store Pick Bourbon',
      type: 'store_pick_bourbon',
      description: 'Bourbon selected by specific liquor stores or bars, often unique barrels.',
      characteristics: {
        abvRange: { min: 45, max: 60 },
        colorProfile: 'Varies',
        bodyStyle: 'varies',
      },
      typicalFlavors: ['store specific', 'unique', 'curated', 'special', 'exclusive'],
      seasonal: { year_round: true },
    },
    {
      name: 'Stitch Fix Bourbon',
      type: 'stitch_fix_bourbon',
      description: 'Single barrel bourbon selected for the Stitch Fix brand.',
      characteristics: {
        abvRange: { min: 45, max: 55 },
        colorProfile: 'Amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['caramel', 'oak', 'vanilla', 'smooth', 'selected'],
      seasonal: { year_round: true },
    }
  ],

  'Rye Whiskey': [
    {
      name: 'Straight Rye Whiskey',
      type: 'rye_whiskey',
      description: 'American rye whiskey made from at least 51% rye, aged in new charred oak barrels for a minimum of 2 years.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['spice', 'pepper', 'herbal', 'caramel', 'citrus'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'High Rye Whiskey',
      type: 'high_rye',
      description: 'Rye whiskey with a particularly high rye content (often 90-100%), showcasing intense spicy and herbal characteristics.',
      characteristics: {
        abvRange: { min: 45, max: 55 },
        colorProfile: 'Amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['intense spice', 'black pepper', 'herbal', 'licorice', 'dill'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Canadian Rye Whisky',
      type: 'canadian_rye',
      description: 'A Canadian whisky style that may or may not contain actual rye, but is known for its light, smooth, and approachable character.',
      characteristics: {
        abvRange: { min: 40, max: 45 },
        colorProfile: 'Pale gold to amber',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['smooth', 'light spice', 'vanilla', 'caramel', 'fruit'],
      seasonal: { year_round: true },
    },
    {
      name: 'Bottled-in-Bond Rye',
      type: 'bottled_in_bond_rye',
      description: 'Rye whiskey meeting the Bottled-in-Bond Act requirements: single distillery, one distillation season, 4+ years aged, 50% ABV.',
      characteristics: {
        abvRange: { min: 50, max: 50 },
        colorProfile: 'Amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['bold spice', 'oak', 'caramel', 'herbal', 'complex'],
      seasonal: { fall: true, winter: true },
    }
  ],
  'Sparkling Wine': [
    {
      name: 'Prosecco',
      type: 'prosecco',
      description: 'Italian sparkling wine from the Veneto region, primarily from Glera grapes, made using the Tank Method (Charmat) for a fresh, fruity profile.',
      characteristics: {
        abvRange: { min: 11, max: 12.5 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'dry',
        carbonation: 'lively_bubbles',
      },
      typicalFlavors: ['green apple', 'pear', 'honeysuckle', 'melon', 'fresh cream'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Cava',
      type: 'cava',
      description: 'Spanish sparkling wine made primarily in Penedès using the Traditional Method, offering excellent value with crisp, earthy flavors.',
      characteristics: {
        abvRange: { min: 11.5, max: 12.5 },
        colorProfile: 'Pale straw to yellow',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        carbonation: 'fine_bubbles',
      },
      typicalFlavors: ['lemon', 'apple', 'almond', 'mineral', 'yeasty'],
      seasonal: { year_round: true },
    },
    {
      name: 'Crémant',
      type: 'cremant',
      description: 'French sparkling wine made outside of Champagne using the Traditional Method. Named by region (e.g., Crémant d\'Alsace, Crémant de Loire).',
      characteristics: {
        abvRange: { min: 11.5, max: 13 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        carbonation: 'creamy_bubbles', // Typically slightly less pressure than Champagne
      },
      typicalFlavors: ['citrus', 'stone fruit', 'floral', 'toasty', 'mineral'],
      seasonal: { year_round: true },
    },
    {
      name: 'Lambrusco',
      type: 'lambrusco',
      description: 'A lightly sparkling (frizzante) red or rosé wine from Emilia-Romagna, Italy, ranging from dry to sweet.',
      characteristics: {
        abvRange: { min: 8, max: 12 },
        colorProfile: 'Ruby red to deep pink',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'varies',
        carbonation: 'light_frothy',
      },
      typicalFlavors: ['red berries', 'plum', 'violets', 'earth', 'tangy'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Franciacorta',
      type: 'franciacorta',
      description: 'High-quality Italian Traditional Method sparkling wine from Lombardy, often considered Italy\'s answer to Champagne.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pale gold',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        carbonation: 'fine_persistent',
      },
      typicalFlavors: ['citrus zest', 'white flowers', 'bread crust', 'hazelnut', 'mineral'],
      seasonal: { year_round: true },
    },
    {
      name: 'Sekt',
      type: 'sekt',
      description: 'German or Austrian sparkling wine. Qualitätssekt (higher quality) is often Riesling-based and can be made via Traditional or Tank Method.',
      characteristics: {
        abvRange: { min: 10, max: 13 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'varies',
        carbonation: 'lively',
      },
      typicalFlavors: ['apple', 'peach', 'citrus', 'floral', 'herbal'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'American Sparkling Wine',
      type: 'american_sparkling',
      description: 'Sparkling wine produced in the United States (notably California), often using the Traditional Method with Chardonnay and Pinot Noir.',
      characteristics: {
        abvRange: { min: 12, max: 13.5 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'medium',
        sweetnessLevel: 'dry',
        carbonation: 'fine_bubbles',
      },
      typicalFlavors: ['apple', 'pear', 'toast', 'citrus', 'cream'],
      seasonal: { year_round: true },
    },
    {
      name: 'Pét-Nat (Pétillant Naturel)',
      type: 'pet_nat',
      description: '"Natural" sparkling wine bottled before primary fermentation is complete, resulting in light, often cloudy, fizzy wine with rustic charm.',
      characteristics: {
        abvRange: { min: 10.5, max: 12.5 },
        colorProfile: 'Often hazy, pale straw to amber',
        bodyStyle: 'light',
        sweetnessLevel: 'off_dry',
        carbonation: 'gentle',
      },
      typicalFlavors: ['fruity', 'yeasty', 'funky', 'tangy', 'cider-like'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Asti (Moscato d\'Asti)',
      type: 'asti',
      description: 'Gently sparkling, sweet, low-alcohol Italian wine from Piedmont, made from Moscato Bianco grapes via a single fermentation.',
      characteristics: {
        abvRange: { min: 5, max: 7 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'sweet',
        carbonation: 'light_frothy',
      },
      typicalFlavors: ['peach', 'apricot', 'orange blossom', 'honey', 'grapey'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Prosecco',
      type: 'prosecco',
      description: 'Italys popular frizzante sparkling wine, softer and fruitier than Champagne.',
      characteristics: {
        abvRange: { min: 11, max: 12 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'off_dry',
        carbonation: 'gentle_frizzante',
      },
      typicalFlavors: ['green apple', 'pear', 'white flowers', 'citrus', 'light'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Moscato dAsti',
      type: 'moscato_dasti',
      description: 'Sweet, gently sparkling Italian wine from Muscat grapes, low alcohol and aromatic.',
      characteristics: {
        abvRange: { min: 5, max: 7 },
        colorProfile: 'Pale straw to golden',
        bodyStyle: 'light',
        sweetnessLevel: 'sweet',
        carbonation: 'gentle_frizzante',
      },
      typicalFlavors: ['muscat grape', 'peach', 'orange blossom', 'honey', 'aromatic'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Asti Spumante',
      type: 'asti_spumante',
      description: 'Fully sparkling version of Moscato dAsti, sweeter and more effervescent.',
      characteristics: {
        abvRange: { min: 7, max: 9 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'sweet',
        carbonation: 'fully_sparkling',
      },
      typicalFlavors: ['muscat', 'grape', 'peach', 'honey', 'fruity'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Cava',
      type: 'cava',
      description: 'Spains traditional method sparkling wine, typically dry and crisp.',
      characteristics: {
        abvRange: { min: 11, max: 12.5 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'brut',
        carbonation: 'fine_bubbles',
      },
      typicalFlavors: ['citrus', 'green apple', 'mineral', ' brioche', 'crisp'],
      seasonal: { year_round: true },
    },
    {
      name: 'Sekt',
      type: 'sekt',
      description: 'German sparkling wine, ranging from dry to sweet styles.',
      characteristics: {
        abvRange: { min: 11, max: 13 },
        colorProfile: 'Pale straw to golden',
        bodyStyle: 'medium',
        sweetnessLevel: 'varies',
        carbonation: 'fine',
      },
      typicalFlavors: ['apple', 'pear', 'citrus', 'yeasty', 'fresh'],
      seasonal: { year_round: true },
    },
    {
      name: 'Crémant',
      type: 'cremant',
      description: 'French sparkling wine made outside Champagne region using traditional method.',
      characteristics: {
        abvRange: { min: 11, max: 12.5 },
        colorProfile: 'Pale straw to golden',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'brut',
        carbonation: 'fine',
      },
      typicalFlavors: ['citrus', 'apple', 'brioche', 'mineral', 'elegant'],
      seasonal: { year_round: true },
    },
    {
      name: 'Crémant de Loire',
      type: 'cremant_loire',
      description: 'French sparkling wine from the Loire Valley, often made from Chenin Blanc.',
      characteristics: {
        abvRange: { min: 11.5, max: 12.5 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'brut',
        carbonation: 'fine',
      },
      typicalFlavors: ['chenin blanc', 'citrus', 'green apple', 'mineral', 'fresh'],
      seasonal: { year_round: true },
    },
    {
      name: 'Crémant dAlsace',
      type: 'cremant_alsace',
      description: 'French sparkling wine from Alsace, often made from Pinot Blanc.',
      characteristics: {
        abvRange: { min: 12, max: 13 },
        colorProfile: 'Pale straw',
        bodyStyle: 'medium',
        sweetnessLevel: 'brut',
        carbonation: 'fine',
      },
      typicalFlavors: ['pear', 'apple', 'citrus', 'floral', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Franciacorta',
      type: 'franciacorta',
      description: 'Italys premium traditional method sparkling wine from Lombardy.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'medium',
        sweetnessLevel: 'brut',
        carbonation: 'fine',
      },
      typicalFlavors: ['citrus', 'brioche', 'nutty', 'elegant', 'complex'],
      seasonal: { year_round: true },
    },
    {
      name: 'Trentodoc',
      type: 'trentodoc',
      description: 'Italian sparkling wine from Trentino, known for high-quality traditional method wines.',
      characteristics: {
        abvRange: { min: 11.5, max: 12.5 },
        colorProfile: 'Pale straw',
        bodyStyle: 'medium',
        sweetnessLevel: 'brut',
        carbonation: 'fine',
      },
      typicalFlavors: ['green apple', 'citrus', 'yeasty', 'crisp', 'fresh'],
      seasonal: { year_round: true },
    },
    {
      name: 'Oltrepò Pavese',
      type: 'oltrepo_pavese',
      description: 'Italian sparkling wine from Lombardy, often Pinot Noir based.',
      characteristics: {
        abvRange: { min: 11.5, max: 12.5 },
        colorProfile: 'Pale to light pink',
        bodyStyle: 'medium',
        sweetnessLevel: 'brut',
        carbonation: 'fine',
      },
      typicalFlavors: ['red apple', 'citrus', 'berry', 'yeasty', 'structured'],
      seasonal: { year_round: true },
    },
    {
      name: 'Lambrusco',
      type: 'lambrusco',
      description: 'Emilia-Romagnas frizzante red wine, slightly sweet and fruity.',
      characteristics: {
        abvRange: { min: 8, max: 12 },
        colorProfile: 'Deep purple to ruby',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'off_dry',
        carbonation: 'frizzante',
      },
      typicalFlavors: ['berry', 'grape', 'fruity', 'fresh', 'tart'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Brachetto',
      type: 'brachetto',
      description: 'Piedmonts sweet, lightly sparkling red wine with strawberry aromatics.',
      characteristics: {
        abvRange: { min: 6, max: 7 },
        colorProfile: 'Light ruby to pink',
        bodyStyle: 'light',
        sweetnessLevel: 'sweet',
        carbonation: 'gentle',
      },
      typicalFlavors: ['strawberry', 'raspberry', 'rose', 'grape', 'aromatic'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Red Sparkling Wine',
      type: 'red_sparkling',
      description: 'Sparkling red wines like sparkling Shiraz or Lambrusco.',
      characteristics: {
        abvRange: { min: 10, max: 14 },
        colorProfile: 'Deep ruby to purple',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'varies',
        carbonation: 'frizzante',
      },
      typicalFlavors: ['berry', 'spice', 'fruity', 'bubbly', 'unique'],
      seasonal: { year_round: true },
    },
    {
      name: ' Demi-Sec Sparkling',
      type: 'demi_sec_sparkling',
      description: 'Sweet sparkling wine with noticeable residual sugar.',
      characteristics: {
        abvRange: { min: 11, max: 13 },
        colorProfile: 'Pale straw to golden',
        bodyStyle: 'medium',
        sweetnessLevel: 'demi_sec',
        carbonation: 'fine',
      },
      typicalFlavors: ['sweet', 'fruity', 'honey', 'dessert', 'balanced'],
      seasonal: { year_round: true },
    },
    {
      name: 'Doux Sparkling',
      type: 'doux_sparkling',
      description: 'Very sweet sparkling wine with high residual sugar.',
      characteristics: {
        abvRange: { min: 10, max: 12 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'full',
        sweetnessLevel: 'doux',
        carbonation: 'fine',
      },
      typicalFlavors: ['very sweet', 'honey', 'caramel', 'dessert', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Extra Brut Sparkling',
      type: 'extra_brut_sparkling',
      description: 'Very dry sparkling wine with minimal residual sugar (0-3g/L).',
      characteristics: {
        abvRange: { min: 11.5, max: 13 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'extra_brut',
        carbonation: 'fine',
      },
      typicalFlavors: ['citrus', 'mineral', 'crisp', 'dry', 'tart'],
      seasonal: { year_round: true },
    },
    {
      name: 'Zero Dosage Sparkling',
      type: 'zero_dosage',
      description: 'Sparkling wine with no added sugar (no dosage), bone dry.',
      characteristics: {
        abvRange: { min: 11.5, max: 13 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'zero',
        carbonation: 'fine',
      },
      typicalFlavors: ['mineral', 'citrus', 'pure', 'dry', 'crisp'],
      seasonal: { year_round: true },
    },
    {
      name: 'Vintage Sparkling',
      type: 'vintage_sparkling',
      description: 'Sparkling wine made from a single harvest year, expressing that years characteristics.',
      characteristics: {
        abvRange: { min: 11.5, max: 13 },
        colorProfile: 'Pale straw to golden',
        bodyStyle: 'medium',
        sweetnessLevel: 'brut',
        carbonation: 'fine',
      },
      typicalFlavors: ['complex', 'year character', 'yeasty', 'aged', 'unique'],
      seasonal: { year_round: true },
    },
    {
      name: 'Rosé Sparkling',
      type: 'rose_sparkling',
      description: 'Pink sparkling wine with bubbles, can be from any method.',
      characteristics: {
        abvRange: { min: 11, max: 13 },
        colorProfile: 'Pink to salmon',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'varies',
        carbonation: 'fine',
      },
      typicalFlavors: ['red berries', 'citrus', 'floral', 'bubbly', 'elegant'],
      seasonal: { year_round: true },
    }
  ],
  'Champagne': [
    {
      name: 'Non-Vintage (NV) Champagne',
      type: 'non_vintage_champagne',
      description: 'The most common style, a blend of wines from multiple years, crafted to represent the house\'s consistent signature style.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pale straw to gold',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        carbonation: 'fine_persistent',
      },
      typicalFlavors: ['green apple', 'citrus', 'brioche', 'toast', 'almond'],
      seasonal: { year_round: true },
    },
    {
      name: 'Vintage Champagne',
      type: 'vintage_champagne',
      description: 'Made only in exceptional years from grapes of a single harvest, aged longer (minimum 3 years), expressing the character of that specific year.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Golden yellow',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'dry',
        carbonation: 'fine_persistent',
      },
      typicalFlavors: ['mature fruit', 'honey', 'pastry', 'nutty', 'complex'],
      seasonal: { year_round: true },
    },
    {
      name: 'Blanc de Blancs',
      type: 'blanc_de_blancs',
      description: '"White from whites." Champagne made exclusively from Chardonnay grapes, known for its finesse, minerality, and crisp acidity.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'dry',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['lemon zest', 'white flowers', 'chalk', 'mineral', 'apple'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Blanc de Noirs',
      type: 'blanc_de_noirs',
      description: '"White from blacks." Champagne made exclusively from black grapes (Pinot Noir and/or Pinot Meunier), offering more body and red fruit notes.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Straw to pale gold',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'brut',
        carbonation: 'fine_persistent',
      },
      typicalFlavors: ['red apple', 'pear', 'strawberry', 'brioche', 'structured'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Rosé Champagne',
      type: 'rose_champagne',
      description: 'Pink Champagne, made either by blending a small amount of still red wine into the base wine (most common) or via limited skin contact (saignée).',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Salmon pink to onion skin',
        bodyStyle: 'medium',
        sweetnessLevel: 'brut',
        carbonation: 'fine_persistent',
      },
      typicalFlavors: ['red berries', 'cherry', 'citrus', 'rose petal', 'brioche'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Prestige Cuvée',
      type: 'prestige_cuvee',
      description: 'A house\'s top-tier, most luxurious Champagne, often vintage, from the best vineyards and oldest reserves. Examples: Dom Pérignon, Cristal.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Brilliant gold',
        bodyStyle: 'full',
        sweetnessLevel: 'brut',
        carbonation: 'fine_persistent',
      },
      typicalFlavors: ['complex', 'layered', 'toasted brioche', 'honey', 'stone fruit', 'mineral'],
      seasonal: { year_round: true, winter: true },
    },
    {
      name: 'Brut',
      type: 'brut_nature',
      description: 'The driest style, with no added sugar (dosage) after disgorgement, highlighting pure, unadulterated terroir and high acidity.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'bone_dry',
        carbonation: 'fine_persistent',
      },
      typicalFlavors: ['sharp citrus', 'flint', 'green apple', 'chalk', 'yeasty'],
      seasonal: { year_round: true },
    },
    {
      name: 'Extra Brut',
      type: 'extra_brut',
      description: 'Very dry style with only 0-6 grams per liter of residual sugar, allowing the wines natural character to shine with minimal sweetness.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light_medium',
        sweetnessLevel: 'bone_dry',
        carbonation: 'fine_persistent',
      },
      typicalFlavors: ['crisp apple', 'citrus', 'mineral', 'lean', 'precise'],
      seasonal: { year_round: true },
    },
    {
      name: 'Sec',
      type: 'sec',
      description: 'A noticeably sweet style (17-32 g/l residual sugar), historically popular but now less common, often paired with desserts.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Golden',
        bodyStyle: 'medium',
        sweetnessLevel: 'sweet',
        carbonation: 'fine',
      },
      typicalFlavors: ['ripe peach', 'apricot', 'honey', 'pastry', 'caramel'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Demi-Sec',
      type: 'demi_sec',
      description: 'Even sweeter (32-50 g/l), definitively a dessert Champagne, perfect with fruit tarts, cakes, or blue cheese.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Golden',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'very_sweet',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['tropical fruit', 'candied citrus', 'honey', 'marzipan', 'rich'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Blanc de Blancs',
      type: 'blanc_de_blancs',
      description: 'Champagne made exclusively from white grapes (usually Chardonnay), known for lightness and elegance.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pale straw to light gold',
        bodyStyle: 'light',
        sweetnessLevel: 'brut',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['citrus', 'green apple', 'mineral', 'crisp', 'elegant'],
      seasonal: { year_round: true },
    },
    {
      name: 'Blanc de Noirs',
      type: 'blanc_de_noirs',
      description: 'Champagne made from dark grapes (Pinot Noir, Meunier), with more body and richness.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pale straw to golden',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'brut',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['red berries', 'bread', 'rich', 'creamy', 'structured'],
      seasonal: { year_round: true },
    },
    {
      name: 'Rosé Champagne',
      type: 'rose_champagne',
      description: 'Pink Champagne achieved through skin contact or blending red and white wines.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pink to salmon',
        bodyStyle: 'medium',
        sweetnessLevel: 'brut',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['red berries', 'citrus', 'brioche', 'floral', 'elegant'],
      seasonal: { year_round: true },
    },
    {
      name: 'Prestige Cuvée',
      type: 'prestige_cuvee',
      description: 'The houses finest and most exclusive Champagne cuvée, often from the best vineyards.',
      characteristics: {
        abvRange: { min: 12.5, max: 13 },
        colorProfile: 'Pale straw to golden',
        bodyStyle: 'full',
        sweetnessLevel: 'brut',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['complex', 'aged', 'brioche', 'nutty', 'luxurious'],
      seasonal: { year_round: true },
    },
    {
      name: 'Vintage Champagne',
      type: 'vintage_champagne',
      description: 'Champagne from a single exceptional year, aged longer than non-vintage.',
      characteristics: {
        abvRange: { min: 12, max: 13 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'brut',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['aged', 'brioche', 'nutty', 'complex', 'toasty'],
      seasonal: { year_round: true },
    },
    {
      name: 'Demi-Sec Champagne',
      type: 'demi_sec_champagne',
      description: 'Sweet Champagne with noticeable residual sugar, perfect with desserts.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'full',
        sweetnessLevel: 'demi_sec',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['sweet', 'honey', 'fruits', 'dessert', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Doux Champagne',
      type: 'doux_champagne',
      description: 'Very sweet Champagne with high residual sugar, rare and luxurious.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Deep golden',
        bodyStyle: 'full',
        sweetnessLevel: 'doux',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['very sweet', 'honey', 'caramel', 'dessert', 'ultra rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Extra Brut Champagne',
      type: 'extra_brut_champagne',
      description: 'Very dry Champagne with minimal sugar (0-3g/L residual).',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'extra_brut',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['citrus', 'mineral', 'crisp', 'tart', 'dry'],
      seasonal: { year_round: true },
    },
    {
      name: 'Zero Dosage Champagne',
      type: 'zero_dosage_champagne',
      description: 'No-dosage Champagne with no added sugar, bone dry and pure.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pale straw',
        bodyStyle: 'light',
        sweetnessLevel: 'zero',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['mineral', 'citrus', 'pure', 'tart', 'structured'],
      seasonal: { year_round: true },
    },
    {
      name: 'Rouge de Noirs',
      type: 'rouge_de_noirs',
      description: 'Red Champagne made from Pinot Noir, with deeper color and richer flavor.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Light red to pink',
        bodyStyle: 'medium_full',
        sweetnessLevel: 'brut',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['red berries', 'cherry', 'bread', 'rich', 'unique'],
      seasonal: { year_round: true },
    },
    {
      name: 'Cr食endant Champagne',
      type: 'crack_champagne',
      description: 'Grower Champagne made by the wine growers themselves, expressing terroir.',
      characteristics: {
        abvRange: { min: 12, max: 13 },
        colorProfile: 'Varies',
        bodyStyle: 'varies',
        sweetnessLevel: 'varies',
        carbonation: 'fine',
      },
      typicalFlavors: ['terroir', 'varied', 'authentic', 'unique', 'artisan'],
      seasonal: { year_round: true },
    },
    {
      name: 'Single Vineyard Champagne',
      type: 'single_vineyard_champagne',
      description: 'Champagne from grapes of a single specific vineyard.',
      characteristics: {
        abvRange: { min: 12, max: 12.5 },
        colorProfile: 'Pale straw to golden',
        bodyStyle: 'medium',
        sweetnessLevel: 'brut',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['terroir', 'specific vineyard', 'unique', 'pure', 'distinct'],
      seasonal: { year_round: true },
    },
    {
      name: 'Old Vine Champagne',
      type: 'old_vine_champagne',
      description: 'Champagne from ancient vines (40+ years), often more concentrated.',
      characteristics: {
        abvRange: { min: 12.5, max: 13 },
        colorProfile: 'Golden',
        bodyStyle: 'full',
        sweetnessLevel: 'brut',
        carbonation: 'fine_elegant',
      },
      typicalFlavors: ['concentrated', 'complex', 'aged', 'rich', 'intense'],
      seasonal: { year_round: true },
    }
  ],

  'Vodka': [
    {
      name: 'Premium Vodka',
      type: 'premium_vodka',
      description: 'High-quality vodka, often distilled multiple times and filtered for exceptional smoothness and purity. Served neat or in refined cocktails.',
      characteristics: {
        abvRange: { min: 37.5, max: 40 },
        colorProfile: 'Clear',
        bodyStyle: 'light',
      },
      typicalFlavors: ['clean', 'smooth', 'creamy', 'mineral', 'subtle sweetness'],
      seasonal: { year_round: true },
    },
    {
      name: 'Classic / Standard Vodka',
      type: 'classic_vodka',
      description: 'Traditional, versatile vodka suitable for a wide range of cocktails and mixed drinks. The backbone of the vodka category.',
      characteristics: {
        abvRange: { min: 37.5, max: 40 },
        colorProfile: 'Clear',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['neutral', 'grain', 'pepper', 'crisp'],
      seasonal: { year_round: true },
    },
    {
      name: 'Grain Vodka',
      type: 'grain_vodka',
      description: 'Vodka distilled from grains like wheat, rye, or barley, often prized for its clean, slightly sweet, or bready character.',
      characteristics: {
        abvRange: { min: 37.5, max: 50 },
        colorProfile: 'Clear',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['creamy', 'sweet', 'bready', 'soft', 'clean'],
      seasonal: { year_round: true },
    },
    {
      name: 'Potato Vodka',
      type: 'potato_vodka',
      description: 'Vodka distilled from potatoes, known for a fuller mouthfeel and a distinct, earthy, or creamy texture compared to grain vodka.',
      characteristics: {
        abvRange: { min: 37.5, max: 40 },
        colorProfile: 'Clear',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['earthy', 'creamy', 'buttery', 'rich', 'nutty'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Rye Vodka',
      type: 'rye_vodka',
      description: 'Vodka made primarily from rye, offering a distinctive spicy, peppery, or slightly fruity note that adds complexity to cocktails.',
      characteristics: {
        abvRange: { min: 40, max: 45 },
        colorProfile: 'Clear',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['pepper', 'spice', 'grass', 'light fruit', 'bold'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Flavored Vodka',
      type: 'flavored_vodka',
      description: 'Vodka infused with natural or artificial flavors post-distillation, ranging from citrus and berry to more exotic profiles.',
      characteristics: {
        abvRange: { min: 30, max: 37.5 },
        colorProfile: 'Clear to vibrant colors (depending on flavor)',
        bodyStyle: 'light',
      },
      typicalFlavors: ['citrus', 'berry', 'vanilla', 'cinnamon', 'honey'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Lemon / Citrus Vodka',
      type: 'citrus_vodka',
      description: 'A popular subcategory of flavored vodka, specifically infused with lemon, lime, orange, or other citrus peels for a bright, zesty profile.',
      characteristics: {
        abvRange: { min: 35, max: 37.5 },
        colorProfile: 'Clear to pale yellow',
        bodyStyle: 'light',
      },
      typicalFlavors: ['lemon zest', 'lime', 'orange', 'citrus peel', 'bright'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Orange / Mandarin Vodka',
      type: 'orange_vodka',
      description: 'Vodka infused with orange or mandarin citrus, offering a bright, zesty sweetness perfect for summer cocktails.',
      characteristics: {
        abvRange: { min: 35, max: 37.5 },
        colorProfile: 'Clear to pale orange',
        bodyStyle: 'light',
      },
      typicalFlavors: ['orange zest', 'tangerine', 'citrus', 'sweet', 'bright'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Vanilla Vodka',
      type: 'vanilla_vodka',
      description: 'Vodka infused with vanilla beans, creating a smooth, sweet profile popular in dessert cocktails.',
      characteristics: {
        abvRange: { min: 35, max: 40 },
        colorProfile: 'Clear to light amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['vanilla', 'cream', 'sweet', 'baking spice', 'smooth'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Cucumber Vodka',
      type: 'cucumber_vodka',
      description: 'Vodka infused with fresh cucumber, delivering a crisp, refreshing, and subtly herbal profile.',
      characteristics: {
        abvRange: { min: 35, max: 40 },
        colorProfile: 'Clear',
        bodyStyle: 'light',
      },
      typicalFlavors: ['cucumber', 'fresh', 'herbal', 'green', 'refreshing'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Berry Vodka',
      type: 'berry_vodka',
      description: 'Vodka infused with mixed berries like strawberry, raspberry, or blackberry for a fruity profile.',
      characteristics: {
        abvRange: { min: 35, max: 37.5 },
        colorProfile: 'Clear to pinkish',
        bodyStyle: 'light',
      },
      typicalFlavors: ['strawberry', 'raspberry', 'sweet', 'fruit', 'jammy'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Espresso Vodka',
      type: 'espresso_vodka',
      description: 'Vodka infused with espresso or coffee, combining caffeine with spirits for an energizing cocktail base.',
      characteristics: {
        abvRange: { min: 35, max: 40 },
        colorProfile: 'Clear to brown',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['coffee', 'espresso', 'roasted', 'smooth', 'bitter sweet'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Honey Vodka',
      type: 'honey_vodka',
      description: 'Vodka infused with honey, creating a smooth, naturally sweet spirit with floral undertones.',
      characteristics: {
        abvRange: { min: 35, max: 40 },
        colorProfile: 'Clear to golden',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['honey', 'sweet', 'floral', 'smooth', 'amber'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Pepper Vodka',
      type: 'pepper_vodka',
      description: 'Vodka infused with chili peppers, delivering a spicy kick that adds heat to cocktails.',
      characteristics: {
        abvRange: { min: 35, max: 45 },
        colorProfile: 'Clear to reddish',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['pepper', 'spice', 'heat', 'warming', 'bold'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Cherry Vodka',
      type: 'cherry_vodka',
      description: 'Vodka infused with cherries, offering a sweet-tart fruit flavor perfect for classic cocktails.',
      characteristics: {
        abvRange: { min: 35, max: 37.5 },
        colorProfile: 'Clear to red',
        bodyStyle: 'light',
      },
      typicalFlavors: ['cherry', 'red fruit', 'sweet', 'tart', 'stone fruit'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Apple Vodka',
      type: 'apple_vodka',
      description: 'Vodka infused with apple, capturing the crisp, refreshing character of fresh apples.',
      characteristics: {
        abvRange: { min: 35, max: 40 },
        colorProfile: 'Clear to pale green',
        bodyStyle: 'light',
      },
      typicalFlavors: ['apple', 'crisp', 'green apple', 'fresh', 'fruit'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Watermelon Vodka',
      type: 'watermelon_vodka',
      description: 'Vodka infused with watermelon, delivering a sweet, summery fruit flavor.',
      characteristics: {
        abvRange: { min: 35, max: 37.5 },
        colorProfile: 'Clear to pink',
        bodyStyle: 'light',
      },
      typicalFlavors: ['watermelon', 'sweet', 'fresh', 'summer', 'fruit'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Raspberry Vodka',
      type: 'raspberry_vodka',
      description: 'Vodka infused with raspberries, offering a sweet-tart berry profile.',
      characteristics: {
        abvRange: { min: 35, max: 37.5 },
        colorProfile: 'Clear to pinkish-red',
        bodyStyle: 'light',
      },
      typicalFlavors: ['raspberry', 'berry', 'sweet', 'tart', 'fruity'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Birthday Cake Vodka',
      type: 'birthday_cake_vodka',
      description: 'Flavored vodka inspired by birthday cake, with vanilla and frosting notes.',
      characteristics: {
        abvRange: { min: 35, max: 37.5 },
        colorProfile: 'Clear to pale yellow',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['vanilla', 'cream', 'sweet', 'birthday cake', 'festive'],
      seasonal: { year_round: true },
    },
    {
      name: 'Cake Vodka',
      type: 'cake_vodka',
      description: 'Vodka with cake-like flavors, often reminiscent of wedding cake or vanilla cake.',
      characteristics: {
        abvRange: { min: 35, max: 37.5 },
        colorProfile: 'Clear to golden',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['vanilla', 'sugar', 'sweet', 'baking', 'cream'],
      seasonal: { year_round: true },
    }
  ],

  'Gin': [
    {
      name: 'London Dry Gin',
      type: 'london_dry_gin',
      description: 'The classic, juniper-forward style. No flavors can be added after distillation, resulting in a clean, dry profile.',
      characteristics: {
        abvRange: { min: 37.5, max: 47 },
        colorProfile: 'Clear',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['juniper', 'citrus peel', 'angelica root', 'coriander seed', 'spice'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Old Tom Gin',
      type: 'old_tom_gin',
      description: 'A historical, slightly sweetened style of gin that bridges London Dry and Genever. Often used in classic cocktails like the Tom Collins.',
      characteristics: {
        abvRange: { min: 40, max: 47 },
        colorProfile: 'Clear to pale straw',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['juniper', 'citrus', 'herbal', 'subtle sweetness', 'spice'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Plymouth Gin',
      type: 'plymouth_gin',
      description: 'A Protected Geographical Indication (PGI) style from Plymouth, England. Softer, earthier, and less juniper-forward than London Dry.',
      characteristics: {
        abvRange: { min: 41.2, max: 41.2 }, // Traditionally a specific strength
        colorProfile: 'Clear',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['earthy juniper', 'citrus', 'rooty', 'smooth', 'balanced'],
      seasonal: { year_round: true },
    },
    {
      name: 'Contemporary / New American Gin',
      type: 'contemporary_gin',
      description: 'A modern style where juniper is less dominant, allowing other botanicals (floral, fruity, herbal) to shine.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Clear',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['floral', 'cucumber', 'berries', 'unique botanicals', 'citrus'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Navy Strength Gin',
      type: 'navy_strength_gin',
      description: 'A high-proof gin (traditionally 57% ABV or higher) that ensured gunpowder would still ignite if the spirit spilled on it.',
      characteristics: {
        abvRange: { min: 57, max: 58 },
        colorProfile: 'Clear',
        bodyStyle: 'full',
      },
      typicalFlavors: ['intense juniper', 'bold spice', 'citrus', 'herbal', 'pepper'],
      seasonal: { year_round: true },
    },
    {
      name: 'Sloe Gin',
      type: 'sloe_gin',
      description: 'A British liqueur made by steeping sloe berries (a type of plum) in gin, often with added sugar.',
      characteristics: {
        abvRange: { min: 15, max: 30 },
        colorProfile: 'Deep ruby red',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['berry', 'jam', 'almond', 'tart', 'sweet'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Genever (Hollands Gin)',
      type: 'genever_gin',
      description: 'The historic Dutch predecessor to gin, made from malted grain and Juniper, with a rich, malty character.',
      characteristics: {
        abvRange: { min: 35, max: 50 },
        colorProfile: 'Clear to pale gold',
        bodyStyle: 'full',
      },
      typicalFlavors: ['juniper', 'malt', 'caraway', 'herbal', 'spice'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Aged Gin',
      type: 'aged_gin',
      description: 'Gin aged in wooden barrels, absorbing oak and vanilla notes while maintaining botanical complexity.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Amber to golden',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['oak', 'vanilla', 'juniper', 'spice', 'smooth'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Barrel-Aged Gin',
      type: 'barrel_aged_gin',
      description: 'Gin that has been rested in oak barrels, often formerly used for whiskey or wine.',
      characteristics: {
        abvRange: { min: 40, max: 47 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['wood', 'vanilla', 'juniper', 'citrus', 'caramel'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'International Gin',
      type: 'international_gin',
      description: 'A style meeting minimum requirements but with flexibility in botanicals and production methods.',
      characteristics: {
        abvRange: { min: 37.5, max: 50 },
        colorProfile: 'Clear',
        bodyStyle: 'varies',
      },
      typicalFlavors: ['juniper', 'citrus', 'floral', 'herbal', 'spice'],
      seasonal: { year_round: true },
    },
    {
      name: 'Citra Gin',
      type: 'citra_gin',
      description: 'Gin featuring Citra hops for a bold citrus-forward profile with tropical fruit notes.',
      characteristics: {
        abvRange: { min: 40, max: 45 },
        colorProfile: 'Clear',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['citrus', 'tropical', 'grapefruit', 'hop', 'bright'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Floral Gin',
      type: 'floral_gin',
      description: 'Gin emphasizing floral botanicals like lavender, rose, or chamomile for a delicate, aromatic profile.',
      characteristics: {
        abvRange: { min: 37.5, max: 45 },
        colorProfile: 'Clear to pale lavender',
        bodyStyle: 'light',
      },
      typicalFlavors: ['lavender', 'rose', 'floral', 'herbal', 'delicate'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Lemon Gin',
      type: 'lemon_gin',
      description: 'Gin with prominent lemon peel or lemongrass, offering bright citrus aromatics.',
      characteristics: {
        abvRange: { min: 37.5, max: 45 },
        colorProfile: 'Clear to pale yellow',
        bodyStyle: 'light',
      },
      typicalFlavors: ['lemon', 'citrus', 'bright', 'zesty', 'fresh'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Grapefruit Gin',
      type: 'grapefruit_gin',
      description: 'Gin infused with grapefruit peel for a bold, tangy citrus profile.',
      characteristics: {
        abvRange: { min: 40, max: 45 },
        colorProfile: 'Clear to pale pink',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['grapefruit', 'citrus', 'bitter', 'zesty', 'fresh'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Cucumber Gin',
      type: 'cucumber_gin',
      description: 'Gin with fresh cucumber infusion, popular in the UK for its refreshing, garden-fresh quality.',
      characteristics: {
        abvRange: { min: 40, max: 45 },
        colorProfile: 'Clear',
        bodyStyle: 'light',
      },
      typicalFlavors: ['cucumber', 'fresh', 'herbal', 'green', 'refreshing'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Apple Gin',
      type: 'apple_gin',
      description: 'Gin with apple or pear botanicals, offering a crisp, fruity profile.',
      characteristics: {
        abvRange: { min: 40, max: 45 },
        colorProfile: 'Clear to pale gold',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['apple', 'pear', 'crisp', 'fruit', 'fresh'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Elderflower Gin',
      type: 'elderflower_gin',
      description: 'Gin infused with elderflower, creating a sweet, floral, and aromatic profile.',
      characteristics: {
        abvRange: { min: 38, max: 42 },
        colorProfile: 'Clear to pale yellow',
        bodyStyle: 'light',
      },
      typicalFlavors: ['elderflower', 'floral', 'sweet', 'grassy', 'delicate'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Blackberry Gin',
      type: 'blackberry_gin',
      description: 'Gin infused with blackberries, offering a dark, fruity, slightly tart profile.',
      characteristics: {
        abvRange: { min: 38, max: 45 },
        colorProfile: 'Deep purple to ruby',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['blackberry', 'berry', 'tart', 'sweet', 'fruity'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Saffron Gin',
      type: 'saffron_gin',
      description: 'Premium gin infused with saffron, one of the worlds most expensive spices, for exotic floral notes.',
      characteristics: {
        abvRange: { min: 42, max: 47 },
        colorProfile: 'Clear to golden',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['saffron', 'floral', 'honey', 'exotic', 'luxurious'],
      seasonal: { year_round: true },
    },
    {
      name: 'Pink Gin',
      type: 'pink_gin',
      description: 'Gin blended with angostura bitters and sometimes raspberry or other flavoring.',
      characteristics: {
        abvRange: { min: 40, max: 45 },
        colorProfile: 'Pink to rose',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['bitter', 'berry', 'herbal', 'complex', 'bittersweet'],
      seasonal: { year_round: true },
    }
  ],

  'Rum': [
    {
      name: 'White Rum',
      type: 'white_rum',
      description: 'Clear, light rum that is either unaged or filtered after aging, ideal for cocktails.',
      characteristics: {
        abvRange: { min: 37.5, max: 40 },
        colorProfile: 'Clear',
        bodyStyle: 'light',
      },
      typicalFlavors: ['sugarcane', 'vanilla', 'citrus', 'clean'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Gold Rum',
      type: 'gold_rum',
      description: 'Aged rum with a golden hue, offering a balance between light and dark rum characteristics.',
      characteristics: {
        abvRange: { min: 40, max: 43 },
        colorProfile: 'Pale gold to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['caramel', 'vanilla', 'tropical fruit', 'oak'],
      seasonal: { spring: true, summer: true, fall: true },
    },
    {
      name: 'Dark Rum',
      type: 'dark_rum',
      description: 'Aged rum with rich color and complex flavors, often from longer aging or the addition of caramel.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Amber to dark brown',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['molasses', 'caramel', 'spice', 'oak', 'chocolate'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Aged Rum',
      type: 'aged_rum',
      description: 'Premium rum aged for extended periods (often 8+ years) in oak casks, intended for sipping.',
      characteristics: {
        abvRange: { min: 40, max: 46 },
        colorProfile: 'Rich amber to mahogany',
        bodyStyle: 'full',
      },
      typicalFlavors: ['toffee', 'dried fruit', 'tobacco', 'oak', 'spice'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Spiced Rum',
      type: 'spiced_rum',
      description: 'Rum infused with spices, herbs, and caramel, creating a sweeter, aromatic profile.',
      characteristics: {
        abvRange: { min: 35, max: 40 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['vanilla', 'cinnamon', 'nutmeg', 'caramel', 'clove'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Rhum Agricole',
      type: 'rhum_agricole',
      description: 'French-style rum from Martinique, made from fresh sugarcane juice rather than molasses.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Clear to amber (depending on age)',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['grassy', 'herbal', 'floral', 'earthy', 'pepper'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Cachaça',
      type: 'cachaca',
      description: 'Brazilian spirit distilled from fresh sugarcane juice, the key ingredient in a Caipirinha.',
      characteristics: {
        abvRange: { min: 38, max: 48 },
        colorProfile: 'Clear to golden (if aged)',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['sugarcane', 'grass', 'citrus', 'earthy', 'vegetal'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Flavored Rum',
      type: 'flavored_rum',
      description: 'Rum infused with various flavors like coconut, pineapple, mango, or other tropical fruits.',
      characteristics: {
        abvRange: { min: 21, max: 40 },
        colorProfile: 'Various (clear, amber, or colored)',
        bodyStyle: 'light',
      },
      typicalFlavors: ['coconut', 'pineapple', 'mango', 'tropical', 'sweet'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Coconut Rum',
      type: 'coconut_rum',
      description: 'Rum infused with coconut flavor, popular for tropical cocktails and beach drinks.',
      characteristics: {
        abvRange: { min: 21, max: 40 },
        colorProfile: 'Clear to white',
        bodyStyle: 'light',
      },
      typicalFlavors: ['coconut', 'tropical', 'sweet', 'beachy', 'smooth'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Pineapple Rum',
      type: 'pineapple_rum',
      description: 'Rum infused with pineapple for a sweet, tropical fruit profile.',
      characteristics: {
        abvRange: { min: 21, max: 40 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'light',
      },
      typicalFlavors: ['pineapple', 'tropical', 'sweet', 'fruit', 'bright'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Mango Rum',
      type: 'mango_rum',
      description: 'Rum infused with mango for a rich, sweet tropical flavor.',
      characteristics: {
        abvRange: { min: 21, max: 40 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['mango', 'tropical', 'sweet', 'fruit', 'ripe'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Spiced Black Rum',
      type: 'spiced_black_rum',
      description: 'Dark rum with added spices like cinnamon, clove, and vanilla for a richer, more complex profile.',
      characteristics: {
        abvRange: { min: 40, max: 45 },
        colorProfile: 'Dark brown to black',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['cinnamon', 'clove', 'vanilla', 'molasses', 'warming'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Overproof Rum',
      type: 'overproof_rum',
      description: 'High-alcohol rum (typically 60%+ ABV) popular in tiki cocktails and for flaming drinks.',
      characteristics: {
        abvRange: { min: 55, max: 80 },
        colorProfile: 'Clear to amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['strong', 'bold', 'sugarcane', 'alcohol', 'intense'],
      seasonal: { year_round: true },
    },
    {
      name: 'Navy Rum',
      type: 'navy_rum',
      description: 'Traditional British naval rum, typically dark and full-bodied with a rich history.',
      characteristics: {
        abvRange: { min: 54.5, max: 60 },
        colorProfile: 'Dark amber to brown',
        bodyStyle: 'full',
      },
      typicalFlavors: ['molasses', 'oak', 'spice', 'dark caramel', 'bold'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Demerara Rum',
      type: 'demerara_rum',
      description: 'Rum made from Demerara sugar, known for its rich, dark molasses flavor.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Dark amber to brown',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['demerara', 'molasses', 'toffee', 'brown sugar', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Agricole Blanc',
      type: 'agricole_blanc',
      description: 'White rum from the French Caribbean, made from fresh sugarcane juice with grassy, vegetal notes.',
      characteristics: {
        abvRange: { min: 40, max: 55 },
        colorProfile: 'Clear',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['sugarcane', 'grass', 'herbal', 'fresh', 'vegetal'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Agricole Rhum Vieux',
      type: 'agricole_vieux',
      description: 'Aged agricultural rum from the French Caribbean, offering complex oak and aging notes.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Amber to golden',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['oak', 'vanilla', 'spice', 'caramel', 'aged'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Pusser Rum',
      type: 'pusser_rum',
      description: 'Original Royal Navy rum supply, known for its authentic naval heritage and bold flavor.',
      characteristics: {
        abvRange: { min: 54.5, max: 54.5 },
        colorProfile: 'Dark amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['molasses', 'oak', 'spice', 'traditional', 'bold'],
      seasonal: { year_round: true },
    },
    {
      name: '151 Proof Rum',
      type: 'rum_151',
      description: 'High-proof rum at 75.5% ABV, used sparingly in tiki cocktails.',
      characteristics: {
        abvRange: { min: 75.5, max: 75.5 },
        colorProfile: 'Amber to dark',
        bodyStyle: 'full',
      },
      typicalFlavors: ['strong alcohol', 'molasses', 'intense', 'burning'],
      seasonal: { year_round: true },
    },
    {
      name: 'Coffee Rum',
      type: 'coffee_rum',
      description: 'Rum infused with coffee beans for a rich, caffeinated spirit.',
      characteristics: {
        abvRange: { min: 35, max: 45 },
        colorProfile: 'Dark brown',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['coffee', 'roasted', 'cocoa', 'dark chocolate', 'rich'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Banana Rum',
      type: 'banana_rum',
      description: 'Rum infused with banana for a sweet, tropical fruit profile.',
      characteristics: {
        abvRange: { min: 21, max: 40 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'light',
      },
      typicalFlavors: ['banana', 'tropical', 'sweet', 'fruit', 'creamy'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Vanilla Rum',
      type: 'vanilla_rum',
      description: 'Rum infused with vanilla for a sweet, smooth profile.',
      characteristics: {
        abvRange: { min: 35, max: 40 },
        colorProfile: 'Golden to amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['vanilla', 'sweet', 'caramel', 'baking', 'smooth'],
      seasonal: { year_round: true },
    }
  ],

  // Tequila Subcategories
  'Tequila': [
    {
      name: 'Blanco Tequila',
      type: 'blanco_tequila',
      description: 'Unaged tequila with pure agave flavor, bottled immediately after distillation or rested less than 2 months.',
      characteristics: {
        abvRange: { min: 38, max: 40 },
        colorProfile: 'Clear',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['agave', 'citrus', 'pepper', 'herbal', 'mineral'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Reposado Tequila',
      type: 'reposado_tequila',
      description: 'Tequila aged 2-12 months in oak barrels, achieving a balance between agave and wood notes.',
      characteristics: {
        abvRange: { min: 38, max: 40 },
        colorProfile: 'Pale gold to light amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['agave', 'vanilla', 'caramel', 'oak', 'honey'],
      seasonal: { spring: true, summer: true, fall: true },
    },
    {
      name: 'Añejo Tequila',
      type: 'anejo_tequila',
      description: 'Tequila aged 1-3 years in small oak barrels, developing complex, smooth characteristics.',
      characteristics: {
        abvRange: { min: 38, max: 40 },
        colorProfile: 'Rich amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['caramel', 'vanilla', 'oak', 'spice', 'chocolate'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Extra Añejo Tequila',
      type: 'extra_anejo_tequila',
      description: 'Tequila aged a minimum of 3 years in oak, with deep, luxurious flavor profiles.',
      characteristics: {
        abvRange: { min: 38, max: 40 },
        colorProfile: 'Deep amber to mahogany',
        bodyStyle: 'full',
      },
      typicalFlavors: ['dried fruit', 'toffee', 'spice', 'oak', 'leather'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Joven Tequila',
      type: 'joven_tequila',
      description: 'A blend of Blanco and aged tequilas, often with added coloring or flavoring.',
      characteristics: {
        abvRange: { min: 38, max: 40 },
        colorProfile: 'Light gold',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['agave', 'caramel', 'vanilla', 'sweet'],
      seasonal: { spring: true, summer: true },
    }
  ],

  // Brandy Subcategories
  'Brandy': [
    {
      name: 'Cognac',
      type: 'cognac',
      description: 'Premium brandy from the Cognac region of France, double-distilled from white wine and aged in French oak.',
      characteristics: {
        abvRange: { min: 40, max: 45 },
        colorProfile: 'Amber to deep amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['dried fruit', 'oak', 'vanilla', 'spice', 'orange peel'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Armagnac',
      type: 'armagnac',
      description: 'Traditional French brandy from Gascony, often single-distilled, known for its rustic and robust character.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Amber to deep amber',
        bodyStyle: 'full',
      },
      typicalFlavors: ['prune', 'oak', 'spice', 'earthy', 'chocolate'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Brandy de Jerez',
      type: 'spanish_brandy',
      description: 'Spanish brandy aged in the solera system using American oak casks, primarily in the Jerez region.',
      characteristics: {
        abvRange: { min: 36, max: 45 },
        colorProfile: 'Deep amber to mahogany',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['sherry', 'walnut', 'oak', 'vanilla', 'raisin'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'American Brandy',
      type: 'american_brandy',
      description: 'Brandy produced in the United States, often from California, with styles ranging from smooth and approachable to pot-distilled and complex.',
      characteristics: {
        abvRange: { min: 40, max: 50 },
        colorProfile: 'Golden to deep amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['caramel', 'vanilla', 'oak', 'apricot', 'toffee'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Pisco',
      type: 'pisco',
      description: 'A clear or slightly aged grape brandy from Peru and Chile, not aged in wood (or only briefly) to preserve fresh grape character.',
      characteristics: {
        abvRange: { min: 38, max: 48 },
        colorProfile: 'Clear to pale gold',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['muscat grape', 'floral', 'citrus', 'herbal'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Calvados',
      type: 'calvados',
      description: 'Apple (or apple-pear) brandy from the Normandy region of France, aged in oak barrels.',
      characteristics: {
        abvRange: { min: 40, max: 45 },
        colorProfile: 'Golden to deep amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['apple', 'cider', 'oak', 'vanilla', 'baking spices'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Grappa',
      type: 'grappa',
      description: 'Italian pomace brandy made from the skins, seeds, and stems leftover from winemaking.',
      characteristics: {
        abvRange: { min: 40, max: 60 },
        colorProfile: 'Clear to amber (if aged)',
        bodyStyle: 'light_full',
      },
      typicalFlavors: ['grape skin', 'floral', 'spice', 'earthy', 'herbal'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Metaxa',
      type: 'metaxa',
      description: 'A Greek spirit blending grape brandy with wine and an infusion of Mediterranean botanicals.',
      characteristics: {
        abvRange: { min: 38, max: 40 },
        colorProfile: 'Amber to deep amber',
        bodyStyle: 'medium',
      },
      typicalFlavors: ['muscat', 'honey', 'floral', 'spice', 'orange blossom'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'German Weinbrand',
      type: 'german_weinbrand',
      description: 'German brandy, often lighter and smoother, typically aged for a minimum of six months in oak.',
      characteristics: {
        abvRange: { min: 36, max: 40 },
        colorProfile: 'Light to golden amber',
        bodyStyle: 'light_medium',
      },
      typicalFlavors: ['light fruit', 'caramel', 'vanilla', 'subtle oak'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'South African Brandy',
      type: 'south_african_brandy',
      description: 'Brandy from South Africa, often pot-stilled and aged for a minimum of three years, similar to Cognac in method.',
      characteristics: {
        abvRange: { min: 38, max: 43 },
        colorProfile: 'Golden to rich amber',
        bodyStyle: 'medium_full',
      },
      typicalFlavors: ['dried fruit', 'toffee', 'oak', 'honey', 'spice'],
      seasonal: { fall: true, winter: true },
    }
  ],
  'Water': [
    {
      name: 'Still Water',
      type: 'still_water',
      description: 'Purified or spring water without added carbonation.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 0, max: 1000 },
        phRange: { min: 6.5, max: 8.5 },
      },
      typicalFlavors: ['clean', 'neutral', 'crisp', 'mineral'],
      seasonal: { year_round: true },
    },
    {
      name: 'Sparkling Water',
      type: 'sparkling_water',
      description: 'Water infused with carbon dioxide under pressure, creating natural or added effervescence.',
      characteristics: {
        carbonation: 'high',
        tdsRange: { min: 0, max: 1500 },
        phRange: { min: 4.5, max: 6.5 },
      },
      typicalFlavors: ['effervescent', 'crisp', 'slightly acidic', 'clean'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Mineral Water',
      type: 'mineral_water',
      description: 'Water from a mineral spring containing various minerals like salts and sulfur compounds.',
      characteristics: {
        carbonation: 'varies',
        tdsRange: { min: 250, max: 1500 },
        phRange: { min: 6, max: 8 },
      },
      typicalFlavors: ['mineral', 'salty', 'earthy', 'distinct terroir'],
      seasonal: { year_round: true },
    },
    {
      name: 'Spring Water',
      type: 'spring_water',
      description: 'Water derived from an underground formation from which water flows naturally to the surface.',
      characteristics: {
        carbonation: 'low',
        tdsRange: { min: 50, max: 500 },
        phRange: { min: 6.5, max: 8.5 },
      },
      typicalFlavors: ['fresh', 'clean', 'slight mineral', 'natural'],
      seasonal: { year_round: true },
    },
    {
      name: 'Flavored/Infused Water',
      type: 'flavored_water',
      description: 'Water with natural fruit, herb, or botanical infusions, typically without added sweeteners.',
      characteristics: {
        carbonation: 'varies',
        tdsRange: { min: 0, max: 100 },
        phRange: { min: 6, max: 7.5 },
      },
      typicalFlavors: ['citrus', 'cucumber', 'berry', 'mint', 'subtle fruit'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Alkaline Water',
      type: 'alkaline_water',
      description: 'Water with a higher pH level (typically above 7), often achieved through filtration or additives.',
      characteristics: {
        carbonation: 'low',
        tdsRange: { min: 0, max: 100 },
        phRange: { min: 8, max: 10 },
      },
      typicalFlavors: ['smooth', 'slightly sweet', 'clean', 'soft mouthfeel'],
      seasonal: { year_round: true },
    },
    {
      name: 'Distilled Water',
      type: 'distilled_water',
      description: 'Water that has been boiled into vapor and condensed back into liquid, removing impurities and minerals.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 0, max: 10 },
        phRange: { min: 6.5, max: 7.5 },
      },
      typicalFlavors: ['neutral', 'flat', 'pure', 'minimal flavor'],
      seasonal: { year_round: true },
    },
    {
      name: 'Artesian Water',
      type: 'artesian_water',
      description: 'Water from a confined aquifer that rises to the surface under natural pressure.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 50, max: 500 },
        phRange: { min: 7, max: 8 },
      },
      typicalFlavors: ['clean', 'pure', 'slightly mineral', 'smooth'],
      seasonal: { year_round: true },
    },
    {
      name: 'Glacial Water',
      type: 'glacial_water',
      description: 'Water sourced from glaciers or ice formations, often prized for its purity and unique mineral content.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 10, max: 200 },
        phRange: { min: 6.5, max: 7.5 },
      },
      typicalFlavors: ['clean', 'crisp', 'pure', 'smooth'],
      seasonal: { year_round: true },
    },
    {
      name: 'Electrolyte Water',
      type: 'electrolyte_water',
      description: 'Water enhanced with electrolytes like sodium, potassium, magnesium, and calcium for hydration.',
      characteristics: {
        carbonation: 'varies',
        tdsRange: { min: 200, max: 800 },
        phRange: { min: 6, max: 8 },
      },
      typicalFlavors: ['slightly salty', 'clean', 'mineral', 'sports'],
      seasonal: { year_round: true },
    },
    {
      name: 'pH Balance Water',
      type: 'ph_balanced_water',
      description: 'Water with balanced pH, typically around 7, marketed for health benefits.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 50, max: 300 },
        phRange: { min: 6.8, max: 7.2 },
      },
      typicalFlavors: ['neutral', 'clean', 'balanced', 'pure'],
      seasonal: { year_round: true },
    },
    {
      name: 'Vitamin Water',
      type: 'vitamin_water',
      description: 'Flavored water fortified with vitamins and sometimes minerals.',
      characteristics: {
        carbonation: 'medium',
        tdsRange: { min: 50, max: 500 },
        phRange: { min: 6, max: 7.5 },
      },
      typicalFlavors: ['fruit', 'sweet', 'vitamins', 'flavored'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Coconut Water',
      type: 'coconut_water',
      description: 'The clear liquid inside young coconuts, naturally low in sugar and high in electrolytes.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 50, max: 200 },
        phRange: { min: 5, max: 6.5 },
      },
      typicalFlavors: ['coconut', 'sweet', 'tropical', 'fresh', 'light'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Aloe Vera Water',
      type: 'aloe_vera_water',
      description: 'Water infused with aloe vera gel, marketed for digestive and skin health benefits.',
      characteristics: {
        carbonation: 'low',
        tdsRange: { min: 50, max: 200 },
        phRange: { min: 6, max: 7 },
      },
      typicalFlavors: ['aloe', 'fresh', 'slightly bitter', 'herbal'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Maple Water',
      type: 'maple_water',
      description: 'Water tapped from maple trees in early spring, containing maple sap nutrients.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 100, max: 300 },
        phRange: { min: 6.5, max: 7.5 },
      },
      typicalFlavors: ['maple', 'sweet', 'woody', 'natural', 'subtle'],
      seasonal: { spring: true },
    },
    {
      name: 'Birch Water',
      type: 'birch_water',
      description: 'Water tapped from birch trees, containing natural sugars and minerals.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 50, max: 200 },
        phRange: { min: 6.5, max: 7.5 },
      },
      typicalFlavors: ['birch', 'sweet', 'earthy', 'light', 'natural'],
      seasonal: { spring: true },
    },
    {
      name: 'Rose Water',
      type: 'rose_water',
      description: 'Water distilled from rose petals, used in beverages and culinary applications.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 0, max: 100 },
        phRange: { min: 6, max: 7 },
      },
      typicalFlavors: ['rose', 'floral', 'delicate', 'sweet', 'perfume'],
      seasonal: { year_round: true },
    },
    {
      name: ' Jasmine Water',
      type: 'jasmine_water',
      description: 'Water infused with jasmine flowers for a delicate floral flavor.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 0, max: 100 },
        phRange: { min: 6, max: 7 },
      },
      typicalFlavors: ['jasmine', 'floral', 'delicate', 'fragrant', 'light'],
      seasonal: { year_round: true },
    },
    {
      name: 'Mint Water',
      type: 'mint_water',
      description: 'Water infused with mint leaves for a refreshing, cooling effect.',
      characteristics: {
        carbonation: 'varies',
        tdsRange: { min: 0, max: 100 },
        phRange: { min: 6.5, max: 7.5 },
      },
      typicalFlavors: ['mint', 'refreshing', 'cool', 'fresh', 'herbal'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Lemon Water',
      type: 'lemon_water',
      description: 'Water infused with lemon juice or peel for a citrus-refreshing drink.',
      characteristics: {
        carbonation: 'varies',
        tdsRange: { min: 20, max: 150 },
        phRange: { min: 5, max: 6.5 },
      },
      typicalFlavors: ['lemon', 'citrus', 'tart', 'refreshing', 'zesty'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Cucumber Infused Water',
      type: 'cucumber_water',
      description: 'Water infused with cucumber slices for a subtle, refreshing flavor.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 20, max: 100 },
        phRange: { min: 6.5, max: 7.5 },
      },
      typicalFlavors: ['cucumber', 'fresh', 'green', 'light', 'refreshing'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Berry Infused Water',
      type: 'berry_water',
      description: 'Water infused with mixed berries for a subtle fruity flavor.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 30, max: 150 },
        phRange: { min: 6, max: 7 },
      },
      typicalFlavors: ['berry', 'fruit', 'subtle sweetness', 'fresh', 'light'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Ginger Water',
      type: 'ginger_water',
      description: 'Water infused with ginger for a warming, digestive-aiding drink.',
      characteristics: {
        carbonation: 'none',
        tdsRange: { min: 20, max: 150 },
        phRange: { min: 6, max: 7 },
      },
      typicalFlavors: ['ginger', 'spicy', 'warming', 'zesty', 'herbal'],
      seasonal: { fall: true, winter: true },
    },
    {
      name: 'Tonic Water',
      type: 'tonic_water',
      description: 'Carbonated water with quinine, used as a mixer with gin and vodka.',
      characteristics: {
        carbonation: 'high',
        tdsRange: { min: 80, max: 150 },
        phRange: { min: 2, max: 4 },
      },
      typicalFlavors: ['bitter', 'quinine', 'citrus', 'bubbly', 'sharp'],
      seasonal: { spring: true, summer: true },
    },
    {
      name: 'Soda Water (Club Soda)',
      type: 'club_soda',
      description: 'Carbonated water with added minerals like sodium bicarbonate, used as a mixer.',
      characteristics: {
        carbonation: 'high',
        tdsRange: { min: 50, max: 200 },
        phRange: { min: 5, max: 7 },
      },
      typicalFlavors: ['bubbly', 'slightly salty', 'mineral', 'clean'],
      seasonal: { year_round: true },
    },
    {
      name: 'Seltzer Water',
      type: 'seltzer_water',
      description: 'Plain carbonated water without added minerals or flavors.',
      characteristics: {
        carbonation: 'high',
        tdsRange: { min: 0, max: 50 },
        phRange: { min: 5, max: 6.5 },
      },
      typicalFlavors: ['bubbly', 'crisp', 'neutral', 'refreshing'],
      seasonal: { spring: true, summer: true },
    }
  ],
  'Dairy & Alternatives': [
    {
      name: 'Whole Milk',
      type: 'whole_milk',
      description: 'Unprocessed milk with its natural fat content (typically 3.25-4%).',
      characteristics: {
        fatContent: 'high',
        consistency: 'creamy',
        lactoseContent: 'high',
      },
      typicalFlavors: ['creamy', 'rich', 'sweet', 'dairy'],
      seasonal: { year_round: true },
    },
    {
      name: '2% Reduced-Fat Milk',
      type: 'reduced_fat_milk',
      description: 'Milk with approximately half the fat of whole milk removed.',
      characteristics: {
        fatContent: 'medium',
        consistency: 'smooth',
        lactoseContent: 'high',
      },
      typicalFlavors: ['mild', 'slightly sweet', 'clean dairy'],
      seasonal: { year_round: true },
    },
    {
      name: 'Skim Milk',
      type: 'skim_milk',
      description: 'Milk with almost all fat removed (typically less than 0.5%).',
      characteristics: {
        fatContent: 'very_low',
        consistency: 'thin',
        lactoseContent: 'high',
      },
      typicalFlavors: ['light', 'slightly sweet', 'watery dairy'],
      seasonal: { year_round: true },
    },
    {
      name: 'Half & Half',
      type: 'half_and_half',
      description: 'Equal parts whole milk and light cream, with about 10-12% fat.',
      characteristics: {
        fatContent: 'medium_high',
        consistency: 'rich',
        lactoseContent: 'medium',
      },
      typicalFlavors: ['creamy', 'rich', 'smooth', 'dairy'],
      seasonal: { year_round: true },
    },
    {
      name: 'Light Cream',
      type: 'light_cream',
      description: 'Cream with 18-30% butterfat, lighter than heavy cream.',
      characteristics: {
        fatContent: 'high',
        consistency: 'velvety',
        lactoseContent: 'medium',
      },
      typicalFlavors: ['rich', 'creamy', 'smooth', 'luxurious'],
      seasonal: { year_round: true },
    },
    {
      name: 'Heavy Cream',
      type: 'heavy_cream',
      description: 'Cream with at least 36% butterfat, ideal for whipping and rich sauces.',
      characteristics: {
        fatContent: 'very_high',
        consistency: 'thick',
        lactoseContent: 'low_medium',
      },
      typicalFlavors: ['ultra-rich', 'buttery', 'decadent', 'smooth'],
      seasonal: { year_round: true },
    },
    {
      name: 'Buttermilk (Cultured)',
      type: 'cultured_buttermilk',
      description: 'Fermented milk with a tangy flavor and slightly thickened consistency.',
      characteristics: {
        fatContent: 'low',
        consistency: 'slightly_thick',
        lactoseContent: 'low',
      },
      typicalFlavors: ['tangy', 'sour', 'creamy', 'fermented'],
      seasonal: { year_round: true },
    },
    {
      name: 'Sweetened Condensed Milk',
      type: 'condensed_milk',
      description: 'Milk with about 60% of water removed and sugar added, creating a thick, sweet product.',
      characteristics: {
        fatContent: 'high',
        consistency: 'syrupy_thick',
        lactoseContent: 'high',
        sweetnessLevel: 'very_high',
      },
      typicalFlavors: ['extremely sweet', 'caramelized', 'creamy', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Evaporated Milk',
      type: 'evaporated_milk',
      description: 'Milk with about 60% of water removed, unsweetened, with a slightly caramelized flavor.',
      characteristics: {
        fatContent: 'medium_high',
        consistency: 'thick',
        lactoseContent: 'high',
        sweetnessLevel: 'low',
      },
      typicalFlavors: ['cooked milk', 'slightly sweet', 'caramel notes', 'rich'],
      seasonal: { year_round: true },
    },
    {
      name: 'Almond Milk',
      type: 'almond_milk',
      description: 'Plant-based milk made from ground almonds and water, often fortified with vitamins.',
      characteristics: {
        baseIngredient: 'almonds',
        consistency: 'light',
        lactoseContent: 'none',
        commonFortifications: ['calcium', 'vitamin_d', 'vitamin_e'],
      },
      typicalFlavors: ['nutty', 'slightly sweet', 'subtle', 'clean'],
      seasonal: { year_round: true },
    },
    {
      name: 'Oat Milk',
      type: 'oat_milk',
      description: 'Creamy plant-based milk made from soaked and blended oats, known for its neutral flavor and frothing ability.',
      characteristics: {
        baseIngredient: 'oats',
        consistency: 'creamy_medium',
        lactoseContent: 'none',
        commonFortifications: ['calcium', 'vitamin_d', 'vitamin_a'],
      },
      typicalFlavors: ['creamy', 'oaty', 'slightly sweet', 'neutral'],
      seasonal: { year_round: true },
    },
    {
      name: 'Soy Milk',
      type: 'soy_milk',
      description: 'One of the original plant-based milks, made from soaked and ground soybeans, with protein content similar to dairy milk.',
      characteristics: {
        baseIngredient: 'soybeans',
        consistency: 'medium',
        lactoseContent: 'none',
        commonFortifications: ['calcium', 'vitamin_d', 'vitamin_b12'],
      },
      typicalFlavors: ['beany', 'nutty', 'slightly sweet', 'earthy'],
      seasonal: { year_round: true },
    },
    {
      name: 'Coconut Milk (Beverage)',
      type: 'coconut_milk',
      description: 'Thin beverage made from coconut cream and water, different from canned coconut milk used in cooking.',
      characteristics: {
        baseIngredient: 'coconut',
        consistency: 'light_medium',
        lactoseContent: 'none',
        commonFortifications: ['calcium', 'vitamin_d', 'vitamin_b12'],
      },
      typicalFlavors: ['tropical', 'coconut', 'slightly sweet', 'creamy'],
      seasonal: { year_round: true },
    },
    
  ]
};

// ============================================================
// ENHANCED REALISTIC PRODUCTS DATA
// ============================================================



const REALISTIC_PRODUCTS = [
  // BEERS
  {
    name: 'Guinness Foreign Extra Stout',
    brand: 'Guinness',
    type: 'stout',
    subType: 'Foreign Extra Stout',
    category: 'Beer',
    subCategory: 'Stout',
    isAlcoholic: true,
    abv: 7.5,
    proof: 15,
    volumeMl: 330,
    originCountry: 'Ireland',
    region: 'Dublin',
    breweryName: 'St. James\'s Gate Brewery',
    productionMethod: 'traditional',
    description: 'A bold, rich stout with distinctive roasted barley flavor and bittersweet balance.',
    shortDescription: 'Bold Irish stout with roasted barley notes',
    tagline: 'Good Things Come to Those Who Wait',
    tastingNotes: {
      aroma: ['roasted coffee', 'dark chocolate', 'caramel'],
      palate: ['rich malt', 'roasted barley', 'subtle hops'],
      finish: ['smooth', 'bittersweet', 'lingering'],
      mouthfeel: ['creamy', 'full-bodied'],
      appearance: 'Deep ruby red with a creamy tan head',
      color: 'Ruby black',
    },
    flavorProfile: ['roasted', 'chocolate', 'caramel', 'bitter', 'creamy'],
    servingSuggestions: {
      temperature: 'Cool (6-8°C)',
      glassware: 'Tulip glass or pint glass',
    },
    isDietary: {
      vegan: true,
      vegetarian: true,
      glutenFree: false,
    },
    allergens: ['gluten', 'barley'],
    nutritionalInfo: {
      calories: 176,
      carbohydrates: 14.2,
      sugar: 0,
      protein: 1.9,
    },
    awards: [
      {
        title: 'World Beer Cup',
        organization: 'Brewers Association',
        year: 2022,
        medal: 'gold',
      },
    ],
    standardSizes: ['33cl', 'can-330ml', 'bottle-330ml', 'pack-6'], // Valid sizes
    servingSize: '1 bottle (330ml)',
    servingsPerContainer: 1,
  },
  {
    name: 'Heineken Lager Beer',
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
    description: 'A premium quality lager beer with a balanced taste and refreshing character.',
    shortDescription: 'Premium Dutch lager, crisp and refreshing',
    tagline: 'Open Your World',
    tastingNotes: {
      aroma: ['mild hop', 'grain', 'slight fruit'],
      palate: ['crisp', 'balanced', 'light malt'],
      finish: ['clean', 'refreshing'],
    },
    flavorProfile: ['crisp', 'malty', 'dry', 'clean'],
    isDietary: {
      vegan: true,
      vegetarian: true,
    },
    allergens: ['gluten', 'barley'],
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
    tagline: 'Bold and refreshing',
    tastingNotes: {
      aroma: ['citrus', 'pine', 'floral'],
      palate: ['balanced', 'malty', 'hoppy'],
      finish: ['clean', 'refreshing'],
    },
    flavorProfile: ['citrus', 'pine', 'balanced'],
    isDietary: {
      vegan: true,
      vegetarian: true,
    },
    allergens: ['gluten', 'barley'],
    standardSizes: ['35.5cl', 'can-355ml', 'bottle-355ml', 'pack-6'],
  },
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
    subCategory: 'Brut',
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
    subCategory: 'Cream Liqueur',
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
    subCategory: 'Espresso',
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
  {
    name: 'Star Lager Beer',
    brand: 'Star',
    type: 'lager',
    category: 'Beer',
    subCategory: 'Lager',
    isAlcoholic: true,
    abv: 5.0,
    volumeMl: 600,
    originCountry: 'Nigeria',
    region: 'Lagos',
    breweryName: 'Nigerian Breweries',
    description: 'Nigeria\'s favorite lager beer with a unique bold and refreshing taste.',
    shortDescription: 'Bold Nigerian lager',
    tastingNotes: {
      aroma: ['grain', 'mild hop'],
      palate: ['crisp', 'refreshing'],
    },
    flavorProfile: ['crisp', 'malty', 'clean'],
    standardSizes: ['bottle-600ml', 'pack-12'], 
    isLocal: true,
  },
  {
    name: 'Budweiser Lager',
    brand: 'Budweiser',
    type: 'lager',
    category: 'Beer',
    subCategory: 'Lager',
    isAlcoholic: true,
    abv: 5.0,
    volumeMl: 330,
    originCountry: 'United States',
    breweryName: 'Anheuser-Busch',
    description: 'The King of Beers. A classic American lager with a crisp, clean taste.',
    shortDescription: 'Classic American lager',
    flavorProfile: ['crisp', 'clean', 'light'],
    standardSizes: ['33cl', 'can-330ml', 'pack-6'],
  },

  // WINES
  {
    name: 'Carlo Rossi California Red',
    brand: 'Carlo Rossi',
    type: 'red_wine',
    subType: 'Table Wine',
    category: 'Wine',
    subCategory: 'Red Wine',
    isAlcoholic: true,
    abv: 12.5,
    volumeMl: 750,
    originCountry: 'United States',
    region: 'California',
    wineryName: 'Carlo Rossi Winery',
    vintage: 2022,
    description: 'A smooth, easy-drinking red wine with fruity flavors and a soft finish.',
    shortDescription: 'Smooth California red blend',
    tastingNotes: {
      aroma: ['red berries', 'plum', 'oak'],
      palate: ['fruity', 'smooth', 'balanced'],
      finish: ['soft', 'medium'],
      color: 'Deep ruby',
    },
    flavorProfile: ['fruity', 'berry', 'oak', 'smooth'],
    servingSuggestions: {
      temperature: 'Room temperature (16-18°C)',
      glassware: 'Red wine glass',
    },
    foodPairings: ['Pasta', 'Pizza', 'Grilled meats', 'Cheese'],
    isDietary: {
      vegan: false,
      vegetarian: true,
    },
    standardSizes: ['75cl', 'bottle-750ml', '1.5L'],
  },
  {
    name: 'Four Cousins Natural Sweet Rosé',
    brand: 'Four Cousins',
    type: 'rose_wine',
    category: 'Wine',
    subCategory: 'Rosé Wine',
    isAlcoholic: true,
    abv: 11.5,
    volumeMl: 750,
    originCountry: 'South Africa',
    region: 'Western Cape',
    vintage: 2023,
    description: 'A refreshing, naturally sweet rosé with vibrant berry flavors.',
    shortDescription: 'Sweet and fruity South African rosé',
    tastingNotes: {
      aroma: ['strawberry', 'raspberry', 'floral'],
      palate: ['sweet', 'fruity', 'refreshing'],
      color: 'Pale pink',
    },
    flavorProfile: ['fruity', 'berry', 'sweet', 'crisp'],
    standardSizes: ['75cl', 'bottle-750ml'],
  },

  // SPIRITS
  {
    name: 'Johnnie Walker Black Label',
    brand: 'Johnnie Walker',
    type: 'scotch',
    subType: 'Blended Scotch Whisky',
    category: 'Spirits',
    subCategory: 'Whiskey',
    isAlcoholic: true,
    abv: 40,
    proof: 80,
    volumeMl: 700,
    age: 12,
    ageStatement: '12 Year Old',
    originCountry: 'Scotland',
    region: 'Speyside',
    distilleryName: 'Multiple Distilleries',
    description: 'A smooth, complex blend of over 40 whiskies, each aged for at least 12 years.',
    shortDescription: 'Premium 12-year Blended Scotch',
    tagline: 'Keep Walking',
    tastingNotes: {
      nose: ['vanilla', 'smoke', 'dried fruit'],
      aroma: ['rich smoke', 'sweet fruit', 'spice'],
      palate: ['smooth', 'creamy', 'smoky'],
      finish: ['long', 'warming', 'sweet'],
    },
    flavorProfile: ['smoky', 'vanilla', 'fruity', 'oak', 'spicy', 'smooth'],
    standardSizes: ['70cl', '1L', 'miniature-50ml'],
  },
  {
    name: 'Tropicana Pure Premium Orange Juice',
    brand: 'Tropicana',
    type: 'orange_juice',
    category: 'Juice',
    subCategory: 'Orange Juice',
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
  {
    name: 'Jameson Irish Whiskey',
    brand: 'Jameson',
    type: 'irish_whiskey',
    category: 'Spirits',
    subCategory: 'Whiskey',
    isAlcoholic: true,
    abv: 40,
    volumeMl: 700,
    originCountry: 'Ireland',
    region: 'Cork',
    distilleryName: 'Midleton Distillery',
    description: 'Triple-distilled Irish whiskey with a smooth, balanced taste.',
    shortDescription: 'Smooth triple-distilled Irish whiskey',
    flavorProfile: ['vanilla', 'smooth', 'nutty', 'sweet'],
    standardSizes: ['70cl', '1L', '35cl'],
  },
  {
    name: 'Absolut Vodka',
    brand: 'Absolut',
    type: 'vodka',
    category: 'Spirits',
    subCategory: 'Vodka',
    isAlcoholic: true,
    abv: 40,
    volumeMl: 700,
    originCountry: 'Sweden',
    description: 'Rich, full-bodied and complex, yet smooth and mellow.',
    shortDescription: 'Premium Swedish vodka',
    flavorProfile: ['clean', 'smooth'],
    standardSizes: ['70cl', '1L', '35cl'],
  },
  {
    name: 'Bacardi Superior White Rum',
    brand: 'Bacardi',
    type: 'white_rum',
    category: 'Spirits',
    subCategory: 'Rum',
    isAlcoholic: true,
    abv: 37.5,
    volumeMl: 700,
    originCountry: 'Puerto Rico',
    description: 'Light and aromatic white rum, perfect for cocktails.',
    shortDescription: 'Classic white rum for cocktails',
    flavorProfile: ['clean', 'smooth', 'vanilla'],
    standardSizes: ['70cl', '1L', '35cl'],
  },

  // LIQUEURS
  {
    name: 'Baileys Irish Cream',
    brand: 'Baileys',
    type: 'cream_liqueur',
    category: 'Liqueurs',
    isAlcoholic: true,
    abv: 17,
    volumeMl: 700,
    originCountry: 'Ireland',
    description: 'Smooth blend of Irish whiskey and cream with hints of cocoa and vanilla.',
    shortDescription: 'Creamy Irish liqueur',
    flavorProfile: ['creamy', 'chocolate', 'vanilla', 'sweet'],
    allergens: ['milk', 'lactose'],
    standardSizes: ['70cl', '1L', '35cl'],
  },
  {
    name: 'Amarula Cream Liqueur',
    brand: 'Amarula',
    type: 'cream_liqueur',
    category: 'Liqueurs',
    isAlcoholic: true,
    abv: 17,
    volumeMl: 750,
    originCountry: 'South Africa',
    description: 'Exotic cream liqueur made from the marula fruit.',
    shortDescription: 'African cream liqueur',
    flavorProfile: ['creamy', 'fruity', 'caramel'],
    standardSizes: ['75cl', '1L'],
  },

  // SOFT DRINKS
  {
    name: 'Coca-Cola Classic',
    brand: 'Coca-Cola',
    type: 'cola',
    category: 'Soft Drinks',
    isAlcoholic: false,
    volumeMl: 330,
    originCountry: 'United States',
    description: 'The original cola with the unique, refreshing taste.',
    shortDescription: 'Classic cola drink',
    flavorProfile: ['sweet', 'caramel', 'citrus'],
    nutritionalInfo: {
      calories: 139,
      carbohydrates: 35,
      sugar: 35,
    },
    standardSizes: ['33cl', 'can-330ml', '50cl', '1L', '1.5L', '2L', 'pack-6', 'pack-12'],
  },
  {
    name: 'Sprite Lemon-Lime',
    brand: 'Sprite',
    type: 'lemon_lime',
    category: 'Soft Drinks',
    isAlcoholic: false,
    volumeMl: 330,
    originCountry: 'United States',
    description: 'Crisp, clean lemon-lime taste.',
    shortDescription: 'Refreshing lemon-lime soda',
    flavorProfile: ['citrus', 'crisp', 'sweet'],
    standardSizes: ['33cl', 'can-330ml', '50cl', '1.5L', '2L'],
  },

  // ENERGY & WATER
  {
    name: 'Red Bull Energy Drink',
    brand: 'Red Bull',
    type: 'energy_drink',
    category: 'Energy Drinks',
    isAlcoholic: false,
    volumeMl: 250,
    originCountry: 'Austria',
    description: 'Wings when you need them. Vitalizes body and mind.',
    shortDescription: 'Premium energy drink',
    nutritionalInfo: {
      caffeine: 80,
    },
    standardSizes: ['can-250ml', 'can-473ml'],
  },
  {
    name: 'Evian Natural Spring Water',
    brand: 'Evian',
    type: 'spring_water',
    category: 'Water & Mixers',
    isAlcoholic: false,
    volumeMl: 500,
    originCountry: 'France',
    region: 'French Alps',
    description: 'Pure, natural spring water from the French Alps.',
    shortDescription: 'Premium spring water',
    standardSizes: ['33cl', '50cl', '75cl', '1L', '1.5L'],
  },
];

// ============================================================
// ENHANCED BRANDS DATA
// ============================================================

const BRANDS_DATA = [
  {
    name: 'Guinness',
    brandType: 'brewery',
    primaryCategory: 'beer',
    countryOfOrigin: 'Ireland',
    region: 'Dublin',
    founded: 1759,
    description: 'Iconic Irish brewery famous for its rich, dark stouts. A global symbol of Irish heritage.',
    story: 'Founded by Arthur Guinness in 1759, the brewery has been crafting exceptional stouts for over 260 years. From a small brewery in Dublin to a global icon, Guinness represents Irish tradition and innovation.',
    tagline: 'Made of More',
    website: 'https://www.guinness.com',
    specializations: ['Stout', 'Dark Beer'],
    productionMethod: 'traditional',
    qualityStandards: ['iso_certified'],
    isPremium: true,
    headquarters: {
      city: 'Dublin',
      country: 'Ireland',
    },
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
  },
  {
    name: 'Star',
    brandType: 'brewery',
    primaryCategory: 'beer',
    countryOfOrigin: 'Nigeria',
    region: 'Lagos',
    founded: 1949,
    description: 'Nigeria\'s favorite lager beer brand.',
    isLocal: true,
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
    name: 'Johnnie Walker',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'Scotland',
    region: 'Speyside',
    founded: 1820,
    description: 'The world\'s most distributed Scotch whisky, known for its iconic striding man logo.',
    tagline: 'Keep Walking',
    specializations: ['Blended Scotch Whisky'],
    isPremium: true,
    isCraft: false,
  },
  {
    name: 'Jameson',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'Ireland',
    founded: 1780,
    description: 'Ireland\'s most famous whiskey, triple-distilled for smoothness.',
    specializations: ['Irish Whiskey'],
    isPremium: true,
  },
  {
    name: 'Carlo Rossi',
    brandType: 'winery',
    primaryCategory: 'wine',
    countryOfOrigin: 'United States',
    region: 'California',
    founded: 1974,
    description: 'Popular California wine brand known for accessible, easy-drinking wines.',
    specializations: ['Table Wine', 'Red Wine'],
  },
  {
    name: 'Four Cousins',
    brandType: 'winery',
    primaryCategory: 'wine',
    countryOfOrigin: 'South Africa',
    region: 'Western Cape',
    founded: 1994,
    description: 'South African wine brand offering naturally sweet wines.',
    specializations: ['Sweet Wine', 'Rosé'],
    isPremium: false,
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
    name: 'Nederburg',
    brandType: 'wine_estate',
    primaryCategory: 'wine',
    countryOfOrigin: 'South Africa',
    region: 'Paarl',
    founded: 1791,
    description: 'Historic South African wine estate producing award-winning wines.',
    specializations: ['Cabernet Sauvignon', 'Premium Wine'],
    isPremium: true,
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
  {
    name: 'Absolut',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'Sweden',
    founded: 1879,
    description: 'Swedish vodka brand known for its distinctive bottle and pure taste.',
    specializations: ['Vodka', 'Flavored Spirits'],
    isPremium: true,
  },
  {
    name: 'Bacardi',
    brandType: 'distillery',
    primaryCategory: 'spirits',
    countryOfOrigin: 'Puerto Rico',
    founded: 1862,
    description: 'World\'s most awarded rum, founded in Cuba and now produced in Puerto Rico.',
    specializations: ['White Rum', 'Premium Rum'],
    isPremium: true,
  },
  {
    name: 'Baileys',
    brandType: 'spirits_producer',
    primaryCategory: 'liqueurs',
    countryOfOrigin: 'Ireland',
    founded: 1974,
    description: 'The original Irish cream liqueur.',
    specializations: ['Cream Liqueur'],
    isPremium: true,
  },
  {
    name: 'Amarula',
    brandType: 'spirits_producer',
    primaryCategory: 'liqueurs',
    countryOfOrigin: 'South Africa',
    founded: 1989,
    description: 'Premium cream liqueur made from the exotic marula fruit.',
    specializations: ['Cream Liqueur', 'Exotic Spirits'],
    isPremium: true,
  },
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
  {
    name: 'Sprite',
    brandType: 'beverage_company',
    primaryCategory: 'soft_drinks',
    countryOfOrigin: 'United States',
    founded: 1961,
    description: 'Leading lemon-lime flavored soft drink.',
    specializations: ['Lemon-Lime Soda'],
  },
  {
    name: 'Red Bull',
    brandType: 'beverage_company',
    primaryCategory: 'energy_drinks',
    countryOfOrigin: 'Austria',
    founded: 1987,
    description: 'Pioneer and market leader in energy drinks.',
    specializations: ['Energy Drinks'],
    isPremium: true,
  },
  {
    name: 'Evian',
    brandType: 'water_brand',
    primaryCategory: 'water',
    countryOfOrigin: 'France',
    founded: 1826,
    description: 'Premium natural spring water from the French Alps.',
    specializations: ['Spring Water', 'Premium Water'],
    isPremium: true,
  },
];

// ============================================================
// ENHANCED TENANTS DATA
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
    enforceAgeVerification: false, // Sells mostly soft drinks
  },
];


/**
 * Get default images for a product type
 */
function getDefaultProductImages(productType, count = 3) {
  // Try exact type match first
  let images = DEFAULT_PRODUCT_IMAGES[productType];
  
  // Try parent category
  if (!images || images.length === 0) {
    const parentType = productType.split('_')[0]; // e.g., 'red_wine' -> 'red'
    images = DEFAULT_PRODUCT_IMAGES[parentType];
  }
  
  // Fallback to default
  if (!images || images.length === 0) {
    images = DEFAULT_PRODUCT_IMAGES.default;
  }
  
  // Return requested number of images
  const selectedImages = [];
  for (let i = 0; i < Math.min(count, images.length); i++) {
    selectedImages.push({
      url: images[i],
      alt: `Product image ${i + 1}`,
      isPrimary: i === 0,
      order: i,
      source: 'unsplash',
      metadata: {
        width: 800,
        height: 800,
      },
    });
  }
  
  return selectedImages;
}




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
      status: 'active',
      isVerified: true,
      source: 'admin',
      commonIn: {
        beverageTypes: flavorData.category === 'fruit' ? ['wine', 'cocktail', 'juice'] :
                       flavorData.category === 'sweet' ? ['liqueur', 'cocktail'] :
                       flavorData.category === 'spice' ? ['spirit', 'liqueur'] :
                       ['beer', 'wine', 'spirit'],
      },
    }, 'value');
    
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
      displayName: tagData.name.charAt(0).toUpperCase() + tagData.name.slice(1),
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
    if (!parentCategory) continue;
    
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
      brandColors: {
        primary: '#1a202c',
        secondary: '#718096',
      },
    }, 'slug');
    
    createdData.brands.push(brand);
  }
  
  console.log(`✓ Created ${createdData.brands.length} brands`);
}



/**
 * Create Tenants (Best Approach)
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
        // Create tenant
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
        // Create owner user (temporarily as customer to bypass validation)
        owner = await User.create({
          email: ownerEmail,
          passwordHash: hashedPassword,
          firstName: tenantData.name.split(' ')[0],
          lastName: 'Admin',
          displayName: `${tenantData.name} Admin`,
          role: 'customer', // Temporary role
          status: 'active',
          isEmailVerified: true,
          isAgeVerified: true,
          ageVerificationMethod: 'self_declaration',
        });
        
        // Update to tenant_owner with tenant reference
        owner.role = 'tenant_owner';
        owner.tenant = tenant._id;
        await owner.save();
        
        console.log(`  ✓ Created tenant owner: ${ownerEmail}`);
      } else {
        console.log(`  ℹ Tenant owner "${ownerEmail}" already exists`);
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
    const subCategory = productData.subCategory ? 
      createdData.subCategories.find(sc => sc.name === productData.subCategory) : null;
    
    // Select flavors based on product type
    const relevantFlavors = createdData.flavors.filter(f => 
      productData.flavorProfile?.includes(f.value)
    );
    const selectedFlavors = randomSelect(relevantFlavors, Math.min(randomInt(3, 5), relevantFlavors.length));
    
    // Select tags
    const relevantTags = createdData.tags.filter(t => {
      if (productData.isAlcoholic && t.name === 'organic') return randomBool(0.3);
      if (t.name === 'premium' && productData.abv > 12) return randomBool(0.4);
      if (t.name === 'bestseller') return randomBool(0.2);
      return false;
    });
    const selectedTags = randomSelect(relevantTags, Math.min(3, relevantTags.length));
    
    // Get default images based on product type
    const productImages = getDefaultProductImages(productData.type, 3);
    
    try {
      // Create product
      const product = await Product.create({
        ...productData,
        slug: generateUniqueSlug(`${productData.name}-${i}`),
        brand: brand._id,
        category: category?._id,
        subCategory: subCategory?._id,
        flavors: selectedFlavors.map(f => f._id),
        tags: selectedTags.map(t => t._id),
        images: productImages, // Add default images
        status: 'approved',
        publishedAt: new Date(),
        approvedBy: createdData.users[0]?._id,
        submissionSource: 'admin',
        metaTitle: `${productData.name} - Buy Online`,
        metaDescription: productData.shortDescription,
        keywords: [
          productData.name,
          productData.brand,
          productData.type,
          ...(productData.flavorProfile || [])
        ],
      });
      
      createdData.products.push(product);
      console.log(`  ✓ Created product: ${product.name} (with ${productImages.length} images)`);
    } catch (error) {
      console.error(`  ✗ Error creating product "${productData.name}":`, error.message);
      continue;
    }
  }
  
  console.log(`✓ Created ${createdData.products.length} products with default images`);
}




/**
 * Create SubProducts with Enhanced Data
 */
async function createSubProducts() {
  console.log('\n📦 Creating SubProducts...');
  
  let totalSubProducts = 0;
  let skippedProducts = 0;
  
  // Validate we have data
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
      // Select 1-3 random tenants for this product
      const numTenants = randomInt(1, Math.min(3, createdData.tenants.length));
      const selectedTenants = randomSelect(createdData.tenants, numTenants);
      
      if (!selectedTenants || selectedTenants.length === 0) {
        console.log(`  ⚠️  No tenants selected for ${product.name}, skipping...`);
        skippedProducts++;
        continue;
      }
      
      for (const tenant of selectedTenants) {
        if (!tenant || !tenant._id) {
          console.log(`  ⚠️  Invalid tenant for ${product.name}, skipping...`);
          continue;
        }
        
        // Calculate pricing based on tenant's revenue model
        const baseCost = randomInt(1000, 50000);
        let sellingPrice;
        
        if (tenant.revenueModel === 'markup') {
          sellingPrice = baseCost * (1 + (tenant.markupPercentage || 40) / 100);
        } else {
          sellingPrice = baseCost * 1.3; // Default 30% markup
        }
        
        // Generate unique SKU
        const tenantPrefix = tenant.slug.substring(0, 3).toUpperCase();
        const productPrefix = product.slug.substring(0, 5).toUpperCase();
        const randomSuffix = randomInt(100, 999);
        const sku = `${tenantPrefix}-${productPrefix}-${randomSuffix}`;
        
        // Determine seasonal availability
        let seasonal = {};
        if (product.type?.includes('beer') || product.type === 'lager') {
          seasonal = { summer: true };
        } else if (product.type?.includes('wine') && product.type?.includes('red')) {
          seasonal = { fall: true, winter: true };
        } else if (product.type?.includes('spirit') || product.type?.includes('whiskey')) {
          seasonal = { winter: true };
        }
        
        // Create SubProduct
        const totalStock = randomInt(50, 500);
        const lowStockThreshold = randomInt(10, 30);
        
        const subProduct = await SubProduct.create({
          product: product._id,
          tenant: tenant._id,
          sku,
          baseSellingPrice: Math.round(sellingPrice),
          costPrice: baseCost,
          currency: tenant.defaultCurrency || 'NGN',
          status: 'active',
          isFeaturedByTenant: randomBool(0.2),
          addedAt: new Date(),
          activatedAt: new Date(),
          
          // Stock management
          totalStock,
          availableStock: totalStock,
          reservedStock: 0,
          lowStockThreshold,
          reorderPoint: randomInt(5, 15),
          reorderQuantity: randomInt(50, 100),
          stockStatus: totalStock === 0 ? 'out_of_stock' :
                       totalStock <= lowStockThreshold ? 'low_stock' : 'in_stock',
          
          // Seasonal
          seasonal,
          
          // Analytics
          totalSold: randomInt(0, 100),
          totalRevenue: randomInt(0, 500000),
          viewCount: randomInt(10, 500),
          addToCartCount: randomInt(5, 200),
          conversionRate: randomInt(5, 25),
        });
        
        totalSubProducts++;
        product.subProducts.push(subProduct._id);
        
        console.log(`  ✓ Created SubProduct: ${product.name} for ${tenant.name}`);
      }
      
      // Save product with subProduct references
      await product.save();
      
    } catch (error) {
      console.error(`  ✗ Error creating SubProducts for ${product.name}:`, error.message);
      skippedProducts++;
      continue;
    }
  }
  
  console.log(`✓ Created ${totalSubProducts} subproducts`);
  if (skippedProducts > 0) {
    console.log(`  ⚠️  Skipped ${skippedProducts} products due to errors`);
  }
}

// scripts/seed.js - Fix createSizes function similarly

/**
 * Create Sizes with Enhanced Data
 */
async function createSizes() {
  console.log('\n📏 Creating Sizes...');
  
  let totalSizes = 0;
  let skippedSubProducts = 0;
  
  const allSubProducts = await SubProduct.find({}).populate('product');
  
  if (!allSubProducts || allSubProducts.length === 0) {
    console.log('  ⚠️  No SubProducts found');
    return;
  }
  
  for (const subProduct of allSubProducts) {
    try {
      const product = subProduct.product;
      
      if (!product) {
        console.log(`  ⚠️  SubProduct ${subProduct._id} has no product, skipping...`);
        skippedSubProducts++;
        continue;
      }
      
      // Determine appropriate sizes based on product type
      let availableSizes = [];
      
      if (product.type?.includes('beer') || product.type === 'lager' || product.type === 'ale' || product.type === 'stout') {
        availableSizes = ['33cl', 'can-330ml', 'bottle-330ml', 'bottle-600ml'];
      } else if (product.type?.includes('wine') || product.type?.includes('sparkling')) {
        availableSizes = ['75cl', 'bottle-750ml', '1.5L'];
      } else if (product.type?.includes('spirit') || product.type?.includes('whiskey') || product.type === 'vodka' || product.type === 'gin' || product.type === 'rum') {
        availableSizes = ['70cl', '1L', '35cl', 'miniature-50ml'];
      } else if (product.type === 'liqueur' || product.type === 'cream_liqueur') {
        availableSizes = ['70cl', '1L', '35cl'];
      } else if (product.type?.includes('soft_drink') || product.type === 'cola' || product.type === 'lemon_lime') {
        availableSizes = ['33cl', 'can-330ml', '50cl', '1.5L', '2L'];
      } else if (product.type === 'energy_drink') {
        availableSizes = ['can-250ml', 'can-473ml'];
      } else if (product.type?.includes('water')) {
        availableSizes = ['50cl', '1L', '1.5L'];
      } else {
        availableSizes = ['50cl', '70cl', '1L'];
      }
      
      if (availableSizes.length === 0) {
        console.log(`  ⚠️  No available sizes for product type: ${product.type}`);
        skippedSubProducts++;
        continue;
      }
      
      // Select 1-2 sizes for this subproduct
      const numSizes = randomInt(1, Math.min(2, availableSizes.length));
      const selectedSizes = randomSelect(availableSizes, numSizes);
      
      for (let i = 0; i < selectedSizes.length; i++) {
        const sizeValue = selectedSizes[i];
        
        if (!sizeValue) continue;
        
        // Calculate volume in ml
        let volumeMl = product.volumeMl || 0;
        if (sizeValue.includes('cl')) {
          volumeMl = parseInt(sizeValue) * 10;
        } else if (sizeValue.includes('ml')) {
          const match = sizeValue.match(/\d+/);
          volumeMl = match ? parseInt(match[0]) : 0;
        } else if (sizeValue.includes('L') && !sizeValue.includes('cl')) {
          volumeMl = parseFloat(sizeValue) * 1000;
        }
        
        const stock = randomInt(20, 200);
        const lowStockThreshold = randomInt(5, 15);
        
        const size = await Size.create({
          subproduct: subProduct._id,
          size: sizeValue,
          displayName: `${sizeValue} Bottle`,
          sizeCategory: volumeMl < 100 ? 'miniature' :
                       volumeMl < 500 ? 'single_serve' :
                       volumeMl < 1000 ? 'standard' : 'large',
          unitType: 'volume_ml',
          volumeMl,
          sellingPrice: Math.round(subProduct.baseSellingPrice * (i === 0 ? 1 : 1 + (i * 0.3))),
          costPrice: Math.round(subProduct.costPrice * (i === 0 ? 1 : 1 + (i * 0.3))),
          compareAtPrice: Math.round(subProduct.baseSellingPrice * (i === 0 ? 1.2 : 1.2 + (i * 0.3))),
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
      skippedSubProducts++;
      continue;
    }
  }
  
  console.log(`✓ Created ${totalSizes} sizes`);
  if (skippedSubProducts > 0) {
    console.log(`  ⚠️  Skipped ${skippedSubProducts} subproducts due to errors`);
  }
}

// scripts/seed.js - Update createCustomers

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
        role: 'customer', // This role doesn't require tenant
        status: 'active',
        isEmailVerified: randomBool(0.8),
        isAgeVerified: randomBool(0.9),
        ageVerificationMethod: 'self_declaration',
        preferredCurrency: 'NGN',
        language: 'en',
        // Don't include tenant field for customers
      }, 'email');
      
      createdData.users.push(customer);
    } catch (error) {
      console.error(`  ✗ Failed to create customer ${email}:`, error.message);
      // Continue with next customer
    }
  }
  
  console.log(`✓ Created ${createdData.users.length - 1} customers`); // -1 for super admin
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
    
    // Verify environment variable
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set. Please check your .env file.');
    }
    
    console.log(`📡 Connecting to MongoDB...`);
    
    // Connect to database using the db module
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
    console.log(`   • Products: ${createdData.products.length} (with images)`);
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
    
    // Try to disconnect if connected
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
