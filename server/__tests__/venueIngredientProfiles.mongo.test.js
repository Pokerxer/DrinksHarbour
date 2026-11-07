'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {connectVenueMongo,fixture,beverage}=require('./helpers/venueMongo');
test('ingredient profile authoring owns its stock identity and never infers allergens or cost',async t=>{
 await connectVenueMongo(t,'ingredient_profile');const scope=await fixture();await require('../services/venue/service-sessions').ensureIndexes();const stock=await beverage(scope);const other=await fixture();const foreign=await beverage(other);const api=require('../services/venue/ingredient-profiles');await require('../models/IngredientProfile').createIndexes();
 const input={subProductId:stock.subProductId,dimension:'mass',perishable:true,allergenSource:['gluten']};const first=await api.createProfile({...scope,input,idempotencyKey:'create'});const replay=await api.createProfile({...scope,input,idempotencyKey:'create'});assert.equal(first.id,replay.id);const list=await api.listProfiles(scope);assert.equal(list.items[0].subProductId,stock.subProductId);assert.equal(list.items[0].stockForms[0].id,stock.sizeId);assert.deepEqual(list.items[0].allergenSource,['gluten']);assert.equal(list.items[0].costPrice,undefined);
 await assert.rejects(api.createProfile({...scope,input:{...input,subProductId:foreign.subProductId},idempotencyKey:'foreign'}),e=>e.code==='NOT_FOUND');
});
