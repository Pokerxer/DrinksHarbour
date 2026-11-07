const { additionalSizePresets, extraSizeCodes } = require('./businessSizePresets');
const { legacyAlcoholicTypes, legacyNonAlcoholicTypes, legacyBeverageTypes, legacyBeverageFamilies, legacyBeverageCategories } = require('./legacyBeverageTypes');
// constants/productTypes.js
const { expandedTypes } = require('./expandedProductTypes');

/**
 * Product Type Enums and Related Constants for DrinksHarbour
 * 
 * Comprehensive classification system for beverages and related products
 */

// ============================================================
// CORE PRODUCT TYPES
// ============================================================

/**
 * Main product type categories
 */
const PRODUCT_TYPES = {
  ...Object.fromEntries(legacyBeverageTypes.map(type => [type.toUpperCase(), type])),
  ...Object.fromEntries(expandedTypes.map(t => [t.value.toUpperCase(), t.value])),
  // Alcoholic Beverages - Beer & Cider
  BEER: 'beer',
  CRAFT_BEER: 'craft_beer',
  CIDER: 'cider',
  MEAD: 'mead',
  
  // Alcoholic Beverages - Wine
  WINE: 'wine',
  RED_WINE: 'red_wine',
  WHITE_WINE: 'white_wine',
  ROSE_WINE: 'rose_wine',
  SPARKLING_WINE: 'sparkling_wine',
  DESSERT_WINE: 'dessert_wine',
  FORTIFIED_WINE: 'fortified_wine',
  ORANGE_WINE: 'orange_wine',
  
  // Alcoholic Beverages - Spirits
  SPIRIT: 'spirit',
  WHISKEY: 'whiskey',
  VODKA: 'vodka',
  GIN: 'gin',
  RUM: 'rum',
  TEQUILA: 'tequila',
  COGNAC: 'cognac',
  BRANDY: 'brandy',
  MEZCAL: 'mezcal',
  SAKE: 'sake',
  SOJU: 'soju',
  BAIJIU: 'baijiu',
  
  // Alcoholic Beverages - Liqueurs & Others
  LIQUEUR: 'liqueur',
  CREAM_LIQUEUR: 'cream_liqueur',
  ABSINTHE: 'absinthe',
  APERITIF: 'aperitif',
  VERMOUTH: 'vermouth',
  BITTERS: 'bitters',
  AMARO: 'amaro',
  
  // Ready-to-Drink Alcoholic
  COCKTAIL_RTD: 'cocktail_ready_to_drink',
  HARD_SELTZER: 'hard_seltzer',
  ALCOPOP: 'alcopop',
  PREMIX: 'premix',
  
  // Non-Alcoholic Beverages
  NON_ALCOHOLIC: 'non_alcoholic',
  NON_ALCOHOLIC_BEER: 'non_alcoholic_beer',
  NON_ALCOHOLIC_WINE: 'non_alcoholic_wine',
  NON_ALCOHOLIC_SPIRITS: 'non_alcoholic_spirits',
  MOCKTAIL_RTD: 'mocktail_ready_to_drink',
  
  // Soft Drinks & Carbonated
  SOFT_DRINK: 'soft_drink',
  COLA: 'cola',
  LEMONADE: 'lemonade',
  TONIC_WATER: 'tonic_water',
  GINGER_ALE: 'ginger_ale',
  GINGER_BEER: 'ginger_beer',
  SODA_WATER: 'soda_water',
  FLAVORED_SPARKLING: 'flavored_sparkling_water',
  
  // Juices & Fruit Drinks
  JUICE: 'juice',
  FRUIT_JUICE: 'fruit_juice',
  VEGETABLE_JUICE: 'vegetable_juice',
  JUICE_BLEND: 'juice_blend',
  NECTAR: 'nectar',
  SMOOTHIE: 'smoothie',
  
  // Water
  WATER: 'water',
  STILL_WATER: 'still_water',
  SPARKLING_WATER: 'sparkling_water',
  MINERAL_WATER: 'mineral_water',
  FLAVORED_WATER: 'flavored_water',
  ALKALINE_WATER: 'alkaline_water',
  
  // Hot Beverages
  COFFEE: 'coffee',
  INSTANT_COFFEE: 'instant_coffee',
  GROUND_COFFEE: 'ground_coffee',
  COFFEE_BEANS: 'coffee_beans',
  COFFEE_PODS: 'coffee_pods',
  COLD_BREW: 'cold_brew',
  ICED_COFFEE: 'iced_coffee',
  
  TEA: 'tea',
  BLACK_TEA: 'black_tea',
  GREEN_TEA: 'green_tea',
  HERBAL_TEA: 'herbal_tea',
  OOLONG_TEA: 'oolong_tea',
  WHITE_TEA: 'white_tea',
  MATCHA: 'matcha',
  CHAI: 'chai',
  ICED_TEA: 'iced_tea',
  
  HOT_CHOCOLATE: 'hot_chocolate',
  DRINKING_CHOCOLATE: 'drinking_chocolate',
  
  // Dairy & Plant-Based
  MILK: 'milk',
  DAIRY_MILK: 'dairy_milk',
  FLAVORED_MILK: 'flavored_milk',
  PLANT_MILK: 'plant_milk',
  ALMOND_MILK: 'almond_milk',
  OAT_MILK: 'oat_milk',
  COCONUT_MILK: 'coconut_milk',
  SOY_MILK: 'soy_milk',
  
  // Energy & Sports
  ENERGY_DRINK: 'energy_drink',
  SPORTS_DRINK: 'sports_drink',
  PROTEIN_DRINK: 'protein_drink',
  ISOTONIC_DRINK: 'isotonic_drink',
  VITAMIN_DRINK: 'vitamin_drink',
  
  // Mixers & Ingredients
  MIXER: 'mixer',
  SIMPLE_SYRUP: 'simple_syrup',
  GRENADINE: 'grenadine',
  CORDIAL: 'cordial',
  SHRUB: 'shrub',
  BITTERS_MIXER: 'bitters_mixer',
  
  // Kombucha & Fermented
  KOMBUCHA: 'kombucha',
  KEFIR: 'kefir',
  KVASS: 'kvass',
  TEPACHE: 'tepache',
  
  // Specialty & Functional
  FUNCTIONAL_DRINK: 'functional_drink',
  WELLNESS_DRINK: 'wellness_drink',
  CBD_DRINK: 'cbd_drink',
  ADAPTOGEN_DRINK: 'adaptogen_drink',
  PROBIOTIC_DRINK: 'probiotic_drink',
  
  // Accessories & Related
  GLASSWARE: 'glassware',
  BAR_TOOL: 'bar_tool',
  COCKTAIL_KIT: 'cocktail_kit',
  GARNISH: 'garnish',
  ICE_MOLD: 'ice_mold',
  COASTER: 'coaster',
  DECANTER: 'decanter',
  AERATOR: 'aerator',
  
  // Age-restricted non-beverage devices
  VAPE: 'vape',

  // Snacks & Pairings
  SNACK: 'snack',
  NUTS: 'nuts',
  CHEESE: 'cheese',
  CHOCOLATE: 'chocolate',
  CRACKERS: 'crackers',
  DRIED_FRUIT: 'dried_fruit',
  
  // Gift & Bundles
  GIFT_SET: 'gift_set',
  GIFT_BASKET: 'gift_basket',
  TASTING_SET: 'tasting_set',
  BUNDLE: 'bundle',
  
  // Other
  OTHER: 'other',
};

/**
 * Array of all product types (for enum validation)
 */
const PRODUCT_TYPE_VALUES = Object.values(PRODUCT_TYPES);

// ============================================================
// TYPE CATEGORIES & GROUPINGS
// ============================================================

/**
 * Alcoholic beverage types
 */
const ALCOHOLIC_TYPES = [...new Set([
  ...legacyAlcoholicTypes,
  ...expandedTypes.filter(t=>t.alcoholic && !['baijiu'].includes(t.value)).map(t=>t.value),
  PRODUCT_TYPES.BEER,
  PRODUCT_TYPES.CRAFT_BEER,
  PRODUCT_TYPES.CIDER,
  PRODUCT_TYPES.MEAD,
  PRODUCT_TYPES.WINE,
  PRODUCT_TYPES.RED_WINE,
  PRODUCT_TYPES.WHITE_WINE,
  PRODUCT_TYPES.ROSE_WINE,
  PRODUCT_TYPES.SPARKLING_WINE,
  PRODUCT_TYPES.DESSERT_WINE,
  PRODUCT_TYPES.FORTIFIED_WINE,
  PRODUCT_TYPES.ORANGE_WINE,
  PRODUCT_TYPES.SPIRIT,
  PRODUCT_TYPES.WHISKEY,
  PRODUCT_TYPES.VODKA,
  PRODUCT_TYPES.GIN,
  PRODUCT_TYPES.RUM,
  PRODUCT_TYPES.TEQUILA,
  PRODUCT_TYPES.COGNAC,
  PRODUCT_TYPES.BRANDY,
  PRODUCT_TYPES.MEZCAL,
  PRODUCT_TYPES.SAKE,
  PRODUCT_TYPES.SOJU,
  PRODUCT_TYPES.BAIJIU,
  PRODUCT_TYPES.LIQUEUR,
  PRODUCT_TYPES.CREAM_LIQUEUR,
  PRODUCT_TYPES.ABSINTHE,
  PRODUCT_TYPES.APERITIF,
  PRODUCT_TYPES.VERMOUTH,
  PRODUCT_TYPES.BITTERS,
  PRODUCT_TYPES.AMARO,
  PRODUCT_TYPES.COCKTAIL_RTD,
  PRODUCT_TYPES.HARD_SELTZER,
  PRODUCT_TYPES.ALCOPOP,
  PRODUCT_TYPES.PREMIX,
])];

/**
 * Non-alcoholic beverage types
 */
const NON_ALCOHOLIC_TYPES = [...new Set([
  ...legacyNonAlcoholicTypes,
  ...expandedTypes.filter(t=>!t.alcoholic && t.beverage).map(t=>t.value),
  PRODUCT_TYPES.NON_ALCOHOLIC,
  PRODUCT_TYPES.NON_ALCOHOLIC_BEER,
  PRODUCT_TYPES.NON_ALCOHOLIC_WINE,
  PRODUCT_TYPES.NON_ALCOHOLIC_SPIRITS,
  PRODUCT_TYPES.MOCKTAIL_RTD,
  PRODUCT_TYPES.SOFT_DRINK,
  PRODUCT_TYPES.COLA,
  PRODUCT_TYPES.LEMONADE,
  PRODUCT_TYPES.TONIC_WATER,
  PRODUCT_TYPES.GINGER_ALE,
  PRODUCT_TYPES.GINGER_BEER,
  PRODUCT_TYPES.SODA_WATER,
  PRODUCT_TYPES.FLAVORED_SPARKLING,
  PRODUCT_TYPES.JUICE,
  PRODUCT_TYPES.FRUIT_JUICE,
  PRODUCT_TYPES.VEGETABLE_JUICE,
  PRODUCT_TYPES.JUICE_BLEND,
  PRODUCT_TYPES.NECTAR,
  PRODUCT_TYPES.SMOOTHIE,
  PRODUCT_TYPES.WATER,
  PRODUCT_TYPES.STILL_WATER,
  PRODUCT_TYPES.SPARKLING_WATER,
  PRODUCT_TYPES.MINERAL_WATER,
  PRODUCT_TYPES.FLAVORED_WATER,
  PRODUCT_TYPES.ALKALINE_WATER,
  PRODUCT_TYPES.COFFEE,
  PRODUCT_TYPES.INSTANT_COFFEE,
  PRODUCT_TYPES.GROUND_COFFEE,
  PRODUCT_TYPES.COFFEE_BEANS,
  PRODUCT_TYPES.COFFEE_PODS,
  PRODUCT_TYPES.COLD_BREW,
  PRODUCT_TYPES.ICED_COFFEE,
  PRODUCT_TYPES.TEA,
  PRODUCT_TYPES.BLACK_TEA,
  PRODUCT_TYPES.GREEN_TEA,
  PRODUCT_TYPES.HERBAL_TEA,
  PRODUCT_TYPES.OOLONG_TEA,
  PRODUCT_TYPES.WHITE_TEA,
  PRODUCT_TYPES.MATCHA,
  PRODUCT_TYPES.CHAI,
  PRODUCT_TYPES.ICED_TEA,
  PRODUCT_TYPES.HOT_CHOCOLATE,
  PRODUCT_TYPES.DRINKING_CHOCOLATE,
  PRODUCT_TYPES.MILK,
  PRODUCT_TYPES.DAIRY_MILK,
  PRODUCT_TYPES.FLAVORED_MILK,
  PRODUCT_TYPES.PLANT_MILK,
  PRODUCT_TYPES.ALMOND_MILK,
  PRODUCT_TYPES.OAT_MILK,
  PRODUCT_TYPES.COCONUT_MILK,
  PRODUCT_TYPES.SOY_MILK,
  PRODUCT_TYPES.ENERGY_DRINK,
  PRODUCT_TYPES.SPORTS_DRINK,
  PRODUCT_TYPES.PROTEIN_DRINK,
  PRODUCT_TYPES.ISOTONIC_DRINK,
  PRODUCT_TYPES.VITAMIN_DRINK,
  PRODUCT_TYPES.KOMBUCHA,
  PRODUCT_TYPES.KEFIR,
  PRODUCT_TYPES.KVASS,
  PRODUCT_TYPES.TEPACHE,
  PRODUCT_TYPES.FUNCTIONAL_DRINK,
  PRODUCT_TYPES.WELLNESS_DRINK,
  PRODUCT_TYPES.CBD_DRINK,
  PRODUCT_TYPES.ADAPTOGEN_DRINK,
  PRODUCT_TYPES.PROBIOTIC_DRINK,
])];

/**
 * Beverage types (all drinks)
 */
const BEVERAGE_TYPES = [...ALCOHOLIC_TYPES, ...NON_ALCOHOLIC_TYPES, PRODUCT_TYPES.MIXER];

/**
 * Non-beverage product types
 */
const NON_BEVERAGE_TYPES = [
  ...expandedTypes.filter(t=>!t.beverage).map(t=>t.value),
  PRODUCT_TYPES.VAPE,
  PRODUCT_TYPES.GLASSWARE,
  PRODUCT_TYPES.BAR_TOOL,
  PRODUCT_TYPES.COCKTAIL_KIT,
  PRODUCT_TYPES.GARNISH,
  PRODUCT_TYPES.ICE_MOLD,
  PRODUCT_TYPES.COASTER,
  PRODUCT_TYPES.DECANTER,
  PRODUCT_TYPES.AERATOR,
  PRODUCT_TYPES.SNACK,
  PRODUCT_TYPES.NUTS,
  PRODUCT_TYPES.CHEESE,
  PRODUCT_TYPES.CHOCOLATE,
  PRODUCT_TYPES.CRACKERS,
  PRODUCT_TYPES.DRIED_FRUIT,
  PRODUCT_TYPES.GIFT_SET,
  PRODUCT_TYPES.GIFT_BASKET,
  PRODUCT_TYPES.TASTING_SET,
  PRODUCT_TYPES.BUNDLE,
];

/**
 * Type categories for filtering
 */
const TYPE_CATEGORIES = {
  BEER_AND_CIDER: {
    name: 'Beer & Cider',
    types: [
      PRODUCT_TYPES.BEER,
      PRODUCT_TYPES.CRAFT_BEER,
      PRODUCT_TYPES.CIDER,
      PRODUCT_TYPES.MEAD,
      PRODUCT_TYPES.NON_ALCOHOLIC_BEER,
    ],
  },
  
  WINE: {
    name: 'Wine',
    types: [
      PRODUCT_TYPES.WINE,
      PRODUCT_TYPES.RED_WINE,
      PRODUCT_TYPES.WHITE_WINE,
      PRODUCT_TYPES.ROSE_WINE,
      PRODUCT_TYPES.SPARKLING_WINE,
      PRODUCT_TYPES.DESSERT_WINE,
      PRODUCT_TYPES.FORTIFIED_WINE,
      PRODUCT_TYPES.ORANGE_WINE,
      PRODUCT_TYPES.NON_ALCOHOLIC_WINE,
    ],
  },
  
  SPIRITS: {
    name: 'Spirits',
    types: [
      PRODUCT_TYPES.SPIRIT,
      PRODUCT_TYPES.WHISKEY,
      PRODUCT_TYPES.VODKA,
      PRODUCT_TYPES.GIN,
      PRODUCT_TYPES.RUM,
      PRODUCT_TYPES.TEQUILA,
      PRODUCT_TYPES.COGNAC,
      PRODUCT_TYPES.BRANDY,
      PRODUCT_TYPES.MEZCAL,
      PRODUCT_TYPES.SAKE,
      PRODUCT_TYPES.SOJU,
      PRODUCT_TYPES.BAIJIU,
      PRODUCT_TYPES.NON_ALCOHOLIC_SPIRITS,
    ],
  },
  
  LIQUEURS: {
    name: 'Liqueurs & Aperitifs',
    types: [
      PRODUCT_TYPES.LIQUEUR,
      PRODUCT_TYPES.CREAM_LIQUEUR,
      PRODUCT_TYPES.ABSINTHE,
      PRODUCT_TYPES.APERITIF,
      PRODUCT_TYPES.VERMOUTH,
      PRODUCT_TYPES.BITTERS,
      PRODUCT_TYPES.AMARO,
    ],
  },
  
  RTD: {
    name: 'Ready to Drink',
    types: [
      PRODUCT_TYPES.COCKTAIL_RTD,
      PRODUCT_TYPES.HARD_SELTZER,
      PRODUCT_TYPES.ALCOPOP,
      PRODUCT_TYPES.PREMIX,
      PRODUCT_TYPES.MOCKTAIL_RTD,
    ],
  },
  
  SOFT_DRINKS: {
    name: 'Soft Drinks',
    types: [
      PRODUCT_TYPES.SOFT_DRINK,
      PRODUCT_TYPES.COLA,
      PRODUCT_TYPES.LEMONADE,
      PRODUCT_TYPES.TONIC_WATER,
      PRODUCT_TYPES.GINGER_ALE,
      PRODUCT_TYPES.GINGER_BEER,
      PRODUCT_TYPES.SODA_WATER,
      PRODUCT_TYPES.FLAVORED_SPARKLING,
    ],
  },
  
  WATER: {
    name: 'Water',
    types: [
      PRODUCT_TYPES.WATER,
      PRODUCT_TYPES.STILL_WATER,
      PRODUCT_TYPES.SPARKLING_WATER,
      PRODUCT_TYPES.MINERAL_WATER,
      PRODUCT_TYPES.FLAVORED_WATER,
      PRODUCT_TYPES.ALKALINE_WATER,
    ],
  },
  
  JUICE: {
    name: 'Juices & Smoothies',
    types: [
      PRODUCT_TYPES.JUICE,
      PRODUCT_TYPES.FRUIT_JUICE,
      PRODUCT_TYPES.VEGETABLE_JUICE,
      PRODUCT_TYPES.JUICE_BLEND,
      PRODUCT_TYPES.NECTAR,
      PRODUCT_TYPES.SMOOTHIE,
    ],
  },
  
  COFFEE: {
    name: 'Coffee',
    types: [
      PRODUCT_TYPES.COFFEE,
      PRODUCT_TYPES.INSTANT_COFFEE,
      PRODUCT_TYPES.GROUND_COFFEE,
      PRODUCT_TYPES.COFFEE_BEANS,
      PRODUCT_TYPES.COFFEE_PODS,
      PRODUCT_TYPES.COLD_BREW,
      PRODUCT_TYPES.ICED_COFFEE,
    ],
  },
  
  TEA: {
    name: 'Tea',
    types: [
      PRODUCT_TYPES.TEA,
      PRODUCT_TYPES.BLACK_TEA,
      PRODUCT_TYPES.GREEN_TEA,
      PRODUCT_TYPES.HERBAL_TEA,
      PRODUCT_TYPES.OOLONG_TEA,
      PRODUCT_TYPES.WHITE_TEA,
      PRODUCT_TYPES.MATCHA,
      PRODUCT_TYPES.CHAI,
      PRODUCT_TYPES.ICED_TEA,
    ],
  },
  
  MILK: {
    name: 'Milk & Plant-Based',
    types: [
      PRODUCT_TYPES.MILK,
      PRODUCT_TYPES.DAIRY_MILK,
      PRODUCT_TYPES.FLAVORED_MILK,
      PRODUCT_TYPES.PLANT_MILK,
      PRODUCT_TYPES.ALMOND_MILK,
      PRODUCT_TYPES.OAT_MILK,
      PRODUCT_TYPES.COCONUT_MILK,
      PRODUCT_TYPES.SOY_MILK,
    ],
  },
  
  ENERGY_SPORTS: {
    name: 'Energy & Sports Drinks',
    types: [
      PRODUCT_TYPES.ENERGY_DRINK,
      PRODUCT_TYPES.SPORTS_DRINK,
      PRODUCT_TYPES.PROTEIN_DRINK,
      PRODUCT_TYPES.ISOTONIC_DRINK,
      PRODUCT_TYPES.VITAMIN_DRINK,
    ],
  },
  
  FERMENTED: {
    name: 'Fermented & Probiotic',
    types: [
      PRODUCT_TYPES.KOMBUCHA,
      PRODUCT_TYPES.KEFIR,
      PRODUCT_TYPES.KVASS,
      PRODUCT_TYPES.TEPACHE,
      PRODUCT_TYPES.PROBIOTIC_DRINK,
    ],
  },
  
  FUNCTIONAL: {
    name: 'Functional & Wellness',
    types: [
      PRODUCT_TYPES.FUNCTIONAL_DRINK,
      PRODUCT_TYPES.WELLNESS_DRINK,
      PRODUCT_TYPES.CBD_DRINK,
      PRODUCT_TYPES.ADAPTOGEN_DRINK,
    ],
  },
  
  MIXERS: {
    name: 'Mixers & Ingredients',
    types: [
      PRODUCT_TYPES.MIXER,
      PRODUCT_TYPES.SIMPLE_SYRUP,
      PRODUCT_TYPES.GRENADINE,
      PRODUCT_TYPES.CORDIAL,
      PRODUCT_TYPES.SHRUB,
      PRODUCT_TYPES.BITTERS_MIXER,
    ],
  },
  
  ACCESSORIES: {
    name: 'Bar Accessories',
    types: [
      PRODUCT_TYPES.GLASSWARE,
      PRODUCT_TYPES.BAR_TOOL,
      PRODUCT_TYPES.COCKTAIL_KIT,
      PRODUCT_TYPES.GARNISH,
      PRODUCT_TYPES.ICE_MOLD,
      PRODUCT_TYPES.COASTER,
      PRODUCT_TYPES.DECANTER,
      PRODUCT_TYPES.AERATOR,
    ],
  },
  
  VAPES: {
    name: 'Vapes & E-cigarettes',
    types: [PRODUCT_TYPES.VAPE],
  },

  SNACKS: {
    name: 'Snacks & Pairings',
    types: [
      PRODUCT_TYPES.SNACK,
      PRODUCT_TYPES.NUTS,
      PRODUCT_TYPES.CHEESE,
      PRODUCT_TYPES.CHOCOLATE,
      PRODUCT_TYPES.CRACKERS,
      PRODUCT_TYPES.DRIED_FRUIT,
    ],
  },
  
  GIFTS: {
    name: 'Gifts & Sets',
    types: [
      PRODUCT_TYPES.GIFT_SET,
      PRODUCT_TYPES.GIFT_BASKET,
      PRODUCT_TYPES.TASTING_SET,
      PRODUCT_TYPES.BUNDLE,
    ],
  },

  // ── Retail verticals (2026-11-02, additive) ───────────────────────────────
  // Group keys match constants/generalProductTypes.js retailTypes[].group;
  // the additive loop below pushes each prefixed type into its group here.
  // All retail types stay out of ALCOHOLIC/NON_ALCOHOLIC/BEVERAGE lists via
  // the expandedTypes beverage/alcoholic filters (beverage=false).
  ELECTRONICS: {
    name: 'Electronics',
    types: [],
  },
  FASHION: {
    name: 'Fashion',
    types: [],
  },
  BEAUTY: {
    name: 'Beauty',
    types: [],
  },
  HOME: {
    name: 'Home',
    types: [],
  },
  // ── Food Service & Venue verticals (2026-11-02, additive) ─────────────────
  // POPULATED BY THE SAME ADDITIVE LOOP BELOW from constants/
  // generalProductTypes.js (groups FOODSERVICE/HOSPITALITY). Prepared food is
  // NOT a type here: prepared_beverage/prepared_food remain catalog KINDS and
  // the venue docs' menu machinery governs restaurant items (catalogKind.js).
  FOODSERVICE: {
    name: 'Food Service & Venue',
    types: [],
  },
  HOSPITALITY: {
    name: 'Hospitality & Tobacco',
    types: [],
  },
};

// Preserve existing category assignments; fill only previously ungrouped legacy types.
TYPE_CATEGORIES.COCOA = { name: 'Cocoa & Chocolate Drinks', types: [] };
for (const [type, category] of Object.entries(legacyBeverageCategories)) {
  const group = TYPE_CATEGORIES[category];
  if (group && !Object.values(TYPE_CATEGORIES).some(existing => existing.types.includes(type))) {
    group.types.push(type);
  }
}

for (const type of expandedTypes) {
  const group = TYPE_CATEGORIES[type.group];
  if (group && !group.types.includes(type.value)) group.types.push(type.value);
}


// ============================================================
// SUB-TYPES & STYLES
// ============================================================

/**
 * Beer sub-types and styles
 */
const BEER_SUBTYPES = [
  'Lager',
  'Pale Lager',
  'Pilsner',
  'Ale',
  'Pale Ale',
  'IPA',
  'Double IPA',
  'Session IPA',
  'New England IPA',
  'West Coast IPA',
  'Stout',
  'Dry Stout',
  'Imperial Stout',
  'Porter',
  'Wheat Beer',
  'Hefeweizen',
  'Witbier',
  'Saison',
  'Belgian Ale',
  'Tripel',
  'Dubbel',
  'Quadrupel',
  'Sour Beer',
  'Gose',
  'Berliner Weisse',
  'Lambic',
  'Amber Ale',
  'Brown Ale',
  'Scottish Ale',
  'Barley Wine',
  'Bock',
  'Doppelbock',
  'Dunkel',
  'Märzen',
  'Rauchbier',
  'Kölsch',
  'Cream Ale',
  'Blonde Ale',
];

/**
 * Wine sub-types and styles
 */
const WINE_SUBTYPES = [
  // Red Wine
  'Cabernet Sauvignon',
  'Merlot',
  'Pinot Noir',
  'Syrah',
  'Shiraz',
  'Malbec',
  'Zinfandel',
  'Sangiovese',
  'Tempranillo',
  'Nebbiolo',
  'Grenache',
  'Barbera',
  'Petite Sirah',
  'Cabernet Franc',
  'Carménère',
  'Pinotage',
  
  // White Wine
  'Chardonnay',
  'Sauvignon Blanc',
  'Riesling',
  'Pinot Grigio',
  'Pinot Gris',
  'Moscato',
  'Gewürztraminer',
  'Viognier',
  'Chenin Blanc',
  'Albariño',
  'Grüner Veltliner',
  'Vermentino',
  'Torrontés',
  'Semillon',
  
  // Rosé
  'Provence Rosé',
  'Spanish Rosado',
  'White Zinfandel',
  
  // Sparkling
  'Champagne',
  'Prosecco',
  'Cava',
  'Crémant',
  'Franciacorta',
  'Sekt',
  'Asti Spumante',
  
  // Dessert & Fortified
  'Port',
  'Sherry',
  'Madeira',
  'Marsala',
  'Ice Wine',
  'Late Harvest',
  'Sauternes',
  'Tokaji',
];

/**
 * Spirit sub-types
 */
const SPIRIT_SUBTYPES = {
  whiskey: [
    'Scotch',
    'Irish Whiskey',
    'Bourbon',
    'Tennessee Whiskey',
    'Rye Whiskey',
    'Canadian Whisky',
    'Japanese Whisky',
    'Single Malt',
    'Blended Scotch',
    'Single Grain',
    'Blended Malt',
    'Cask Strength',
  ],
  vodka: [
    'Plain Vodka',
    'Flavored Vodka',
    'Premium Vodka',
    'Potato Vodka',
    'Wheat Vodka',
    'Rye Vodka',
    'Corn Vodka',
  ],
  gin: [
    'London Dry Gin',
    'Plymouth Gin',
    'Old Tom Gin',
    'Genever',
    'Navy Strength Gin',
    'Contemporary Gin',
    'Flavored Gin',
    'Sloe Gin',
  ],
  rum: [
    'White Rum',
    'Gold Rum',
    'Dark Rum',
    'Spiced Rum',
    'Aged Rum',
    'Overproof Rum',
    'Rhum Agricole',
    'Cachaça',
  ],
  tequila: [
    'Blanco',
    'Reposado',
    'Añejo',
    'Extra Añejo',
    'Cristalino',
    'Joven',
  ],
  cognac: [
    'VS',
    'VSOP',
    'XO',
    'XXO',
    'Napoleon',
  ],
};

// ============================================================
// SIZE & PACKAGING CONSTANTS
// ============================================================

/**
 * Standard beverage sizes
 */
const STANDARD_SIZES = {
  // Metric volumes
  MICRO_BOTTLES: ['5cl', '10cl', '20cl'],
  STANDARD_BOTTLES: ['25cl', '33cl', '35cl', '37.5cl', '50cl'],
  WINE_BOTTLES: ['75cl', 'bottle-750ml'],
  LARGE_BOTTLES: ['1L', '1.5L', '2L', '3L', '4.5L', '5L', '10L'],
  
  // Special wine sizes
  WINE_SIZES: [
    'split-187ml',      // Quarter bottle
    'half-375ml',       // Half bottle
    'standard-750ml',   // Standard bottle
    'magnum',          // 1.5L (2 bottles)
    'jeroboam',        // 3L (4 bottles)
    'rehoboam',        // 4.5L (6 bottles)
    'methuselah',      // 6L (8 bottles)
    'salmanazar',      // 9L (12 bottles)
    'balthazar',       // 12L (16 bottles)
    'nebuchadnezzar',  // 15L (20 bottles)
  ],
  
  // Cans
  CANS: ['can-250ml', 'can-330ml', 'can-355ml', 'can-440ml', 'can-500ml'],
  
  // Kegs
  KEGS: ['keg-20L', 'keg-30L', 'keg-50L'],
  
  // Packs
  PACKS: ['pack-4', 'pack-6', 'pack-12', 'pack-24', 'case-24'],
  
  // Non-beverage sizes
  WEIGHT: ['240g', 'kg-0.25', 'kg-0.5', 'kg-1', 'kg-2'],
  UNITS: ['unit-single', 'unit-pair', 'set-4', 'set-6', 'set-8'],
  HOME_SETS: ['unit-single', 'set-2', 'set-4', 'set-6', 'set-8', 'set-12'],
  
  // Gifts, Lifestyle & Snacks — count / piece / set / bar / bag / tin based
  GIFTS_AND_LIFESTYLE: [
    'piece-single', 'pair', 'unit-single',
    'set-2', 'set-3', 'set-4', 'set-6', 'set-12',
    'gift-set', 'tasting-set', 'variety-pack',
    'box-single', 'box-5', 'box-10', 'box-20', 'box-24', 'box-25', 'box-50',
    'pack-2', 'pack-3', 'pack-5',
    'kit-3', 'kit-5', 'kit-8', 'kit-10',
    'bar-single', 'bar-2',
    'bag-100g', 'bag-200g', 'bag-250g', 'bag-500g', 'bag-1kg',
    'tin-single', 'tin-200g', 'tin-500g',
  ],

  // ── Retail verticals (2026-11-02) — CANONICAL Size enum additions ────────
  // Contract with the schema agent: models/Size.js must accept exactly these
  // strings for the retail verticals. Coordinate EXACTLY — these arrays are
  // what getSizesForType returns and what the admin size pickers mirror.
  // (Size.js had not landed the additions when this was written; these exact
  // strings are declared here so both sides stay in lock-step.)
  APPAREL: ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', 'one_size'],
  // Fashion sizing systems (2026-11-03): numeric US dress sizes, jeans
  // waist/inseam, kids ages — every string is added to the Size enum (see
  // models/Size.js FASHION block) and mirrored by the admin size pickers.
  NUMERIC_US: ['us-0', 'us-2', 'us-4', 'us-6', 'us-8', 'us-10', 'us-12', 'us-14', 'us-16', 'us-18'],
  WAIST: ['w28', 'w30', 'w32', 'w34', 'w36', 'w38', 'w40'],
  INSEAM: ['l30', 'l32', 'l34', 'l36'],
  KIDS_AGE: ['kids-2-3', 'kids-4-5', 'kids-6-7', 'kids-8-9', 'kids-10-11', 'kids-12-13'],
  SHOES: [
    'eu-35', 'eu-36', 'eu-37', 'eu-38', 'eu-39', 'eu-40', 'eu-41', 'eu-42',
    'eu-43', 'eu-44', 'eu-45', 'eu-46', 'eu-47',
    'us-m-6', 'us-m-7', 'us-m-8', 'us-m-8.5', 'us-m-9', 'us-m-10', 'us-m-11',
    'us-m-12', 'us-m-13',
    'us-w-4', 'us-w-5', 'us-w-6', 'us-w-7', 'us-w-8', 'us-w-9', 'us-w-10',
    'us-w-11', 'us-w-12',
  ],
  STORAGE: [
    'storage-16gb', 'storage-32gb', 'storage-64gb', 'storage-128gb',
    'storage-256gb', 'storage-512gb', 'storage-1tb', 'storage-2tb',
    'storage-4tb',
  ],
  // Electronics sizing systems (2026-11-03): screen inches for TVs/monitors,
  // RAM for computers, battery capacity for power gear — mirrored into the
  // Size enum (models/Size.js) exactly like the fashion systems.
  SCREEN_INCH: ['screen-24', 'screen-32', 'screen-43', 'screen-50', 'screen-55', 'screen-65', 'screen-75', 'screen-85'],
  LAPTOP_SCREEN_INCH: [
    'screen-12.5', 'screen-13', 'screen-13.3', 'screen-14', 'screen-15',
    'screen-15.6', 'screen-16', 'screen-17.3', 'screen-18',
  ],
  TABLET_SCREEN_INCH: [
    'screen-7', 'screen-8', 'screen-8.7', 'screen-9', 'screen-10.1',
    'screen-10.9', 'screen-11', 'screen-12.4', 'screen-12.9', 'screen-13',
  ],
  RAM: ['ram-4gb', 'ram-8gb', 'ram-16gb', 'ram-32gb', 'ram-64gb'],
  BATTERY: ['battery-5000mah', 'battery-10000mah', 'battery-20000mah', 'battery-26800mah'],
  // Beauty volumes reuse Size strings that ALREADY exist (vape ml sizes /
  // soft-drink ml sizes), so no Size enum change is required for beauty.
  BEAUTY: ['15ml', '30ml', '50ml', '100ml', '200ml', '250ml', '500ml'],

  // ── Food Service & Venue (2026-11-02) — NO Size enum additions needed ────
  // Every string below was verified against models/Size.js enumValues.
  // Honest drift note: the legacy WEIGHT list above contains 'kg-0.25', which
  // is NOT in the Size enum — pre-existing, out of scope for this round; the
  // new lists deliberately avoid it so every new guidance string validates.
  FOODSERVICE: [
    '250g', '500g', '1kg', '2kg',
    'kg-0.5', 'kg-1', 'kg-2',
    'bag-100g', 'bag-200g', 'bag-250g', 'bag-500g', 'bag-1kg',
    'tin-single', 'tin-200g', 'tin-500g',
    'box-single', 'box-5', 'box-10', 'box-24',
    'case-6', 'case-12', 'case-24',
  ],
  SHISHA_MOLASSES: [
    'bag-100g', 'bag-200g', 'bag-250g', 'bag-500g', 'bag-1kg',
    '250g', '500g', 'kg-0.5', 'kg-1', 'kg-2',
  ],
  HOSPITALITY_CHARCOAL: [
    'bag-100g', 'bag-200g', 'bag-250g', 'bag-500g', 'bag-1kg',
    'kg-0.5', 'kg-1', 'kg-2',
  ],
  HOSPITALITY_CIGAR: [
    'cigar-single', 'sampler-5', 'sampler-6',
    'box-5', 'box-10', 'box-20', 'box-25', 'box-50',
  ],
  HOSPITALITY_UNIT: ['unit-single'],
};

/**
 * All valid size enum values
 */
const ALL_SIZE_ENUMS = [...new Set([
  ...extraSizeCodes,
  ...STANDARD_SIZES.MICRO_BOTTLES,
  ...STANDARD_SIZES.STANDARD_BOTTLES,
  ...STANDARD_SIZES.WINE_BOTTLES,
  ...STANDARD_SIZES.LARGE_BOTTLES,
  ...STANDARD_SIZES.WINE_SIZES,
  ...STANDARD_SIZES.CANS,
  ...STANDARD_SIZES.KEGS,
  ...STANDARD_SIZES.PACKS,
  ...STANDARD_SIZES.WEIGHT,
  ...STANDARD_SIZES.UNITS,
  ...STANDARD_SIZES.GIFTS_AND_LIFESTYLE,
  // Retail vertical canonical strings (see comments on STANDARD_SIZES above)
  ...STANDARD_SIZES.APPAREL,
  ...STANDARD_SIZES.SHOES,
  ...STANDARD_SIZES.STORAGE,
  ...STANDARD_SIZES.BEAUTY,
  // Fashion sizing systems (2026-11-03)
  ...STANDARD_SIZES.NUMERIC_US,
  ...STANDARD_SIZES.WAIST,
  ...STANDARD_SIZES.INSEAM,
  ...STANDARD_SIZES.KIDS_AGE,
  // Electronics sizing systems (2026-11-03)
  ...STANDARD_SIZES.SCREEN_INCH,
  ...new Set([...STANDARD_SIZES.LAPTOP_SCREEN_INCH, ...STANDARD_SIZES.TABLET_SCREEN_INCH]),
  ...STANDARD_SIZES.RAM,
  ...STANDARD_SIZES.BATTERY,
])];

// Per-type guidance for the HOSPITALITY deliverables that must NOT fall into
// the generic sizeKind branches in getSizesForType: shisha molasses/charcoal
// use the bag-weight strings (NOT cosmetic ml volumes), cigars keep their
// legacy cigar sizes, and shisha kits are a single unit.
const FOODSERVICE_SIZE_GUIDANCE = {
  foodservice_bakery: ['unit-single', 'pack-6', 'pack-12', ...STANDARD_SIZES.FOODSERVICE],
  foodservice_dairy: [
    '250ml', '500ml', '1L', '2L', '5L', 'pack-6', 'pack-12', 'pack-30',
    ...STANDARD_SIZES.FOODSERVICE,
  ],
  foodservice_disposables: [
    'unit-single', 'pack-12', 'pack-24', 'pack-36', 'box-single',
    'box-5', 'box-10', 'box-24', 'case-6', 'case-12', 'case-24',
  ],
  foodservice_cleaning: ['500ml', '1L', '2L', '5L', ...STANDARD_SIZES.FOODSERVICE],
  foodservice_kitchen_smallware: ['unit-single', 'set-2', 'set-4', 'set-6', 'set-12'],
  foodservice_tabletop_bar: ['unit-single', 'set-2', 'set-4', 'set-6', 'set-12', 'case-12', 'case-24'],
  foodservice_janitorial: ['unit-single', 'pack-6', 'pack-12', 'case-12', 'case-24'],
  foodservice_equipment: ['unit-single'],
};

const HOSPITALITY_SIZE_GUIDANCE = {
  hospitality_shisha_kit: STANDARD_SIZES.HOSPITALITY_UNIT,
  hospitality_shisha_flavour: STANDARD_SIZES.SHISHA_MOLASSES,
  hospitality_charcoal: STANDARD_SIZES.HOSPITALITY_CHARCOAL,
  hospitality_cigar: STANDARD_SIZES.HOSPITALITY_CIGAR,
  hospitality_shisha_accessory: ['unit-single', 'pack-6', 'pack-12', 'pack-24'],
  hospitality_cigar_accessory: STANDARD_SIZES.HOSPITALITY_UNIT,
  hospitality_cigar_storage: STANDARD_SIZES.HOSPITALITY_UNIT,
  hospitality_venue_apparel: ['unit-single', ...STANDARD_SIZES.APPAREL],
  hospitality_venue_drinkware: ['unit-single', 'set-2', 'set-4', 'set-6', 'set-8', 'set-12'],
  hospitality_venue_gift_pack: ['unit-single', 'set-2', 'set-4', 'set-6'],
};

/**
 * Age-restricted DELIVERABLES (2026-11-02, additive). Vape documents the
 * existing intent; the three HOSPITALITY tobacco deliverables (shisha kit,
 * shisha flavour molasses, cigars) are the additive benefit — they are always
 * created isAlcoholic:false, so the alcoholic default alone would leave
 * requiresAgeVerification false. hospitality_charcoal is NOT age-restricted.
 * Consumed by BOTH creation services as the OR-clause age gate:
 *   - services/subproduct.service.js (tenant SubProduct creation → Product
 *     payload)
 *   - services/product.service.js createProduct (autoRequiresAgeVerification
 *     derivation; an explicit caller `requiresAgeVerification` still wins)
 */
const AGE_RESTRICTED_TYPES = [
  'vape',
  'hospitality_shisha_kit',
  'hospitality_shisha_flavour',
  'hospitality_cigar',
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if a type is alcoholic
 */
const isAlcoholicType = (type) => {
  return ALCOHOLIC_TYPES.includes(type);
};

/**
 * Check if a type is a beverage
 */
const isBeverageType = (type) => {
  return BEVERAGE_TYPES.includes(type);
};

/**
 * Get category for a type
 */
const getCategoryForType = (type) => {
  for (const [key, category] of Object.entries(TYPE_CATEGORIES)) {
    if (category.types.includes(type)) {
      return {
        key,
        name: category.name,
        types: category.types,
      };
    }
  }
  return null;
};

/**
 * Get human-readable name for type
 */
const getTypeDisplayName = (type) => {
  const names = {
    [PRODUCT_TYPES.BEER]: 'Beer',
    [PRODUCT_TYPES.CRAFT_BEER]: 'Craft Beer',
    [PRODUCT_TYPES.CIDER]: 'Cider',
    [PRODUCT_TYPES.WINE]: 'Wine',
    [PRODUCT_TYPES.RED_WINE]: 'Red Wine',
    [PRODUCT_TYPES.WHITE_WINE]: 'White Wine',
    [PRODUCT_TYPES.ROSE_WINE]: 'Rosé Wine',
    [PRODUCT_TYPES.SPARKLING_WINE]: 'Sparkling Wine',
    [PRODUCT_TYPES.SPIRIT]: 'Spirit',
    [PRODUCT_TYPES.WHISKEY]: 'Whiskey',
    [PRODUCT_TYPES.VODKA]: 'Vodka',
    [PRODUCT_TYPES.GIN]: 'Gin',
    [PRODUCT_TYPES.RUM]: 'Rum',
    [PRODUCT_TYPES.TEQUILA]: 'Tequila',
    [PRODUCT_TYPES.LIQUEUR]: 'Liqueur',
    [PRODUCT_TYPES.COCKTAIL_RTD]: 'Ready-to-Drink Cocktail',
    [PRODUCT_TYPES.NON_ALCOHOLIC]: 'Non-Alcoholic',
    [PRODUCT_TYPES.ENERGY_DRINK]: 'Energy Drink',
    [PRODUCT_TYPES.SOFT_DRINK]: 'Soft Drink',
    [PRODUCT_TYPES.JUICE]: 'Juice',
    [PRODUCT_TYPES.WATER]: 'Water',
    [PRODUCT_TYPES.COFFEE]: 'Coffee',
    [PRODUCT_TYPES.TEA]: 'Tea',
    [PRODUCT_TYPES.MIXER]: 'Mixer',
    // Add more as needed
  };
  
  return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// These Home families commonly sell in both singles and sets.
const HOME_SET_TYPES = new Set([
  'home_kitchen', 'home_cookware', 'home_bedding', 'home_storage', 'home_bath',
]);

/** Get appropriate sizes for a type. */
const baseSizesForType = (type) => {
  if (HOME_SET_TYPES.has(type)) return STANDARD_SIZES.HOME_SETS;
  if (type === 'beauty_nails') return [...STANDARD_SIZES.BEAUTY, 'unit-single', 'set-2', 'set-4', 'set-6'];
  if (type === 'beauty_tool') return ['unit-single', 'set-2', 'set-4', 'set-6'];
  const expanded = expandedTypes.find(t=>t.value===type);
  // Food Service & Venue guidance (2026-11-02): explicit lists BEFORE the
  // generic sizeKind branches — molasses/charcoal must land on bag weights
  // (not beverage volumes) and cigars keep their legacy sizes. Every string
  // verified against models/Size.js enumValues (see STANDARD_SIZES above).
  if (HOSPITALITY_SIZE_GUIDANCE[type]) return HOSPITALITY_SIZE_GUIDANCE[type];
  // Most procurement stock uses mass and bulk packaging; dairy, cleaning
  // products, baked goods and disposables also need liquid or count options.
  if (typeof type === 'string' && type.startsWith('foodservice_')) {
    return FOODSERVICE_SIZE_GUIDANCE[type] || STANDARD_SIZES.FOODSERVICE;
  }
  if (expanded?.sizeKind==='unit') return ['unit-single'];
  if (expanded?.sizeKind==='weight') return STANDARD_SIZES.WEIGHT;
  // Retail vertical canonical lists — coordinate EXACTLY with the Size enum
  // additions (schema agent contract, see STANDARD_SIZES comments).
  // Fashion sizing systems (2026-11-03): per-family guidance — numeric US
  // sizes for dresses/tops, waist+inseam codes for bottoms, kids ages for
  // kids fashion; plain alpha elsewhere.
  if (expanded?.sizeKind==='apparel') {
    if (type==='fashion_bottom') return [...STANDARD_SIZES.WAIST, ...STANDARD_SIZES.INSEAM, ...STANDARD_SIZES.APPAREL];
    if (type==='fashion_dress') return [...STANDARD_SIZES.NUMERIC_US, ...STANDARD_SIZES.APPAREL];
    if (type==='fashion_top' || type==='fashion_outerwear' || type==='fashion_innerwear') return [...STANDARD_SIZES.NUMERIC_US, ...STANDARD_SIZES.APPAREL];
    if (type==='fashion_kids') return STANDARD_SIZES.KIDS_AGE;
    return STANDARD_SIZES.APPAREL;
  }
  if (expanded?.sizeKind==='shoes') return STANDARD_SIZES.SHOES;
  if (expanded?.sizeKind==='storage') {
    // Electronics sizing systems (2026-11-03): device family decides which
    // spec dimensions the shopper picks — storage for compute/phone gear,
    // screen inches for displays, RAM for computers, battery capacity for
    // power gear. Portable screens have separate dimensions from TVs.
    if (type==='electronics_laptop') return [...STANDARD_SIZES.STORAGE, ...STANDARD_SIZES.RAM, ...STANDARD_SIZES.LAPTOP_SCREEN_INCH];
    if (type==='electronics_tablet') return [...STANDARD_SIZES.STORAGE, ...STANDARD_SIZES.TABLET_SCREEN_INCH];
    if (type==='electronics_desktop') return [...STANDARD_SIZES.STORAGE, ...STANDARD_SIZES.RAM];
    if (type==='electronics_tv_display') return STANDARD_SIZES.SCREEN_INCH;
    if (type==='electronics_power') return STANDARD_SIZES.BATTERY;
    if (type==='electronics_gaming') return [...STANDARD_SIZES.STORAGE, ...STANDARD_SIZES.RAM];
    return STANDARD_SIZES.STORAGE;
  }
  // beauty_* volume kinds: cosmetic container sizes (enum-valid ml strings),
  // NOT the beverage bottle scales the generic volume branch returns below.
  if (expanded?.sizeKind==='volume' && typeof type==='string' && type.startsWith('beauty_')) {
    return STANDARD_SIZES.BEAUTY;
  }
  if (expanded) return ['25cl', '50cl', '70cl', '75cl', '1L'];
  const sizeMap = {
    // Beer & Cider
    [PRODUCT_TYPES.BEER]: [...STANDARD_SIZES.STANDARD_BOTTLES, ...STANDARD_SIZES.CANS],
    [PRODUCT_TYPES.CRAFT_BEER]: [...STANDARD_SIZES.STANDARD_BOTTLES, ...STANDARD_SIZES.CANS],
    [PRODUCT_TYPES.CIDER]: [...STANDARD_SIZES.STANDARD_BOTTLES, ...STANDARD_SIZES.CANS],
    
    // Wine
    [PRODUCT_TYPES.WINE]: STANDARD_SIZES.WINE_SIZES,
    [PRODUCT_TYPES.RED_WINE]: STANDARD_SIZES.WINE_SIZES,
    [PRODUCT_TYPES.WHITE_WINE]: STANDARD_SIZES.WINE_SIZES,
    [PRODUCT_TYPES.ROSE_WINE]: STANDARD_SIZES.WINE_SIZES,
    [PRODUCT_TYPES.SPARKLING_WINE]: STANDARD_SIZES.WINE_SIZES,
    
    // Spirits
    [PRODUCT_TYPES.SPIRIT]: ['50cl', '70cl', '1L'],
    [PRODUCT_TYPES.WHISKEY]: ['50cl', '70cl', '1L'],
    [PRODUCT_TYPES.VODKA]: ['50cl', '70cl', '1L'],
    [PRODUCT_TYPES.GIN]: ['50cl', '70cl', '1L'],
    [PRODUCT_TYPES.RUM]: ['50cl', '70cl', '1L'],
    [PRODUCT_TYPES.TEQUILA]: ['50cl', '70cl', '1L'],
    
    // Soft drinks
    [PRODUCT_TYPES.SOFT_DRINK]: [...STANDARD_SIZES.STANDARD_BOTTLES, ...STANDARD_SIZES.LARGE_BOTTLES],
    [PRODUCT_TYPES.WATER]: [...STANDARD_SIZES.STANDARD_BOTTLES, ...STANDARD_SIZES.LARGE_BOTTLES],
    [PRODUCT_TYPES.JUICE]: ['33cl', '1L', '1.5L', '2L'],
    
    // Energy drinks
    [PRODUCT_TYPES.ENERGY_DRINK]: STANDARD_SIZES.CANS,
    
    // Accessories
    [PRODUCT_TYPES.GLASSWARE]: STANDARD_SIZES.GIFTS_AND_LIFESTYLE,
    [PRODUCT_TYPES.BAR_TOOL]: STANDARD_SIZES.GIFTS_AND_LIFESTYLE,
    [PRODUCT_TYPES.DECANTER]: STANDARD_SIZES.GIFTS_AND_LIFESTYLE,
    [PRODUCT_TYPES.COCKTAIL_KIT]: STANDARD_SIZES.GIFTS_AND_LIFESTYLE,

    [PRODUCT_TYPES.VAPE]: ['unit-single'],

    // Snacks & Pairings
    [PRODUCT_TYPES.SNACK]: [
      'bar-single', 'bar-2',
      'bag-100g', 'bag-200g', 'bag-250g', 'bag-500g', 'bag-1kg',
      'tin-single', 'tin-200g', 'tin-500g',
      ...STANDARD_SIZES.WEIGHT,
    ],
    [PRODUCT_TYPES.NUTS]: STANDARD_SIZES.WEIGHT,
    [PRODUCT_TYPES.CHOCOLATE]: [
      'bar-single', 'bar-2', 'tin-single', 'tin-200g', 'tin-500g',
    ],

    // Gift & Bundles
    [PRODUCT_TYPES.GIFT_SET]: STANDARD_SIZES.GIFTS_AND_LIFESTYLE,
    [PRODUCT_TYPES.GIFT_BASKET]: [
      'piece-single', 'box-single', 'gift-set', 'set-2', 'set-4', 'set-6',
    ],
    [PRODUCT_TYPES.TASTING_SET]: ['tasting-set', 'set-4', 'set-6', 'set-12'],
    [PRODUCT_TYPES.BUNDLE]: ['piece-single', 'gift-set', 'variety-pack'],
  };
  
  const family = legacyBeverageFamilies[type];
  if (family === 'hot') return [...STANDARD_SIZES.WEIGHT, ...STANDARD_SIZES.STANDARD_BOTTLES];
  return sizeMap[type] || sizeMap[family] || STANDARD_SIZES.GIFTS_AND_LIFESTYLE;
};

const getSizesForType = (type) => [...new Set([
  ...baseSizesForType(type),
  ...additionalSizePresets(type, legacyBeverageFamilies[type]),
])];

const BEVERAGE_SIZE_CODES = [...new Set(BEVERAGE_TYPES.flatMap(getSizesForType))];

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Core enums
  PRODUCT_TYPES,
  PRODUCT_TYPE_VALUES,
  
  // Type groups
  ALCOHOLIC_TYPES,
  NON_ALCOHOLIC_TYPES,
  BEVERAGE_TYPES,
  NON_BEVERAGE_TYPES,
  TYPE_CATEGORIES,

  // Age-restricted deliverables (vape + HOSPITALITY tobacco; see JSDoc above)
  AGE_RESTRICTED_TYPES,
  
  // Sub-types
  BEER_SUBTYPES,
  WINE_SUBTYPES,
  SPIRIT_SUBTYPES,
  
  // Sizes
  STANDARD_SIZES,
  BEVERAGE_SIZE_CODES,
  ALL_SIZE_ENUMS,
  
  // Helper functions
  isAlcoholicType,
  isBeverageType,
  getCategoryForType,
  getTypeDisplayName,
  getSizesForType,
};
