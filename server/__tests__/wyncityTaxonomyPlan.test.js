const test = require('node:test');
const assert = require('node:assert/strict');
const base = {
  categories: [
    { _id: 'vapes1', slug: 'vapes-e-cigarettes', name: 'Vapes & E-cigarettes' },
    { _id: 'wine1', slug: 'white-wine', name: 'White Wine' },
    { _id: 'snacks1', slug: 'snacks-treats', name: 'Snacks & Treats' },
  ],
  subcategories: [
    { _id: 'devices1', slug: 'vape-kits-and-devices', parent: 'vapes1' },
    { _id: 'pinot1', slug: 'pinot-grigio', parent: 'wine1' },
    { _id: 'nuts1', slug: 'nuts-and-seeds', parent: 'snacks1' },
  ],
};
test('plans only missing Cashew Nuts and reuses all existing shelves', () => {
  const { planTaxonomy } = require('../scripts/wyncity-taxonomy-plan');
  const plan = planTaxonomy(base);
  assert.equal(plan.creates.length, 1);
  assert.deepEqual(plan.creates[0], { name: 'Cashew Nuts', slug: 'cashew-nuts', parent: 'snacks1', type: 'nuts', subType: 'cashew', status: 'draft', showInMenu: false });
  assert.equal(plan.mappings.vape.categoryId, 'vapes1');
  assert.equal(plan.mappings.wine.subCategoryId, 'pinot1');
});
test('rerun is a no-op and wrong-parent subcategories cannot be reused', () => {
  const { planTaxonomy } = require('../scripts/wyncity-taxonomy-plan');
  const existing = { _id: 'cashew1', name: 'Cashew Nuts', slug: 'cashew-nuts', parent: 'snacks1' };
  assert.equal(planTaxonomy({ ...base, subcategories: [...base.subcategories, existing] }).creates.length, 0);
  assert.throws(() => planTaxonomy({ ...base, subcategories: [...base.subcategories, { ...existing, parent: 'other1' }] }), /parent/);
  assert.throws(() => planTaxonomy({ ...base, categories: [] }), /Missing/);
});
