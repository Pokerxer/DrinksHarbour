const {test}=require('node:test');
const assert=require('node:assert/strict');
test('the renamed Kiwi syrup retains its exact ID and correct syrup taxonomy',()=>{
 const {reviewedProducts,classifyProduct}=require('../data/monin-kiwi-taxonomy-repair');
 assert.equal(reviewedProducts.length,23);
 const kiwi=reviewedProducts.find(p=>p.id==='6ac609195a9646ade2908018');
 assert.equal(kiwi.name,'Le Sirop de Monin Kiwi');
 assert.deepEqual(classifyProduct(kiwi.name),{parent:'syrup',slug:'fruit-syrups',type:'simple_syrup'});
 assert.throws(()=>classifyProduct('Monin Unknown Syrup'),/Unreviewed/);
});
