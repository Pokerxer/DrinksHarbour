// Mirrors `server/constants/productTypes.js` NON_BEVERAGE_TYPES plus the extra
// accessory/gift values the Product model allows ('accessory', 'gift', 'ice',
// 'subscription_box'). Anything not in this set is treated as a beverage.
export const NON_BEVERAGE_PRODUCT_TYPES: ReadonlySet<string> = new Set([
  // Accessories & related
  'accessory',
  'glassware',
  'bar_tool',
  'cocktail_kit',
  'garnish',
  'ice_mold',
  'coaster',
  'decanter',
  'aerator',
  'ice',
  // Snacks & pairings
  'snack',
  'nuts',
  'cheese',
  'chocolate',
  'crackers',
  'dried_fruit',
  // Gift & bundles
  'gift',
  'gift_set',
  'gift_basket',
  'tasting_set',
  'subscription_box',
  'bundle',
  // Other
  'other',
]);

export const isBeverageProductType = (type?: string | null): boolean =>
  !type || !NON_BEVERAGE_PRODUCT_TYPES.has(type);