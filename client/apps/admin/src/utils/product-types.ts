import {generalNonBeverageTypes} from './general-product-types';
import {hospitalityProductTypeValues} from './hospitality-product-types';
import {retailProductTypeValues} from './retail-product-types';
// Mirrors `server/constants/productTypes.js` NON_BEVERAGE_TYPES plus the extra
// accessory/gift values the Product model allows ('accessory', 'gift', 'ice',
// 'subscription_box'). Anything not in this set is treated as a beverage.
// The 37 retail verticals (electronics_/fashion_/beauty_/home_ prefixed) are
// all server NON_BEVERAGE_TYPES (beverage=false) — included via the canonical
// retail mirror below so beverage-step hiding and drink-field gating apply to
// them the same way as for other non-beverages. Same treatment for the 14
// hospitality/foodservice types (foodservice_/hospitality_ prefixed, supply
// category 'hospitality') via the hospitality mirror below.
export const NON_BEVERAGE_PRODUCT_TYPES: ReadonlySet<string> = new Set([
  ...generalNonBeverageTypes,
  ...retailProductTypeValues,
  ...hospitalityProductTypeValues,
  'vape',
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
