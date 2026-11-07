const test = require('node:test');
const assert = require('node:assert/strict');
const { planBeverageAssignment } = require('../utils/beverageTaxonomyAssignment');
test('assigns drink roots and descendants without changing unrelated taxonomy', () => {
  const categories = [{_id:'a',slug:'beer'}, {_id:'b',slug:'beauty-grooming'}, {_id:'c',slug:'child',parent:'a'}];
  const subs = [{_id:'s',parent:'a'}, {_id:'t',parent:'b'}, {_id:'u',parent:'c'}];
  const plan = planBeverageAssignment(categories,subs);
  assert.deepEqual(plan.categories.map(r=>r._id), ['a','c']);
  assert.deepEqual(plan.subcategories.map(r=>r._id), ['s','u']);
});
test('is idempotent and rejects explicit conflicting assignments', () => {
  assert.equal(planBeverageAssignment([{_id:'a',slug:'beer',industry:'beverage'}],[{_id:'s',parent:'a',industry:'beverage'}]).categories.length,0);
  assert.throws(()=>planBeverageAssignment([{_id:'a',slug:'beer',industry:'home'}],[]), /Conflicting/);
  assert.throws(()=>planBeverageAssignment([{_id:'a',slug:'beer'}],[{_id:'s',parent:'a',industry:'home'}]), /Conflicting/);
});
