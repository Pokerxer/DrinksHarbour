// server/config/merchandising.js
// Beverage family taxonomy for upsell/cross-sell ranking (spec:
// docs/superpowers/specs/2026-11-13-merchandising-upsell-cross-sell-design.md).
//
// Families REUSE the group names that expandedProductTypes already assigns, so
// every expanded type derives its family from its own `group` field and the
// base Product.enum types are mapped explicitly below. A type whose group is
// not a beverage family (Electronics, Fashion, Home & Living retail verticals
// on tenant surfaces) maps to OTHER, which pairs with nothing and always falls
// through to the semantic/related tiers.

const { expandedTypes } = require('../constants/expandedProductTypes');

const BEVERAGE_GROUPS = new Set([
  'BEER_AND_CIDER', 'WINE', 'SPIRITS', 'LIQUEURS', 'RTD', 'NON_ALCOHOLIC',
  'SOFT_DRINKS', 'WATERS', 'JUICE', 'COFFEE', 'TEA', 'ENERGY_SPORTS',
  'MIXERS', 'MILK_DAIRY', 'ACCESSORIES', 'SNACKS', 'GIFTS',
]);

// Explicit map for the base enum values declared in server/models/Product.js.
const BASE_TYPE_FAMILIES = {
  // Beer family
  beer: 'BEER_AND_CIDER', lager: 'BEER_AND_CIDER', ale: 'BEER_AND_CIDER',
  stout: 'BEER_AND_CIDER', porter: 'BEER_AND_CIDER', ipa: 'BEER_AND_CIDER',
  pilsner: 'BEER_AND_CIDER', wheat_beer: 'BEER_AND_CIDER',
  sour_beer: 'BEER_AND_CIDER', craft_beer: 'BEER_AND_CIDER',
  cider: 'BEER_AND_CIDER', perry: 'BEER_AND_CIDER',
  // Wine family
  wine: 'WINE', red_wine: 'WINE', white_wine: 'WINE', rose_wine: 'WINE',
  sparkling_wine: 'WINE', champagne: 'WINE', prosecco: 'WINE',
  fortified_wine: 'WINE', dessert_wine: 'WINE', orange_wine: 'WINE',
  natural_wine: 'WINE', palm_wine: 'WINE', rice_wine: 'WINE', mead: 'WINE',
  // Spirits
  spirit: 'SPIRITS', whiskey: 'SPIRITS', whisky: 'SPIRITS',
  bourbon: 'SPIRITS', scotch: 'SPIRITS', rye_whiskey: 'SPIRITS',
  irish_whiskey: 'SPIRITS', japanese_whisky: 'SPIRITS', vodka: 'SPIRITS',
  gin: 'SPIRITS', rum: 'SPIRITS', white_rum: 'SPIRITS', dark_rum: 'SPIRITS',
  spiced_rum: 'SPIRITS', tequila: 'SPIRITS', mezcal: 'SPIRITS',
  brandy: 'SPIRITS', cognac: 'SPIRITS', armagnac: 'SPIRITS',
  grappa: 'SPIRITS', absinthe: 'SPIRITS', sake: 'SPIRITS', soju: 'SPIRITS',
  // Liqueurs & aperitifs
  liqueur: 'LIQUEURS', cream_liqueur: 'LIQUEURS', coffee_liqueur: 'LIQUEURS',
  fruit_liqueur: 'LIQUEURS', herbal_liqueur: 'LIQUEURS', amaretto: 'LIQUEURS',
  vermouth: 'LIQUEURS', aperitif: 'LIQUEURS', digestif: 'LIQUEURS',
  bitters: 'LIQUEURS',
  // Ready-to-drink
  cocktail_ready_to_drink: 'RTD', premixed_cocktail: 'RTD',
  hard_seltzer: 'RTD', alcopop: 'RTD', cooler: 'RTD',
  // Non-alcoholic
  non_alcoholic: 'NON_ALCOHOLIC', non_alcoholic_beer: 'NON_ALCOHOLIC',
  non_alcoholic_wine: 'NON_ALCOHOLIC', non_alcoholic_spirit: 'NON_ALCOHOLIC',
  mocktail: 'NON_ALCOHOLIC',
  // Soft drinks (mixer-class sodas live here too; `mixer` itself is MIXERS)
  soft_drink: 'SOFT_DRINKS', cola: 'SOFT_DRINKS', lemon_lime: 'SOFT_DRINKS',
  orange_soda: 'SOFT_DRINKS', root_beer: 'SOFT_DRINKS',
  ginger_ale: 'SOFT_DRINKS', ginger_beer: 'SOFT_DRINKS',
  tonic_water: 'SOFT_DRINKS', club_soda: 'SOFT_DRINKS',
  // Waters
  water: 'WATERS', mineral_water: 'WATERS', spring_water: 'WATERS',
  alkaline_water: 'WATERS', coconut_water: 'WATERS',
  sparkling_water: 'WATERS', flavored_water: 'WATERS',
  // Juices & health
  juice: 'JUICE', fruit_juice: 'JUICE', vegetable_juice: 'JUICE',
  smoothie: 'JUICE', kombucha: 'JUICE', probiotic_drink: 'JUICE',
  // Coffee & cocoa
  coffee: 'COFFEE', espresso: 'COFFEE', cold_brew: 'COFFEE',
  instant_coffee: 'COFFEE', hot_chocolate: 'COFFEE',
  // Tea
  tea: 'TEA', green_tea: 'TEA', black_tea: 'TEA', herbal_tea: 'TEA',
  oolong_tea: 'TEA', white_tea: 'TEA', chai: 'TEA', matcha: 'TEA',
  // Energy & sports
  energy_drink: 'ENERGY_SPORTS', sports_drink: 'ENERGY_SPORTS',
  protein_shake: 'ENERGY_SPORTS', vitamin_drink: 'ENERGY_SPORTS',
  electrolyte_drink: 'ENERGY_SPORTS',
  // Mixers
  mixer: 'MIXERS', simple_syrup: 'MIXERS', grenadine: 'MIXERS',
  bitters_mixer: 'MIXERS',
  // Milk & dairy
  milk: 'MILK_DAIRY', dairy_milk: 'MILK_DAIRY', plant_milk: 'MILK_DAIRY',
  almond_milk: 'MILK_DAIRY', oat_milk: 'MILK_DAIRY', soy_milk: 'MILK_DAIRY',
  coconut_milk: 'MILK_DAIRY', milkshake: 'MILK_DAIRY',
  // Accessories & others
  accessory: 'ACCESSORIES', glassware: 'ACCESSORIES', bar_tool: 'ACCESSORIES',
  ice: 'ACCESSORIES', garnish: 'ACCESSORIES', vape: 'ACCESSORIES',
  snack: 'SNACKS', nuts: 'SNACKS',
  gift_set: 'GIFTS', subscription_box: 'GIFTS',
  other: 'OTHER',
};

// Expanded types derive from their own `group`; non-beverage retail verticals
// (Electronics, Fashion, …) collapse into OTHER.
const typeFamilies = {
  ...BASE_TYPE_FAMILIES,
  ...Object.fromEntries(
    expandedTypes.map((t) => [t.value, BEVERAGE_GROUPS.has(t.group) ? t.group : 'OTHER'])
  ),
};

// Family → complement families. Every family referenced here must have at
// least one enum type (enforced by the test above). OTHER pairs with nothing.
const familyPairings = {
  BEER_AND_CIDER: ['SNACKS', 'WATERS', 'SOFT_DRINKS', 'ACCESSORIES', 'GIFTS'],
  WINE: ['SNACKS', 'ACCESSORIES', 'GIFTS', 'NON_ALCOHOLIC'],
  SPIRITS: ['MIXERS', 'SOFT_DRINKS', 'JUICE', 'ACCESSORIES', 'SNACKS'],
  LIQUEURS: ['COFFEE', 'SOFT_DRINKS', 'ACCESSORIES', 'GIFTS'],
  RTD: ['SNACKS', 'WATERS', 'ACCESSORIES', 'GIFTS'],
  NON_ALCOHOLIC: ['JUICE', 'SNACKS', 'WATERS', 'GIFTS'],
  SOFT_DRINKS: ['SNACKS', 'JUICE', 'WATERS', 'GIFTS'],
  WATERS: ['JUICE', 'SOFT_DRINKS'],
  JUICE: ['SOFT_DRINKS', 'SNACKS', 'WATERS'],
  COFFEE: ['MILK_DAIRY', 'SNACKS', 'GIFTS'],
  TEA: ['MILK_DAIRY', 'SNACKS', 'GIFTS'],
  ENERGY_SPORTS: ['WATERS', 'SOFT_DRINKS', 'SNACKS'],
  MIXERS: ['SPIRITS', 'ACCESSORIES', 'JUICE'],
  MILK_DAIRY: ['COFFEE', 'TEA', 'SNACKS'],
  ACCESSORIES: ['SPIRITS', 'WINE', 'GIFTS', 'BEER_AND_CIDER'],
  SNACKS: ['BEER_AND_CIDER', 'SOFT_DRINKS', 'JUICE', 'WINE'],
  GIFTS: ['WINE', 'SPIRITS', 'LIQUEURS', 'ACCESSORIES'],
  OTHER: [],
};

const familyForType = (type) => typeFamilies[type] || 'OTHER';

const complementFamilies = (type) => familyPairings[familyForType(type)] || [];

const typesForFamilies = (families) => {
  const wanted = new Set(families);
  return Object.entries(typeFamilies)
    .filter(([, family]) => wanted.has(family))
    .map(([type]) => type);
};

module.exports = {
  typeFamilies,
  familyPairings,
  familyForType,
  complementFamilies,
  typesForFamilies,
};
