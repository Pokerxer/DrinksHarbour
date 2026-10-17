const {test}=require('node:test');
const assert=require('node:assert/strict');
const Product=require('../models/Product');
const types=require('../constants/productTypes');
test('general product types distinguish drinks from equipment, snacks and gifts',async()=>{
 const {generalTypes}=require('../constants/generalProductTypes');
 assert.equal(generalTypes.length,32);
 for(const t of generalTypes){
  assert.ok(types.PRODUCT_TYPE_VALUES.includes(t.value),t.value);
  assert.equal(types.isBeverageType(t.value),t.beverage,t.value);
  assert.equal(types.isAlcoholicType(t.value),t.alcoholic,t.value);
  assert.ok(types.getCategoryForType(t.value),t.value);
  const p=new Product({name:'General type test',slug:'general-type-test',type:t.value,volumeMl:700,abv:40,isAlcoholic:t.alcoholic});
  await p.validate();
  if(!t.beverage){assert.equal(p.volumeMl,undefined,t.value);assert.equal(p.abv,undefined,t.value);assert.equal(p.isAlcoholic,false);}
 }
});
test('equipment and snacks receive suitable unit/weight sizes rather than bottles',()=>{
 assert.deepEqual(types.getSizesForType('coffee_equipment'),['unit-single']);
 assert.ok(types.getSizesForType('snack_mix').some(s=>s.includes('g')));
});
test('new general taxonomy has unique names/slugs and valid category documents',async()=>{
 const {categories,subcategories}=require('../data/general-taxonomy-expansion');
 const Category=require('../models/Category'),SubCategory=require('../models/SubCategory');
 assert.equal(categories.length,4);assert.ok(subcategories.length>=60);
 assert.equal(new Set(subcategories.map(s=>s.slug)).size,subcategories.length);
 for(const c of categories)await new Category({...c,status:'published'}).validate();
 for(const s of subcategories)await new SubCategory({name:s.name,slug:s.slug,parent:'69d1f1970aef5189677bf137',shortDescription:s.blurb,status:'published'}).validate();
});
