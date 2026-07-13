const mongoose = require('mongoose');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Brand = require('../models/Brand');

// Umbrella/marketing slugs (footer, ads, SEO pages link to ?category=wines,
// ?category=spirits, …) mapped to Category.type family PATTERNS. Resolution
// stays DB-driven: an umbrella slug matches every *published Category
// document* whose `type` matches the family pattern, so categories added to
// the DB later (e.g. japanese-whisky, world-whisky, port-wine/fortified_wine)
// join their family automatically — nothing here duplicates catalog data.
const WHISKY_PATTERN   = 'whisk|scotch|bourbon';
const WINE_PATTERN     = 'wine|champagne';
const SPIRIT_PATTERN   = `${WHISKY_PATTERN}|vodka|gin|rum|tequila|brandy|cognac|soju|baijiu|shochu|mezcal|liqueur|aperitif|digestif|cocktail`;
const BEER_PATTERN     = 'beer|cider';
const NON_ALCO_PATTERN = 'coffee|tea|juice|soda|water|milk|yogurt|soft_drink|dairy|functional|syrup';

const CATEGORY_TYPE_GROUPS = {
  'wine':           WINE_PATTERN,
  'wines':          WINE_PATTERN,
  'whisky':         WHISKY_PATTERN,
  'whiskies':       WHISKY_PATTERN,
  'whiskeys':       WHISKY_PATTERN,
  'scotch-whisky':  'scotch',
  'spirit':         SPIRIT_PATTERN,
  'spirits':        SPIRIT_PATTERN,
  'beers':          BEER_PATTERN,
  'beers-ciders':   BEER_PATTERN,
  'ciders':         'cider',
  'non-alcoholic':  NON_ALCO_PATTERN,
  'nonalcoholic':   NON_ALCO_PATTERN,
};

/**
 * Split requested category slugs into Category.type family patterns (for
 * umbrella slugs) and literal slug candidates (with a de-pluralized fallback,
 * e.g. "vodkas" → also tries "vodka").
 * @param {string[]} names - Raw slugs/names from the URL
 * @returns {{ typePatterns: string[], slugs: string[] }}
 */
const expandCategorySlugs = (names) => {
  const typePatterns = new Set();
  const slugs = new Set();
  for (const raw of names || []) {
    const n = String(raw).toLowerCase().trim();
    if (!n) continue;
    const family = CATEGORY_TYPE_GROUPS[n];
    if (family) {
      typePatterns.add(family);
    } else {
      slugs.add(n);
      if (n.length > 3 && n.endsWith('s')) slugs.add(n.slice(0, -1));
    }
  }
  return { typePatterns: [...typePatterns], slugs: [...slugs] };
};

/**
 * Resolve category names to ObjectIds.
 * Umbrella slugs (wines, spirits, …) match Category.type by family pattern;
 * everything else matches by slug or display name, case-insensitively.
 * @param {string[]} names - Category names to resolve
 * @returns {Promise<string[]>} Array of ObjectId strings
 */
const resolveCategoryToObjectIds = async (names) => {
  if (!names || names.length === 0) return [];

  const { typePatterns, slugs } = expandCategorySlugs(names);
  if (typePatterns.length === 0 && slugs.length === 0) return [];

  const escaped = slugs.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const or = [
    ...typePatterns.map(p => ({ type: new RegExp(p, 'i') })),
    ...escaped.map(n => ({ slug: new RegExp(`^${n}$`, 'i') })),
    // Also match by display name so ?category=Red%20Wine style links work
    ...escaped.map(n => ({ name: new RegExp(`^${n}$`, 'i') })),
  ];

  const categories = await Category.find({ $or: or, status: 'published' })
    .select('_id').lean();

  return categories.map(c => c._id.toString());
};

/**
 * Resolve subcategory names to ObjectIds
 * Products reference Category documents at level 1 for subcategories,
 * but SubCategory collection also exists with unprefixed slugs.
 * @param {string[]} names - Subcategory names to resolve
 * @param {string} [parentCategoryId] - Optional parent category ObjectId string
 * @returns {Promise<string[]>} Array of ObjectId strings
 */
const resolveSubCategoryToObjectIds = async (names, parentCategoryId = null) => {
  if (!names || names.length === 0) return [];
  
  let categoryQuery = { status: 'published', level: 1 };
  if (parentCategoryId) {
    categoryQuery.parent = parentCategoryId;
  }
  
  const categorySubs = await Category.find(categoryQuery).select('_id slug parent').lean();
  
  let subCategoryQuery = { status: 'published' };
  if (parentCategoryId) {
    subCategoryQuery.parent = parentCategoryId;
  }
  const subCategories = await SubCategory.find(subCategoryQuery).select('_id slug parent').lean();
  
  const results = [];
  
  for (const name of names) {
    const nameLower = name.toLowerCase();
    
    const categoryMatch = categorySubs.find(sc => sc.slug.toLowerCase() === nameLower);
    if (categoryMatch) {
      results.push(categoryMatch._id.toString());
      continue;
    }
    
    let bestMatch = null;
    let bestMatchLength = 0;

    const allSubs = [...categorySubs, ...subCategories];
    for (const sc of allSubs) {
      const slugLower = sc.slug.toLowerCase();
      if (nameLower.endsWith('-' + slugLower) || nameLower === slugLower) {
        if (slugLower.length > bestMatchLength) {
          bestMatchLength = slugLower.length;
          bestMatch = sc;
        }
      }
      // Family/prefix match, DB-driven: a short marketing slug matches every
      // stored slug it prefixes, so ?subcategory=single-malt covers
      // single-malt-scotch, single-malt-japanese-whisky, … — whatever the
      // catalog actually contains.
      if (slugLower.startsWith(nameLower + '-')) {
        results.push(sc._id.toString());
      }
    }

    if (bestMatch) {
      results.push(bestMatch._id.toString());
    }
  }

  return [...new Set(results)];
};

/**
 * Resolve brand names to ObjectIds
 * @param {string[]} names - Brand names to resolve
 * @returns {Promise<string[]>} Array of ObjectId strings
 */
const resolveBrandToObjectIds = async (names) => {
  if (!names || names.length === 0) return [];
  
  const brands = await Brand.find({
    $or: names.map(n => ({ name: new RegExp(`^${n}$`, 'i') })),
    status: 'active'
  }).select('_id').lean();
  
  return brands.map(b => b._id.toString());
};

/**
 * Build category filter query object
 * @param {string|string[]} category - Category name(s) or ObjectId(s)
 * @param {string[]} [resolvedIds] - Pre-resolved category ObjectId strings
 * @returns {Promise<Object>} MongoDB query object
 */
const buildCategoryFilter = async (category, resolvedIds = []) => {
  if (!category) return null;
  
  if (Array.isArray(category)) {
    const names = category.filter(c => !/^[0-9a-fA-F]{24}$/.test(c));
    const objectIds = category.filter(c => /^[0-9a-fA-F]{24}$/.test(c));
    
    if (names.length > 0 && resolvedIds.length === 0) {
      resolvedIds.push(...await resolveCategoryToObjectIds(names));
    }
    
    const allIds = [...objectIds, ...resolvedIds];
    if (allIds.length > 0) {
      return { category: { $in: allIds.map(id => new mongoose.Types.ObjectId(id)) } };
    }
  } else {
    if (/^[0-9a-fA-F]{24}$/.test(category)) {
      return { category: new mongoose.Types.ObjectId(category) };
    } else {
      const resolved = await resolveCategoryToObjectIds([category]);
      if (resolved.length > 0) {
        return { category: { $in: resolved.map(id => new mongoose.Types.ObjectId(id)) } };
      }
    }
  }
  
  return null;
};

/**
 * Build subCategory filter query object
 * @param {string|string[]} subCategory - Subcategory name(s) or ObjectId(s)
 * @param {string[]} [resolvedIds] - Pre-resolved subcategory ObjectId strings
 * @param {string} [parentCategoryId] - Optional parent category ObjectId string
 * @returns {Promise<Object>} MongoDB query object
 */
const buildSubCategoryFilter = async (subCategory, resolvedIds = [], parentCategoryId = null) => {
  if (!subCategory) return null;
  
  if (Array.isArray(subCategory)) {
    const names = subCategory.filter(s => !/^[0-9a-fA-F]{24}$/.test(s));
    const objectIds = subCategory.filter(s => /^[0-9a-fA-F]{24}$/.test(s));
    
    if (names.length > 0 && resolvedIds.length === 0) {
      resolvedIds.push(...await resolveSubCategoryToObjectIds(names, parentCategoryId));
    }
    
    const allIds = [...objectIds, ...resolvedIds];
    if (allIds.length > 0) {
      return { subCategory: { $in: allIds.map(id => new mongoose.Types.ObjectId(id)) } };
    }
  } else {
    if (/^[0-9a-fA-F]{24}$/.test(subCategory)) {
      return { subCategory: new mongoose.Types.ObjectId(subCategory) };
    } else {
      const resolved = await resolveSubCategoryToObjectIds([subCategory], parentCategoryId);
      if (resolved.length > 0) {
        return { subCategory: { $in: resolved.map(id => new mongoose.Types.ObjectId(id)) } };
      }
    }
  }
  
  return null;
};

/**
 * Build brand filter query object
 * @param {string|string[]} brand - Brand name(s) or ObjectId(s)
 * @param {string[]} [resolvedIds] - Pre-resolved brand ObjectId strings
 * @returns {Promise<Object>} MongoDB query object
 */
const buildBrandFilter = async (brand, resolvedIds = []) => {
  if (!brand) return null;
  
  if (Array.isArray(brand)) {
    const names = brand.filter(b => !/^[0-9a-fA-F]{24}$/.test(b));
    const objectIds = brand.filter(b => /^[0-9a-fA-F]{24}$/.test(b));
    
    if (names.length > 0 && resolvedIds.length === 0) {
      resolvedIds.push(...await resolveBrandToObjectIds(names));
    }
    
    const allIds = [...objectIds, ...resolvedIds];
    if (allIds.length > 0) {
      return { brand: { $in: allIds.map(id => new mongoose.Types.ObjectId(id)) } };
    }
  } else {
    if (/^[0-9a-fA-F]{24}$/.test(brand)) {
      return { brand: new mongoose.Types.ObjectId(brand) };
    } else {
      const resolved = await resolveBrandToObjectIds([brand]);
      if (resolved.length > 0) {
        return { brand: { $in: resolved.map(id => new mongoose.Types.ObjectId(id)) } };
      }
    }
  }
  
  return null;
};

/**
 * Check if a value is a valid MongoDB ObjectId
 * @param {string} value - Value to check
 * @returns {boolean} True if valid ObjectId
 */
const isObjectId = (value) => {
  return /^[0-9a-fA-F]{24}$/.test(value);
};

/**
 * Convert string(s) to MongoDB ObjectId(s)
 * @param {string|string[]} values - String value(s) to convert
 * @returns {mongoose.Types.ObjectId|mongoose.Types.ObjectId[]} ObjectId(s)
 */
const toObjectId = (values) => {
  if (Array.isArray(values)) {
    return values.map(v => new mongoose.Types.ObjectId(v));
  }
  return new mongoose.Types.ObjectId(values);
};

module.exports = {
  CATEGORY_TYPE_GROUPS,
  expandCategorySlugs,
  resolveCategoryToObjectIds,
  resolveSubCategoryToObjectIds,
  resolveBrandToObjectIds,
  buildCategoryFilter,
  buildSubCategoryFilter,
  buildBrandFilter,
  isObjectId,
  toObjectId
};
