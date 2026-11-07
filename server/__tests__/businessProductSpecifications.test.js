const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeFacts, applyBriefToProduct } = require('../services/productResearch.service');
const Product = require('../models/Product');
test('research preserves non-beverage specifications and strips unknown keys', () => {
  const facts = sanitizeFacts({ specifications: { material: 'Oak', dimensions: '80 × 40 cm', admin: 'true' } });
  assert.deepEqual(facts.specifications, { material: 'Oak', dimensions: '80 × 40 cm' });
});
test('unsourced specifications cannot survive full-product generation', () => {
  const { data } = applyBriefToProduct({ type: 'home_furniture', specifications: { material: 'Gold' } }, { facts: {} });
  assert.deepEqual(data.specifications, {});
});
test('verified specifications are limited to the selected business', () => {
  const { data } = applyBriefToProduct({ type: 'home_furniture' }, { facts: { specifications: { material: 'Oak', processor: 'Invented chip' } } });
  assert.deepEqual(data.specifications, { material: 'Oak' });
});
test('Product retains bounded specifications', () => {
  const product = new Product({ name: 'Desk', type: 'home_furniture', specifications: { material: 'Oak', invented: 'x' } });
  assert.equal(product.toObject().specifications.material, 'Oak');
  assert.equal(product.toObject().specifications.invented, undefined);
});
test('client and server specification registries stay identical', () => {
  assert.deepEqual(require('../constants/businessSpecifications.json'), require('../../client/apps/admin/src/utils/business-specifications.json'));
});
test('research discards specifications without actual search sources', async () => {
  const {researchProduct,clearResearchCache} = require('../services/productResearch.service');
  clearResearchCache();
  const client={messages:{stream:()=>({finalMessage:async()=>({content:[{type:'text',text:JSON.stringify({found:true,specifications:{material:'Oak'}})}]})})}};
  const brief=await researchProduct({name:'Unverified desk',type:'home_furniture'},{client});
  assert.equal(brief.found,false);
  assert.equal(brief.facts.specifications,undefined);
});
