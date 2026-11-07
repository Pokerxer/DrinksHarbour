'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),dto=require('../services/merchantFulfillment/refundView');
test('refund DTO retains immutable own unit ranges while stripping nested private settlement metadata',()=>{
 const view=dto({_id:'saved-refund',amountMinor:500,fulfillmentVersion:2,provider:'stripe',unitRanges:[{
   line:'aaaaaaaaaaaaaaaaaaaaaaaa',privateCost:123,providerReceipt:'private',ranges:[{start:1,quantity:2,costMinor:456,refundProviderKey:'private'}],
 }]});
 assert.deepEqual(view.unitRanges,[{line:'aaaaaaaaaaaaaaaaaaaaaaaa',ranges:[{start:1,quantity:2}]}]);
 assert.equal(view.fulfillmentVersion,2);assert.equal(view.amountMinor,500);assert.equal(view.provider,undefined);
});
test('legacy refund DTO does not invent quantity fields',()=>{
 assert.deepEqual(dto({_id:'v1',state:'reserved',commissionMinor:50}),{_id:'v1',state:'reserved'});
});
