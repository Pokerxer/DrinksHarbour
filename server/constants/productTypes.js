// constants/productTypes.js

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
const ALCOHOLIC_TYPES = [
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
];

/**
 * Non-alcoholic beverage types
 */
const NON_ALCOHOLIC_TYPES = [
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
];

/**
 * Beverage types (all drinks)
 */
const BEVERAGE_TYPES = [...ALCOHOLIC_TYPES, ...NON_ALCOHOLIC_TYPES, PRODUCT_TYPES.MIXER];

/**
 * Non-beverage product types
 */
const NON_BEVERAGE_TYPES = [
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
};

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
  WEIGHT: ['kg-0.25', 'kg-0.5', 'kg-1', 'kg-2'],
  UNITS: ['unit-single', 'unit-pair', 'set-4', 'set-6', 'set-8'],
};

/**
 * All valid size enum values
 */
const ALL_SIZE_ENUMS = [
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

/**
 * Get appropriate sizes for a type
 */
const getSizesForType = (type) => {
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
    [PRODUCT_TYPES.GLASSWARE]: STANDARD_SIZES.UNITS,
    [PRODUCT_TYPES.SNACK]: STANDARD_SIZES.WEIGHT,
  };
  
  return sizeMap[type] || ['unit-single'];
};

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
  
  // Sub-types
  BEER_SUBTYPES,
  WINE_SUBTYPES,
  SPIRIT_SUBTYPES,
  
  // Sizes
  STANDARD_SIZES,
  ALL_SIZE_ENUMS,
  
  // Helper functions
  isAlcoholicType,
  isBeverageType,
  getCategoryForType,
  getTypeDisplayName,
  getSizesForType,
};