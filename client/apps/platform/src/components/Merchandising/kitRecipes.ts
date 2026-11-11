import type { ProductType } from '@/types/product.types';

interface Ingredient {
  query: string;
  types: readonly string[];
  subCategories?: readonly string[];
  searchSubCategories?: readonly string[];
  categories?: readonly string[];
  broadTypes: readonly string[];
  alias: RegExp;
  alcoholic: boolean;
}

export interface KitRecipe {
  name: string;
  prompt: string;
  base: Ingredient;
  mixer: Ingredient;
  optional?: Ingredient;
}

const spirit = ['spirit', 'spirits'];
const mixerTypes = ['soft_drink', 'soft_drinks', 'soda', 'mixer', 'cocktail_mixers', 'non_alcoholic'];
const waterTypes = [...mixerTypes, 'water', 'mineral_water'];
const juiceTypes = [...mixerTypes, 'juice', 'fruit_juice', 'cold_pressed'];
const syrupTypes = [...mixerTypes, 'syrup'];

const sodaWater: Ingredient = {
  query: 'soda water',
  types: ['soda_water', 'club_soda', 'sparkling_water', 'sparkling_mineral_water'],
  broadTypes: waterTypes,
  alias: /\b(soda water|club soda|sparkling (mineral )?water)\b/,
  alcoholic: false,
};

export const kitRecipes: readonly KitRecipe[] = [
  {
    name: 'Gin and tonic kit', prompt: 'Complete your gin and tonic',
    base: {
      query: 'gin', alcoholic: true, broadTypes: spirit, alias: /\bgin\b/,
      types: ['gin', 'london_dry_gin', 'old_tom_gin', 'plymouth_gin', 'navy_gin', 'navy_strength_gin',
        'sloe_gin', 'flavored_gin', 'flavoured_gin', 'japanese_gin', 'premium_gin', 'contemporary_gin', 'genever'],
      categories: ['gin'],
    },
    mixer: {
      query: 'tonic water', alcoholic: false, broadTypes: waterTypes,
      types: ['tonic_water', 'soda_tonic_water'],
      subCategories: ['tonic-water'],
      alias: /\b(tonic water|indian tonic)\b/,
    },
  },
  {
    name: 'Whisky highball kit', prompt: 'Complete your whisky highball',
    base: {
      query: 'whisky', alcoholic: true, broadTypes: spirit, alias: /\b(whisk(?:e)?y|scotch|bourbon)\b/,
      types: ['whisky', 'whiskey', 'bourbon', 'scotch', 'rye_whiskey', 'irish_whiskey', 'japanese_whisky',
        'single_malt_scotch', 'blended_scotch', 'single_malt_whisky', 'blended_whisky'],
      categories: ['whisky', 'whiskey', 'bourbon', 'scotch', 'japanese-whisky', 'irish-whiskey', 'american-whiskey', 'world-whisky', 'rye-whiskey'],
    },
    mixer: sodaWater,
  },
  {
    name: 'Rum and ginger kit', prompt: 'Complete your rum and ginger',
    base: {
      query: 'rum', alcoholic: true, broadTypes: spirit, alias: /\b(rum|rhum agricole)\b/,
      types: ['rum', 'white_rum', 'dark_rum', 'spiced_rum', 'gold_rum', 'aged_rum',
        'rhum_agricole', 'overproof_rum', 'flavored_rum', 'premium_rum'],
      categories: ['rum'],
    },
    mixer: {
      query: 'ginger beer', alcoholic: false, broadTypes: mixerTypes,
      types: ['ginger_beer'], searchSubCategories: ['ginger-beer-ginger-ale'], alias: /\bginger beer\b/,
    },
  },
  {
    name: 'Rum and cola kit', prompt: 'Complete your rum and cola',
    base: {
      query: 'rum', alcoholic: true, broadTypes: spirit, alias: /\b(rum|rhum agricole)\b/,
      types: ['rum', 'white_rum', 'dark_rum', 'spiced_rum', 'gold_rum', 'aged_rum',
        'rhum_agricole', 'overproof_rum', 'flavored_rum', 'premium_rum'],
      categories: ['rum'],
    },
    mixer: {
      query: 'cola', alcoholic: false, broadTypes: mixerTypes, types: ['cola'],
      alias: /\b(cola|coca cola|pepsi)\b/,
    },
  },
  {
    name: 'Sparkling mocktail kit', prompt: 'Complete your sparkling mocktail',
    base: {
      query: 'syrup', alcoholic: false, broadTypes: syrupTypes, alias: /\b(syrup|cordial|sirop)\b/,
      types: ['syrup', 'simple_syrup', 'fruit_syrup', 'grenadine', 'cocktail_syrup', 'cordial'],
      subCategories: ['fruit-syrups', 'soda-syrups', 'cocktail-syrup'],
      categories: ['syrup'],
    },
    mixer: {
      ...sodaWater, query: 'sparkling water', broadTypes: [...waterTypes, ...juiceTypes],
      subCategories: ['sparkling-fruit-juice'],
      alias: /\b(soda water|club soda|sparkling (mineral )?water|sparkling apple( juice)?)\b/,
    },
    optional: {
      query: 'lime juice', alcoholic: false, broadTypes: juiceTypes, types: ['lime_juice'],
      alias: /\blime juice\b/,
    },
  },
];

const normalize = (value?: string | null) => value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') ?? '';

const specificTaxonomy = new Set([
  ...kitRecipes.flatMap(recipe => [recipe.base, recipe.mixer, recipe.optional].flatMap(role =>
    role ? [...role.types, ...(role.subCategories ?? []), ...(role.categories ?? [])].map(normalize) : [],
  )),
  'ginger_ale', 'flavored_water', 'still_water', 'root_beer', 'orange_soda', 'lemon_lime',
]);

const genericTaxonomy = new Set([
  ...spirit, ...waterTypes, ...juiceTypes, ...syrupTypes,
  'beverage', 'beverages', 'drinks', 'ginger_soda', 'ginger_beer_ginger_ale',
]);
export function needsKitTaxonomy(product: ProductType) {
  const hasSubcategory = typeof product.subCategory === 'object'
    ? !!(product.subCategory?.slug || product.subCategory?.name || product.subCategory?.type)
    : !!product.subCategory && !/^[a-f\d]{24}$/i.test(product.subCategory);
  return !hasSubcategory && !product.subType &&
    (!product.type || genericTaxonomy.has(normalize(product.type)));
}

const preparedDrink = /\b(ready to drink|rtd|premix\w*|hard seltzer|gin (and |n )?tonic|gin tonic|rum (and |n )?cola)\b/;

function hasValue(values: readonly string[] | undefined, value: string) {
  return values?.some(entry => normalize(entry) === value) ?? false;
}

export function matchesIngredient(product: ProductType, ingredient: Ingredient) {
  const category = product.category;
  const subCategory = typeof product.subCategory === 'string'
    ? { name: /^[a-f\d]{24}$/i.test(product.subCategory) ? '' : product.subCategory }
    : product.subCategory;
  const fields = [product.type, product.subType, category?.slug, category?.type, category?.name,
    subCategory?.slug, subCategory?.name, subCategory?.type, subCategory?.subType];
  const name = normalize(product.name).replaceAll('_', ' ');
  if (fields.some(value => preparedDrink.test(normalize(value).replaceAll('_', ' '))) ||
      preparedDrink.test(name) || product.isGiftPackaging) return false;
  if (ingredient.alcoholic ? product.isAlcoholic === false :
    product.isAlcoholic === true || (product.abv ?? 0) > 0.5) return false;

  const type = normalize(product.type);
  const subtype = normalize(product.subType);
  const accepted = (value: string) => hasValue(ingredient.types, value) || hasValue(ingredient.subCategories, value);
  if (type && !accepted(type) && !hasValue(ingredient.broadTypes, type)) return false;
  const exactSubcategory = [subCategory?.slug, subCategory?.name, subCategory?.type, subCategory?.subType].map(normalize);
  const exactCategory = [category?.slug, category?.name, category?.type].map(normalize);
  if ([subtype, ...exactSubcategory, ...exactCategory].some(value =>
    specificTaxonomy.has(value) && !accepted(value) && !hasValue(ingredient.categories, value) && !genericTaxonomy.has(value),
  )) return false;
  if (accepted(type) || accepted(subtype) || exactSubcategory.some(accepted) ||
      exactCategory.some(value => accepted(value) || hasValue(ingredient.categories, value))) return true;

  return exactSubcategory.every(value => !value || genericTaxonomy.has(value)) &&
    exactCategory.every(value => !value || genericTaxonomy.has(value)) &&
    ingredient.alias.test(name);
}
