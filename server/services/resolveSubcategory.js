const mongoose = require('mongoose');
const SubCategory = require('../models/SubCategory');
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Product.subCategory references SubCategory, not the Category collection.
// Names are matched literally and cannot select another category's child.
async function resolveSubcategory(value, categoryId, model = SubCategory) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  const filter = categoryId ? { parent: categoryId } : {};
  if (mongoose.Types.ObjectId.isValid(input) && /^[a-f\d]{24}$/i.test(input)) {
    filter._id = input;
  } else {
    const slug = input.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    filter.$or = [{ name: new RegExp(`^${escapeRegex(input)}$`, 'i') }, { slug }];
  }
  const doc = await model.findOne(filter).select('_id').lean();
  return doc?._id || null;
}

module.exports = { resolveSubcategory };
