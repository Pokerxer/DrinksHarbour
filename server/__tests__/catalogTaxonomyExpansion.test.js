const {test}=require('node:test');
const assert=require('node:assert/strict');
const Product=require('../models/Product');
const Category=require('../models/Category');
const types=require('../constants/productTypes');
const values=['syrup','flavoured_syrup','fruit_syrup','sugar_free_syrup','fruit_puree','fruit_mix','juice_concentrate','beverage_concentrate','cocktail_mix','dessert_sauce','frappe_mix','malt_drink','palm_wine','rice_wine','shochu','baijiu','cordial','shrub'];
test('new catalog types are valid and retain beverage volume fields',async()=>{
 for(const type of values){
  const doc=new Product({name:'Catalog taxonomy test',slug:'taxonomy-test',type,volumeMl:700});
  await doc.validate();
  assert.ok(types.PRODUCT_TYPE_VALUES.includes(type),type);
  assert.equal(types.isBeverageType(type),true,type);
  assert.equal(doc.volumeMl,700,type);
  assert.ok(types.getCategoryForType(type),type);
 }
});
test('new types preserve alcohol group distinctions',()=>{
 for(const type of ['palm_wine','rice_wine','shochu','baijiu']) assert.equal(types.isAlcoholicType(type),true,type);
 for(const type of ['fruit_mix','fruit_syrup','malt_drink','juice_concentrate']) assert.equal(types.isAlcoholicType(type),false,type);
});
test('new taxonomy validates and has unique slugs',async()=>{
 const {categories,subcategories}=require('../data/catalog-taxonomy-expansion');
 assert.equal(categories.length,4);
 assert.equal(new Set(subcategories.map(s=>s.slug)).size,subcategories.length);
 for(const c of categories) await new Category({...c,status:'published'}).validate();
});
test('exact reviewed products never infer unknown names or IDs',()=>{
 const {reviewedProducts,findClassification}=require('../data/catalog-taxonomy-products');
 assert.ok(reviewedProducts.length>=30);
 assert.equal(new Set(reviewedProducts.map(p=>p.id)).size,reviewedProducts.length);
 assert.throws(()=>findClassification('000000000000000000000000','Monin Kiwi Syrup'),/Unreviewed/);
 const kiwi=reviewedProducts.find(p=>p.name==='Monin Kiwi Syrup');
 assert.equal(findClassification(kiwi.id,kiwi.name).type,'fruit_syrup');
 assert.throws(()=>findClassification(kiwi.id,'Renamed unexpectedly'),/Unreviewed/);
});

test('new non-alcoholic type defaults do not mark ingredients as alcoholic',async()=>{
 for(const type of ['fruit_syrup','fruit_mix','juice_concentrate','malt_drink']) {
  const doc=new Product({name:'New ingredient',slug:'new-ingredient',type,volumeMl:700});
  await doc.validate();assert.equal(doc.isAlcoholic,false,type);
 }
});
