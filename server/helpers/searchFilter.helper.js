const mongoose = require('mongoose');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Brand = require('../models/Brand');

/**
 * Resolve category names to ObjectIds
 * @param {string[]} names - Category names to resolve
 * @returns {Promise<string[]>} Array of ObjectId strings
 */
const resolveCategoryToObjectIds = async (names) => {
  if (!names || names.length === 0) return [];
  
  const categories = await Category.find({
    $or: names.map(n => ({ name: new RegExp(`^${n}$`, 'i') })),
    status: 'published'
  }).select('_id').lean();
  
  return categories.map(c => c._id.toString());
};

/**
 * Resolve subcategory names to ObjectIds
 * @param {string[]} names - Subcategory names to resolve
 * @param {string} [parentCategoryId] - Optional parent category ObjectId string
 * @returns {Promise<string[]>} Array of ObjectId strings
 */
const resolveSubCategoryToObjectIds = async (names, parentCategoryId = null) => {
  if (!names || names.length === 0) return [];
  
  const query = {
    $or: names.map(n => ({ name: new RegExp(`^${n}$`, 'i') })),
    status: 'published'
  };
  
  if (parentCategoryId) {
    query.parent = parentCategoryId;
  }
  
  const subCategories = await SubCategory.find(query).select('_id').lean();
  return subCategories.map(c => c._id.toString());
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
  resolveCategoryToObjectIds,
  resolveSubCategoryToObjectIds,
  resolveBrandToObjectIds,
  buildCategoryFilter,
  buildSubCategoryFilter,
  buildBrandFilter,
  isObjectId,
  toObjectId
};
