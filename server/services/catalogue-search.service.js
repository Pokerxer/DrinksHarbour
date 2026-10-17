'use strict';

const Product = require('../models/Product');
const Brand = require('../models/Brand');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const { buildExpandedTextQuery, preprocessQuery, toSearchPattern } = require('./semanticSearch.service');
const { catalogueNamePattern, rankCatalogueProducts, normalize } = require('./catalogue-search-ranking');

const PUBLIC_FIELDS = ['_id', 'name', 'slug', 'type', 'subType', 'brand', 'category',
  'subCategory', 'barcode', 'volumeMl', 'abv', 'originCountry', 'producer',
  'flavorProfile', 'shortDescription', 'images', 'primaryImage', 'thumbImage', 'status'];

async function searchCatalogueProducts({ query = '', type, limit = 15 } = {}) {
  const term = String(query).trim().slice(0, 160);
  if (normalize(term).length < 2) return { products: [] };
  const namePattern = catalogueNamePattern(term);
  const expanded = preprocessQuery(term).expandedTerms.slice(0, 30);
  const taxonomyPattern = new RegExp([...expanded.map(toSearchPattern), namePattern.source].join('|'), 'i');
  const taxonomy = await Promise.all([Brand, Category, SubCategory].map((Model) =>
    Model.find({ name: taxonomyPattern }).select('_id name').limit(30).lean()));
  const clauses = buildExpandedTextQuery(term)?.$or || [];
  clauses.push({ name: namePattern }, { barcode: term });
  ['brand', 'category', 'subCategory'].forEach((field, index) => {
    if (taxonomy[index].length) clauses.push({ [field]: { $in: taxonomy[index].map((entry) => entry._id) } });
  });
  const match = { status: { $in: ['approved', 'pending'] }, $or: clauses };
  if (type) match.type = new RegExp(`^${toSearchPattern(String(type))}$`, 'i');
  const exactName = `^${toSearchPattern(term)}$`;
  const tokenScores = preprocessQuery(term).tokens.slice(0, 10).map((token) => ({
    $cond: [{ $regexMatch: { input: '$name', regex: toSearchPattern(token), options: 'i' } }, 100, 0],
  }));
  const rows = await Product.aggregate([
    { $match: match },
    { $addFields: { _candidateScore: { $add: [
      { $cond: [{ $eq: ['$barcode', term] }, 10000, 0] },
      { $cond: [{ $regexMatch: { input: '$name', regex: exactName, options: 'i' } }, 9000, 0] },
      ...tokenScores,
    ] } } },
    { $sort: { _candidateScore: -1, name: 1, _id: 1 } },
    { $limit: 300 },
    { $project: Object.fromEntries(PUBLIC_FIELDS.map((field) => [field, 1])) },
  ]);
  const populated = await Product.populate(rows, ['brand', 'category', 'subCategory']
    .map((path) => ({ path, select: 'name' })));
  const products = rankCatalogueProducts(populated, term).slice(0, Math.max(1, Math.min(15, Number(limit) || 15)))
    .map((product) => Object.fromEntries([...PUBLIC_FIELDS, 'matchKind', 'matchReason']
      .filter((field) => product[field] !== undefined).map((field) => [field, product[field]])));
  return { products };
}

module.exports = { searchCatalogueProducts };
