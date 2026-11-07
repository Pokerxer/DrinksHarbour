const {test}=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const SubCategory=require('../models/SubCategory');
test('German wine additions reuse four published wine families and have unique identities',()=>{
 const {categories,subcategories}=require('../data/german-wine-subcategories');
 assert.deepEqual(categories,[]);
 assert.equal(subcategories.length,48);
 assert.equal(new Set(subcategories.map(s=>s.slug)).size,48);
 assert.equal(new Set(subcategories.map(s=>s.name.toLowerCase())).size,48);
 assert.deepEqual([...new Set(subcategories.map(s=>s.parent))].sort(),['red-wine','white-wine','rose-wine','sparkling-wine'].sort());
 for(const slug of ['riesling','pinot-noir','pinot-grigio','sekt','icewine'])assert.ok(!subcategories.some(s=>s.slug===slug),slug);
});
test('German wine definitions include all six Riesling predicates without equating ripeness and sweetness',()=>{
 const {subcategories}=require('../data/german-wine-subcategories');
 for(const predicate of ['kabinett','spatlese','auslese','beerenauslese','trockenbeerenauslese','eiswein'])
  assert.ok(subcategories.some(s=>s.slug==='german-riesling-'+predicate),predicate);
 for(const predicate of ['kabinett','spatlese','auslese'])
  assert.match(subcategories.find(s=>s.slug==='german-riesling-'+predicate).blurb,/sweetness.*separately/i);
});
test('every new German subcategory validates against the real schema',async()=>{
 const {subcategories}=require('../data/german-wine-subcategories');
 for(const entry of subcategories){
  assert.match(entry.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  await new SubCategory({name:entry.name,slug:entry.slug,parent:new mongoose.Types.ObjectId(),parentPath:entry.parent,type:entry.slug,status:'published',shortDescription:entry.blurb}).validate();
 }
});
