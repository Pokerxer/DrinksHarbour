const {test}=require('node:test');
const assert=require('node:assert/strict');
const SubCategory=require('../models/SubCategory');
test('whisky expansion covers eight existing spirit families without new roots',()=>{
 const {categories,subcategories}=require('../data/whisky-subcategories');
 assert.deepEqual(categories,[]);
 assert.deepEqual([...new Set(subcategories.map(s=>s.parent))].sort(),['scotch','bourbon','rye-whiskey','irish-whiskey','japanese-whisky','world-whisky','brandy','rum'].sort());
 assert.ok(subcategories.some(s=>s.parent==='scotch'&&s.slug==='blended-scotch-whisky'));
});
test('new whisky entries are unique and avoid known existing synonyms',()=>{
 const {subcategories}=require('../data/whisky-subcategories');
 assert.equal(new Set(subcategories.map(s=>s.slug)).size,subcategories.length);
 assert.equal(new Set(subcategories.map(s=>s.name.toLowerCase())).size,subcategories.length);
 for(const slug of ['single-cask-scotch','blended-malt-japanese-whisky','barrel-proof-bourbon','single-malt-scotch'])assert.ok(!subcategories.some(s=>s.slug===slug),slug);
});
test('subcategories validate and descriptions avoid specific strength or age claims',async()=>{
 const {subcategories}=require('../data/whisky-subcategories');
 for(const s of subcategories){
  await new SubCategory({name:s.name,slug:s.slug,parent:'69d1f1970aef5189677bf14c',shortDescription:s.blurb,status:'published'}).validate();
  assert.doesNotMatch(s.blurb,/\d+\s*(%|years?)/i);
 }
});
