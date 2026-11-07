'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {refundComponents}=require('../services/venue/refund-components');
test('one-kobo repeated partial refunds preserve disjoint merchandise, tax and shortfall totals',()=>{
 const original={appliedMinor:10,taxMinor:4,financialMinor:4};const totals={merchandiseMinor:0,taxMinor:0,financialMinor:0};
 for(let previous=0;previous<10;previous++){
  const shares=refundComponents(original,1,previous);
  assert.equal(shares.merchandiseMinor+shares.taxMinor+shares.financialMinor,1);
  for(const key of Object.keys(totals)){assert.ok(shares[key]>=0);totals[key]+=shares[key];}
 }
 assert.deepEqual(totals,{merchandiseMinor:2,taxMinor:4,financialMinor:4});
});
test('component refunds reject invalid original allocations and cumulative over-refunds',()=>{
 assert.throws(()=>refundComponents({appliedMinor:10,taxMinor:6,financialMinor:5},1,0),e=>e.code==='REFUND_SOURCE_REVIEW_REQUIRED');
 assert.throws(()=>refundComponents({appliedMinor:10,taxMinor:4,financialMinor:4},2,9),e=>e.code==='REFUND_EXCEEDS_RECEIPT');
});
