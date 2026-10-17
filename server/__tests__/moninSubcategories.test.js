const { test } = require('node:test');
const assert = require('node:assert/strict');
const { entries, reviewedProducts, classifyProduct } = require('../data/monin-subcategories');
const Product = require('../models/Product');
const SubCategory = require('../models/SubCategory');
test('all 23 reviewed Monin products have schema-supported classifications', () => {
  assert.equal(reviewedProducts.length, 23);
  assert.equal(new Set(reviewedProducts.map(p => p.id)).size, 23);
  for (const p of reviewedProducts) assert.ok(Product.schema.path('type').enumValues.includes(classifyProduct(p.name).type));
});
test('Le Fruit is separate from Le Sirop and Curaçao syrup from liqueur', () => {
  assert.equal(classifyProduct('Le Fruit De Monin Mango Aromes Naturels').slug, 'fruit-purees-mixes');
  assert.equal(classifyProduct('Le Sirop de Monin Mango Aromes Naturels').parent, 'syrup');
  assert.equal(classifyProduct('Le Sirop de Monin Blue Curacao Aromes Naturels').slug, 'fruit-syrups');
  assert.equal(classifyProduct('Blue Curaçao Liqueur Monin').slug, 'triple-sec-orange-liqueurs');
});
test('Rantcho is a lemon concentrate, Kiwi syrup is not sour mix, and cane sugar is simple syrup', () => {
  assert.deepEqual(classifyProduct('Le Sirop de Monin Lemon Rantcho'), {parent:'cocktail-mixers',slug:'lemon-juice-concentrates',type:'mixer'});
  assert.equal(classifyProduct('Monin Kiwi Syrup').slug, 'fruit-syrups');
  assert.equal(classifyProduct('Monin Kiwi Syrup').type, 'simple_syrup');
  assert.equal(classifyProduct('Le Sirop de Monin Cane Sugar').slug, 'simple-syrup');
  assert.throws(() => classifyProduct('Monin Unknown Syrup'), /Unreviewed/);
});
test('new reusable subcategories validate without brand-specific category names', async () => {
  assert.equal(entries.filter(e => e.create).length, 4);
  for(const e of entries.filter(e=>e.create)) {
    assert.doesNotMatch(e.name, /monin/i);
    await new SubCategory({name:e.name,slug:e.slug,parent:'69d1f1980aef5189677bf18e',shortDescription:e.blurb,status:'published'}).validate();
  }
});
