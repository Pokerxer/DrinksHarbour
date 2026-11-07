'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {connectVenueMongo,fixture,beverage}=require('./helpers/venueMongo');
test('serving availability stays unavailable without reviewed physical configuration',async t=>{
 await connectVenueMongo(t,'availability');const scope=await fixture();const item=await beverage(scope);
 const api=require('../services/venue/serving-availability');
 const result=await api.getServingAvailability({...scope,servingSnapshot:{subProductId:item.subProductId,sizeId:item.sizeId,mode:'made_to_order'},at:new Date('2026-10-30T12:00:00Z')});
 assert.deepEqual(result,{available:false,asOf:'2026-10-30T12:00:00.000Z',reason:'not_configured'});
 assert.equal(JSON.stringify(result).includes('cost'),false);
});
