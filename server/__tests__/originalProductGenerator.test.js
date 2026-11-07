const { test, mock, after } = require('node:test');
const assert = require('node:assert/strict');
const research = require('../services/productResearch.service');
const sdkPath = require.resolve('@anthropic-ai/sdk');
const originalSdk = require.cache[sdkPath].exports;
const previousKey = process.env.ANTHROPIC_API_KEY;
process.env.ANTHROPIC_API_KEY = 'test-only';
let generated, prompt, facts;
require.cache[sdkPath].exports = class {
  messages = { create: async args => {
    prompt = args.messages[0].content;
    return { content: [{ type: 'text', text: JSON.stringify(generated) }] };
  } };
};
mock.method(research, 'researchProduct', async () => ({ found: true, facts, sources: [{url:'https://manufacturer.example/spec',title:'Specification'}], searchedAt:'2026-11-04' }));
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const query = data => ({select(){return this;}, populate(){return this;},lean:async()=>data});
mock.method(Category, 'find', () => query([{_id:'category1',name:'Furniture',industry:'home'}]));
mock.method(SubCategory, 'find', () => query([{_id:'sub1',name:'Chairs',parent:'category1',industry:'home'}]));
const { generateProductDetails, generateProductFromSubProducts } = require('../controllers/gemini.controller');
after(() => {
  require.cache[sdkPath].exports = originalSdk;
  if(previousKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previousKey;
  mock.restoreAll();
});
function call(handler, body, role='admin') {
  return new Promise((resolve,reject) => {
    const res = { status(){return this;},json:resolve };
    handler({body,user:{role}},res,reject);
  });
}
for (const [type,field,value] of [
  ['beauty_skincare','skinType','Dry skin'], ['home_furniture','material','Oak'],
  ['electronics_phone','memory','8 GB'], ['fashion_top','fabricComposition','100% cotton'],
  ['foodservice_equipment','capacity','20 L'], ['hospitality_venue_drinkware','packSize','100 units'],
]) test(`original generator returns sourced specifications for ${type}`, async () => {
  facts = {specifications:{[field]:value}};
  generated = {name:'Example',type,description:'Product description',abv:40,specifications:{[field]:'UNSOURCED'},metaTitle:'Example',metaDescription:'Recorded details'};
  const result = await call(generateProductDetails,{name:'Example',type});
  assert.equal(result.data.specifications[field],value);
  assert.equal(result.data.type,type);
  assert.equal(result.data.abv,0);
  assert.equal(result.data.metaDescription,'Recorded details');
  assert.match(prompt, /No beverage attributes/);
});
test('beverages retain verified ABV, volume and original full output',async()=>{
 facts={abv:40,volumeMl:700};generated={name:'Spirit',type:'whisky',description:'Whisky',tastingNotes:{nose:['oak']}};
 const result=await call(generateProductDetails,{name:'Spirit',type:'whisky'});
 assert.equal(result.data.abv,40);assert.equal(result.data.proof,80);assert.equal(result.data.volumeMl,700);
 assert.deepEqual(result.data.tastingNotes.nose,['oak']);
});
test('edit-header generator uses the same business flow and preserves identity',async()=>{
 mock.method(Product,'findById',()=>query({_id:'69d1f1970aef5189677bf137',name:'Chair',slug:'chair',type:'home_furniture'}));
 facts={specifications:{material:'Oak'}};generated={name:'Renamed',slug:'changed',type:'wine',description:'Chair'};
 const result=await call(generateProductFromSubProducts,{productId:'69d1f1970aef5189677bf137'});
 assert.equal(result.data.name,'Chair');assert.equal(result.data.slug,'chair');assert.equal(result.data.type,'home_furniture');assert.equal(result.data.specifications.material,'Oak');
});
test('tenant cannot invoke central edit-header generation',async()=>{
 await assert.rejects(call(generateProductFromSubProducts,{productId:'69d1f1970aef5189677bf137'},'tenant_admin'),/platform administrators/);
});
test('empty category suggestions do not select the first category',async()=>{
 facts={};generated={name:'Chair',type:'home_furniture',categoryName:'',subCategoryName:''};
 const result=await call(generateProductDetails,{name:'Chair',type:'home_furniture'});
 assert.equal(result.data.category,null);assert.equal(result.data.subCategory,null);
});
test('name-only generation classifies before matching business taxonomy', async () => {
  Category.find.mock.mockImplementation(() => query([
    {_id:'home',name:'Furniture',industry:'home'},
    {_id:'beauty',name:'Skincare',industry:'beauty'},
  ]));
  SubCategory.find.mock.mockImplementation(() => query([
    {_id:'chairs',name:'Chairs',parent:'home',industry:'home'},
    {_id:'serum',name:'Face Serums',parent:'beauty',industry:'beauty'},
  ]));
  facts = {};
  generated = {name:'Chair',type:'home_furniture',categoryName:'Skincare',subCategoryName:'Face Serums'};
  const result = await call(generateProductDetails, {name:'Chair'});
  assert.equal(result.data.type, 'home_furniture');
  assert.equal(result.data.category, null);
  assert.match(prompt, /Furniture/);
  assert.doesNotMatch(prompt, /Skincare|Face Serums/);
});
