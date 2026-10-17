const test = require('node:test');
const assert = require('node:assert/strict');
const { getCategoryOptions } = require('../services/productEnrich.service');
const query = value => ({ select() { return this; }, lean: async () => value });

test('enrichment lists actual SubCategory documents under their own parent', async () => {
  const options = await getCategoryOptions({
    Category: { find: () => query([{ _id: 'cat1', name: 'Vapes & E-cigarettes', parent: null }]) },
    SubCategory: { find: () => query([{ _id: 'sub1', name: 'Vape Kits & Devices', parent: 'cat1' }]) },
  });
  assert.deepEqual(options, { categories: ['Vapes & E-cigarettes'], subcategories: { 'Vapes & E-cigarettes': ['Vape Kits & Devices'] } });
});

test('subcategory resolution accepts an existing ID only within the selected category', async () => {
  const { resolveSubcategory } = require('../services/resolveSubcategory');
  const id = '507f1f77bcf86cd799439011';
  const model = { findOne: filter => query(filter._id === id && filter.parent === 'parent1' ? { _id: id } : null) };
  assert.equal(await resolveSubcategory(id, 'parent1', model), id);
  assert.equal(await resolveSubcategory(id, 'different-parent', model), null);
});

test('subcategory names are literal, not regex patterns matching other shelves', async () => {
  const { resolveSubcategory } = require('../services/resolveSubcategory');
  const model = { findOne: filter => query(filter.parent === 'parent1' && filter.$or[0].name.test('Nuts & Seeds') ? { _id: 'nuts1' } : null) };
  assert.equal(await resolveSubcategory('Nuts & Seeds', 'parent1', model), 'nuts1');
  assert.equal(await resolveSubcategory('.*', 'parent1', model), null);
  assert.equal(await resolveSubcategory('', 'parent1', model), null);
});
