'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('one-kobo allocations partition canonical merchandise, tax and financial shortfall exactly',()=>{
 const {allocationComponents}=require('../services/venue/multiple-allocations');const snapshot={totalMinor:10,taxMinor:4,financialLines:[{amountMinor:4}]};const totals={taxMinor:0,financialMinor:0,merchandiseMinor:0};
 for(let paid=0;paid<10;paid++){
  const shares=allocationComponents(snapshot,1,paid);assert.equal(Object.values(shares).reduce((a,b)=>a+b,0),1);
  for(const key of Object.keys(totals)){assert.ok(shares[key]>=0);totals[key]+=shares[key];}
 }
 assert.deepEqual(totals,{taxMinor:4,financialMinor:4,merchandiseMinor:2});
});
