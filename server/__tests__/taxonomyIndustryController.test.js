const test = require('node:test');
const assert = require('node:assert/strict');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const categories = require('../controllers/category.controller');
const subcategories = require('../controllers/subcategory.controller');
function response() { return { status() { return this; }, json(value) { this.body = value; return value; } }; }
const next = error => { throw error; };
test('category create persists the selected business and defaults legacy drinks', async t => {
  t.mock.method(Category.prototype, 'save', async function() { return this; });
  for (const [body, industry] of [[{name:'Champagne',slug:'champagne',type:'champagne'},'beverage'], [{name:'Lamps',slug:'lamps',type:'home',industry:'home'},'home']]) {
    const res = response();
    await categories.createCategory({body},res,next);
    assert.equal(res.body.data.category.industry,industry);
  }
});
test('category update persists an explicit business without resetting an omitted one', async t => {
  const updates=[];
  t.mock.method(Category,'findByIdAndUpdate',async (_id,data)=>{updates.push(data);return data;});
  await categories.updateCategory({params:{id:'id'},body:{industry:'beverage'}},response(),next);
  await categories.updateCategory({params:{id:'id'},body:{name:'New name'}},response(),next);
  assert.equal(updates[0].industry,'beverage');
  assert.equal(Object.hasOwn(updates[1],'industry'),false);
});
test('new subcategory inherits its parent business', async t => {
  t.mock.method(Category,'findById',()=>({select:()=>({lean:async()=>({industry:'beverage'})})}));
  t.mock.method(SubCategory.prototype,'save',async function(){return this;});
  const res=response();
  await subcategories.createSubCategory({body:{name:'Lager',slug:'lager',parent:'69d1f1970aef5189677bf137',industry:''}},res,next);
  assert.equal(res.body.data.subcategory.industry,'beverage');
});
