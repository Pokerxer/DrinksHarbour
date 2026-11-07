// Explicit legacy Product.type values. Preserve stored spellings; never rename records.
// Mirrored by admin legacy-beverage-types.ts; parity tests prevent drift.
const groups = {
  "Alcoholic Beverages": ["beer", "lager", "ale", "stout", "porter", "ipa", "pilsner", "wheat_beer", "sour_beer", "craft_beer"],
  "Wine": ["wine", "red_wine", "white_wine", "rose_wine", "sparkling_wine", "champagne", "prosecco", "fortified_wine", "dessert_wine", "orange_wine", "natural_wine"],
  "Spirits": ["spirit", "whiskey", "whisky", "bourbon", "scotch", "rye_whiskey", "irish_whiskey", "japanese_whisky", "vodka", "gin", "rum", "white_rum", "dark_rum", "spiced_rum", "tequila", "mezcal", "brandy", "cognac", "armagnac", "grappa", "absinthe", "sake", "soju"],
  "Liqueurs & Aperitifs": ["liqueur", "cream_liqueur", "coffee_liqueur", "fruit_liqueur", "herbal_liqueur", "amaretto", "vermouth", "aperitif", "digestif", "bitters"],
  "Ready-to-Drink": ["cocktail_ready_to_drink", "premixed_cocktail", "hard_seltzer", "alcopop", "cooler", "cider", "perry", "mead"],
  "Non-Alcoholic": ["non_alcoholic", "non_alcoholic_beer", "non_alcoholic_wine", "non_alcoholic_spirit", "mocktail"],
  "Soft Drinks": ["soft_drink", "cola", "lemon_lime", "orange_soda", "root_beer", "ginger_ale", "ginger_beer", "tonic_water", "club_soda", "sparkling_water", "flavored_water"],
  "Juices & Health": ["juice", "fruit_juice", "vegetable_juice", "smoothie", "kombucha", "probiotic_drink"],
  "Hot Beverages": ["coffee", "espresso", "cold_brew", "instant_coffee", "tea", "green_tea", "black_tea", "herbal_tea", "oolong_tea", "white_tea", "chai", "matcha", "hot_chocolate"],
  "Energy & Sports": ["energy_drink", "sports_drink", "protein_shake", "vitamin_drink", "electrolyte_drink"],
  "Water": ["water", "mineral_water", "spring_water", "alkaline_water", "coconut_water"],
  "Mixers": ["mixer", "simple_syrup", "grenadine", "bitters_mixer"],
  "Milk & Dairy": ["milk", "dairy_milk", "plant_milk", "almond_milk", "oat_milk", "soy_milk", "coconut_milk", "milkshake"],
};
const alcoholicGroups = ["Alcoholic Beverages", "Wine", "Spirits", "Liqueurs & Aperitifs", "Ready-to-Drink"];
const legacyAlcoholicTypes = alcoholicGroups.flatMap(group => groups[group]);
const legacyNonAlcoholicTypes = Object.entries(groups).filter(([group]) => !alcoholicGroups.includes(group)).flatMap(([, types]) => types);
const legacyBeverageTypes = [...legacyAlcoholicTypes, ...legacyNonAlcoholicTypes];
const familyByGroup = {"Alcoholic Beverages": "beer", "Wine": "wine", "Spirits": "spirit", "Liqueurs & Aperitifs": "spirit", "Ready-to-Drink": "beer", "Non-Alcoholic": "soft_drink", "Soft Drinks": "soft_drink", "Juices & Health": "juice", "Hot Beverages": "hot", "Energy & Sports": "energy_drink", "Water": "water", "Mixers": "soft_drink", "Milk & Dairy": "soft_drink"};
const legacyBeverageFamilies = Object.fromEntries(Object.entries(groups).flatMap(([group, types]) => types.map(type => [type, familyByGroup[group]])));
Object.assign(legacyBeverageFamilies, { non_alcoholic_wine: 'wine', non_alcoholic_spirit: 'spirit', non_alcoholic_beer: 'beer' });
const categoryByGroup = {
  'Alcoholic Beverages': 'BEER_AND_CIDER', Wine: 'WINE', Spirits: 'SPIRITS',
  'Liqueurs & Aperitifs': 'LIQUEURS', 'Ready-to-Drink': 'RTD',
  'Non-Alcoholic': 'SOFT_DRINKS', 'Soft Drinks': 'SOFT_DRINKS',
  'Juices & Health': 'JUICE', 'Energy & Sports': 'ENERGY_SPORTS',
  Water: 'WATER', Mixers: 'MIXERS', 'Milk & Dairy': 'MILK',
};
const legacyBeverageCategories = Object.fromEntries(Object.entries(groups)
  .flatMap(([group, types]) => types.map(type => [type, categoryByGroup[group]])));
Object.assign(legacyBeverageCategories, {
  espresso: 'COFFEE', hot_chocolate: 'COCOA',
  non_alcoholic_wine: 'WINE', non_alcoholic_spirit: 'SPIRITS',
  non_alcoholic_beer: 'BEER_AND_CIDER', cider: 'BEER_AND_CIDER',
  perry: 'BEER_AND_CIDER', mead: 'BEER_AND_CIDER',
});
module.exports = { legacyAlcoholicTypes, legacyNonAlcoholicTypes, legacyBeverageTypes, legacyBeverageFamilies, legacyBeverageCategories };
