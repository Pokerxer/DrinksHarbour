const test = require('node:test');
const assert = require('node:assert/strict');
const { categoryIndustryForCreate, subcategoryIndustryForWrite } = require('../utils/taxonomyIndustryWrite');
test('new legacy beverage categories default to Beverages', () => {
  assert.equal(categoryIndustryForCreate({type:'champagne'}), 'beverage');
  assert.equal(categoryIndustryForCreate({slug:'world-whisky',type:'other'}), 'beverage');
  assert.equal(categoryIndustryForCreate({type:'home',industry:'home'}), 'home');
  assert.equal(categoryIndustryForCreate({type:'other'}), undefined);
});
test('subcategory ownership follows parent and rejects conflicts', () => {
  assert.equal(subcategoryIndustryForWrite('', {industry:'beverage'}), 'beverage');
  assert.equal(subcategoryIndustryForWrite(undefined, {industry:'beverage'}), 'beverage');
  assert.throws(()=>subcategoryIndustryForWrite('home',{industry:'beverage'}), /parent/);
});
