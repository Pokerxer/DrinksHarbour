// utils/slugify.js

const slugifyLib = require('slugify');


/**
 * Convert a string to URL-friendly slug
 * @param {string} text - Text to slugify
 * @param {object} options - Slugify options
 * @returns {string} - Slugified string
 * 
 * @example
 * slugify('Johnnie Walker Black Label') // 'johnnie-walker-black-label'
 * slugify('Château Margaux 2015') // 'chateau-margaux-2015'
 * slugify('Baileys Irish Cream') // 'baileys-irish-cream'
 */
function slugify(text, options = {}) {
  const defaults = {
    lowercase: true,
    separator: '-',
    replacements: {
      'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
      'ç': 'c',
      'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
      'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
      'ñ': 'n',
      'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o', 'œ': 'oe',
      'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
      'ý': 'y', 'ÿ': 'y',
      'ß': 'ss',
      // Additional replacements
      'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Æ': 'AE',
      'Ç': 'C',
      'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
      'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
      'Ñ': 'N',
      'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O', 'Œ': 'OE',
      'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
      'Ý': 'Y', 'Ÿ': 'Y',
    },
  };

  const config = { ...defaults, ...options };

  if (!text || typeof text !== 'string') {
    return '';
  }

  let slug = text.trim();

  // Replace accented characters
  Object.entries(config.replacements).forEach(([char, replacement]) => {
    slug = slug.replace(new RegExp(char, 'g'), replacement);
  });

  // Convert to lowercase if specified
  if (config.lowercase) {
    slug = slug.toLowerCase();
  }

  // Replace special characters and spaces with separator
  slug = slug
    .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
    .replace(/[\s_-]+/g, config.separator) // Replace spaces, underscores, and multiple hyphens with separator
    .replace(new RegExp(`^${config.separator}+|${config.separator}+$`, 'g'), ''); // Trim separators from start/end

  return slug;
}

/**
 * Generate unique slug with counter suffix
 * @param {string} text - Base text
 * @param {number} counter - Counter value
 * @returns {string} - Slugified string with counter
 * 
 * @example
 * slugifyWithCounter('Guinness Stout', 1) // 'guinness-stout-1'
 */
function slugifyWithCounter(text, counter) {
  const baseSlug = slugify(text);
  return counter > 0 ? `${baseSlug}-${counter}` : baseSlug;
}

/**
 * Generate slug from product name and variant
 * @param {string} name - Product name
 * @param {string} variant - Variant/size
 * @returns {string} - Combined slug
 * 
 * @example
 * slugifyProduct('Heineken', '330ml') // 'heineken-330ml'
 */
function slugifyProduct(name, variant = '') {
  const namePart = slugify(name);
  const variantPart = variant ? slugify(variant) : '';
  return variantPart ? `${namePart}-${variantPart}` : namePart;
}

/**
 * Validate slug format
 * @param {string} slug - Slug to validate
 * @returns {boolean} - Whether slug is valid
 */
function isValidSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    return false;
  }
  // Valid slug: lowercase letters, numbers, and hyphens only
  // Cannot start or end with hyphen
  // No consecutive hyphens
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugPattern.test(slug);
}

/**
 * Sanitize slug (fix common issues)
 * @param {string} slug - Slug to sanitize
 * @returns {string} - Sanitized slug
 */
function sanitizeSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    return '';
  }

  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphen
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}


/**
 * Creates a clean, URL-safe slug for products, tenants, categories, brands, etc.
 * Ensures uniqueness when needed by checking database (handled in service layer).
 *
 * @param {string} text - The text to slugify (e.g. product name, tenant name)
 * @param {Object} [options] - Optional slugify settings
 * @returns {string} Clean slug
 */
function createSlug(text, options = {}) {
  if (!text || typeof text !== 'string') {
    throw new Error('createSlug: text must be a non-empty string');
  }

  const defaultOptions = {
    lower: true,
    strict: true,           // remove all non-alphanumeric except hyphen
    trim: true,
    remove: /[*+~.()'"!:@]/g,
  };

  return slugifyLib(text, { ...defaultOptions, ...options });
}

/**
 * Generate a unique slug by appending a number if base slug exists.
 * Used in services when creating entities that require unique slugs.
 *
 * @param {string} baseText - Original text (name)
 * @param {Function} existsCheck - Async function that returns true if slug exists
 * @returns {Promise<string>} Guaranteed unique slug
 *
 * @example
 * const slug = await generateUniqueSlug(
 *   'My Product Name',
 *   async (slug) => {
 *     const exists = await Product.findOne({ slug }).lean();
 *     return !!exists;
 *   }
 * );
 */
async function generateUniqueSlug(baseText, existsCheck) {
  if (!baseText || typeof baseText !== 'string') {
    throw new Error('generateUniqueSlug: baseText must be a non-empty string');
  }

  if (typeof existsCheck !== 'function') {
    throw new Error('generateUniqueSlug: existsCheck must be a function');
  }

  let slug = createSlug(baseText);
  let counter = 1;
  let finalSlug = slug;

  while (await existsCheck(finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
}

module.exports = {
  createSlug,
  generateUniqueSlug,
  slugify,
  slugifyWithCounter,
  slugifyProduct,
  isValidSlug,
  sanitizeSlug,
};