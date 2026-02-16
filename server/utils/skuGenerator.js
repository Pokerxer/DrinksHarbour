// utils/skuGenerator.js

const crypto = require('crypto');
const SubProduct = require('../models/subProduct');
const Size = require('../models/size');
const Tenant = require('../models/tenant');
const Product = require('../models/product');

// ============================================================
// SKU GENERATION STRATEGIES
// ============================================================

/**
 * SKU Format Options:
 * 1. Sequential: TENANT-PRODUCT-0001
 * 2. Hierarchical: CAT-BRAND-PROD-VAR
 * 3. Hash-based: TEN123-PROD456-ABC123
 * 4. Date-based: 20260130-TEN-PROD-001
 * 5. Custom: Based on business rules
 */

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Generate random alphanumeric string
 */
const generateRandomString = (length = 6, uppercase = true) => {
  const chars = uppercase 
    ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    : 'abcdefghijklmnopqrstuvwxyz0123456789';
  
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
};

/**
 * Generate hash from string
 */
const generateHash = (input, length = 6) => {
  const hash = crypto
    .createHash('sha256')
    .update(input.toString())
    .digest('hex');
  
  return hash.substring(0, length).toUpperCase();
};

/**
 * Clean and format string for SKU
 */
const cleanForSKU = (str, maxLength = 10) => {
  if (!str) return '';
  
  return str
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, maxLength);
};

/**
 * Get tenant prefix (first 3 letters + ID hash)
 */
const getTenantPrefix = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).select('slug').lean();
  
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  
  const slugPrefix = cleanForSKU(tenant.slug, 3);
  const hashSuffix = generateHash(tenantId.toString(), 3);
  
  return `${slugPrefix}${hashSuffix}`;
};

/**
 * Get product code (from name or ID)
 */
const getProductCode = async (productId) => {
  const product = await Product.findById(productId).select('name type').lean();
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  const nameCode = cleanForSKU(product.name, 4);
  const hashCode = generateHash(productId.toString(), 4);
  
  return `${nameCode}${hashCode}`;
};

/**
 * Get sequential number for SKU
 */
const getNextSequentialNumber = async (prefix, model, field = 'sku') => {
  // Find highest number with this prefix
  const regex = new RegExp(`^${prefix}-(\\d+)$`);
  
  const lastItem = await model
    .findOne({ [field]: regex })
    .sort({ [field]: -1 })
    .select(field)
    .lean();
  
  if (!lastItem) {
    return 1;
  }
  
  const match = lastItem[field].match(regex);
  if (!match) {
    return 1;
  }
  
  return parseInt(match[1]) + 1;
};

/**
 * Pad number with leading zeros
 */
const padNumber = (num, length = 4) => {
  return num.toString().padStart(length, '0');
};

/**
 * Check if SKU exists
 */
const skuExists = async (sku, model) => {
  const existing = await model.findOne({ sku }).select('_id').lean();
  return !!existing;
};

// ============================================================
// MAIN SKU GENERATORS
// ============================================================

/**
 * Generate SKU for SubProduct
 * Format: TENANT_PREFIX-PRODUCT_CODE-RANDOM
 * Example: ABC123-WINE456-X7Y9Z2
 */
const generateSKU = async (productId, tenantId, options = {}) => {
  const {
    strategy = 'hash', // 'hash', 'sequential', 'hierarchical', 'date'
    prefix = '',
    suffix = '',
  } = options;

  try {
    let sku;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique SKU after maximum attempts');
      }

      switch (strategy) {
        case 'sequential':
          sku = await generateSequentialSKU(productId, tenantId, prefix, suffix);
          break;
        
        case 'hierarchical':
          sku = await generateHierarchicalSKU(productId, tenantId, prefix, suffix);
          break;
        
        case 'date':
          sku = await generateDateBasedSKU(productId, tenantId, prefix, suffix);
          break;
        
        case 'hash':
        default:
          sku = await generateHashBasedSKU(productId, tenantId, prefix, suffix);
          break;
      }

      attempts++;
    } while (await skuExists(sku, SubProduct));

    return sku;
  } catch (error) {
    console.error('SKU generation error:', error);
    throw new Error(`Failed to generate SKU: ${error.message}`);
  }
};

/**
 * Generate hash-based SKU
 * Format: TEN123-PROD456-ABC123
 */
const generateHashBasedSKU = async (productId, tenantId, prefix, suffix) => {
  const tenantPrefix = await getTenantPrefix(tenantId);
  const productCode = await getProductCode(productId);
  const randomSuffix = generateRandomString(6);

  const parts = [
    prefix,
    tenantPrefix,
    productCode,
    randomSuffix,
    suffix,
  ].filter(Boolean);

  return parts.join('-');
};

/**
 * Generate sequential SKU
 * Format: TENANT-PRODUCT-0001
 */
const generateSequentialSKU = async (productId, tenantId, prefix, suffix) => {
  const tenantPrefix = await getTenantPrefix(tenantId);
  const productCode = await getProductCode(productId);
  const basePrefix = [prefix, tenantPrefix, productCode].filter(Boolean).join('-');
  
  const nextNumber = await getNextSequentialNumber(basePrefix, SubProduct);
  const paddedNumber = padNumber(nextNumber, 4);

  const parts = [
    basePrefix,
    paddedNumber,
    suffix,
  ].filter(Boolean);

  return parts.join('-');
};

/**
 * Generate hierarchical SKU
 * Format: CAT-BRAND-PRODUCT-VARIANT
 */
const generateHierarchicalSKU = async (productId, tenantId, prefix, suffix) => {
  const product = await Product.findById(productId)
    .populate('category', 'slug')
    .populate('brand', 'slug')
    .lean();

  if (!product) {
    throw new Error('Product not found');
  }

  const categoryCode = product.category 
    ? cleanForSKU(product.category.slug, 3)
    : 'GEN';
  
  const brandCode = product.brand
    ? cleanForSKU(product.brand.slug, 3)
    : 'UNB';
  
  const productCode = cleanForSKU(product.name, 4);
  const tenantCode = generateHash(tenantId.toString(), 3);
  const randomCode = generateRandomString(4);

  const parts = [
    prefix,
    categoryCode,
    brandCode,
    productCode,
    tenantCode,
    randomCode,
    suffix,
  ].filter(Boolean);

  return parts.join('-');
};

/**
 * Generate date-based SKU
 * Format: 20260130-TEN-PROD-001
 */
const generateDateBasedSKU = async (productId, tenantId, prefix, suffix) => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  
  const tenantCode = generateHash(tenantId.toString(), 3);
  const productCode = generateHash(productId.toString(), 4);
  
  const basePrefix = [prefix, dateStr, tenantCode, productCode].filter(Boolean).join('-');
  const nextNumber = await getNextSequentialNumber(basePrefix, SubProduct);
  const paddedNumber = padNumber(nextNumber, 3);

  const parts = [
    basePrefix,
    paddedNumber,
    suffix,
  ].filter(Boolean);

  return parts.join('-');
};

// ============================================================
// SIZE SKU GENERATORS
// ============================================================

/**
 * Generate SKU for Size variant
 * Format: SUBPRODUCT_SKU-SIZE_CODE
 * Example: ABC123-WINE456-X7Y9Z2-70CL
 */
const generateSizeSKU = async (subProductId, sizeValue, options = {}) => {
  const {
    strategy = 'append', // 'append', 'sequential', 'hash'
  } = options;

  try {
    const subProduct = await SubProduct.findById(subProductId).select('sku').lean();
    
    if (!subProduct || !subProduct.sku) {
      throw new Error('SubProduct SKU not found');
    }

    let sizeSKU;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique Size SKU after maximum attempts');
      }

      switch (strategy) {
        case 'sequential':
          sizeSKU = await generateSequentialSizeSKU(subProduct.sku, sizeValue);
          break;
        
        case 'hash':
          sizeSKU = await generateHashSizeSKU(subProduct.sku, sizeValue);
          break;
        
        case 'append':
        default:
          sizeSKU = generateAppendSizeSKU(subProduct.sku, sizeValue);
          break;
      }

      attempts++;
    } while (await skuExists(sizeSKU, Size));

    return sizeSKU;
  } catch (error) {
    console.error('Size SKU generation error:', error);
    throw new Error(`Failed to generate Size SKU: ${error.message}`);
  }
};

/**
 * Append size to SubProduct SKU
 */
const generateAppendSizeSKU = (subProductSKU, sizeValue) => {
  const sizeCode = cleanForSKU(sizeValue, 6);
  return `${subProductSKU}-${sizeCode}`;
};

/**
 * Sequential size SKU
 */
const generateSequentialSizeSKU = async (subProductSKU, sizeValue) => {
  const basePrefix = `${subProductSKU}-${cleanForSKU(sizeValue, 4)}`;
  const nextNumber = await getNextSequentialNumber(basePrefix, Size);
  const paddedNumber = padNumber(nextNumber, 2);
  
  return `${basePrefix}-${paddedNumber}`;
};

/**
 * Hash-based size SKU
 */
const generateHashSizeSKU = (subProductSKU, sizeValue) => {
  const sizeHash = generateHash(sizeValue, 4);
  const randomSuffix = generateRandomString(3);
  
  return `${subProductSKU}-${sizeHash}${randomSuffix}`;
};

// ============================================================
// BARCODE GENERATORS
// ============================================================

/**
 * Generate EAN-13 barcode (simplified)
 * Note: This is a basic implementation. For production, use a proper EAN-13 library
 */
const generateEAN13 = (prefix = '200') => {
  // Ensure prefix is 3 digits
  const eanPrefix = prefix.padStart(3, '0').substring(0, 3);
  
  // Generate 9 random digits
  const randomPart = Math.floor(Math.random() * 1000000000)
    .toString()
    .padStart(9, '0');
  
  // Calculate check digit
  const partialCode = eanPrefix + randomPart;
  const checkDigit = calculateEAN13CheckDigit(partialCode);
  
  return partialCode + checkDigit;
};

/**
 * Calculate EAN-13 check digit
 */
const calculateEAN13CheckDigit = (code) => {
  let sum = 0;
  
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
};

/**
 * Validate EAN-13 barcode
 */
const validateEAN13 = (barcode) => {
  if (!/^\d{13}$/.test(barcode)) {
    return false;
  }
  
  const checkDigit = parseInt(barcode[12]);
  const calculatedCheckDigit = calculateEAN13CheckDigit(barcode.substring(0, 12));
  
  return checkDigit === calculatedCheckDigit;
};

/**
 * Generate UPC-A barcode
 */
const generateUPCA = () => {
  // Generate 11 random digits
  const randomPart = Math.floor(Math.random() * 100000000000)
    .toString()
    .padStart(11, '0');
  
  // Calculate check digit (same algorithm as EAN-13)
  const checkDigit = calculateEAN13CheckDigit(randomPart);
  
  return randomPart + checkDigit;
};

// ============================================================
// BATCH OPERATIONS
// ============================================================

/**
 * Generate multiple SKUs at once
 */
const generateBatchSKUs = async (productId, tenantId, count = 1, options = {}) => {
  const skus = [];
  
  for (let i = 0; i < count; i++) {
    const sku = await generateSKU(productId, tenantId, options);
    skus.push(sku);
  }
  
  return skus;
};

/**
 * Regenerate SKU (for fixing/updating)
 */
const regenerateSKU = async (subProductId, options = {}) => {
  const subProduct = await SubProduct.findById(subProductId)
    .select('product tenant')
    .lean();
  
  if (!subProduct) {
    throw new Error('SubProduct not found');
  }
  
  const newSKU = await generateSKU(
    subProduct.product,
    subProduct.tenant,
    options
  );
  
  // Update SubProduct
  await SubProduct.findByIdAndUpdate(subProductId, { sku: newSKU });
  
  return newSKU;
};

// ============================================================
// VALIDATION & UTILITIES
// ============================================================

/**
 * Validate SKU format
 */
const validateSKU = (sku) => {
  // Basic validation rules
  if (!sku || typeof sku !== 'string') {
    return { valid: false, error: 'SKU must be a non-empty string' };
  }
  
  if (sku.length < 5 || sku.length > 50) {
    return { valid: false, error: 'SKU length must be between 5 and 50 characters' };
  }
  
  if (!/^[A-Z0-9-]+$/.test(sku)) {
    return { valid: false, error: 'SKU can only contain uppercase letters, numbers, and hyphens' };
  }
  
  return { valid: true };
};

/**
 * Parse SKU to extract components
 */
const parseSKU = (sku, strategy = 'hash') => {
  const parts = sku.split('-');
  
  switch (strategy) {
    case 'hash':
      return {
        tenantPrefix: parts[0],
        productCode: parts[1],
        random: parts[2],
      };
    
    case 'sequential':
      return {
        tenantPrefix: parts[0],
        productCode: parts[1],
        sequence: parts[2],
      };
    
    case 'hierarchical':
      return {
        category: parts[0],
        brand: parts[1],
        product: parts[2],
        tenant: parts[3],
        random: parts[4],
      };
    
    case 'date':
      return {
        date: parts[0],
        tenant: parts[1],
        product: parts[2],
        sequence: parts[3],
      };
    
    default:
      return { parts };
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Main generators
  generateSKU,
  generateSizeSKU,
  
  // Barcode generators
  generateEAN13,
  generateUPCA,
  validateEAN13,
  
  // Batch operations
  generateBatchSKUs,
  regenerateSKU,
  
  // Validation
  validateSKU,
  parseSKU,
  
  // Utilities
  generateRandomString,
  generateHash,
  cleanForSKU,
  padNumber,
  skuExists,
};