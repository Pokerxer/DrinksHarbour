// General product formats. beverage=false hides drink-only fields.
const generalTypes=[
 ['beverage_powder','Beverage Powder','MIXERS',false,true,'weight'],
 ['instant_drink_mix','Instant Drink Mix','MIXERS',false,true,'weight'],
 ['cocoa_powder','Cocoa Powder','COFFEE',false,true,'weight'],
 ['drinking_chocolate','Drinking Chocolate','COFFEE',false,true,'weight'],
 ['ground_coffee','Ground Coffee','COFFEE',false,true,'weight'],
 ['coffee_beans','Coffee Beans','COFFEE',false,true,'weight'],
 ['coffee_pods','Coffee Capsules & Pods','COFFEE',false,true,'unit'],
 ['tea_bag','Tea Bags','TEA',false,true,'unit'],
 ['loose_leaf_tea','Loose Leaf Tea','TEA',false,true,'weight'],
 ['hibiscus_drink','Hibiscus Drink','SOFT_DRINKS',false,true,'volume'],
 ['tiger_nut_drink','Tiger Nut Drink','SOFT_DRINKS',false,true,'volume'],
 ['grain_drink','Grain Drink','SOFT_DRINKS',false,true,'volume'],
 ['fruit_drink','Fruit Drink','JUICE',false,true,'volume'],
 ['non_alcoholic_cider','Non-Alcoholic Cider','BEER_AND_CIDER',false,true,'volume'],
 ['chocolate_liqueur','Chocolate Liqueur','LIQUEURS',true,true,'volume'],
 ['nut_liqueur','Nut Liqueur','LIQUEURS',true,true,'volume'],
 ['orange_liqueur','Orange Liqueur','LIQUEURS',true,true,'volume'],
 ['coffee_equipment','Coffee Equipment','ACCESSORIES',false,false,'unit'],
 ['tea_equipment','Tea Equipment','ACCESSORIES',false,false,'unit'],
 ['beverage_dispenser','Beverage Dispenser','ACCESSORIES',false,false,'unit'],
 ['bar_cleaning_supply','Bar Cleaning Supply','ACCESSORIES',false,false,'unit'],
 ['beverage_packaging','Beverage Packaging','ACCESSORIES',false,false,'unit'],
 ['drinkware','Drinkware','ACCESSORIES',false,false,'unit'],
 ['wine_accessory','Wine Accessory','ACCESSORIES',false,false,'unit'],
 ['cocktail_cherry','Cocktail Cherries','ACCESSORIES',false,false,'weight'],
 ['dried_citrus','Dried Citrus Garnish','ACCESSORIES',false,false,'weight'],
 ['rimming_salt','Rimming Salt & Sugar','ACCESSORIES',false,false,'weight'],
 ['edible_flower','Edible Flower Garnish','ACCESSORIES',false,false,'weight'],
 ['snack_mix','Snack Mix','SNACKS',false,false,'weight'],
 ['biscuits','Biscuits','SNACKS',false,false,'weight'],
 ['gift_hamper','Gift Hamper','GIFTS',false,false,'unit'],
 ['tasting_set','Tasting & Discovery Set','GIFTS',false,false,'unit'],
].map(([value,label,group,alcoholic,beverage,sizeKind])=>({value,label,group,alcoholic,beverage,sizeKind}));

// ── Retail verticals (marketplace taxonomy 2026-11-02, additive) ─────────────
// New industry verticals; every value uses one of RETAIL_TYPE_PREFIXES so
// config/marketCategories.js (supply category 'retail') and catalogKind.js
// (KINDS.retail) can map them by the SAME prefix rule. NEVER rename a value:
// they mirror client/apps/admin/src/utils/* form mirrors and Size.canonical
// apparel/shoes/storage strings (see constants/productTypes.js STANDARD_SIZES).
// Group keys ELECTRONICS/FASHION/BEAUTY/HOME match TYPE_CATEGORIES entries in
// constants/productTypes.js (populated there by the additive loop).
// Group sizeKind canon: ELECTRONICS unit, FASHION apparel, BEAUTY volume,
// HOME unit — deviated per-type only where a sensible canonical list exists
// ('storage' devices, 'shoes', unit-based fashion goods).
const retailTypes=[
 // Electronics — storage-capable devices sell by storage tier, the rest by unit.
 ['electronics_phone','Mobile Phone','ELECTRONICS',false,false,'storage'],
 ['electronics_tablet','Tablet','ELECTRONICS',false,false,'storage'],
 ['electronics_laptop','Laptop','ELECTRONICS',false,false,'storage'],
 ['electronics_desktop','Desktop Computer','ELECTRONICS',false,false,'storage'],
 ['electronics_printer','Printer & Scanner','ELECTRONICS',false,false,'unit'],
 ['electronics_storage','Data Storage','ELECTRONICS',false,false,'storage'],
 ['electronics_computer_accessory','Computer Accessory','ELECTRONICS',false,false,'unit'],
 ['electronics_audio','Audio Device','ELECTRONICS',false,false,'unit'],
 ['electronics_tv_display','TV & Display','ELECTRONICS',false,false,'storage'],
 ['electronics_camera','Camera','ELECTRONICS',false,false,'unit'],
 ['electronics_gaming','Gaming & Console','ELECTRONICS',false,false,'storage'],
 ['electronics_wearable','Smart Wearable','ELECTRONICS',false,false,'unit'],
 ['electronics_networking','Networking Device','ELECTRONICS',false,false,'unit'],
 ['electronics_power','Power & Charging','ELECTRONICS',false,false,'storage'],
 // Fashion — apparel scales; footwear by shoe size; goods/wear by single unit.
 ['fashion_top','Top','FASHION',false,false,'apparel'],
 ['fashion_dress','Dress','FASHION',false,false,'apparel'],
 ['fashion_bottom','Bottoms','FASHION',false,false,'apparel'],
 ['fashion_outerwear','Outerwear','FASHION',false,false,'apparel'],
 ['fashion_innerwear','Innerwear & Sleep','FASHION',false,false,'apparel'],
 ['fashion_shoes','Shoes','FASHION',false,false,'shoes'],
 ['fashion_bag','Bags & Luggage','FASHION',false,false,'unit'],
 ['fashion_accessory','Fashion Accessory','FASHION',false,false,'unit'],
 ['fashion_watch','Watches','FASHION',false,false,'unit'],
 ['fashion_jewellery','Jewellery','FASHION',false,false,'unit'],
 ['fashion_kids','Kids Fashion','FASHION',false,false,'apparel'],
 // Beauty — sold by container volume (ml strings already valid in Size.js).
 ['beauty_skincare','Skincare','BEAUTY',false,false,'volume'],
 ['beauty_makeup','Makeup','BEAUTY',false,false,'volume'],
 ['beauty_hair','Hair Care & Styling','BEAUTY',false,false,'volume'],
 ['beauty_fragrance','Fragrance','BEAUTY',false,false,'volume'],
 ['beauty_nails','Nails & Manicure','BEAUTY',false,false,'volume'],
 ['beauty_tool','Beauty Tool & Appliance','BEAUTY',false,false,'unit'],
 ['beauty_hygiene','Personal Hygiene','BEAUTY',false,false,'volume'],
 // Home — household goods and appliances are count-based units.
 ['home_kitchen','Kitchen & Dining','HOME',false,false,'unit'],
 ['home_cookware','Cookware & Bakeware','HOME',false,false,'unit'],
 ['home_decor','Home Decor','HOME',false,false,'unit'],
 ['home_furniture','Furniture','HOME',false,false,'unit'],
 ['home_bedding','Bedding & Textile','HOME',false,false,'unit'],
 ['home_storage','Storage & Organisation','HOME',false,false,'unit'],
 ['home_cleaning','Cleaning & Household','HOME',false,false,'unit'],
 ['home_small_appliance','Small Home Appliance','HOME',false,false,'unit'],
 ['home_lighting','Lighting','HOME',false,false,'unit'],
 ['home_bath','Bath & Bathroom Accessories','HOME',false,false,'unit'],
 ['home_garden','Garden & Outdoor','HOME',false,false,'unit'],
].map(([value,label,group,alcoholic,beverage,sizeKind])=>({value,label,group,alcoholic,beverage,sizeKind}));

// Authoritative retail prefixes. config/marketCategories.js maps types starting
// with one of these to the 'retail' SUPPLY category, catalogKind.js maps them
// to KINDS.retail; every other type keeps its legacy mapping.
const RETAIL_TYPE_PREFIXES=['electronics_','fashion_','beauty_','home_'];

// ── Food Service & Venue verticals (2026-11-02, additive) ───────────────────
// The missing CATALOG vocabulary for restaurants / lounges / clubs. Two
// families, both alcoholic=false / beverage=false (the expandedTypes beverage
// filter keeps them out of ALCOHOLIC/NON_ALCOHOLIC/BEVERAGE automatically):
//   foodservice_* — PROCUREMENT stock a restaurant/lounge/club buys (produce,
//     meat, disposables…). catalogKind.js maps the prefix to KINDS.ingredient;
//     the supply category is 'hospitality' (config/marketCategories.js).
//   hospitality_* — SELLABLE lounge/club stock (shisha kits, cigar boxes…).
//     catalogKind.js maps the prefix to KINDS.retail — the same sellable kind
//     as the retail verticals above — so they list on the central
//     marketplace/shop surfaces.
// Prepared food stays a KIND (KINDS.prepared_food): restaurant menu items keep
// using the venue-serving machinery; this registry does NOT add a
// prepared_food Product.type (docs/saas/venues/03-products-inventory.md §2
// governs). NEVER rename a value: they mirror admin form surfaces and the
// canonical size strings (constants/productTypes.js — getSizesForType).
// FOODSERVICE uses procurement guidance in productTypes.js; packaging is
// counted. HOSPITALITY uses units except molasses and charcoal bag weights.
// Supply-category prefixes: BOTH families resolve to the 'hospitality'
// category via CATERING_SUPPLY_PREFIXES (single source consumed by config/
// marketCategories.js so the rule cannot drift). CATALOG KIND deliberately
// splits: catalogKind.js maps 'hospitality_' → KINDS.retail but 'foodservice_'
// → KINDS.ingredient, so it cannot reuse this combined array.
const foodserviceTypes=[
 ['foodservice_produce','Fresh Produce','FOODSERVICE',false,false,'weight'],
 ['foodservice_meat','Meat & Poultry','FOODSERVICE',false,false,'weight'],
 ['foodservice_seafood','Seafood','FOODSERVICE',false,false,'weight'],
 ['foodservice_dairy','Dairy & Eggs','FOODSERVICE',false,false,'weight'],
 ['foodservice_bakery','Bakery & Bread','FOODSERVICE',false,false,'weight'],
 ['foodservice_staples','Dry Goods & Staples','FOODSERVICE',false,false,'weight'],
 ['foodservice_frozen','Frozen Foods','FOODSERVICE',false,false,'weight'],
 ['foodservice_condiment','Condiments & Spices','FOODSERVICE',false,false,'weight'],
 ['foodservice_disposables','Disposables & Packaging','FOODSERVICE',false,false,'unit'],
 ['foodservice_cleaning','Cleaning Chemicals & Sanitisers','FOODSERVICE',false,false,'weight'],
 ['foodservice_kitchen_smallware','Commercial Kitchen Smallwares','FOODSERVICE',false,false,'unit'],
 ['foodservice_tabletop_bar','Tabletop & Bar Service','FOODSERVICE',false,false,'unit'],
 ['foodservice_janitorial','Janitorial Supplies','FOODSERVICE',false,false,'unit'],
 ['foodservice_equipment','Commercial Kitchen & Bar Equipment','FOODSERVICE',false,false,'unit'],
].map(([value,label,group,alcoholic,beverage,sizeKind])=>({value,label,group,alcoholic,beverage,sizeKind}));
const hospitalityTypes=[
 ['hospitality_shisha_kit','Shisha & Hookah','HOSPITALITY',false,false,'unit'],
 ['hospitality_shisha_flavour','Shisha Flavour (Molasses)','HOSPITALITY',false,false,'weight'],
 ['hospitality_charcoal','Charcoal & Heating','HOSPITALITY',false,false,'weight'],
 ['hospitality_cigar','Cigars & Tobacco','HOSPITALITY',false,false,'unit'],
 ['hospitality_shisha_accessory','Shisha Parts & Accessories','HOSPITALITY',false,false,'unit'],
 ['hospitality_cigar_accessory','Cigar Cutters & Lighters','HOSPITALITY',false,false,'unit'],
 ['hospitality_cigar_storage','Humidors & Cigar Cases','HOSPITALITY',false,false,'unit'],
 ['hospitality_venue_apparel','Venue Apparel','HOSPITALITY',false,false,'apparel'],
 ['hospitality_venue_drinkware','Branded Drinkware','HOSPITALITY',false,false,'unit'],
 ['hospitality_venue_gift_pack','Venue Gift Packs','HOSPITALITY',false,false,'unit'],
].map(([value,label,group,alcoholic,beverage,sizeKind])=>({value,label,group,alcoholic,beverage,sizeKind}));

const CATERING_SUPPLY_PREFIXES=['foodservice_','hospitality_'];
module.exports={generalTypes,retailTypes,hospitalityTypes,foodserviceTypes,RETAIL_TYPE_PREFIXES,CATERING_SUPPLY_PREFIXES};
